import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const PRIORITY_COLORS = { urgent: 'badge-red', high: 'badge-yellow', normal: 'badge-blue', low: 'badge-gray' };
const TYPE_ICONS = {
  transaction: '💳', loan: '📋', document: '📎', user_profile: '👤',
  account_deletion: '🗑️', transaction_deletion: '🗑️', user_creation: '👥',
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [stats, setStats] = useState({});
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [action, setAction] = useState('');

  useEffect(() => { fetchApprovals(); fetchStats(); }, [page, statusFilter]);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/approvals?${params}`);
      setApprovals(res.data.data.approvals);
      setTotal(res.data.data.total);
      setTotalPages(res.data.data.totalPages);
    } catch { toast.error('Failed to load approvals'); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/approvals/stats');
      setStats(res.data.data);
    } catch {}
  };

  const handleReview = async () => {
    setProcessing(true);
    try {
      await api.post(`/approvals/${selected.id}/review`, { action, notes });
      toast.success(`Request ${action}d successfully`);
      setSelected(null);
      setNotes('');
      fetchApprovals();
      fetchStats();
    } catch { toast.error('Failed to process approval'); }
    finally { setProcessing(false); }
  };

  const openAction = (approval, act) => {
    setSelected(approval);
    setAction(act);
    setNotes('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-subtitle">Review and process pending requests</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: stats.pending, color: 'border-l-yellow-500' },
          { label: 'Urgent Pending', value: stats.urgent_pending, color: 'border-l-red-600' },
          { label: 'Approved', value: stats.approved, color: 'border-l-green-600' },
          { label: 'Rejected', value: stats.rejected, color: 'border-l-gray-500' },
        ].map((s) => (
          <div key={s.label} className={`card border-l-4 ${s.color}`}>
            <p className="text-xs text-dark-400">{s.label}</p>
            <p className="text-2xl font-bold">{s.value || 0}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex gap-3 mb-4">
          {['pending', 'approved', 'rejected', ''].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-primary-900 text-white' : 'bg-dark-100 text-dark-600 hover:bg-dark-200'}`}>
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>

        {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
          <>
            <div className="space-y-3">
              {approvals.map((a) => (
                <div key={a.id} className="border border-dark-100 rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">{TYPE_ICONS[a.reference_type] || '📄'}</span>
                      <div>
                        <p className="font-semibold text-dark-900">{a.title}</p>
                        <p className="text-sm text-dark-500 mt-0.5">{a.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-dark-400">By: <span className="font-medium text-dark-600">{a.requested_by_name}</span> (ITS: {a.requested_by_its})</span>
                          <span className="text-dark-200">·</span>
                          <span className="text-xs text-dark-400">{formatDateTime(a.requested_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${PRIORITY_COLORS[a.priority] || 'badge-gray'} uppercase text-xs`}>{a.priority}</span>
                        <StatusBadge status={a.status} />
                      </div>
                      {a.status === 'pending' && (
                        <div className="flex gap-1.5">
                          <button onClick={() => openAction(a, 'approve')} className="btn-primary btn-sm text-xs">✓ Approve</button>
                          <button onClick={() => openAction(a, 'reject')} className="btn-danger btn-sm text-xs">✗ Reject</button>
                        </div>
                      )}
                      {a.status !== 'pending' && a.reviewed_by_name && (
                        <p className="text-xs text-dark-400">Reviewed by {a.reviewed_by_name}</p>
                      )}
                      {a.review_notes && <p className="text-xs text-dark-500 italic max-w-xs text-right">"{a.review_notes}"</p>}
                    </div>
                  </div>
                </div>
              ))}
              {approvals.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">✅</p>
                  <p className="text-dark-400">No {statusFilter} approvals</p>
                </div>
              )}
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Action Modal */}
      <Modal isOpen={!!selected && !!action} onClose={() => { setSelected(null); setAction(''); }}
        title={action === 'approve' ? '✓ Approve Request' : '✗ Reject Request'}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => { setSelected(null); setAction(''); }} className="btn-outline">Cancel</button>
            <button onClick={handleReview} disabled={processing}
              className={action === 'approve' ? 'btn-primary' : 'btn-danger'}>
              {processing ? 'Processing...' : action === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </div>
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="bg-dark-50 rounded-lg p-3">
              <p className="font-medium text-dark-800">{selected.title}</p>
              <p className="text-sm text-dark-500">{selected.description}</p>
            </div>
            <div>
              <label className="input-label">{action === 'approve' ? 'Notes (optional)' : 'Rejection Reason'}</label>
              <textarea className="input-field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={action === 'approve' ? 'Add any approval notes...' : 'Please provide reason for rejection...'}
                required={action === 'reject'} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
