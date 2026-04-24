import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../utils/api';
import { hasRole, formatDate, formatCurrency } from '../utils/helpers';
import Toggle from '../components/common/Toggle';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'personal', label: 'Personal', icon: '👤' },
  { key: 'debtor', label: 'Debtor', icon: '📋' },
  { key: 'creditor', label: 'Creditor', icon: '🏦' },
  { key: 'guarantor', label: 'Guarantor', icon: '🤝' },
];

export default function UserProfilePage({ isSelf, isNew }) {
  const { id } = useParams();
  const { user: authUser } = useSelector((s) => s.auth);
  const navigate = useNavigate();
  const isAdmin = hasRole(authUser, 'admin');
  const isAccountant = hasRole(authUser, 'admin', 'accountant');
  const userId = isSelf ? authUser.id : id;

  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('personal');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', dateOfBirth: '', gender: '', email: '',
    addressLine1: '', addressLine2: '', city: '', state: '', country: 'India', postalCode: '',
    involvedInInterest: false, involvedInInsurance: false, involvedInSubstanceAbuse: false,
    involvedInCrypto: false, involvedInPonzi: false, involvedInOtherSchemes: false,
    otherSchemesDescription: '',
  });

  useEffect(() => {
    if (!isNew && userId) fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users/${userId}`);
      const u = res.data.data;
      setUser(u);
      setForm({
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        phone: u.phone || '',
        dateOfBirth: u.date_of_birth ? u.date_of_birth.split('T')[0] : '',
        gender: u.gender || '',
        email: u.email || '',
        addressLine1: u.address_line1 || '',
        addressLine2: u.address_line2 || '',
        city: u.city || '',
        state: u.state || '',
        country: u.country || 'India',
        postalCode: u.postal_code || '',
        involvedInInterest: u.involved_in_interest || false,
        involvedInInsurance: u.involved_in_insurance || false,
        involvedInSubstanceAbuse: u.involved_in_substance_abuse || false,
        involvedInCrypto: u.involved_in_crypto || false,
        involvedInPonzi: u.involved_in_ponzi || false,
        involvedInOtherSchemes: u.involved_in_other_schemes || false,
        otherSchemesDescription: u.other_schemes_description || '',
      });
    } catch (err) {
      toast.error('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/users/${userId}`, form);
      toast.success(isAdmin ? 'Profile updated successfully' : 'Profile update submitted for approval');
      fetchUser();
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwdForm.newPassword !== pwdForm.confirm) return toast.error('Passwords do not match');
    if (pwdForm.newPassword.length < 8) return toast.error('Password must be at least 8 characters');
    try {
      await api.put(`/users/${userId}/password`, { currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword });
      toast.success('Password changed successfully');
      setShowPwdModal(false);
      setPwdForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch {
      toast.error('Failed to change password');
    }
  };

  const createProfile = async (type) => {
    try {
      await api.post(`/profiles/${type}`, { userId });
      toast.success(`${type} profile created`);
      fetchUser();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create profile');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;

  const canEdit = isSelf || isAdmin;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isNew ? 'Create User' : isSelf ? 'My Profile' : `${user?.first_name} ${user?.last_name}`}</h1>
          <p className="page-subtitle">ITS: {user?.its_number || '—'} · {user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.is_active !== undefined && <StatusBadge status={user.is_active ? 'active' : 'inactive'} />}
          {(isSelf || userId === authUser.id) && (
            <button onClick={() => setShowPwdModal(true)} className="btn-outline btn-sm">🔒 Change Password</button>
          )}
          {canEdit && (
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : isAdmin ? 'Save Changes' : 'Submit for Approval'}
            </button>
          )}
        </div>
      </div>

      {/* Pending changes notice */}
      {user?.profile_changes_pending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm font-medium">⏳ Profile changes are pending admin approval</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-primary-900 shadow-sm' : 'text-dark-500 hover:text-dark-700'
            }`}
          >
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Personal Tab */}
      {tab === 'personal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card space-y-5">
            <h3 className="text-primary-900 font-semibold border-b pb-2">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">First Name</label>
                <input className="input-field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} disabled={!canEdit} />
              </div>
              <div>
                <label className="input-label">Last Name</label>
                <input className="input-field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} disabled={!canEdit} />
              </div>
              <div>
                <label className="input-label">Email</label>
                <input className="input-field" type="email" value={form.email} disabled />
              </div>
              <div>
                <label className="input-label">Phone</label>
                <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!canEdit} />
              </div>
              <div>
                <label className="input-label">Date of Birth</label>
                <input className="input-field" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} disabled={!canEdit} />
              </div>
              <div>
                <label className="input-label">Gender</label>
                <select className="input-field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} disabled={!canEdit}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <h3 className="text-primary-900 font-semibold border-b pb-2 pt-2">Address</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="input-label">Address Line 1</label>
                <input className="input-field" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} disabled={!canEdit} />
              </div>
              <div className="sm:col-span-2">
                <label className="input-label">Address Line 2</label>
                <input className="input-field" value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} disabled={!canEdit} />
              </div>
              <div>
                <label className="input-label">City</label>
                <input className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} disabled={!canEdit} />
              </div>
              <div>
                <label className="input-label">State</label>
                <input className="input-field" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} disabled={!canEdit} />
              </div>
              <div>
                <label className="input-label">Country</label>
                <input className="input-field" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} disabled={!canEdit} />
              </div>
              <div>
                <label className="input-label">Postal Code</label>
                <input className="input-field" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} disabled={!canEdit} />
              </div>
            </div>
          </div>

          {/* Risk profile */}
          <div className="card space-y-4">
            <h3 className="text-primary-900 font-semibold border-b pb-2">Involvement Disclosure</h3>
            <p className="text-xs text-dark-400">Required for eligibility assessment</p>
            {[
              { key: 'involvedInInterest', label: 'Interest / Riba' },
              { key: 'involvedInInsurance', label: 'Insurance' },
              { key: 'involvedInSubstanceAbuse', label: 'Substance Abuse' },
              { key: 'involvedInCrypto', label: 'Cryptocurrency' },
              { key: 'involvedInPonzi', label: 'Ponzi / MLM Schemes' },
              { key: 'involvedInOtherSchemes', label: 'Other Schemes' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-1.5 border-b border-dark-50">
                <span className="text-sm text-dark-700">{label}</span>
                <Toggle
                  checked={form[key]}
                  onChange={(v) => setForm({ ...form, [key]: v })}
                  disabled={!canEdit}
                />
              </div>
            ))}
            {form.involvedInOtherSchemes && (
              <div>
                <label className="input-label">Describe other schemes</label>
                <textarea className="input-field" rows={2} value={form.otherSchemesDescription}
                  onChange={(e) => setForm({ ...form, otherSchemesDescription: e.target.value })}
                  disabled={!canEdit} />
              </div>
            )}

            {/* Roles */}
            {user?.role_display_names && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-dark-500 mb-2">ROLES</p>
                <div className="flex flex-wrap gap-1">
                  {user.role_display_names.filter(Boolean).map((r, i) => (
                    <span key={i} className="badge badge-green">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Debtor Tab */}
      {tab === 'debtor' && (
        <div className="card">
          {user?.debtor_id ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div><p className="text-xs text-dark-400">Debtor Number</p><p className="font-semibold">{user.debtor_number}</p></div>
                <div><p className="text-xs text-dark-400">Total Borrowed</p><p className="font-semibold">{formatCurrency(user.total_borrowed)}</p></div>
                <div><p className="text-xs text-dark-400">Total Repaid</p><p className="font-semibold text-green-700">{formatCurrency(user.total_repaid)}</p></div>
                <div><p className="text-xs text-dark-400">Outstanding</p><p className="font-semibold text-red-700">{formatCurrency(user.outstanding_balance)}</p></div>
                <div><p className="text-xs text-dark-400">Status</p><StatusBadge status={user.debtor_status} /></div>
              </div>
              <div className="pt-3 border-t">
                <button onClick={() => navigate('/loans')} className="btn-outline btn-sm">View Loans →</button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-dark-400 mb-4">No debtor profile found</p>
              {isAccountant && (
                <button onClick={() => createProfile('debtor')} className="btn-primary">Create Debtor Profile</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Creditor Tab */}
      {tab === 'creditor' && (
        <div className="card">
          {user?.creditor_id ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <div><p className="text-xs text-dark-400">Creditor Number</p><p className="font-semibold">{user.creditor_number}</p></div>
              <div><p className="text-xs text-dark-400">Total Given</p><p className="font-semibold">{formatCurrency(user.total_given)}</p></div>
              <div><p className="text-xs text-dark-400">Total Recovered</p><p className="font-semibold text-green-700">{formatCurrency(user.total_recovered)}</p></div>
              <div><p className="text-xs text-dark-400">Outstanding</p><p className="font-semibold text-orange-700">{formatCurrency(user.creditor_outstanding)}</p></div>
              <div><p className="text-xs text-dark-400">Status</p><StatusBadge status={user.creditor_status} /></div>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-dark-400 mb-4">No creditor profile found</p>
              {isAccountant && (
                <button onClick={() => createProfile('creditor')} className="btn-primary">Create Creditor Profile</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Guarantor Tab */}
      {tab === 'guarantor' && (
        <div className="card">
          {user?.guarantor_id ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div><p className="text-xs text-dark-400">Guarantor Number</p><p className="font-semibold">{user.guarantor_number}</p></div>
              <div><p className="text-xs text-dark-400">Total Guaranteed</p><p className="font-semibold">{formatCurrency(user.total_guaranteed)}</p></div>
              <div><p className="text-xs text-dark-400">Active Guarantees</p><p className="font-semibold">{user.active_guarantees}</p></div>
              <div><p className="text-xs text-dark-400">Status</p><StatusBadge status={user.guarantor_status} /></div>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-dark-400 mb-4">No guarantor profile found</p>
              {isAccountant && (
                <button onClick={() => createProfile('guarantor')} className="btn-primary">Create Guarantor Profile</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Change Password Modal */}
      <Modal isOpen={showPwdModal} onClose={() => setShowPwdModal(false)} title="Change Password"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowPwdModal(false)} className="btn-outline">Cancel</button>
            <button onClick={handleChangePassword} className="btn-primary">Update Password</button>
          </div>
        }
      >
        <div className="space-y-4">
          {(isSelf || userId === authUser.id) && (
            <div>
              <label className="input-label">Current Password</label>
              <input type="password" className="input-field" value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })} />
            </div>
          )}
          <div>
            <label className="input-label">New Password</label>
            <input type="password" className="input-field" placeholder="Min. 8 characters" value={pwdForm.newPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })} />
          </div>
          <div>
            <label className="input-label">Confirm New Password</label>
            <input type="password" className="input-field" value={pwdForm.confirm}
              onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
