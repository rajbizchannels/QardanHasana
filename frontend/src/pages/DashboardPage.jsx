import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Wallet, Send, FileText, AlertTriangle, FolderOpen, Clock,
  CheckCircle, Users, BookOpen,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../utils/api';
import { formatDate, hasRole } from '../utils/helpers';
import { useCurrency } from '../utils/currency';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';

const StatCard = ({ title, value, sub, icon, color = 'primary', link }) => (
  <Link to={link || '#'} className="stat-card hover:shadow-md transition-shadow block">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-dark-500 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-dark-900 mt-1">{value}</p>
        {sub && <p className={`text-xs mt-1 ${color === 'red' ? 'text-red-600' : color === 'green' ? 'text-green-600' : 'text-dark-400'}`}>{sub}</p>}
      </div>
      <span className={`${color === 'red' ? 'text-red-500' : color === 'green' ? 'text-green-600' : 'text-primary-700'} opacity-70`}>{icon}</span>
    </div>
  </Link>
);

export default function DashboardPage() {
  const { user } = useSelector((s) => s.auth);
  const currency = useSelector((s) => s.settings.currency);
  const fmt = useCurrency();
  const isAdmin = hasRole(user, 'admin', 'accountant');
  const [data, setData] = useState(null);
  const [myLoans, setMyLoans] = useState([]);
  const [myLedger, setMyLedger] = useState(null);
  const [approvalStats, setApprovalStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const promises = [
        api.get(`/ledger/${user.id}?limit=5`).catch(() => null),
        api.get('/loans?limit=5').catch(() => null),
      ];
      if (isAdmin) {
        promises.push(api.get('/reports/cash-status').catch(() => null));
        promises.push(api.get('/approvals/stats').catch(() => null));
      }
      const [ledgerRes, loansRes, reportRes, appRes] = await Promise.all(promises);
      setMyLedger(ledgerRes?.data?.data || null);
      setMyLoans(loansRes?.data?.data?.loans || []);
      if (reportRes) setData(reportRes.data.data);
      if (appRes) setApprovalStats(appRes.data.data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" text="Loading dashboard..." /></div>;

  const chartData = data ? [
    { name: 'Disbursed', amount: data.summary?.totalDisbursed || 0 },
    { name: 'Repaid', amount: data.summary?.totalRepaid || 0 },
    { name: 'Outstanding', amount: data.summary?.totalOutstanding || 0 },
    { name: 'Overdue', amount: data.summary?.overdueAmount || 0 },
  ] : [];

  const pieData = data ? [
    { name: 'Repaid', value: data.summary?.totalRepaid || 0, color: '#15803d' },
    { name: 'Outstanding', value: (data.summary?.totalOutstanding || 0) - (data.summary?.overdueAmount || 0), color: '#D4AF37' },
    { name: 'Overdue', value: data.summary?.overdueAmount || 0, color: '#dc2626' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.first_name}! Here's your financial overview.</p>
        </div>
        <div className="text-sm text-dark-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      {/* Personal stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="My Balance"
          value={fmt(myLedger?.currentBalance || 0)}
          icon={<Wallet className="w-8 h-8" />}
          link="/ledger"
          color={myLedger?.currentBalance >= 0 ? 'green' : 'red'}
        />
        {isAdmin && data && (
          <>
            <StatCard title="Total Disbursed" value={fmt(data.summary?.totalDisbursed)} icon={<Send className="w-8 h-8" />} link="/reports" />
            <StatCard title="Total Outstanding" value={fmt(data.summary?.totalOutstanding)} icon={<FileText className="w-8 h-8" />} link="/reports" color="primary" />
            <StatCard title="Overdue Amount" value={fmt(data.summary?.overdueAmount)} icon={<AlertTriangle className="w-8 h-8" />} link="/reports" color="red"
              sub={`${data.summary?.overdueCount} accounts overdue`} />
          </>
        )}
        {!isAdmin && (
          <>
            <StatCard title="Active Loans" value={myLoans.filter(l => l.status === 'active').length} icon={<FileText className="w-8 h-8" />} link="/loans" />
            <StatCard title="Ledger Entries" value={myLedger?.total || 0} icon={<BookOpen className="w-8 h-8" />} link="/ledger" />
            <StatCard title="Total Entries" value={myLedger?.total || 0} icon={<BookOpen className="w-8 h-8" />} link="/ledger" />
          </>
        )}
      </div>

      {/* Admin stats row */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Active Loans" value={data?.summary?.activeLoansCount || 0} icon={<FolderOpen className="w-8 h-8" />} link="/loans" />
          <StatCard title="Pending Approvals" value={approvalStats?.pending || 0} icon={<Clock className="w-8 h-8" />} link="/approvals" color={parseInt(approvalStats?.pending) > 5 ? 'red' : 'primary'} />
          <StatCard title="Total Repaid" value={fmt(data?.summary?.totalRepaid)} icon={<CheckCircle className="w-8 h-8" />} link="/reports" color="green" />
          <StatCard title="Total Users" value="8+" icon={<Users className="w-8 h-8" />} link="/users" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        {isAdmin && chartData.length > 0 && (
          <div className="lg:col-span-2 card">
            <div className="card-header">
              <h3>Financial Overview</h3>
              <Link to="/reports" className="text-sm text-primary-800 hover:underline">View Reports →</Link>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${currency} ${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="amount" fill="#1B4332" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pie chart or My loans */}
        <div className="card">
          {isAdmin && pieData.length > 0 ? (
            <>
              <div className="card-header"><h3>Loan Distribution</h3></div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-medium">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="card-header">
                <h3>Recent Loans</h3>
                <Link to="/loans" className="text-sm text-primary-800 hover:underline">View All →</Link>
              </div>
              <div className="space-y-3">
                {myLoans.slice(0, 4).map((loan) => (
                  <Link key={loan.id} to={`/loans/${loan.id}`} className="flex items-center justify-between p-2 hover:bg-dark-50 rounded-lg transition-colors">
                    <div>
                      <p className="text-sm font-medium text-dark-800">{loan.loan_number}</p>
                      <p className="text-xs text-dark-400">{fmt(loan.outstanding_balance)} outstanding</p>
                    </div>
                    <StatusBadge status={loan.status} />
                  </Link>
                ))}
                {myLoans.length === 0 && <p className="text-dark-400 text-sm text-center py-4">No loans yet</p>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent ledger */}
        <div className="card">
          <div className="card-header">
            <h3>Recent Ledger Activity</h3>
            <Link to="/ledger" className="text-sm text-primary-800 hover:underline">View All →</Link>
          </div>
          <div className="space-y-2">
            {(myLedger?.entries || []).slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-dark-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${e.entry_type === 'credit' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="text-sm text-dark-700">{e.description}</p>
                    <p className="text-xs text-dark-400">{formatDate(e.entry_date)}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${e.entry_type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                  {e.entry_type === 'credit' ? '+' : '-'}{fmt(e.amount)}
                </span>
              </div>
            ))}
            {(!myLedger?.entries || myLedger.entries.length === 0) && (
              <p className="text-dark-400 text-sm text-center py-4">No ledger entries yet</p>
            )}
          </div>
        </div>

        {/* Due this cycle */}
        <div className="card">
          <div className="card-header">
            <h3>{isAdmin ? 'Dues This Cycle' : 'My Upcoming Dues'}</h3>
            <Link to="/loans" className="text-sm text-primary-800 hover:underline">View Loans →</Link>
          </div>
          <div className="space-y-2">
            {(isAdmin ? (data?.dueThisCycle || []) : myLoans.filter(l => l.status === 'active')).slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-dark-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-dark-700">{item.debtor_name || item.loan_number}</p>
                  <p className="text-xs text-dark-400">Due: {formatDate(item.next_due_date)}</p>
                </div>
                <span className="text-sm font-semibold text-primary-900">{fmt(item.monthly_installment)}</span>
              </div>
            ))}
            {(isAdmin ? (data?.dueThisCycle || []) : myLoans).length === 0 && (
              <p className="text-dark-400 text-sm text-center py-4">No dues this cycle</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
