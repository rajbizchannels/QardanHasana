import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useDropzone } from 'react-dropzone';
import { FileText, Image, Paperclip, Upload, Download, AlertTriangle, Trash2 } from 'lucide-react';
import api from '../utils/api';
import { hasRole, formatDateTime } from '../utils/helpers';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const DOC_TYPES = [
  { value: 'cash_receipt', label: 'Cash Receipt' },
  { value: 'bank_transaction_receipt', label: 'Bank Transaction Receipt' },
  { value: 'others', label: 'Others' },
];

export default function DocumentsPage() {
  const { user } = useSelector((s) => s.auth);
  const isAdmin = hasRole(user, 'admin', 'accountant');
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ documentType: 'cash_receipt', description: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showDelete, setShowDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchDocs(); }, [page, statusFilter]);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/documents?${params}`);
      setDocs(res.data.data.documents);
      setTotal(res.data.data.total);
      setTotalPages(res.data.data.totalPages);
    } catch { toast.error('Failed to load documents'); }
    finally { setLoading(false); }
  };

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1,
  });

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', uploadForm.documentType);
      formData.append('description', uploadForm.description);
      await api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Document uploaded and submitted for approval');
      setShowUpload(false);
      setFile(null);
      setUploadForm({ documentType: 'cash_receipt', description: '' });
      fetchDocs();
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/documents/${showDelete.id}`);
      toast.success('Document deleted');
      setShowDelete(null);
      fetchDocs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (id, name) => {
    try {
      const res = await api.get(`/documents/${id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const fileIcon = (mime) => {
    if (mime?.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (mime?.includes('image')) return <Image className="w-5 h-5 text-blue-500" />;
    return <Paperclip className="w-5 h-5 text-dark-400" />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Documents</h1>
          <p className="page-subtitle">{total} documents • PDF, JPG, PNG only</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary">+ Upload Document</button>
      </div>

      <div className="card">
        <div className="flex gap-3 mb-4">
          {['', 'pending', 'approved', 'rejected'].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-primary-900 text-white' : 'bg-dark-100 text-dark-600 hover:bg-dark-200'}`}>
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>

        {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>File</th><th>Type</th>
                    {isAdmin && <th>Uploaded By</th>}
                    <th>Description</th><th>Date</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span>{fileIcon(d.mime_type)}</span>
                          <div>
                            <p className="text-sm font-medium truncate max-w-32">{d.original_name}</p>
                            <p className="text-xs text-dark-400">{d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-blue text-xs">{d.document_type?.replace(/_/g, ' ')}</span></td>
                      {isAdmin && <td className="text-xs">{d.user_name}<br/><span className="text-dark-400">{d.its_number}</span></td>}
                      <td className="text-xs text-dark-500 max-w-xs truncate">{d.description || '—'}</td>
                      <td className="text-xs">{formatDateTime(d.created_at)}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleDownload(d.id, d.original_name)} className="text-primary-800 hover:underline text-sm flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Download</button>
                          {(isAdmin || d.user_id === user.id) && (
                            <button onClick={() => setShowDelete(d)} className="text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {docs.length === 0 && (
                    <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-dark-400">No documents found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Upload Modal */}
      <Modal isOpen={showUpload} onClose={() => { setShowUpload(false); setFile(null); }} title="Upload Document"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowUpload(false); setFile(null); }} className="btn-outline">Cancel</button>
            <button onClick={handleUpload} disabled={uploading || !file} className="btn-primary">
              {uploading ? 'Uploading...' : 'Upload & Submit'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="input-label">Document Type *</label>
            <select className="input-field" required value={uploadForm.documentType}
              onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value })}>
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Description</label>
            <input className="input-field" placeholder="Brief description of this document" value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })} />
          </div>

          {/* Dropzone */}
          <div>
            <label className="input-label">File * (PDF, JPG, PNG — max 10MB)</label>
            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary-700 bg-primary-50' : 'border-dark-200 hover:border-primary-700 hover:bg-dark-50'}`}>
              <input {...getInputProps()} />
              {file ? (
                <div>
                  <div className="flex justify-center mb-2">{fileIcon(file.type)}</div>
                  <p className="font-medium text-dark-800">{file.name}</p>
                  <p className="text-xs text-dark-400">{(file.size / 1024).toFixed(1)} KB</p>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-red-500 text-xs mt-1 hover:underline">Remove</button>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-dark-300 mx-auto mb-2" />
                  <p className="text-dark-600 font-medium">{isDragActive ? 'Drop file here' : 'Drag & drop or click to browse'}</p>
                  <p className="text-xs text-dark-400 mt-1">Accepts PDF, JPG, PNG up to 10MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-800">Uploaded documents will be reviewed by the accountant before being posted to your ledger.</p>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Delete Document"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowDelete(null)} className="btn-outline">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger">
              {deleting ? 'Deleting...' : 'Delete Document'}
            </button>
          </div>
        }
      >
        <p>Delete <strong>{showDelete?.original_name}</strong>?</p>
        <p className="text-sm text-dark-400 mt-1">Type: {showDelete?.document_type?.replace(/_/g, ' ')}</p>
        <p className="text-sm text-red-600 mt-2">The file will be permanently removed from the server.</p>
      </Modal>
    </div>
  );
}
