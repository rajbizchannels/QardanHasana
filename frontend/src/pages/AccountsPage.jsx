import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AccountsPage() {
  const [tab, setTab] = useState('debtors');
  const [data, setData] = useState({ creditors: [], debtors: [], guarantors: [] });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => { fetchProfiles(); }, [tab, page]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/profiles?type=${tab}&page=${page}&limit=20`);
      setData(prev => ({ ...prev, [tab]: res.data.data[tab] || [] }));
    } catch { toast.error('Failed to load profiles'); }
    finally { setLoading(false); }
  };

  const tabs = [
    { key: 'debtors', label: '📋 Debtors' },
    { key: 'creditors', label: '🏦 Creditors' },
    { key: 'guarantors', label: '🤝 Guarantors' },
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
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-primary-900 shadow-sm' : 'text-dark-500 hover:text-dark-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

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
                        <td>{formatCurrency(d.total_borrowed)}</td>
                        <td className={parseFloat(d.outstanding_balance) > 0 ? 'font-semibold text-orange-700' : ''}>{formatCurrency(d.outstanding_balance)}</td>
                        <td className={parseFloat(d.overdue_amount) > 0 ? 'font-semibold text-red-600' : ''}>{formatCurrency(d.overdue_amount)}</td>
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
                          <Link to={`/users/${d.user_id}`} className="text-primary-800 hover:underline text-sm">Profile</Link>
                        </td>
                      </tr>
                    ))}
                    {currentData.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-dark-400">No debtors found</td></tr>}
                  </tbody>
                </>
              )}

              {tab === 'creditors' && (
                <>
                  <thead><tr><th>Name</th><th>ITS</th><th>Creditor #</th><th>Credit Limit</th><th>Total Given</th><th>Recovered</th><th>Outstanding</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {currentData.map((c) => (
                      <tr key={c.id}>
                        <td className="font-medium">{c.name}</td>
                        <td className="font-mono text-xs">{c.its_number}</td>
                        <td className="font-mono text-xs">{c.creditor_number}</td>
                        <td>{formatCurrency(c.credit_limit)}</td>
                        <td>{formatCurrency(c.total_given)}</td>
                        <td className="text-green-700">{formatCurrency(c.total_recovered)}</td>
                        <td className="font-semibold text-orange-700">{formatCurrency(c.outstanding_amount)}</td>
                        <td><StatusBadge status={c.status} /></td>
                        <td><Link to={`/users/${c.user_id}`} className="text-primary-800 hover:underline text-sm">Profile</Link></td>
                      </tr>
                    ))}
                    {currentData.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-dark-400">No creditors found</td></tr>}
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
                        <td>{formatCurrency(g.total_guaranteed)}</td>
                        <td>{g.active_guarantees}</td>
                        <td><StatusBadge status={g.status} /></td>
                        <td><Link to={`/users/${g.user_id}`} className="text-primary-800 hover:underline text-sm">Profile</Link></td>
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
    </div>
  );
}
