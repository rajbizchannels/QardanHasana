import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../utils/api';
import { hasRole, formatDateTime } from '../utils/helpers';
import { useCurrency } from '../utils/currency';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const TXN_TYPES = ['loan_disbursement', 'loan_repayment', 'deposit', 'withdrawal', 'transfer', 'adjustment'];

const ACCOUNT_CONFIG = {
  loan_disbursement: { from: 'creditor', to: 'debtor',   fromLabel: 'From (Creditor)',  toLabel: 'To (Debtor)'    },
  loan_repayment:    { from: 'debtor',   to: 'creditor', fromLabel: 'From (Debtor)',    toLabel: 'To (Creditor)'  },
  deposit:           { from: 'creditor', to: 'creditor',  fromLabel: 'From (Creditor)',  toLabel: 'To (Creditor)'  },
  withdrawal:        { from: 'creditor', to: 'creditor',  fromLabel: 'From (Creditor)',  toLabel: 'To (Creditor)'  },
  transfer:          { from: 'both',     to: 'both',      fromLabel: 'From',             toLabel: 'To'             },
  adjustment:        { from: 'both',     to: 'both',      fromLabel: 'From (optional)',   toLabel: 'To (optional)'  },
};

const EMPTY_FORM = { type: 'loan_repayment', amount: '', description: '', fromAccountId: '', toAccountId: '', loanId: '', bankReference: '', notes: '', valueDate: '', maturityDate: '' };

