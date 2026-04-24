import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../utils/api';
import { hasRole, formatDate, formatDateTime } from '../utils/helpers';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const { user: authUser } = useSelector((s) => s.auth);
  const navigate = useNavigate();
  const isAdmin = hasRole(authUser, 'admin');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ itsNumber: '', email: '', firstName: '', lastName: '', phone: '', roles: ['member'] });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.append('search', search);
      const res = await api.get(`/users?${params}`);
      setUsers(res.data.data.users);
      setTotalPages(res.data.data.totalPages);
      setTotal(res.data.data.total);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/users', newUser);
      toast.success('User created successfully');
      setShowCreate(false);
      setNewUser({ itsNumber: '', email: '', firstName: '', lastName: '', phone: '', roles: ['member'] });
      fetchUsers();
    } catch {
      toast.error('Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const ROLE_OPTS = ['admin', 'accountant', 'member', 'creditor', 'debtor', 'viewer'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{total} total users in the system</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ Add User</button>
        )}
      </div>

      <div className="card">
        <div className="flex gap-3 mb-4">
          <input
            className="input-field max-w-sm"
            placeholder="Search by name, ITS, or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>ITS Number</th><th>Name</th><th>Email</th><th>Phone</th>
                    <th>Roles</th><th>Status</th><th>Last Login</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="font-mono text-xs">{u.its_number}</td>
                      <td className="font-medium">{u.first_name} {u.last_name}</td>
                      <td className="text-xs">{u.email}</td>
                      <td>{u.phone || '—'}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {(u.roles || []).filter(Boolean).slice(0, 2).map((r, i) => (
                            <span key={i} className="badge badge-blue text-xs">{r}</span>
                          ))}
                        </div>
                      </td>
                      <td><StatusBadge status={u.is_active ? 'active' : 'inactive'} /></td>
                      <td className="text-xs">{u.last_login ? formatDateTime(u.last_login) : 'Never'}</td>
                      <td>
                        <Link to={`/users/${u.id}`} className="text-primary-800 hover:underline text-sm">View</Link>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-dark-400">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New User"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="btn-outline">Cancel</button>
            <button onClick={handleCreate} disabled={creating} className="btn-primary">
              {creating ? 'Creating...' : 'Create User'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="input-label">First Name *</label><input className="input-field" required value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} /></div>
            <div><label className="input-label">Last Name *</label><input className="input-field" required value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} /></div>
          </div>
          <div><label className="input-label">ITS Number *</label><input className="input-field" required value={newUser.itsNumber} onChange={(e) => setNewUser({ ...newUser, itsNumber: e.target.value })} placeholder="e.g. 10000010" /></div>
          <div><label className="input-label">Email *</label><input type="email" className="input-field" required value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
          <div><label className="input-label">Phone</label><input className="input-field" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} /></div>
          <div>
            <label className="input-label">Roles</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {ROLE_OPTS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={newUser.roles.includes(r)}
                    onChange={(e) => setNewUser({ ...newUser, roles: e.target.checked ? [...newUser.roles, r] : newUser.roles.filter(x => x !== r) })} />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-dark-400">Default password will be the ITS number. User should change on first login.</p>
        </form>
      </Modal>
    </div>
  );
}
