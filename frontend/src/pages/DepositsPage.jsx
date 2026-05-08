import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Pencil, Trash2, Plus } from 'lucide-react';
import api from '../utils/api';
import { hasRole } from '../utils/helpers';
import { useCurrency } from '../utils/currency';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const STATUS_COLORS = { active: 'badge-blue', matured: 'badge-yellow', returned: 'badge-green' };

const EMPTY_FORM = { amount: '', depositDate: '', maturityDate: '', notes: '' };

export default function DepositsPage() {
  const { user } = useSelector((s) => s.auth);
  const isAccountant = hasRole(user, 'admin', 'accountant');
  const fmt = useCurrency();

  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const [showEdit, setShowEdit] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [showDelete, setShowDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchDeposits(); }, [page, statusFilter]);

  const fetchDeposits = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/profiles/deposits?${params}`);
      setDeposits(res.data.data.deposits);
      setTotal(res.data.data.total);
      setTotalPages(res.data.data.totalPages);
    } catch { toast.error('Failed to load deposits'); }
    finally { setLoading(false); }
  };

  const openEdit = (d) => {
    setShowEdit(d);
    setForm({
      amount: d.amount,
      depositDate: d.deposit_date ? d.deposit_date.split('T')[0] : '',
      maturityDate: d.maturity_date ? d.maturity_date.split('T')[0] : '',
      notes: d.notes || '',
    });
  };

  const handleSave = async () => {
    if (!form.amount || !form.maturityDate) { toast.error('Amount and maturity date are required'); return; }
    setSaving(true);
    try {
      await api.put(`/profiles/deposits/${showEdit.id}`, form);
      toast.success('Deposit updated');
      setShowEdit(null);
      fetchDeposits();
    } catch { toast.error('Failed to update deposit'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/profiles/deposits/${id}`, { status });
      toast.success(`Marked as ${status}`);
      fetchDeposits();
    } catch { toast.error('Failed to update status'); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/profiles/deposits/${showDelete.id}`);
      toast.success('Deposit deleted');
      setShowDelete(null);
      fetchDeposits();
    } catch { toast.error('Failed to delete deposit'); }
    finally { setDeleting(false); }
  };

  const today = new Date();
  const daysUntil = (d) => Math.ceil((new Date(d.maturity_date) - today) / 86400000);

  const overdue = deposits.filter(d => d.status === 'active' && daysUntil(d) < 0).length;
  const dueSoon = deposits.filter(d => d.status === 'active' && daysUntil(d) >= 0 && daysUntil(d) <= 7).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Creditor Deposits</h1>
          <p className="page-subtitle">{total} deposit record{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {(overdue > 0 || dueSoon > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {overdue > 0 && (
            <div className="card border-l-4 border-l-red-500 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-dark-400">Overdue Deposits</p>
                <p className="text-2xl font-bold text-red-700">{overdue}</p>
              </div>
            </div>
          )}
          {dueSoon > 0 && (
            <div className="card border-l-4 border-l-amber-500 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-dark-400">Due Within 7 Days</p>
                <p className="text-2xl font-bold text-amber-700">{dueSoon}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="flex gap-3 mb-4">
          {[
            { value: '', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'matured', label: 'Matured' },
            { value: 'returned', label: 'Returned' },
          ].map(({ value, label }) => (
            <button key={value} onClick={() => { setStatusFilter(value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === value ? 'bg-primary-900 text-white' : 'bg-dark-100 text-dark-600 hover:bg-dark-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Creditor</th>
                    <th>ITS</th>
                    <th>Amount</th>
                    <th>Deposit Date</th>
                    <th>Maturity Date</th>
                    <th>Due In</th>
                    <th>Status</th>
                    {isAccountant && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d) => {
                    const days = daysUntil(d);
                    const isOverdue = d.status === 'active' && days < 0;
                    const isDueSoon = d.status === 'active' && days >= 0 && days <= 7;
                    return (
                      <tr key={d.id} className={isOverdue ? 'bg-red-50' : isDueSoon ? 'bg-amber-50' : ''}>
                        <td>
                          <Link to={`/users/${d.user_id}`} className="font-medium text-primary-900 hover:underline">
                            {d.creditor_name}
                          </Link>
                          <p className="text-xs text-dark-400 font-mono">{d.creditor_number}</p>
                        </td>
                        <td className="font-mono text-xs">{d.its_number}</td>
                        <td className="font-semibold">{fmt(d.amount)}</td>
                        <td className="text-sm">
                          {d.deposit_date
                            ? new Date(d.deposit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className={`text-sm font-medium ${isOverdue ? 'text-red-700' : isDueSoon ? 'text-amber-700' : 'text-dark-800'}`}>
                          {new Date(d.maturity_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td>
                          {d.status === 'active' ? (
                            <span className={`text-sm font-medium ${isOverdue ? 'text-red-700' : isDueSoon ? 'text-amber-700' : 'text-dark-600'}`}>
                              {isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                            </span>
                          ) : <span className="text-dark-300 text-sm">—</span>}
                        </td>
                        <td>
                          <span className={`badge ${STATUS_COLORS[d.status] || 'badge-gray'}`}>
                            {d.status}
                          </span>
                        </td>
                        {isAccountant && (
                          <td>
                            <div className="flex items-center gap-1.5">
                              {d.status === 'active' && (
                                <button onClick={() => handleStatusChange(d.id, 'returned')}
                                  className="text-xs text-green-700 hover:underline whitespace-nowrap">
                                  Mark Returned
                                </button>
                              )}
                              <button onClick={() => openEdit(d)} className="p-1 text-dark-400 hover:text-dark-700">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setShowDelete(d)} className="p-1 text-dark-400 hover:text-red-600">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {deposits.length === 0 && (
                    <tr>
                      <td colSpan={isAccountant ? 8 : 7} className="text-center py-10 text-dark-400">
                        No deposits found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={!!showEdit} onClose={() => setShowEdit(null)} title="Edit Deposit"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowEdit(null)} className="btn-outline">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        }
      >
        {showEdit && (
          <div className="space-y-3">
            <p className="text-sm text-dark-500">Creditor: <span className="font-medium text-dark-800">{showEdit.creditor_name}</span></p>
            <div>
              <label className="input-label">Amount *</label>
              <input type="number" step="0.01" className="input-field" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Deposit Date</label>
                <input type="date" className="input-field" value={form.depositDate}
                  onChange={(e) => setForm({ ...form, depositDate: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Maturity Date *</label>
                <input type="date" className="input-field" value={form.maturityDate}
                  onChange={(e) => setForm({ ...form, maturityDate: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="input-label">Notes</label>
              <textarea className="input-field" rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Delete Deposit"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowDelete(null)} className="btn-outline">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        }
      >
        <p>Delete deposit of <strong>{showDelete ? fmt(showDelete.amount) : ''}</strong> for <strong>{showDelete?.creditor_name}</strong>?</p>
        <p className="text-sm text-red-600 mt-2">This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