export default function TransactionsPage() {
  const { user } = useSelector((s) => s.auth);
  const isAdmin = hasRole(user, 'admin', 'accountant');
  const fmt = useCurrency();
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ status: '', type: '', startDate: '', endDate: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(null);
  const [showEdit, setShowEdit] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loans, setLoans] = useState([]);
  const [creditors, setCreditors] = useState([]);
  const [debtors, setDebtors] = useState([]);

  useEffect(() => { fetchTxns(); }, [page, filters]);

  const fetchTxns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
      const res = await api.get(`/transactions?${params}`);
      setTxns(res.data.data.transactions);
      setTotal(res.data.data.total);
      setTotalPages(res.data.data.totalPages);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoading(false); }
  };

  const loadFormData = async () => {
    try {
      api.get('/loans?status=active&limit=100').then(r => setLoans(r.data.data.loans || [])).catch(() => {});
    } catch {}
    try {
      const r = await api.get('/profiles/for-select');
      const c = r.data?.data?.creditors || [];
      const d = r.data?.data?.debtors || [];
      setCreditors(c);
      setDebtors(d);
      if (c.length === 0 && d.length === 0) {
        toast('No creditor or debtor profiles found. Create them in the Accounts section first.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error('profiles/for-select failed:', err?.response?.status, err?.response?.data || err.message);
      toast.error(`Failed to load profiles: ${err?.response?.data?.message || err.message}`);
    }
  };

  const openCreate = async () => {
    setShowCreate(true);
    await loadFormData();
  };

  const openEdit = async (txn) => {
    setEditForm({
      type: txn.type,
      amount: txn.amount,
      description: txn.description || '',
      fromAccountId: txn.from_account_id || '',
      toAccountId: txn.to_account_id || '',
      loanId: txn.loan_id || '',
      bankReference: txn.bank_reference || '',
      notes: txn.notes || '',
      valueDate: txn.value_date ? txn.value_date.split('T')[0] : '',
      maturityDate: txn.maturity_date ? txn.maturity_date.split('T')[0] : '',
    });
    setShowEdit(txn);
    await loadFormData();
  };

  const handleTypeChange = (type) => {
    setForm(prev => ({ ...prev, type, fromAccountId: '', toAccountId: '' }));
  };

  const handleEditTypeChange = (type) => {
    setEditForm(prev => ({ ...prev, type, fromAccountId: '', toAccountId: '' }));
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/transactions/${showEdit.id}`, {
        type: editForm.type,
        amount: editForm.amount,
        description: editForm.description,
        fromAccountId: editForm.fromAccountId || null,
        toAccountId: editForm.toAccountId || null,
        loanId: editForm.loanId || null,
        bankReference: editForm.bankReference || null,
        notes: editForm.notes || null,
        valueDate: editForm.valueDate || null,
        maturityDate: editForm.maturityDate || null,
      });
      toast.success('Transaction updated');
      setShowEdit(null);
      fetchTxns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        type: form.type,
        amount: form.amount,
        description: form.description,
        fromAccountId: form.fromAccountId || null,
        toAccountId: form.toAccountId || null,
        loanId: form.loanId || null,
        bankReference: form.bankReference || null,
        notes: form.notes || null,
        valueDate: form.valueDate || null,
        maturityDate: form.maturityDate || null,
      };
      await api.post('/transactions', payload);
      toast.success(isAdmin ? 'Transaction created and posted to ledger' : 'Transaction submitted for approval');
      setShowCreate(false);
      setForm(EMPTY_FORM);
      fetchTxns();
    } catch { toast.error('Failed to create transaction'); }
    finally { setCreating(false); }
  };

  const handleApprove = async (id, action) => {
    try {
      await api.post(`/transactions/${id}/approve`, { action });
      toast.success(`Transaction ${action}d`);
      fetchTxns();
    } catch { toast.error('Action failed'); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      toast.success(isAdmin ? 'Transaction deleted' : 'Deletion request submitted');
      setShowDelete(null);
      fetchTxns();
    } catch { toast.error('Failed to delete transaction'); }
  };

  const typeLabel = (t) => t?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';

  const config = ACCOUNT_CONFIG[form.type] || ACCOUNT_CONFIG.adjustment;

  const getOptions = (role) => {
    if (role === 'creditor') return creditors.map(c => ({ value: c.user_id, label: `${c.name} (${c.creditor_number || c.its_number})` }));
    if (role === 'debtor')   return debtors.map(d => ({ value: d.user_id, label: `${d.name} (${d.debtor_number || d.its_number})` }));
    return [
      ...creditors.map(c => ({ value: c.user_id, label: `${c.name} — Creditor (${c.creditor_number || c.its_number})` })),
      ...debtors.map(d => ({ value: d.user_id, label: `${d.name} — Debtor (${d.debtor_number || d.its_number})` })),
    ];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">{total} transactions</p>
        </div>
        <button onClick={openCreate} className="btn-primary">+ New Transaction</button>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 mb-4">
          <select className="input-field max-w-xs" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All Status</option>
            {['pending', 'approved', 'completed', 'rejected', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input-field max-w-xs" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
            <option value="">All Types</option>
            {TXN_TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </select>
          <input type="date" className="input-field max-w-xs" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
          <input type="date" className="input-field max-w-xs" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
        </div>

        {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Ref #</th><th>Type</th><th>From</th><th>To</th><th>Amount</th><th>Date</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {txns.map((t) => (
                    <tr key={t.id}>
                      <td className="font-mono text-xs font-semibold">{t.transaction_number}</td>
                      <td><span className="badge badge-blue text-xs">{typeLabel(t.type)}</span></td>
                      <td className="text-xs">{t.from_name || '—'}</td>
                      <td className="text-xs">{t.to_name || '—'}</td>
                      <td className="font-semibold">{fmt(t.amount)}</td>
                      <td className="text-xs">{formatDateTime(t.transaction_date)}</td>
                      <td><StatusBadge status={t.status} /></td>
                      <td>
                        <div className="flex items-center gap-1">
                          {isAdmin && t.status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(t.id, 'approve')} className="text-xs text-green-700 hover:underline">✓</button>
                              <button onClick={() => handleApprove(t.id, 'reject')} className="text-xs text-red-600 hover:underline">✗</button>
                            </>
                          )}
                          {isAdmin && !['cancelled', 'rejected'].includes(t.status) && (
                            <button onClick={() => openEdit(t)} className="text-xs text-primary-800 hover:underline ml-1">Edit</button>
                          )}
                          {t.status !== 'cancelled' && t.deleted_at === null && (
                            <button onClick={() => setShowDelete(t)} className="text-xs text-red-500 hover:underline ml-1">Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {txns.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-dark-400">No transactions found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setForm(EMPTY_FORM); }} title="New Transaction"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }} className="btn-outline">Cancel</button>
            <button onClick={handleCreate} disabled={creating} className="btn-primary">{creating ? 'Creating...' : 'Create Transaction'}</button>
          </div>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="input-label">Transaction Type *</label>
            <select className="input-field" required value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
              {TXN_TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </select>
          </div>

          {isAdmin && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {config.fromLabel && (
                  <div>
                    <label className="input-label">{config.fromLabel}</label>
                    <select className="input-field" value={form.fromAccountId}
                      onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })}
                      required={config.from && config.from !== 'both'}>
                      <option value="">Select...</option>
                      {getOptions(config.from).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                {config.toLabel && (
                  <div>
                    <label className="input-label">{config.toLabel}</label>
                    <select className="input-field" value={form.toAccountId}
                      onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}
                      required={config.to && config.to !== 'both'}>
                      <option value="">Select...</option>
                      {getOptions(config.to).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
              )}
              </div>
              {(creditors.length === 0 || debtors.length === 0) && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  {creditors.length === 0 && debtors.length === 0
                    ? 'No creditor or debtor profiles found.'
                    : creditors.length === 0 ? 'No creditor profiles found.'
                    : 'No debtor profiles found.'}
                  {' '}Go to <strong>Accounts</strong> to create them first.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="input-label">Amount *</label>
            <input type="number" className="input-field" required min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="input-label">Description *</label>
            <input className="input-field" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          {['loan_disbursement', 'loan_repayment'].includes(form.type) && (
            <div>
              <label className="input-label">Related Loan</label>
              <select className="input-field" value={form.loanId} onChange={(e) => setForm({ ...form, loanId: e.target.value })}>
                <option value="">Select loan...</option>
                {loans.map(l => <option key={l.id} value={l.id}>{l.loan_number} — {l.debtor_name} — {fmt(l.outstanding_balance)} outstanding</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Transaction Date</label>
              <input type="date" className="input-field" value={form.valueDate} onChange={(e) => setForm({ ...form, valueDate: e.target.value })} />
            </div>
            {form.type === 'deposit' && (
              <div>
                <label className="input-label">Maturity Date *</label>
                <input type="date" className="input-field" required value={form.maturityDate} onChange={(e) => setForm({ ...form, maturityDate: e.target.value })} />
              </div>
            )}
          </div>
          <div>
            <label className="input-label">Bank Reference</label>
            <input className="input-field" value={form.bankReference} onChange={(e) => setForm({ ...form, bankReference: e.target.value })} placeholder="UTR / NEFT / IMPS reference" />
          </div>
          <div>
            <label className="input-label">Notes</label>
            <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {!isAdmin && <div className="bg-yellow-50 border border-yellow-200 rounded p-3"><p className="text-xs text-yellow-800">This transaction will be submitted for admin approval before posting to ledger.</p></div>}
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!showEdit} onClose={() => setShowEdit(null)} title={`Edit Transaction — ${showEdit?.transaction_number}`}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowEdit(null)} className="btn-outline">Cancel</button>
            <button onClick={handleEdit} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        }
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="input-label">Transaction Type *</label>
            <select className="input-field" required value={editForm.type} onChange={(e) => handleEditTypeChange(e.target.value)}>
              {TXN_TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </select>
          </div>
          {(() => { const cfg = ACCOUNT_CONFIG[editForm.type] || ACCOUNT_CONFIG.adjustment; return (
            <div className="grid grid-cols-2 gap-3">
              {cfg.fromLabel && (
                <div>
                  <label className="input-label">{cfg.fromLabel}</label>
                  <select className="input-field" value={editForm.fromAccountId} onChange={(e) => setEditForm({ ...editForm, fromAccountId: e.target.value })} required={cfg.from && cfg.from !== 'both'}>
                    <option value="">Select...</option>
                    {getOptions(cfg.from).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
              {cfg.toLabel && (
                <div>
                  <label className="input-label">{cfg.toLabel}</label>
                  <select className="input-field" value={editForm.toAccountId} onChange={(e) => setEditForm({ ...editForm, toAccountId: e.target.value })} required={cfg.to && cfg.to !== 'both'}>
                    <option value="">Select...</option>
                    {getOptions(cfg.to).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          ); })()}
          <div>
            <label className="input-label">Amount *</label>
            <input type="number" className="input-field" required min="1" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
          </div>
          <div>
            <label className="input-label">Description *</label>
            <input className="input-field" required value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          </div>
          {['loan_disbursement', 'loan_repayment'].includes(editForm.type) && (
            <div>
              <label className="input-label">Related Loan</label>
              <select className="input-field" value={editForm.loanId} onChange={(e) => setEditForm({ ...editForm, loanId: e.target.value })}>
                <option value="">Select loan...</option>
                {loans.map(l => <option key={l.id} value={l.id}>{l.loan_number} — {l.debtor_name} — {fmt(l.outstanding_balance)} outstanding</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Transaction Date</label>
              <input type="date" className="input-field" value={editForm.valueDate} onChange={(e) => setEditForm({ ...editForm, valueDate: e.target.value })} />
            </div>
            {editForm.type === 'deposit' && (
              <div>
                <label className="input-label">Maturity Date *</label>
                <input type="date" className="input-field" value={editForm.maturityDate} onChange={(e) => setEditForm({ ...editForm, maturityDate: e.target.value })} />
              </div>
            )}
          </div>
          <div>
            <label className="input-label">Bank Reference</label>
            <input className="input-field" value={editForm.bankReference} onChange={(e) => setEditForm({ ...editForm, bankReference: e.target.value })} placeholder="UTR / NEFT / IMPS reference" />
          </div>
          <div>
            <label className="input-label">Notes</label>
            <textarea className="input-field" rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Delete Transaction"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowDelete(null)} className="btn-outline">Cancel</button>
            <button onClick={() => handleDelete(showDelete?.id)} className="btn-danger">{isAdmin ? 'Delete' : 'Request Deletion'}</button>
          </div>
        }
      >
        <p className="text-dark-600">
          {isAdmin
            ? `Are you sure you want to delete transaction ${showDelete?.transaction_number}?`
            : `Submit a deletion request for transaction ${showDelete?.transaction_number}? Admin approval required.`}
        </p>
        <p className="text-sm text-dark-400 mt-2">Amount: {fmt(showDelete?.amount)}</p>
      </Modal>
    </div>
  );
}
