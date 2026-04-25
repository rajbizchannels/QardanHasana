import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Building, DollarSign, Bell, Lock, Cloud, Save, Download, Shield, Info, Settings, User } from 'lucide-react';
import api from '../utils/api';
import { hasRole } from '../utils/helpers';
import { setCurrency } from '../store/slices/settingsSlice';
import Toggle from '../components/common/Toggle';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const CURRENCIES = ['INR', 'USD', 'GBP', 'EUR', 'AED', 'SAR', 'PKR'];

function usePreferences(userId) {
  const key = `prefs_${userId}`;
  const load = () => {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
  };
  const [prefs, setPrefsState] = useState(load);
  const savePrefs = (updated) => {
    setPrefsState(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };
  return [prefs, savePrefs];
}

export default function SettingsPage() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const isAdmin = hasRole(user, 'admin');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(isAdmin ? 'general' : 'preferences');
  const [backuping, setBackuping] = useState(false);
  const [prefs, savePrefs] = usePreferences(user?.id);
  const [localPrefs, setLocalPrefs] = useState(prefs);

  useEffect(() => { if (isAdmin) fetchSettings(); else setLoading(false); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      const map = {};
      res.data.data.forEach(s => { map[s.key] = s.value; });
      setSettings(map);
    } catch { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(settings).map(([key, value]) => ({ key, value }));
      await api.put('/settings/bulk', { settings: entries });
      if (settings.currency) dispatch(setCurrency(settings.currency));
      toast.success('Settings saved successfully');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleSavePrefs = () => {
    savePrefs(localPrefs);
    toast.success('Preferences saved');
  };

  const updateSetting = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleBackup = async () => {
    setBackuping(true);
    try {
      const res = await api.post('/backup/create', {}, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded successfully');
    } catch { toast.error('Backup failed'); }
    finally { setBackuping(false); }
  };

  const getGoogleAuthUrl = async () => {
    try {
      const res = await api.get('/backup/auth-url');
      window.open(res.data.data.url, '_blank');
    } catch { toast.error('Failed to get Google auth URL'); }
  };

  const adminTabs = [
    { key: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { key: 'security', label: 'Security', icon: <Lock className="w-4 h-4" /> },
    { key: 'backup', label: 'Backup', icon: <Cloud className="w-4 h-4" /> },
  ];

  const tabs = [
    ...(isAdmin ? adminTabs : []),
    { key: 'preferences', label: 'My Preferences', icon: <User className="w-4 h-4" /> },
  ];

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">System configuration and preferences</p>
        </div>
        {isAdmin && tab !== 'preferences' && (
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        )}
        {tab === 'preferences' && (
          <button onClick={handleSavePrefs} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Preferences
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-dark-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-primary-900 shadow-sm' : 'text-dark-500 hover:text-dark-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* General Settings — admin only */}
      {tab === 'general' && isAdmin && (
        <div className="space-y-6 max-w-2xl">
          {/* Organization */}
          <div className="card space-y-5">
            <h3 className="font-semibold text-primary-900 border-b pb-2 flex items-center gap-2">
              <Building className="w-4 h-4" /> Organization Details
            </h3>
            <div>
              <label className="input-label">Organization Name</label>
              <input className="input-field" value={settings.org_name || ''} onChange={(e) => updateSetting('org_name', e.target.value)} />
            </div>
            <div>
              <label className="input-label">Organization Email</label>
              <input type="email" className="input-field" value={settings.org_email || ''} onChange={(e) => updateSetting('org_email', e.target.value)} />
            </div>
            <div>
              <label className="input-label">Organization Phone</label>
              <input className="input-field" value={settings.org_phone || ''} onChange={(e) => updateSetting('org_phone', e.target.value)} />
            </div>
          </div>

          {/* Financial */}
          <div className="card space-y-5">
            <h3 className="font-semibold text-primary-900 border-b pb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Financial Settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Default Currency</label>
                <select className="input-field" value={settings.currency || 'INR'} onChange={(e) => updateSetting('currency', e.target.value)}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Currency Symbol</label>
                <input className="input-field" value={settings.currency_symbol || '₹'} onChange={(e) => updateSetting('currency_symbol', e.target.value)} maxLength={3} />
              </div>
              <div>
                <label className="input-label">Min Loan Amount</label>
                <input type="number" className="input-field" value={settings.min_loan_amount || ''} onChange={(e) => updateSetting('min_loan_amount', e.target.value)} />
              </div>
              <div>
                <label className="input-label">Max Loan Amount</label>
                <input type="number" className="input-field" value={settings.max_loan_amount || ''} onChange={(e) => updateSetting('max_loan_amount', e.target.value)} />
              </div>
              <div>
                <label className="input-label">Max Loan Term (months)</label>
                <input type="number" className="input-field" value={settings.max_loan_term || ''} onChange={(e) => updateSetting('max_loan_term', e.target.value)} placeholder="e.g. 60" />
              </div>
              <div>
                <label className="input-label">Max Monthly Installments</label>
                <input type="number" className="input-field" value={settings.max_installments || ''} onChange={(e) => updateSetting('max_installments', e.target.value)} />
              </div>
              <div>
                <label className="input-label">Installment Grace Period (days)</label>
                <input type="number" className="input-field" value={settings.installment_grace_period || ''} onChange={(e) => updateSetting('installment_grace_period', e.target.value)} placeholder="e.g. 5" />
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border rounded-lg px-3">
              <div>
                <p className="text-sm font-medium">Require Guarantor for Loans</p>
                <p className="text-xs text-dark-400">All loan applications must have at least one guarantor</p>
              </div>
              <Toggle
                checked={settings.require_guarantor === 'true'}
                onChange={(v) => updateSetting('require_guarantor', v.toString())}
              />
            </div>
          </div>

          {/* Notifications & Registration */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-primary-900 border-b pb-2 flex items-center gap-2">
              <Bell className="w-4 h-4" /> Notifications & Access
            </h3>
            <div className="flex items-center justify-between py-2 border-b border-dark-50">
              <div>
                <p className="text-sm font-medium">Enable Email Notifications</p>
                <p className="text-xs text-dark-400">Send email notifications for all actions</p>
              </div>
              <Toggle
                checked={settings.notification_email === 'true'}
                onChange={(v) => updateSetting('notification_email', v.toString())}
              />
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-50">
              <div>
                <p className="text-sm font-medium">Allow Self Registration</p>
                <p className="text-xs text-dark-400">Let new users register without admin invite</p>
              </div>
              <Toggle
                checked={settings.allow_self_registration === 'true'}
                onChange={(v) => updateSetting('allow_self_registration', v.toString())}
              />
            </div>
            <div>
              <label className="input-label">Sender Email Address</label>
              <input type="email" className="input-field" value={settings.sender_email || ''} onChange={(e) => updateSetting('sender_email', e.target.value)} placeholder="noreply@example.com" />
              <p className="text-xs text-dark-400 mt-1">Used as the From address for all system emails</p>
            </div>
          </div>
        </div>
      )}

      {/* Security — admin only */}
      {tab === 'security' && isAdmin && (
        <div className="card max-w-2xl space-y-4">
          <h3 className="font-semibold text-primary-900 border-b pb-2">Security Settings</h3>
          <div>
            <label className="input-label">Session Timeout (seconds)</label>
            <input type="number" className="input-field" value={settings.session_timeout || 3600}
              onChange={(e) => updateSetting('session_timeout', e.target.value)} />
            <p className="text-xs text-dark-400 mt-1">Default: 3600 (1 hour). Set 0 to disable.</p>
          </div>
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-primary-800" />
              <h4 className="font-semibold text-primary-900">Security Features</h4>
            </div>
            <ul className="text-sm text-primary-800 space-y-1">
              <li>✓ JWT-based authentication with refresh tokens</li>
              <li>✓ Account lockout after 5 failed login attempts</li>
              <li>✓ Password hashing with bcrypt (12 rounds)</li>
              <li>✓ Rate limiting on API endpoints</li>
              <li>✓ CORS protection</li>
              <li>✓ Helmet.js security headers</li>
              <li>✓ Full audit trail for all actions</li>
            </ul>
          </div>
        </div>
      )}

      {/* Backup — admin only */}
      {tab === 'backup' && isAdmin && (
        <div className="card max-w-2xl space-y-5">
          <h3 className="font-semibold text-primary-900 border-b pb-2">Backup Settings</h3>
          <div>
            <label className="input-label">Backup Frequency</label>
            <select className="input-field" value={settings.backup_frequency || 'weekly'} onChange={(e) => updateSetting('backup_frequency', e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="border border-dark-200 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-dark-800">Manual Backup</h4>
            <p className="text-sm text-dark-500">Download a JSON backup of all data or upload to Google Drive.</p>
            <div className="flex gap-3">
              <button onClick={handleBackup} disabled={backuping} className="btn-primary flex items-center gap-2">
                <Download className="w-4 h-4" />
                {backuping ? 'Creating backup...' : 'Download Backup'}
              </button>
              <button onClick={getGoogleAuthUrl} className="btn-secondary flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                Connect Google Drive
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800">
              Backups include all users, loans, transactions, and ledger entries.
              Google Drive backups require OAuth2 authorization.
            </p>
          </div>
        </div>
      )}

      {/* My Preferences — all users */}
      {tab === 'preferences' && (
        <div className="card max-w-2xl space-y-5">
          <h3 className="font-semibold text-primary-900 border-b pb-2 flex items-center gap-2">
            <Bell className="w-4 h-4" /> Loan Payment Reminders
          </h3>
          <p className="text-sm text-dark-500">These preferences are stored on this device only.</p>

          <div className="flex items-center justify-between py-2 border-b border-dark-50">
            <div>
              <p className="text-sm font-medium">Enable Payment Reminders</p>
              <p className="text-xs text-dark-400">Show in-app reminders before your installment is due</p>
            </div>
            <Toggle
              checked={localPrefs.reminder_enabled === true || localPrefs.reminder_enabled === 'true'}
              onChange={(v) => setLocalPrefs({ ...localPrefs, reminder_enabled: v })}
            />
          </div>

          <div>
            <label className="input-label">Remind me (days before due date)</label>
            <input
              type="number"
              className="input-field"
              min="1"
              max="30"
              value={localPrefs.reminder_days_before ?? 3}
              onChange={(e) => setLocalPrefs({ ...localPrefs, reminder_days_before: parseInt(e.target.value) || 3 })}
              disabled={!localPrefs.reminder_enabled}
            />
            <p className="text-xs text-dark-400 mt-1">Default: 3 days. Min 1, max 30.</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800">
              Reminders appear on your dashboard when an installment payment is due within the configured number of days.
              Preferences are device-specific and not synced to the server.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
