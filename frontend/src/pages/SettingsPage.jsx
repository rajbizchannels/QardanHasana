import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../utils/api';
import { hasRole } from '../utils/helpers';
import Toggle from '../components/common/Toggle';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const CURRENCIES = ['INR', 'USD', 'GBP', 'EUR', 'AED', 'SAR', 'PKR'];

export default function SettingsPage() {
  const { user } = useSelector((s) => s.auth);
  const isAdmin = hasRole(user, 'admin');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('general');
  const [backupStatus, setBackupStatus] = useState('');
  const [backuping, setBackuping] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

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
      toast.success('Settings saved successfully');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
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

  const tabs = [
    { key: 'general', label: '🏢 General', adminOnly: false },
    { key: 'financial', label: '💰 Financial', adminOnly: true },
    { key: 'notifications', label: '🔔 Notifications', adminOnly: false },
    { key: 'security', label: '🔒 Security', adminOnly: true },
    { key: 'backup', label: '☁️ Backup', adminOnly: true },
  ].filter(t => !t.adminOnly || isAdmin);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">System configuration and preferences</p>
        </div>
        {isAdmin && (
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : '💾 Save Settings'}
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-dark-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-primary-900 shadow-sm' : 'text-dark-500 hover:text-dark-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* General */}
      {tab === 'general' && (
        <div className="card max-w-2xl space-y-5">
          <h3 className="font-semibold text-primary-900 border-b pb-2">General Settings</h3>
          <div>
            <label className="input-label">Organization Name</label>
            <input className="input-field" value={settings.org_name || ''} onChange={(e) => updateSetting('org_name', e.target.value)} disabled={!isAdmin} />
          </div>
          <div>
            <label className="input-label">Organization Email</label>
            <input type="email" className="input-field" value={settings.org_email || ''} onChange={(e) => updateSetting('org_email', e.target.value)} disabled={!isAdmin} />
          </div>
          <div>
            <label className="input-label">Organization Phone</label>
            <input className="input-field" value={settings.org_phone || ''} onChange={(e) => updateSetting('org_phone', e.target.value)} disabled={!isAdmin} />
          </div>
        </div>
      )}

      {/* Financial */}
      {tab === 'financial' && isAdmin && (
        <div className="card max-w-2xl space-y-5">
          <h3 className="font-semibold text-primary-900 border-b pb-2">Financial Settings</h3>
          <div>
            <label className="input-label">Default Currency</label>
            <select className="input-field" value={settings.currency || 'INR'} onChange={(e) => updateSetting('currency', e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-xs text-dark-400 mt-1">All amounts will be displayed in this currency</p>
          </div>
          <div>
            <label className="input-label">Currency Symbol</label>
            <input className="input-field" value={settings.currency_symbol || '₹'} onChange={(e) => updateSetting('currency_symbol', e.target.value)} maxLength={3} />
          </div>
          <div>
            <label className="input-label">Maximum Loan Amount</label>
            <input type="number" className="input-field" value={settings.max_loan_amount || ''} onChange={(e) => updateSetting('max_loan_amount', e.target.value)} />
          </div>
          <div>
            <label className="input-label">Minimum Loan Amount</label>
            <input type="number" className="input-field" value={settings.min_loan_amount || ''} onChange={(e) => updateSetting('min_loan_amount', e.target.value)} />
          </div>
          <div>
            <label className="input-label">Maximum Monthly Installments</label>
            <input type="number" className="input-field" value={settings.max_installments || ''} onChange={(e) => updateSetting('max_installments', e.target.value)} />
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
      )}

      {/* Notifications */}
      {tab === 'notifications' && (
        <div className="card max-w-2xl space-y-4">
          <h3 className="font-semibold text-primary-900 border-b pb-2">Notification Settings</h3>
          {[
            { key: 'notification_email', label: 'Email Notifications', desc: 'Send email notifications for all actions' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-3 border-b border-dark-50">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-dark-400">{desc}</p>
              </div>
              <Toggle
                checked={settings[key] === 'true'}
                onChange={(v) => updateSetting(key, v.toString())}
                disabled={!isAdmin}
              />
            </div>
          ))}
        </div>
      )}

      {/* Security */}
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
            <h4 className="font-semibold text-primary-900 mb-2">🛡️ Security Features</h4>
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

      {/* Backup */}
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
            <h4 className="font-semibold text-dark-800">📦 Manual Backup</h4>
            <p className="text-sm text-dark-500">Download a JSON backup of all data or upload to Google Drive.</p>
            <div className="flex gap-3">
              <button onClick={handleBackup} disabled={backuping} className="btn-primary">
                {backuping ? 'Creating backup...' : '⬇ Download Backup'}
              </button>
              <button onClick={getGoogleAuthUrl} className="btn-secondary">
                ☁️ Connect Google Drive
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              ℹ️ Backups include all users, loans, transactions, and ledger entries.
              Google Drive backups require OAuth2 authorization.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
