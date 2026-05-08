import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Trash2 } from 'lucide-react';
import api from '../utils/api';
import { hasRole, formatDate } from '../utils/helpers';
import { useCurrency } from '../utils/currency';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const defaultLoan = {
  debtorId: '', principalAmount: '', firstInstallmentDate: '', monthlyInstallment: '',
  totalInstallments: '', securityDescription: '', purpose: '', notes: '',
  guarantors: [{ name: '', itsNumber: '', phone: '', address: '', email: '' }],
};

export default function LoansPage() {
  const { user } = useSelector((s) => s.auth);
  const isAdmin = hasRole(user, 'admin', 'accountant');
  const fmt = useCurrency();
  const navigate = useNavigate();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(defaultLoan);
  const [creating, setCreating] = useState(false);
  const [debtors, setDebtors] = useState([]);
  const [showDelete, setShowDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchLoans(); }, [page, statusFilter]);
  useEffect(() => { if (showCreate && isAdmin) fetchDebtors(); }, [showCreate]);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/loans?${params}`);
      setLoans(res.data.data.loans);
      setTotal(res.data.data.total);
      setTotalPages(res.data.data.totalPages);
    } catch { toast.error('Failed to load loans'); }
    finally { setLoading(false); }
  };

  const fetchDebtors = async () => {
    try {
      const res = await api.get('/profiles?type=debtors');
      setDebtors(res.data.data.debtors || []);
    } catch {}
  };

  const addGuarantor = () => setForm({ ...form, guarantors: [...form.guarantors, { name: '', itsNumber: '', phone: '', address: '', email: '' }] });
  const removeGuarantor = (i) => setForm({ ...form, guarantors: form.guarantors.filter((_, idx) => idx !== i) });
  const updateGuarantor = (i, field, val) => {
    const gs = [...form.guarantors];
    gs[i] = { ...gs[i], [field]: val };
    setForm({ ...form, guarantors: gs });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/loans/${showDelete.id}`);
      toast.success('Loan deleted');
      setShowDelete(null);
      fetchLoans();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete loan');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const debtorProfile = isAdmin ? form.debtorId : null;
      let debtorId = debtorProfile;
      if (!isAdmin) {
        const profRes = await api.get(`/users/${user.id}`);
        debtorId = profRes.data.data.debtor_id;
        if (!debtorId) {
          await api.post('/profiles/debtor', { userId: user.id });
          const profRes2 = await api.get(`/users/${user.id}`);
          debtorId = profRes2.data.data.debtor_id;
        }
      }
      await api.post('/loans', { ...form, debtorId });
      toast.success('Loan application submitted for approval');
      setShowCreate(false);
      setForm(defaultLoan);
      fetchLoans();
    } catch { toast.error('Failed to submit loan application'); }
    finally { setCreating(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Loan Applications</h1>
          <p className="page-subtitle">{total} total loans</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">+ New Application</button>
      </div>

      <div className="card">
        <div className="flex gap-3 mb-4">
          <select className="input-field max-w-xs" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {['pending', 'under_review', 'approved', 'active', 'completed', 'rejected', 'defaulted'].map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
        </div>

        {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Loan #</th><th>Debtor</th><th>Amount</th><th>Installment</th>
                    <th>Outstanding</th><th>Next Due</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((l) => (
                    <tr key={l.id}>
                      <td className="font-mono text-xs font-semibold">{l.loan_number}</td>
                      <td>
                        <div>
                          <p className="font-medium text-sm">{l.debtor_name}</p>
                          <p className="text-xs text-dark-400">{l.debtor_its}</p>
                        </div>
                      </td>
                      <td className="font-semibold">{fmt(l.principal_amount)}</td>
                      <td>{fmt(l.monthly_installment)}/mo</td>
                      <td className={l.is_overdue ? 'text-red-600 font-semibold' : ''}>{fmt(l.outstanding_balance)}</td>
                      <td className={l.is_overdue ? 'text-red-600' : ''}>{formatDate(l.next_due_date)}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={l.status} />
                          {l.is_overdue && <span className="badge badge-red text-xs">Overdue</span>}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link to={`/loans/${l.id}`} className="text-primary-800 hover:underline text-sm">View</Link>
                          {isAdmin && (
                            <button onClick={() => setShowDelete(l)} className="text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {loans.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-dark-400">No loans found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Loan Application" size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="btn-outline">Cancel</button>
            <button onClick={handleCreate} disabled={creating} className="btn-primary">
              {creating ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreate} className="space-y-5">
          {isAdmin && (
            <div>
              <label className="input-label">Select Debtor *</label>
              <select className="input-field" required value={form.debtorId} onChange={(e) => setForm({ ...form, debtorId: e.target.value })}>
                <option value="">Choose debtor...</option>
                {debtors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.its_number}) — {d.debtor_number}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Principal Amount *</label>
              <input type="number" className="input-field" required min="1000" value={form.principalAmount}
                onChange={(e) => setForm({ ...form, principalAmount: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Monthly Installment *</label>
              <input type="number" className="input-field" required min="100" value={form.monthlyInstallment}
                onChange={(e) => setForm({ ...form, monthlyInstallment: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Total Installments *</label>
              <input type="number" className="input-field" required min="1" max="120" value={form.totalInstallments}
                onChange={(e) => setForm({ ...form, totalInstallments: e.target.value })} />
            </div>
            <div>
              <label className="input-label">First Installment Date *</label>
              <input type="date" className="input-field" required value={form.firstInstallmentDate}
                onChange={(e) => setForm({ ...form, firstInstallmentDate: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="input-label">Security Description</label>
            <input className="input-field" placeholder="e.g., Gold jewelry, Property documents" value={form.securityDescription}
              onChange={(e) => setForm({ ...form, securityDescription: e.target.value })} />
          </div>
          <div>
            <label className="input-label">Purpose</label>
            <textarea className="input-field" rows={2} value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </div>

          {/* Guarantors */}
          <div className="border border-dark-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-dark-800">Guarantors</h4>
              <button type="button" onClick={addGuarantor} className="btn-outline btn-sm">+ Add Guarantor</button>
            </div>
            {form.guarantors.map((g, i) => (
              <div key={i} className="border border-dark-100 rounded-lg p-3 mb-3 last:mb-0 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium text-dark-700">Guarantor {i + 1}</p>
                  {form.guarantors.length > 1 && (
                    <button type="button" onClick={() => removeGuarantor(i)} className="text-red-500 text-sm hover:underline">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="input-label text-xs">Full Name *</label><input className="input-field" required value={g.name} onChange={(e) => updateGuarantor(i, 'name', e.target.value)} /></div>
                  <div><label className="input-label text-xs">ITS Number</label><input className="input-field" value={g.itsNumber} onChange={(e) => updateGuarantor(i, 'itsNumber', e.target.value)} /></div>
                  <div><label className="input-label text-xs">Phone *</label><input className="input-field" required value={g.phone} onChange={(e) => updateGuarantor(i, 'phone', e.target.value)} /></div>
                  <div><label className="input-label text-xs">Email</label><input type="email" className="input-field" value={g.email} onChange={(e) => updateGuarantor(i, 'email', e.target.value)} /></div>
                  <div className="sm:col-span-2"><label className="input-label text-xs">Address *</label><input className="input-field" required value={g.address} onChange={(e) => updateGuarantor(i, 'address', e.target.value)} /></div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="input-label">Additional Notes</label>
            <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Delete Loan"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowDelete(null)} className="btn-outline">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger">
              {deleting ? 'Deleting...' : 'Delete Loan'}
            </button>
          </div>
        }
      >
        <p>Delete loan <strong>{showDelete?.loan_number}</strong>?</p>
        <p className="text-sm text-dark-400 mt-1">Debtor: {showDelete?.debtor_name}</p>
        <p className="text-sm text-dark-400">Amount: {showDelete?.principal_amount ? fmt(showDelete.principal_amount) : ''}</p>
        {showDelete && !['pending', 'under_review', 'rejected'].includes(showDelete.status) && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-2">
            This loan has status <strong>{showDelete.status}</strong>. Associated transactions and ledger entries will be unlinked but not deleted.
          </p>
        )}
        <p className="text-sm text-red-600 mt-2">This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
