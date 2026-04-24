import { useState, useEffect } from 'react';
import api from '../utils/api';
import Modal from '../components/common/Modal';
import Toggle from '../components/common/Toggle';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const MODULE_ICONS = { users: '👥', profiles: '🪪', loans: '📋', transactions: '💳', ledger: '📒', documents: '📎', reports: '📊', approvals: '✅', settings: '⚙️', rbac: '🛡️', backup: '☁️' };

export default function RBACPage() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(null);
  const [showDelete, setShowDelete] = useState(null);
  const [form, setForm] = useState({ name: '', displayName: '', description: '', permissions: [] });
  const [saving, setSaving] = useState(false);

  const permsByModule = permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([api.get('/rbac/roles'), api.get('/rbac/permissions')]);
      setRoles(rolesRes.data.data);
      setPermissions(permsRes.data.data);
    } catch { toast.error('Failed to load RBAC data'); }
    finally { setLoading(false); }
  };

  const openEdit = (role) => {
    setShowEdit(role);
    setForm({ name: role.name, displayName: role.display_name, description: role.description || '', permissions: role.permissions || [] });
  };

  const openCreate = () => {
    setForm({ name: '', displayName: '', description: '', permissions: [] });
    setShowCreate(true);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/rbac/roles', form);
      toast.success('Role created');
      setShowCreate(false);
      fetchData();
    } catch { toast.error('Failed to create role'); }
    finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await api.put(`/rbac/roles/${showEdit.id}`, form);
      toast.success('Role updated');
      setShowEdit(null);
      fetchData();
    } catch { toast.error('Failed to update role'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/rbac/roles/${showDelete.id}`);
      toast.success('Role deleted');
      setShowDelete(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete role'); }
  };

  const togglePerm = (permName) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permName)
        ? prev.permissions.filter(p => p !== permName)
        : [...prev.permissions, permName],
    }));
  };

  const toggleModule = (module) => {
    const modPerms = permsByModule[module].map(p => p.name);
    const allSelected = modPerms.every(p => form.permissions.includes(p));
    setForm(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !modPerms.includes(p))
        : [...new Set([...prev.permissions, ...modPerms])],
    }));
  };

  const PermissionEditor = () => (
    <div className="space-y-3 mt-2">
      {Object.entries(permsByModule).map(([module, perms]) => {
        const allSelected = perms.every(p => form.permissions.includes(p.name));
        return (
          <div key={module} className="border border-dark-100 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-dark-50 cursor-pointer" onClick={() => toggleModule(module)}>
              <span className="text-sm font-medium capitalize">{MODULE_ICONS[module]} {module}</span>
              <Toggle checked={allSelected} onChange={() => toggleModule(module)} />
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {perms.map((p) => (
                <label key={p.name} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.permissions.includes(p.name)} onChange={() => togglePerm(p.name)} />
                  <span>{p.action}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">RBAC — Roles & Permissions</h1>
          <p className="page-subtitle">{roles.length} roles · {permissions.length} permissions</p>
        </div>
        <button onClick={openCreate} className="btn-primary">+ Create Role</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div key={role.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-dark-900">{role.display_name}</h3>
                  {role.is_system && <span className="badge badge-gold text-xs">System</span>}
                  {!role.is_active && <span className="badge badge-gray text-xs">Inactive</span>}
                </div>
                <p className="text-xs text-dark-400 font-mono mt-0.5">{role.name}</p>
              </div>
              <span className="text-sm text-dark-500 font-medium">{role.user_count} users</span>
            </div>
            {role.description && <p className="text-sm text-dark-500 mb-3">{role.description}</p>}
            <div className="mb-3">
              <p className="text-xs text-dark-400 mb-1.5">{(role.permissions || []).filter(Boolean).length} permissions</p>
              <div className="flex flex-wrap gap-1">
                {(role.permissions || []).filter(Boolean).slice(0, 6).map((p, i) => (
                  <span key={i} className="badge badge-green text-xs">{p}</span>
                ))}
                {(role.permissions || []).filter(Boolean).length > 6 && (
                  <span className="badge badge-gray text-xs">+{(role.permissions || []).filter(Boolean).length - 6} more</span>
                )}
              </div>
            </div>
            {!role.is_system && (
              <div className="flex gap-2 pt-2 border-t border-dark-50">
                <button onClick={() => openEdit(role)} className="btn-outline btn-sm flex-1">Edit</button>
                <button onClick={() => setShowDelete(role)} className="btn-danger btn-sm">Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Role" size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="btn-outline">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Role'}</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="input-label">Role Name (slug) *</label><input className="input-field" placeholder="e.g. loan_officer" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })} required /></div>
            <div><label className="input-label">Display Name *</label><input className="input-field" placeholder="e.g. Loan Officer" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required /></div>
          </div>
          <div><label className="input-label">Description</label><input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div>
            <label className="input-label">Permissions</label>
            <PermissionEditor />
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!showEdit} onClose={() => setShowEdit(null)} title={`Edit Role: ${showEdit?.display_name}`} size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowEdit(null)} className="btn-outline">Cancel</button>
            <button onClick={handleUpdate} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div><label className="input-label">Display Name</label><input className="input-field" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></div>
          <div><label className="input-label">Description</label><input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="input-label">Permissions</label>
              <Toggle checked={form.isActive !== false} onChange={(v) => setForm({ ...form, isActive: v })} label="Active" />
            </div>
            <PermissionEditor />
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Delete Role"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowDelete(null)} className="btn-outline">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete Role</button>
          </div>
        }
      >
        <p>Are you sure you want to delete the role <strong>{showDelete?.display_name}</strong>?</p>
        <p className="text-sm text-dark-400 mt-1">This action cannot be undone. Roles assigned to users cannot be deleted.</p>
      </Modal>
    </div>
  );
}
