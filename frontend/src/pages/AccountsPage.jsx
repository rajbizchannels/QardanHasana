import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FileText, Building2, Users, AlertTriangle, Trash2 } from 'lucide-react';
import api from '../utils/api';
import { formatDate, hasRole } from '../utils/helpers';
import { useCurrency } from '../utils/currency';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AccountsPage() {
  const fmt = useCurrency();
  const { user: authUser } = useSelector((s) => s.auth);
  const isAccountant = hasRole(authUser, 'admin', 'accountant');
  const [tab, setTab] = useState('debtors');
  const [data, setData] = useState({ creditors: [], debtors: [], guarantors: [] });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [maturityAlerts, setMaturityAlerts] = useState([]);
  const [showDelete, setShowDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchProfiles(); }, [tab, page]);

  const handleDelete = async () => {
    if (!showDelete) return;
    setDeleting(true);
    try {
      const typeMap = { creditors: 'creditor', debtors: 'debtor', guarantors: 'guarantor' };
      await api.delete(`/profiles/${typeMap[showDelete.tab]}/${showDelete.id}`);
      toast.success(`${typeMap[showDelete.tab].charAt(0).toUpperCase() + typeMap[showDelete.tab].slice(1)} profile deactivated`);
      setShowDelete(null);
      fetchProfiles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete profile');
    } finally {
      setDeleting(false);
    }
  };

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/profiles?type=${tab}&page=${page}&limit=20`);
      setData(prev => ({ ...prev, [tab]: res.data.data[tab] || [] }));
      if (isAccountant) {
        const alertRes = await api.get('/profiles/maturity-alerts').catch(() => null);
        setMaturityAlerts(alertRes?.data?.data || []);
      }
    } catch { toast.error('Failed to load profiles'); }
    finally { setLoading(false); }
  };

  const tabs = [
    { key: 'debtors', label: 'Debtors', icon: <FileText className="w-4 h-4" /> },
    { key: 'creditors', label: 'Creditors', icon: <Building2 className="w-4 h-4" /> },
    { key: 'guarantors', label: 'Guarantors', icon: <Users className="w-4 h-4" /> },
  ];

  const currentData = data[tab] || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Account Profiles</h1>
          <p className="page-subtitle">Manage creditor, debtor, and guarantor profiles</p>
        </div>
      </div>

      <div className="flex gap-1 bg-dark-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-primary-900 shadow-sm' : 'text-dark-500 hover:text-dark-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {maturityAlerts.length > 0 && tab === 'creditors' && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {maturityAlerts.filter(a => parseInt(a.days_until_maturity) < 0).length > 0
                ? `${maturityAlerts.filter(a => parseInt(a.days_until_maturity) < 0).length} overdue repayment(s) — `
                : ''}
              {maturityAlerts.length} creditor deposit maturity alert(s)
            </p>
            <p className="text-xs text-amber-700 mt-0.5">Deposits approaching or past their return date. See Maturity Date column below.</p>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
          <div className="table-container">
            <table className="table">
              {tab === 'debtors' && (
                <>
                  <thead><tr><th>Name</th><th>ITS</th><th>Debtor #</th><th>Total Borrowed</th><th>Outstanding</th><th>Overdue</th><th>Credit Score</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {currentData.map((d) => (
                      <tr key={d.id}>
                        <td className="font-medium">{d.name}</td>
                        <td className="font-mono text-xs">{d.its_number}</td>
                        <td className="font-mono text-xs">{d.debtor_number}</td>
                        <td>{fmt(d.total_borrowed)}</td>
                        <td className={parseFloat(d.outstanding_balance) > 0 ? 'font-semibold text-orange-700' : ''}>{fmt(d.outstanding_balance)}</td>
                        <td className={parseFloat(d.overdue_amount) > 0 ? 'font-semibold text-red-600' : ''}>{fmt(d.overdue_amount)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <div className="w-12 h-1.5 bg-dark-200 rounded-full overflow-hidden">
                              <div className="h-full bg-green-600 rounded-full" style={{ width: `${d.credit_score || 0}%` }} />
                            </div>
                            <span className="text-xs">{d.credit_score}</span>
                          </div>
                        </td>
                        <td><StatusBadge status={d.status} /></td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link to={`/users/${d.user_id}`} className="text-primary-800 hover:underline text-sm">Profile</Link>
                            {isAccountant && (
                              <button onClick={() => setShowDelete({ ...d, tab: 'debtors' })} className="text-red-500 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {currentData.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-dark-400">No debtors found</td></tr>}
                  </tbody>
                </>
              )}

              {tab === 'creditors' && (
                <>
                  <thead><tr><th>Name</th><th>ITS</th><th>Creditor #</th><th>Credit Limit</th><th>Total Given</th><th>Recovered</th><th>Outstanding</th><th>Deposits</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {currentData.map((c) => (
                      <tr key={c.id}>
                        <td className="font-medium">{c.name}</td>
                        <td className="font-mono text-xs">{c.its_number}</td>
                        <td className="font-mono text-xs">{c.creditor_number}</td>
                        <td>{fmt(c.credit_limit)}</td>
                        <td>{fmt(c.total_given)}</td>
                        <td className="text-green-700">{fmt(c.total_recovered)}</td>
                        <td className="font-semibold text-orange-700">{fmt(c.outstanding_amount)}</td>
                        <td>
                          {parseInt(c.active_deposit_count) > 0 ? (
                            <div className="space-y-0.5">
                              <span className="text-xs text-dark-600 font-medium">{c.active_deposit_count} active</span>
                              {parseInt(c.overdue_deposits) > 0 && (
                                <div><span className="badge badge-red text-xs">{c.overdue_deposits} overdue</span></div>
                              )}
                              {c.next_maturity_date && parseInt(c.overdue_deposits) === 0 && (() => {
                                const days = Math.ceil((new Date(c.next_maturity_date) - new Date()) / 86400000);
                                return <div><span className={`text-xs ${days <= 7 ? 'text-amber-700 font-medium' : 'text-dark-400'}`}>Next: {new Date(c.next_maturity_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>;
                              })()}
                            </div>
                          ) : <span className="text-dark-300 text-xs">—</span>}
                        </td>
                        <td><StatusBadge status={c.status} /></td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link to={`/users/${c.user_id}`} className="text-primary-800 hover:underline text-sm">Profile</Link>
                            {isAccountant && (
                              <button onClick={() => setShowDelete({ ...c, tab: 'creditors' })} className="text-red-500 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {currentData.length === 0 && <tr><td colSpan={10} className="text-center py-8 text-dark-400">No creditors found</td></tr>}
                  </tbody>
                </>
              )}

              {tab === 'guarantors' && (
                <>
                  <thead><tr><th>Name</th><th>ITS</th><th>Guarantor #</th><th>Total Guaranteed</th><th>Active Guarantees</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {currentData.map((g) => (
                      <tr key={g.id}>
                        <td className="font-medium">{g.name}</td>
                        <td className="font-mono text-xs">{g.its_number}</td>
                        <td className="font-mono text-xs">{g.guarantor_number}</td>
                        <td>{fmt(g.total_guaranteed)}</td>
                        <td>{g.active_guarantees}</td>
                        <td><StatusBadge status={g.status} /></td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link to={`/users/${g.user_id}`} className="text-primary-800 hover:underline text-sm">Profile</Link>
                            {isAccountant && (
                              <button onClick={() => setShowDelete({ ...g, tab: 'guarantors' })} className="text-red-500 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {currentData.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-dark-400">No guarantors found</td></tr>}
                  </tbody>
                </>
              )}
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Deactivate Profile"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowDelete(null)} className="btn-outline">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger">
              {deleting ? 'Deactivating...' : 'Deactivate'}
            </button>
          </div>
        }
      >
        <p>Deactivate the {showDelete?.tab?.replace(/s$/, '')} profile for <strong>{showDelete?.name}</strong>?</p>
        <p className="text-sm text-dark-400 mt-1">ITS: {showDelete?.its_number}</p>
        <p className="text-sm text-dark-400 mt-2">The profile will be hidden from all lists. The user account is not affected.</p>
      </Modal>
    </div>
  );
}
