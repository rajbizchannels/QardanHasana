import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatDateTime } from '../utils/helpers';
import Pagination from '../components/common/Pagination';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const ACTION_COLORS = {
  LOGIN: 'badge-green', LOGOUT: 'badge-gray',
  LOGIN_FAILED: 'badge-red',
  USER_CREATED: 'badge-blue', USER_UPDATED: 'badge-blue', USER_DELETED: 'badge-red',
  LOAN_CREATED: 'badge-blue', LOAN_UPDATED: 'badge-yellow',
  TRANSACTION_CREATED: 'badge-blue', TRANSACTION_APPROVD: 'badge-green', TRANSACTION_DELETED: 'badge-red',
  DOCUMENT_UPLOADED: 'badge-blue',
  PASSWORD_RESET: 'badge-yellow', PASSWORD_CHANGED: 'badge-yellow',
  SETTING_UPDATED: 'badge-gray',
  ROLE_CREATED: 'badge-blue', ROLE_UPDATED: 'badge-yellow', ROLE_DELETED: 'badge-red',
  BACKUP_CREATED: 'badge-green',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ action: '', entityType: '', startDate: '', endDate: '' });
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { fetchLogs(); }, [page, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
      const res = await api.get(`/reports/audit-logs?${params}`);
      setLogs(res.data.data.logs);
      setTotal(res.data.data.total);
      setTotalPages(res.data.data.totalPages);
    } catch { toast.error('Failed to load audit logs'); }
    finally { setLoading(false); }
  };

  const ENTITY_TYPES = ['user', 'loan', 'transaction', 'document', 'approval', 'setting', 'role', 'backup'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">{total} audit log entries</p>
        </div>
        <button onClick={fetchLogs} className="btn-outline btn-sm">🔄 Refresh</button>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 mb-4">
          <input className="input-field max-w-xs" placeholder="Search action..." value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })} />
          <select className="input-field max-w-xs" value={filters.entityType} onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}>
            <option value="">All Entity Types</option>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="date" className="input-field w-auto" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
          <input type="date" className="input-field w-auto" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => setFilters({ action: '', entityType: '', startDate: '', endDate: '' })} className="text-sm text-dark-400 hover:text-dark-700">✕ Clear</button>
          )}
        </div>

        {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>IP</th><th>Status</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <>
                      <tr key={l.id} className="cursor-pointer" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                        <td className="text-xs whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                        <td>
                          <p className="text-sm font-medium">{l.user_name || 'System'}</p>
                          {l.its_number && <p className="text-xs text-dark-400">ITS: {l.its_number}</p>}
                        </td>
                        <td>
                          <span className={`badge ${ACTION_COLORS[l.action] || 'badge-gray'} text-xs`}>{l.action?.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="text-xs">
                          {l.entity_type && <span className="font-medium">{l.entity_type}</span>}
                          {l.entity_id && <p className="text-dark-400 font-mono">{l.entity_id?.split('-')[0]}…</p>}
                        </td>
                        <td className="text-xs font-mono">{l.ip_address || '—'}</td>
                        <td>
                          <span className={`badge ${l.status === 'success' ? 'badge-green' : 'badge-red'} text-xs`}>{l.status}</span>
                        </td>
                        <td>
                          {(l.new_values || l.old_values) && (
                            <button className="text-xs text-primary-800 hover:underline">
                              {expanded === l.id ? '▲ Hide' : '▼ Show'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded === l.id && (l.new_values || l.old_values || l.error_message) && (
                        <tr key={`${l.id}-detail`} className="bg-dark-50">
                          <td colSpan={7} className="p-3">
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              {l.old_values && (
                                <div>
                                  <p className="font-semibold text-dark-500 mb-1">Before:</p>
                                  <pre className="bg-white border rounded p-2 overflow-auto max-h-24 font-mono text-dark-700">
                                    {JSON.stringify(l.old_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {l.new_values && (
                                <div>
                                  <p className="font-semibold text-dark-500 mb-1">After:</p>
                                  <pre className="bg-white border rounded p-2 overflow-auto max-h-24 font-mono text-dark-700">
                                    {JSON.stringify(l.new_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {l.error_message && <div className="col-span-2 text-red-600">Error: {l.error_message}</div>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-dark-400">No audit logs found</td></tr>
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
