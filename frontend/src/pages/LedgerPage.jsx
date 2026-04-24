import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../utils/api';
import { hasRole, formatCurrency, formatDateTime, formatDate } from '../utils/helpers';
import Pagination from '../components/common/Pagination';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

export default function LedgerPage() {
  const { userId: paramUserId } = useParams();
  const { user } = useSelector((s) => s.auth);
  const isAdmin = hasRole(user, 'admin', 'accountant');
  const targetUserId = paramUserId || user.id;

  const [entries, setEntries] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [allAccounts, setAllAccounts] = useState([]);
  const [accPage, setAccPage] = useState(1);
  const [accTotal, setAccTotal] = useState(0);
  const [accTotalPages, setAccTotalPages] = useState(1);
  const viewingAll = isAdmin && !paramUserId;

  useEffect(() => {
    if (viewingAll) fetchAllAccounts();
    else fetchLedger();
  }, [page, targetUserId, dateRange, accPage]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      const res = await api.get(`/ledger/${targetUserId}?${params}`);
      setEntries(res.data.data.entries);
      setBalance(res.data.data.currentBalance);
      setTotal(res.data.data.total);
      setTotalPages(res.data.data.totalPages);
    } catch { toast.error('Failed to load ledger'); }
    finally { setLoading(false); }
  };

  const fetchAllAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/ledger?page=${accPage}&limit=20`);
      setAllAccounts(res.data.data.accounts);
      setAccTotal(res.data.data.total);
      setAccTotalPages(res.data.data.totalPages);
    } catch { toast.error('Failed to load accounts'); }
    finally { setLoading(false); }
  };

  if (viewingAll) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">All Ledger Accounts</h1>
            <p className="page-subtitle">{accTotal} accounts</p>
          </div>
        </div>
        <div className="card">
          {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
            <>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>ITS</th><th>Name</th><th>Email</th><th>Balance</th><th>Entries</th><th>Last Activity</th><th>Actions</th></tr></thead>
                  <tbody>
                    {allAccounts.map((a) => (
                      <tr key={a.id}>
                        <td className="font-mono text-xs">{a.its_number}</td>
                        <td className="font-medium">{a.name}</td>
                        <td className="text-xs">{a.email}</td>
                        <td className={`font-semibold ${parseFloat(a.balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(a.balance)}</td>
                        <td>{a.entry_count}</td>
                        <td className="text-xs">{a.last_activity ? formatDate(a.last_activity) : '—'}</td>
                        <td><Link to={`/ledger/${a.id}`} className="text-primary-800 hover:underline text-sm">View Ledger</Link></td>
                      </tr>
                    ))}
                    {allAccounts.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-dark-400">No accounts</td></tr>}
                  </tbody>
                </table>
              </div>
              <Pagination page={accPage} totalPages={accTotalPages} total={accTotal} limit={20} onPageChange={setAccPage} />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          {paramUserId && isAdmin && (
            <Link to="/ledger" className="text-sm text-dark-400 hover:text-dark-700 mb-1 block">← All Accounts</Link>
          )}
          <h1 className="page-title">{paramUserId && paramUserId !== user.id ? 'Account Ledger' : 'My Ledger'}</h1>
          <p className="page-subtitle">{total} entries</p>
        </div>
        <div className={`text-right`}>
          <p className="text-sm text-dark-500">Current Balance</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatCurrency(balance)}</p>
        </div>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-xs text-dark-400 mb-1">Total Credits</p>
          <p className="font-bold text-green-700 text-lg">
            {formatCurrency(entries.filter(e => e.entry_type === 'credit').reduce((s, e) => s + parseFloat(e.amount), 0))}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-dark-400 mb-1">Total Debits</p>
          <p className="font-bold text-red-600 text-lg">
            {formatCurrency(entries.filter(e => e.entry_type === 'debit').reduce((s, e) => s + parseFloat(e.amount), 0))}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-dark-400 mb-1">Net Balance</p>
          <p className={`font-bold text-lg ${balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatCurrency(balance)}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-dark-600">From:</label>
            <input type="date" className="input-field w-auto" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-dark-600">To:</label>
            <input type="date" className="input-field w-auto" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
          </div>
          {(dateRange.start || dateRange.end) && (
            <button onClick={() => setDateRange({ start: '', end: '' })} className="text-sm text-dark-400 hover:text-dark-700">✕ Clear</button>
          )}
        </div>

        {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Description</th><th>Reference</th><th>Type</th><th>Amount</th><th>Balance After</th></tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="text-xs">{formatDateTime(e.entry_date)}</td>
                      <td>
                        <p className="text-sm">{e.description}</p>
                        {e.loan_number && <p className="text-xs text-dark-400">Loan: {e.loan_number}</p>}
                      </td>
                      <td className="font-mono text-xs">{e.reference || e.transaction_number || '—'}</td>
                      <td>
                        <span className={`badge ${e.entry_type === 'credit' ? 'badge-green' : 'badge-red'}`}>
                          {e.entry_type === 'credit' ? '↑ Credit' : '↓ Debit'}
                        </span>
                      </td>
                      <td className={`font-semibold ${e.entry_type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {e.entry_type === 'credit' ? '+' : '-'}{formatCurrency(e.amount)}
                      </td>
                      <td className={`font-medium ${parseFloat(e.balance_after) >= 0 ? 'text-dark-700' : 'text-red-600'}`}>
                        {formatCurrency(e.balance_after)}
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-dark-400">No ledger entries found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={50} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
