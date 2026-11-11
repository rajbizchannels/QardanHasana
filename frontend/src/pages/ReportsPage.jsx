import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RefreshCw, AlertTriangle, Download, FileText, TrendingUp, BookOpen, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import api from '../utils/api';
import { formatDate } from '../utils/helpers';
import { useCurrency } from '../utils/currency';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const StatBox = ({ label, value, sub, color }) => (
  <div className={`card border-l-4 ${color || 'border-l-primary-800'}`}>
    <p className="text-xs text-dark-400 mb-0.5">{label}</p>
    <p className="text-xl font-bold text-dark-900">{value}</p>
    {sub && <p className="text-xs text-dark-400 mt-0.5">{sub}</p>}
  </div>
);

function downloadPDF(title, buildPdf) {
  import('jspdf').then(({ jsPDF }) => {
    import('jspdf-autotable').then(({ default: autoTable }) => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      buildPdf(doc, autoTable);
      doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
    });
  });
}

function formatCurr(fmt, v) { return fmt(v); }

// ─── Monthly Report Tab ─────────────────────────────────────────────────────
function MonthlyReportTab({ fmt, currency }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/monthly?year=${year}&month=${month}`);
      setData(res.data.data);
    } catch { toast.error('Failed to load monthly report'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [year, month]);

  const handleDownload = () => {
    if (!data) return;
    const { summary, monthActivity, overdueAccounts, period } = data;
    const monthLabel = `${MONTH_NAMES[period.month - 1]} ${period.year}`;
    downloadPDF(`Monthly_Report_${monthLabel}`, (doc, autoTable) => {
      doc.setFontSize(18);
      doc.text(`Qardan Hasana – Monthly Report`, 14, 18);
      doc.setFontSize(11);
      doc.text(`Period: ${monthLabel}`, 14, 26);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);

      doc.setFontSize(13);
      doc.text('Loan Portfolio', 14, 42);
      autoTable(doc, {
        startY: 46,
        head: [['Metric', 'Value']],
        body: [
          ['Active Loans', summary.activeLoans],
          ['Total Disbursed', fmt(summary.totalDisbursed)],
          ['Total Outstanding', fmt(summary.totalOutstanding)],
          ['Overdue Amount', fmt(summary.overdueAmount)],
          ['Overdue Count', summary.overdueCount],
          ['Recovery Rate', `${summary.recoveryRate}%`],
        ],
        theme: 'grid', headStyles: { fillColor: [27, 67, 50] },
      });

      let y = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(13);
      doc.text(`${monthLabel} Activity`, 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Activity', 'Count', 'Amount']],
        body: [
          ['Disbursements', monthActivity.disbursements.count, fmt(monthActivity.disbursements.total)],
          ['Repayments Collected', monthActivity.repayments.count, fmt(monthActivity.repayments.total)],
          ['New Applications', monthActivity.newApplications.count, fmt(monthActivity.newApplications.total)],
          ['Deposits Received', monthActivity.deposits.count, fmt(monthActivity.deposits.total)],
        ],
        theme: 'grid', headStyles: { fillColor: [27, 67, 50] },
      });

      if (overdueAccounts?.length) {
        y = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(13);
        doc.text('Overdue Accounts', 14, y);
        autoTable(doc, {
          startY: y + 4,
          head: [['Debtor', 'ITS', 'Loan #', 'Monthly', 'Outstanding', 'Due Date']],
          body: overdueAccounts.map(o => [o.debtor_name, o.its_number, o.loan_number, fmt(o.monthly_installment), fmt(o.outstanding_balance), formatDate(o.next_due_date)]),
          theme: 'grid', headStyles: { fillColor: [180, 30, 30] },
        });
      }
    });
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  const { summary, monthActivity, overdueAccounts, period, creditorDeposits } = data || {};

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="input-label">Year</label>
          <select className="input-field w-28" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
            {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Month</label>
          <select className="input-field w-36" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
            {MONTH_NAMES.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
          </select>
        </div>
        <button onClick={fetchData} className="btn-outline btn-sm flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> Refresh</button>
        <button onClick={handleDownload} disabled={!data} className="btn-primary btn-sm flex items-center gap-1.5"><Download className="w-4 h-4" /> Download PDF</button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatBox label="Active Loans" value={summary?.activeLoans} color="border-l-primary-800" />
            <StatBox label="Total Disbursed" value={fmt(summary?.totalDisbursed)} color="border-l-blue-500" />
            <StatBox label="Outstanding" value={fmt(summary?.totalOutstanding)} color="border-l-yellow-500" />
            <StatBox label="Overdue" value={fmt(summary?.overdueAmount)} sub={`${summary?.overdueCount} accounts`} color="border-l-red-600" />
            <StatBox label="Recovery Rate" value={`${summary?.recoveryRate}%`} color="border-l-green-600" />
            <StatBox label="Currency" value={currency || 'INR'} color="border-l-gold-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-semibold mb-4">{MONTH_NAMES[(period?.month || 1) - 1]} {period?.year} Activity</h3>
              <div className="space-y-3">
                {[
                  { label: 'Disbursements', count: monthActivity?.disbursements.count, total: monthActivity?.disbursements.total, color: 'text-blue-700' },
                  { label: 'Repayments Collected', count: monthActivity?.repayments.count, total: monthActivity?.repayments.total, color: 'text-green-700' },
                  { label: 'New Applications', count: monthActivity?.newApplications.count, total: monthActivity?.newApplications.total, color: 'text-primary-800' },
                  { label: 'Deposits Received', count: monthActivity?.deposits.count, total: monthActivity?.deposits.total, color: 'text-purple-700' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center py-2 border-b border-dark-50 last:border-0">
                    <div>
                      <span className="text-sm text-dark-700">{item.label}</span>
                      <span className="text-xs text-dark-400 ml-2">({item.count} txns)</span>
                    </div>
                    <span className={`font-bold ${item.color}`}>{fmt(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold mb-4">Portfolio Health</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  { name: 'Outstanding', value: summary?.totalOutstanding || 0 },
                  { name: 'Overdue', value: summary?.overdueAmount || 0 },
                  { name: 'Repaid (mo)', value: monthActivity?.repayments.total || 0 },
                ]}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Bar dataKey="value" fill="#1B4332" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {overdueAccounts?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-4 text-red-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Overdue Accounts ({overdueAccounts.length})</h3>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Debtor</th><th>ITS</th><th>Loan #</th><th>Monthly</th><th>Outstanding</th><th>Due Date</th><th>Phone</th></tr></thead>
                  <tbody>
                    {overdueAccounts.map((o, i) => (
                      <tr key={i} className="bg-red-50">
                        <td className="font-medium text-red-800">{o.debtor_name}</td>
                        <td className="text-xs">{o.its_number}</td>
                        <td className="font-mono text-xs">{o.loan_number}</td>
                        <td>{fmt(o.monthly_installment)}</td>
                        <td className="font-bold text-red-700">{fmt(o.outstanding_balance)}</td>
                        <td className="text-red-600">{formatDate(o.next_due_date)}</td>
                        <td><a href={`tel:${o.phone}`} className="text-primary-800 text-xs hover:underline">{o.phone}</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Transaction Report Tab ──────────────────────────────────────────────────
function TransactionReportTab({ fmt }) {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const [filters, setFilters] = useState({ startDate: firstOfMonth, endDate: '', type: '', userId: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.get('/reports/users-for-select').then(r => setUsers(r.data.data || [])).catch(() => {});
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.type) params.set('type', filters.type);
      if (filters.userId) params.set('userId', filters.userId);
      const res = await api.get(`/reports/transactions?${params}`);
      setData(res.data.data);
    } catch { toast.error('Failed to load transaction report'); }
    finally { setLoading(false); }
  };

  const handleDownload = () => {
    if (!data) return;
    downloadPDF('Transaction_Report', (doc, autoTable) => {
      doc.setFontSize(18);
      doc.text('Qardan Hasana – Transaction Report', 14, 18);
      doc.setFontSize(10);
      if (filters.startDate) doc.text(`From: ${filters.startDate}`, 14, 26);
      if (filters.endDate) doc.text(`To: ${filters.endDate}`, 60, 26);
      doc.text(`Total Transactions: ${data.total}  |  Total Amount: ${fmt(data.totalAmount)}`, 14, 32);

      doc.setFontSize(13);
      doc.text('Breakdown by Type', 14, 42);
      autoTable(doc, {
        startY: 46,
        head: [['Type', 'Count', 'Total Amount']],
        body: (data.breakdown || []).map(b => [b.type.replace(/_/g, ' '), b.count, fmt(b.total)]),
        theme: 'grid', headStyles: { fillColor: [27, 67, 50] },
      });

      let y = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(13);
      doc.text('Transactions', 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Ref #', 'Type', 'From', 'To', 'Amount', 'Date']],
        body: (data.transactions || []).map(t => [t.transaction_number, t.type?.replace(/_/g, ' '), t.from_name || '—', t.to_name || '—', fmt(t.amount), formatDate(t.transaction_date)]),
        theme: 'grid', headStyles: { fillColor: [27, 67, 50] },
        styles: { fontSize: 8 },
      });
    });
  };

  const TXN_TYPES = ['loan_disbursement', 'loan_repayment', 'deposit', 'withdrawal', 'transfer', 'fee', 'adjustment'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="input-label">From</label>
          <input type="date" className="input-field" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
        </div>
        <div>
          <label className="input-label">To</label>
          <input type="date" className="input-field" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
        </div>
        <div>
          <label className="input-label">Type</label>
          <select className="input-field w-44" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
            <option value="">All Types</option>
            {TXN_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">User</label>
          <select className="input-field w-48" value={filters.userId} onChange={(e) => setFilters({ ...filters, userId: e.target.value })}>
            <option value="">All Users</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.its_number})</option>)}
          </select>
        </div>
        <button onClick={fetchData} className="btn-outline btn-sm flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> Apply</button>
        <button onClick={handleDownload} disabled={!data} className="btn-primary btn-sm flex items-center gap-1.5"><Download className="w-4 h-4" /> PDF</button>
      </div>

      {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Total Transactions" value={data.total} color="border-l-primary-800" />
            <StatBox label="Total Amount" value={fmt(data.totalAmount)} color="border-l-blue-500" />
            {(data.breakdown || []).slice(0, 2).map((b) => (
              <StatBox key={b.type} label={b.type.replace(/_/g, ' ')} value={fmt(b.total)} sub={`${b.count} txns`} color="border-l-green-600" />
            ))}
          </div>

          {data.breakdown?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-4">By Type</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.breakdown.map(b => ({ name: b.type.replace(/_/g, ' '), value: parseFloat(b.total) }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Bar dataKey="value" fill="#1B4332" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold mb-4">Transactions ({data.total})</h3>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Ref #</th><th>Type</th><th>From</th><th>To</th><th>Loan</th><th>Amount</th><th>Date</th></tr></thead>
                <tbody>
                  {(data.transactions || []).map((t, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs">{t.transaction_number}</td>
                      <td><span className="badge badge-blue text-xs">{t.type?.replace(/_/g, ' ')}</span></td>
                      <td className="text-sm">{t.from_name || '—'}<span className="text-xs text-dark-400 ml-1">{t.from_its}</span></td>
                      <td className="text-sm">{t.to_name || '—'}<span className="text-xs text-dark-400 ml-1">{t.to_its}</span></td>
                      <td className="font-mono text-xs text-dark-500">{t.loan_number || '—'}</td>
                      <td className="font-semibold">{fmt(t.amount)}</td>
                      <td className="text-xs">{formatDate(t.transaction_date)}</td>
                    </tr>
                  ))}
                  {(!data.transactions || data.transactions.length === 0) && (
                    <tr><td colSpan={7} className="text-center py-8 text-dark-400">No transactions found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Ledger Statement Tab ────────────────────────────────────────────────────
function LedgerStatementTab({ fmt }) {
  const [userId, setUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.get('/reports/users-for-select').then(r => setUsers(r.data.data || [])).catch(() => {});
  }, []);

  const fetchData = async () => {
    if (!userId) { toast.error('Please select a user'); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await api.get(`/reports/ledger-statement?${params}`);
      setData(res.data.data);
    } catch { toast.error('Failed to load ledger statement'); }
    finally { setLoading(false); }
  };

  const handleDownload = () => {
    if (!data) return;
    const u = data.user;
    downloadPDF(`Ledger_Statement_${u?.name || userId}`, (doc, autoTable) => {
      doc.setFontSize(18);
      doc.text('Qardan Hasana – Ledger Statement', 14, 18);
      doc.setFontSize(10);
      doc.text(`Account: ${u?.name}  |  ITS: ${u?.its_number}`, 14, 26);
      if (u?.creditor_number) doc.text(`Creditor #: ${u.creditor_number}`, 14, 32);
      if (u?.debtor_number) doc.text(`Debtor #: ${u.debtor_number}`, 80, 32);
      doc.text(`Period: ${startDate || 'All time'} to ${endDate || 'Present'}`, 14, 38);
      doc.text(`Total Credits: ${fmt(data.totalCredits)}  |  Total Debits: ${fmt(data.totalDebits)}  |  Net: ${fmt(data.netBalance)}`, 14, 44);

      autoTable(doc, {
        startY: 50,
        head: [['Date', 'Description', 'Reference', 'Type', 'Amount', 'Balance After']],
        body: (data.entries || []).map(e => [
          formatDate(e.entry_date),
          (e.description || '').substring(0, 40),
          e.transaction_number || e.reference || '—',
          e.entry_type,
          `${e.entry_type === 'credit' ? '+' : '-'}${fmt(e.amount)}`,
          fmt(e.balance_after),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [27, 67, 50] },
        styles: { fontSize: 8 },
        columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="input-label">Account Holder</label>
          <select className="input-field w-56" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Select user...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.its_number}) {u.creditor_number ? `[C: ${u.creditor_number}]` : ''}{u.debtor_number ? `[D: ${u.debtor_number}]` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label">From</label>
          <input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="input-label">To</label>
          <input type="date" className="input-field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <button onClick={fetchData} className="btn-primary btn-sm flex items-center gap-1.5"><FileText className="w-4 h-4" /> Generate</button>
        <button onClick={handleDownload} disabled={!data} className="btn-outline btn-sm flex items-center gap-1.5"><Download className="w-4 h-4" /> PDF</button>
      </div>

      {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : data && (
        <>
          <div className="card">
            <div className="flex flex-wrap gap-4 items-start justify-between">
              <div>
                <h3 className="font-bold text-lg">{data.user?.name}</h3>
                <p className="text-sm text-dark-500">ITS: {data.user?.its_number}</p>
                {data.user?.creditor_number && <p className="text-xs text-purple-700">Creditor: {data.user.creditor_number}</p>}
                {data.user?.debtor_number && <p className="text-xs text-blue-700">Debtor: {data.user.debtor_number}</p>}
              </div>
              <div className="grid grid-cols-3 gap-4 text-right">
                <div><p className="text-xs text-dark-400">Total Credits</p><p className="font-bold text-green-700 text-lg">{fmt(data.totalCredits)}</p></div>
                <div><p className="text-xs text-dark-400">Total Debits</p><p className="font-bold text-red-600 text-lg">{fmt(data.totalDebits)}</p></div>
                <div><p className="text-xs text-dark-400">Net Balance</p><p className={`font-bold text-lg ${data.netBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(data.netBalance)}</p></div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">Ledger Entries ({data.total})</h3>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Date</th><th>Description</th><th>Reference</th><th>Type</th><th>Amount</th><th>Balance After</th></tr></thead>
                <tbody>
                  {(data.entries || []).map((e, i) => (
                    <tr key={i}>
                      <td className="text-xs">{formatDate(e.entry_date)}</td>
                      <td className="text-sm">
                        {e.description}
                        {e.loan_number && <span className="text-xs text-dark-400 ml-1">[{e.loan_number}]</span>}
                      </td>
                      <td className="font-mono text-xs">{e.transaction_number || e.reference || '—'}</td>
                      <td><span className={`badge ${e.entry_type === 'credit' ? 'badge-green' : 'badge-red'} text-xs`}>{e.entry_type === 'credit' ? '↑ Credit' : '↓ Debit'}</span></td>
                      <td className={`font-semibold ${e.entry_type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {e.entry_type === 'credit' ? '+' : '-'}{fmt(e.amount)}
                      </td>
                      <td className="font-medium">{fmt(e.balance_after)}</td>
                    </tr>
                  ))}
                  {(!data.entries || data.entries.length === 0) && (
                    <tr><td colSpan={6} className="text-center py-8 text-dark-400">No ledger entries found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Forecast Report Tab ─────────────────────────────────────────────────────
function ForecastReportTab({ fmt }) {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/forecast?months=${months}`);
      setData(res.data.data);
    } catch { toast.error('Failed to load forecast'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [months]);

  const handleDownload = () => {
    if (!data) return;
    downloadPDF('Repayment_Forecast', (doc, autoTable) => {
      doc.setFontSize(18);
      doc.text('Qardan Hasana – Repayment Forecast', 14, 18);
      doc.setFontSize(10);
      doc.text(`Next ${months} months  |  Generated: ${new Date().toLocaleDateString()}`, 14, 26);

      doc.setFontSize(13);
      doc.text('Monthly Expected Collections', 14, 36);
      autoTable(doc, {
        startY: 40,
        head: [['Month', 'Active Loans', 'Expected Total']],
        body: (data.monthlyForecasts || []).map(m => [m.label, m.loanCount, fmt(m.expectedTotal)]),
        theme: 'grid', headStyles: { fillColor: [27, 67, 50] },
      });

      let y = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(13);
      doc.text('Upcoming Installments', 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Debtor', 'ITS', 'Loan #', 'Monthly', 'Outstanding', 'Due Date', 'Overdue']],
        body: (data.upcomingInstallments || []).map(u => [u.debtor_name, u.its_number, u.loan_number, fmt(u.monthly_installment), fmt(u.outstanding_balance), formatDate(u.next_due_date), u.is_overdue ? 'YES' : '']),
        theme: 'grid', headStyles: { fillColor: [27, 67, 50] },
        styles: { fontSize: 8 },
      });
    });
  };

  const totalForecast = (data?.monthlyForecasts || []).reduce((s, m) => s + m.expectedTotal, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="input-label">Forecast Horizon</label>
          <select className="input-field w-32" value={months} onChange={(e) => setMonths(parseInt(e.target.value))}>
            {[3, 6, 12, 18, 24].map(m => <option key={m} value={m}>{m} months</option>)}
          </select>
        </div>
        <button onClick={fetchData} className="btn-outline btn-sm flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> Refresh</button>
        <button onClick={handleDownload} disabled={!data} className="btn-primary btn-sm flex items-center gap-1.5"><Download className="w-4 h-4" /> PDF</button>
      </div>

      {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatBox label={`Expected (${months}mo)`} value={fmt(totalForecast)} color="border-l-green-600" />
            <StatBox label="Active Loans" value={data.upcomingInstallments?.length || 0} color="border-l-primary-800" />
            <StatBox label="Overdue Now" value={data.upcomingInstallments?.filter(u => u.is_overdue).length || 0} color="border-l-red-600" />
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">Monthly Expected Collections</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.monthlyForecasts || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="expectedTotal" fill="#1B4332" radius={[4, 4, 0, 0]} name="Expected" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">Upcoming Installments</h3>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Debtor</th><th>ITS</th><th>Loan #</th><th>Monthly</th><th>Outstanding</th><th>Due Date</th><th>Status</th><th>Phone</th></tr></thead>
                <tbody>
                  {(data.upcomingInstallments || []).map((u, i) => (
                    <tr key={i} className={u.is_overdue ? 'bg-red-50' : ''}>
                      <td className={`font-medium ${u.is_overdue ? 'text-red-800' : ''}`}>{u.debtor_name}</td>
                      <td className="text-xs">{u.its_number}</td>
                      <td className="font-mono text-xs">{u.loan_number}</td>
                      <td className="font-semibold">{fmt(u.monthly_installment)}</td>
                      <td className={u.is_overdue ? 'text-red-700 font-semibold' : ''}>{fmt(u.outstanding_balance)}</td>
                      <td className={u.is_overdue ? 'text-red-600' : ''}>{formatDate(u.next_due_date)}</td>
                      <td>{u.is_overdue ? <span className="badge badge-red text-xs">Overdue</span> : <span className="badge badge-green text-xs">Current</span>}</td>
                      <td><a href={`tel:${u.phone}`} className="text-primary-800 text-xs hover:underline">{u.phone}</a></td>
                    </tr>
                  ))}
                  {(!data.upcomingInstallments || data.upcomingInstallments.length === 0) && (
                    <tr><td colSpan={8} className="text-center py-8 text-dark-400">No upcoming installments</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const fmt = useCurrency();
  const currency = useSelector((s) => s.settings.currency);
  const [tab, setTab] = useState('monthly');

  const tabs = [
    { key: 'monthly', label: 'Monthly Report', icon: Calendar },
    { key: 'transactions', label: 'Transactions', icon: TrendingUp },
    { key: 'ledger', label: 'Ledger Statement', icon: BookOpen },
    { key: 'forecast', label: 'Forecast', icon: FileText },
    { key: 'overview', label: 'Overview', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Financial reports, statements, and forecasts</p>
        </div>
      </div>

      <div className="flex gap-1 bg-dark-100 p-1 rounded-xl w-fit overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.key ? 'bg-white text-primary-900 shadow-sm' : 'text-dark-500 hover:text-dark-700'}`}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'monthly' && <MonthlyReportTab fmt={fmt} currency={currency} />}
      {tab === 'transactions' && <TransactionReportTab fmt={fmt} />}
      {tab === 'ledger' && <LedgerStatementTab fmt={fmt} />}
      {tab === 'forecast' && <ForecastReportTab fmt={fmt} />}
      {tab === 'overview' && <OverviewTab fmt={fmt} currency={currency} />}
    </div>
  );
}

// ─── Original Overview Tab ───────────────────────────────────────────────────
function OverviewTab({ fmt, currency }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('overview');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/cash-status');
      setData(res.data.data);
    } catch { toast.error('Failed to load overview'); }
    finally { setLoading(false); }
  };

  const subTabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'collections', label: 'Recent Collections' },
    { key: 'dues', label: 'Dues This Cycle' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'creditors', label: 'Creditors' },
  ];

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  const { summary, recentCollections, dueThisCycle, overdueAccounts, creditorSummary } = data || {};

  const chartData = [
    { name: 'Total Disbursed', value: summary?.totalDisbursed || 0 },
    { name: 'Total Repaid', value: summary?.totalRepaid || 0 },
    { name: 'Outstanding', value: summary?.totalOutstanding || 0 },
    { name: 'Overdue', value: summary?.overdueAmount || 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={fetchData} className="btn-outline btn-sm flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBox label="Total Disbursed" value={fmt(summary?.totalDisbursed)} color="border-l-blue-500" />
        <StatBox label="Total Repaid" value={fmt(summary?.totalRepaid)} color="border-l-green-600" />
        <StatBox label="Outstanding" value={fmt(summary?.totalOutstanding)} color="border-l-yellow-500" />
        <StatBox label="Overdue Amount" value={fmt(summary?.overdueAmount)} sub={`${summary?.overdueCount} accounts`} color="border-l-red-600" />
        <StatBox label="Active Loans" value={summary?.activeLoansCount || 0} color="border-l-primary-800" />
        <StatBox label="Currency" value={currency || 'INR'} color="border-l-gold-500" />
      </div>

      <div className="flex gap-1 bg-dark-100 p-1 rounded-xl w-fit overflow-x-auto">
        {subTabs.map((t) => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${subTab === t.key ? 'bg-white text-primary-900 shadow-sm' : 'text-dark-500 hover:text-dark-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold mb-4">Financial Overview</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${currency} ${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="value" fill="#1B4332" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-4">Quick Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-dark-50">
                <span className="text-sm text-dark-600">Recovery Rate</span>
                <span className="font-bold text-green-700">{summary?.totalDisbursed > 0 ? ((summary.totalRepaid / summary.totalDisbursed) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dark-50">
                <span className="text-sm text-dark-600">Overdue Rate</span>
                <span className="font-bold text-red-600">{summary?.activeLoansCount > 0 ? ((summary.overdueCount / summary.activeLoansCount) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dark-50">
                <span className="text-sm text-dark-600">Avg Loan Size</span>
                <span className="font-bold">{fmt(summary?.activeLoansCount > 0 ? summary.totalOutstanding / summary.activeLoansCount : 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'collections' && (
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
                    <td className="font-semibold text-green-700">{fmt(r.amount)}</td>
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

      {subTab === 'dues' && (
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
                    <td className="font-semibold">{fmt(d.monthly_installment)}</td>
                    <td>{formatDate(d.next_due_date)}</td>
                    <td className="text-orange-600 font-semibold">{fmt(d.outstanding_balance)}</td>
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

      {subTab === 'overdue' && (
        <div className="card">
          <h3 className="font-semibold mb-4 text-red-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Overdue Accounts ({(overdueAccounts || []).length})</h3>
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
                    <td className="font-bold text-red-700">{fmt(o.overdue_amount || o.monthly_installment)}</td>
                    <td className="font-semibold text-red-600">{fmt(o.outstanding_balance)}</td>
                    <td><a href={`tel:${o.phone}`} className="text-primary-800 text-xs hover:underline">{o.phone}</a></td>
                  </tr>
                ))}
                {(!overdueAccounts || overdueAccounts.length === 0) && (
                  <tr><td colSpan={7} className="text-center py-6 text-dark-400">No overdue accounts</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'creditors' && (
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
                    <td className="font-semibold">{fmt(c.total_given)}</td>
                    <td className="text-green-700">{fmt(c.total_recovered)}</td>
                    <td className="font-bold text-orange-700">{fmt(c.outstanding_amount)}</td>
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
