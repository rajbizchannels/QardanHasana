import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const StatBox = ({ label, value, sub, color }) => (
  <div className={`card border-l-4 ${color || 'border-l-primary-800'}`}>
    <p className="text-xs text-dark-400 mb-0.5">{label}</p>
    <p className="text-xl font-bold text-dark-900">{value}</p>
    {sub && <p className="text-xs text-dark-400 mt-0.5">{sub}</p>}
  </div>
);

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/cash-status');
      setData(res.data.data);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'collections', label: 'Recent Collections' },
    { key: 'dues', label: 'Dues This Cycle' },
    { key: 'overdue', label: 'Overdue Accounts' },
    { key: 'creditors', label: 'Creditor Summary' },
  ];

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" text="Loading reports..." /></div>;

  const { summary, recentCollections, dueThisCycle, overdueAccounts, creditorSummary, currency } = data || {};

  const chartData = [
    { name: 'Total Disbursed', value: summary?.totalDisbursed || 0 },
    { name: 'Total Repaid', value: summary?.totalRepaid || 0 },
    { name: 'Outstanding', value: summary?.totalOutstanding || 0 },
    { name: 'Overdue', value: summary?.overdueAmount || 0 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Cash flow status and collection reports</p>
        </div>
        <button onClick={fetchData} className="btn-outline btn-sm">🔄 Refresh</button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBox label="Total Disbursed" value={formatCurrency(summary?.totalDisbursed)} color="border-l-blue-500" />
        <StatBox label="Total Repaid" value={formatCurrency(summary?.totalRepaid)} color="border-l-green-600" />
        <StatBox label="Outstanding" value={formatCurrency(summary?.totalOutstanding)} color="border-l-yellow-500" />
        <StatBox label="Overdue Amount" value={formatCurrency(summary?.overdueAmount)} color="border-l-red-600" sub={`${summary?.overdueCount} accounts`} />
        <StatBox label="Active Loans" value={summary?.activeLoansCount || 0} color="border-l-primary-800" />
        <StatBox label="Currency" value={currency || 'INR'} color="border-l-gold-500" />
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-dark-100 p-1 rounded-xl w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.key ? 'bg-white text-primary-900 shadow-sm' : 'text-dark-500 hover:text-dark-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold mb-4">Financial Overview</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="value" fill="#1B4332" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-4">Quick Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-dark-50">
                <span className="text-sm text-dark-600">Recovery Rate</span>
                <span className="font-bold text-green-700">
                  {summary?.totalDisbursed > 0 ? ((summary.totalRepaid / summary.totalDisbursed) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dark-50">
                <span className="text-sm text-dark-600">Overdue Rate</span>
                <span className="font-bold text-red-600">
                  {summary?.activeLoansCount > 0 ? ((summary.overdueCount / summary.activeLoansCount) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dark-50">
                <span className="text-sm text-dark-600">Avg Loan Size</span>
                <span className="font-bold">{formatCurrency(summary?.activeLoansCount > 0 ? summary.totalOutstanding / summary.activeLoansCount : 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Collections */}
      {tab === 'collections' && (
        <div className="card">
          <h3 className="font-semibold mb-4">Recent Collections (Last 30 Days)</h3>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Ref #</th><th>Debtor</th><th>ITS</th><th>Loan #</th><th>Amount</th><th>Date</th></tr></thead>
              <tbody>
                {(recentCollections || []).map((r, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs">{r.transaction_number}</td>
                    <td>{r.payer_name || '—'}</td>
                    <td className="text-xs">{r.its_number || '—'}</td>
                    <td className="font-mono text-xs">{r.loan_number || '—'}</td>
                    <td className="font-semibold text-green-700">{formatCurrency(r.amount)}</td>
                    <td className="text-xs">{formatDate(r.transaction_date)}</td>
                  </tr>
                ))}
                {(!recentCollections || recentCollections.length === 0) && (
                  <tr><td colSpan={6} className="text-center py-6 text-dark-400">No recent collections</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dues This Cycle */}
      {tab === 'dues' && (
        <div className="card">
          <h3 className="font-semibold mb-4">Payment Dues This Month</h3>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Debtor</th><th>ITS</th><th>Loan #</th><th>Installment</th><th>Due Date</th><th>Outstanding</th><th>Contact</th></tr></thead>
              <tbody>
                {(dueThisCycle || []).map((d, i) => (
                  <tr key={i}>
                    <td className="font-medium">{d.debtor_name}</td>
                    <td className="text-xs">{d.its_number}</td>
                    <td className="font-mono text-xs">{d.loan_number}</td>
                    <td className="font-semibold">{formatCurrency(d.monthly_installment)}</td>
                    <td>{formatDate(d.next_due_date)}</td>
                    <td className="text-orange-600 font-semibold">{formatCurrency(d.outstanding_balance)}</td>
                    <td><a href={`tel:${d.phone}`} className="text-primary-800 text-xs hover:underline">{d.phone}</a></td>
                  </tr>
                ))}
                {(!dueThisCycle || dueThisCycle.length === 0) && (
                  <tr><td colSpan={7} className="text-center py-6 text-dark-400">No dues this cycle</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overdue */}
      {tab === 'overdue' && (
        <div className="card">
          <h3 className="font-semibold mb-4 text-red-700">⚠️ Overdue Accounts ({(overdueAccounts || []).length})</h3>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Debtor</th><th>ITS</th><th>Loan #</th><th>Overdue Since</th><th>Overdue Amount</th><th>Outstanding</th><th>Contact</th></tr></thead>
              <tbody>
                {(overdueAccounts || []).map((o, i) => (
                  <tr key={i} className="bg-red-50">
                    <td className="font-medium text-red-800">{o.debtor_name}</td>
                    <td className="text-xs">{o.its_number}</td>
                    <td className="font-mono text-xs">{o.loan_number}</td>
                    <td className="text-red-600">{formatDate(o.next_due_date)}</td>
                    <td className="font-bold text-red-700">{formatCurrency(o.overdue_amount || o.monthly_installment)}</td>
                    <td className="font-semibold text-red-600">{formatCurrency(o.outstanding_balance)}</td>
                    <td><a href={`tel:${o.phone}`} className="text-primary-800 text-xs hover:underline">{o.phone}</a></td>
                  </tr>
                ))}
                {(!overdueAccounts || overdueAccounts.length === 0) && (
                  <tr><td colSpan={7} className="text-center py-6 text-dark-400">No overdue accounts 🎉</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Creditors */}
      {tab === 'creditors' && (
        <div className="card">
          <h3 className="font-semibold mb-4">Creditor Summary</h3>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Creditor</th><th>ITS</th><th>Creditor #</th><th>Total Given</th><th>Recovered</th><th>Outstanding</th></tr></thead>
              <tbody>
                {(creditorSummary || []).map((c, i) => (
                  <tr key={i}>
                    <td className="font-medium">{c.name}</td>
                    <td className="text-xs">{c.its_number}</td>
                    <td className="font-mono text-xs">{c.creditor_number}</td>
                    <td className="font-semibold">{formatCurrency(c.total_given)}</td>
                    <td className="text-green-700">{formatCurrency(c.total_recovered)}</td>
                    <td className="font-bold text-orange-700">{formatCurrency(c.outstanding_amount)}</td>
                  </tr>
                ))}
                {(!creditorSummary || creditorSummary.length === 0) && (
                  <tr><td colSpan={6} className="text-center py-6 text-dark-400">No creditors found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
