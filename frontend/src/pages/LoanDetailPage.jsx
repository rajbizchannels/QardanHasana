import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../utils/api';
import { hasRole, formatDate, formatDateTime } from '../utils/helpers';
import { useCurrency } from '../utils/currency';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import DocumentsPage from './DocumentsPage';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

export default function LoanDetailPage() {
  const { id } = useParams();
  const { user } = useSelector((s) => s.auth);
  const isAdmin = hasRole(user, 'admin', 'accountant');
  const fmt = useCurrency();
  const navigate = useNavigate();
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApprove, setShowApprove] = useState(false);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [action, setAction] = useState('');

  useEffect(() => { fetchLoan(); }, [id]);

  const fetchLoan = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/loans/${id}`);
      setLoan(res.data.data);
    } catch { toast.error('Failed to load loan'); navigate('/loans'); }
    finally { setLoading(false); }
  };

  const handleAction = async () => {
    setProcessing(true);
    try {
      await api.put(`/loans/${id}`, { status: action === 'approve' ? 'approved' : 'rejected', rejectionReason: notes, notes });
      toast.success(`Loan ${action}d successfully`);
      setShowApprove(false);
      fetchLoan();
    } catch { toast.error('Action failed'); }
    finally { setProcessing(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!loan) return null;

  const progress = loan.total_installments > 0 ? (loan.paid_installments / loan.total_installments) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <Link to="/loans" className="text-sm text-dark-400 hover:text-dark-700 mb-1 block">← Loan Applications</Link>
          <h1 className="page-title">Loan {loan.loan_number}</h1>
          <p className="page-subtitle">Applied by {loan.debtor_name} (ITS: {loan.debtor_its})</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={loan.status} />
          {loan.is_overdue && <span className="badge badge-red">Overdue</span>}
          {isAdmin && ['pending', 'under_review'].includes(loan.status) && (
            <>
              <button onClick={() => { setAction('approve'); setShowApprove(true); }} className="btn-primary btn-sm">✓ Approve</button>
              <button onClick={() => { setAction('reject'); setShowApprove(true); }} className="btn-danger btn-sm">✗ Reject</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h3 className="text-primary-900 font-semibold mb-4 border-b pb-2">Loan Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div><p className="text-xs text-dark-400">Principal Amount</p><p className="font-bold text-lg text-primary-900">{fmt(loan.principal_amount)}</p></div>
              <div><p className="text-xs text-dark-400">Outstanding</p><p className="font-bold text-lg text-red-600">{fmt(loan.outstanding_balance)}</p></div>
              <div><p className="text-xs text-dark-400">Monthly Installment</p><p className="font-bold">{fmt(loan.monthly_installment)}</p></div>
              <div><p className="text-xs text-dark-400">Total Installments</p><p className="font-semibold">{loan.total_installments}</p></div>
              <div><p className="text-xs text-dark-400">Paid Installments</p><p className="font-semibold text-green-600">{loan.paid_installments}</p></div>
              <div><p className="text-xs text-dark-400">Remaining</p><p className="font-semibold">{loan.total_installments - loan.paid_installments}</p></div>
              <div><p className="text-xs text-dark-400">First Installment</p><p className="font-semibold">{formatDate(loan.first_installment_date)}</p></div>
              <div><p className="text-xs text-dark-400">Next Due Date</p><p className={`font-semibold ${loan.is_overdue ? 'text-red-600' : ''}`}>{formatDate(loan.next_due_date)}</p></div>
              <div><p className="text-xs text-dark-400">Last Payment</p><p className="font-semibold">{formatDate(loan.last_payment_date)}</p></div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-dark-500 mb-1">
                <span>Repayment Progress</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-dark-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary-800 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {loan.purpose && <div className="mt-3"><p className="text-xs text-dark-400">Purpose</p><p className="text-sm">{loan.purpose}</p></div>}
            {loan.security_description && <div className="mt-2"><p className="text-xs text-dark-400">Security</p><p className="text-sm">{loan.security_description}</p></div>}
            {loan.notes && <div className="mt-2"><p className="text-xs text-dark-400">Notes</p><p className="text-sm">{loan.notes}</p></div>}
          </div>

          {/* Guarantors */}
          <div className="card">
            <h3 className="text-primary-900 font-semibold mb-4 border-b pb-2">Guarantors ({loan.guarantors?.length || 0})</h3>
            {(loan.guarantors || []).map((g, i) => (
              <div key={i} className="border border-dark-100 rounded-lg p-3 mb-3 last:mb-0 grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-dark-400">Name</p><p className="font-medium">{g.name}</p></div>
                <div><p className="text-xs text-dark-400">ITS</p><p>{g.its_number || '—'}</p></div>
                <div><p className="text-xs text-dark-400">Phone</p><p>{g.phone}</p></div>
                <div><p className="text-xs text-dark-400">Email</p><p>{g.email || '—'}</p></div>
                <div className="col-span-2"><p className="text-xs text-dark-400">Address</p><p>{g.address}</p></div>
              </div>
            ))}
            {(!loan.guarantors || loan.guarantors.length === 0) && (
              <p className="text-dark-400 text-sm">No guarantors added</p>
            )}
          </div>

          {/* Transactions */}
          <div className="card">
            <h3 className="text-primary-900 font-semibold mb-4 border-b pb-2">Transaction History</h3>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Ref #</th><th>Type</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {(loan.transactions || []).map((t) => (
                    <tr key={t.id}>
                      <td className="font-mono text-xs">{t.transaction_number}</td>
                      <td><span className="capitalize">{t.type?.replace(/_/g, ' ')}</span></td>
                      <td className="font-semibold">{fmt(t.amount)}</td>
                      <td className="text-xs">{formatDateTime(t.transaction_date)}</td>
                      <td><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                  {(!loan.transactions || loan.transactions.length === 0) && (
                    <tr><td colSpan={5} className="text-center py-4 text-dark-400">No transactions yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {loan.approved_by_name && (
            <div className="card">
              <h4 className="font-semibold text-dark-800 mb-2">Approval Info</h4>
              <div className="space-y-2 text-sm">
                <div><p className="text-xs text-dark-400">Approved By</p><p>{loan.approved_by_name}</p></div>
                <div><p className="text-xs text-dark-400">Approved At</p><p>{formatDateTime(loan.approved_at)}</p></div>
              </div>
            </div>
          )}
          {loan.rejection_reason && (
            <div className="card border-red-200">
              <h4 className="font-semibold text-red-700 mb-2">Rejection Reason</h4>
              <p className="text-sm text-red-600">{loan.rejection_reason}</p>
            </div>
          )}
          <div className="card">
            <h4 className="font-semibold text-dark-800 mb-3">Documents ({loan.documents?.length || 0})</h4>
            {(loan.documents || []).map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-dark-50 last:border-0">
                <div>
                  <p className="text-sm font-medium">{d.original_name}</p>
                  <p className="text-xs text-dark-400">{d.document_type?.replace(/_/g, ' ')}</p>
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
            {(!loan.documents || loan.documents.length === 0) && (
              <p className="text-dark-400 text-sm">No documents attached</p>
            )}
          </div>
        </div>
      </div>

      {/* Approve/Reject Modal */}
      <Modal isOpen={showApprove} onClose={() => setShowApprove(false)}
        title={action === 'approve' ? '✓ Approve Loan' : '✗ Reject Loan'}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowApprove(false)} className="btn-outline">Cancel</button>
            <button onClick={handleAction} disabled={processing}
              className={action === 'approve' ? 'btn-primary' : 'btn-danger'}>
              {processing ? 'Processing...' : action === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </div>
        }
      >
        <div>
          <p className="text-dark-600 mb-3">
            You are about to <strong>{action}</strong> loan <strong>{loan.loan_number}</strong> for <strong>{fmt(loan.principal_amount)}</strong>.
          </p>
          <div>
            <label className="input-label">{action === 'approve' ? 'Notes (optional)' : 'Rejection Reason'}</label>
            <textarea className="input-field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={action === 'approve' ? 'Add any notes...' : 'Please provide reason for rejection...'} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
