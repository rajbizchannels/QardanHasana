import { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone } from 'lucide-react';
import api from '../../utils/api';
import Toggle from './Toggle';
import toast from 'react-hot-toast';

const NOTIFICATION_TYPES = {
  loan_status:        { label: 'Loan Status Updates',       description: 'When your loan application is approved or rejected', defaultEmail: true,  defaultInApp: true  },
  transaction_posted: { label: 'Transaction Notifications', description: 'When your transactions are posted or rejected',       defaultEmail: true,  defaultInApp: true  },
  document_reviewed:  { label: 'Document Review Results',   description: 'When your uploaded documents are reviewed',          defaultEmail: true,  defaultInApp: true  },
  profile_reviewed:   { label: 'Profile Change Results',    description: 'When your profile update requests are reviewed',     defaultEmail: true,  defaultInApp: true  },
  payment_due:        { label: 'Payment Due Reminders',     description: 'Reminders before your installment due date',        defaultEmail: true,  defaultInApp: true  },
  deposit_maturity:   { label: 'Deposit Maturity Alerts',   description: 'Alerts when your deposits are approaching maturity', defaultEmail: true,  defaultInApp: true  },
  account_activity:   { label: 'General Account Activity',  description: 'General updates and account-related activity',      defaultEmail: false, defaultInApp: true  },
};

export default function NotificationPreferences({ userId }) {
  const [prefs, setPrefs] = useState({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    api.get(`/users/${userId}`).then(res => {
      setPrefs(res.data.data.notification_preferences || {});
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [userId]);

  const getPref = (type, channel) => {
    const typeDef = NOTIFICATION_TYPES[type];
    if (prefs[type] !== undefined && prefs[type][channel] !== undefined) {
      return prefs[type][channel];
    }
    return channel === 'email' ? typeDef.defaultEmail : typeDef.defaultInApp;
  };

  const setPref = (type, channel, value) => {
    setPrefs(prev => ({
      ...prev,
      [type]: { ...((prev[type]) || {}), [channel]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/users/${userId}/notification-preferences`, { preferences: prefs });
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="card max-w-2xl space-y-5">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="font-semibold text-primary-900 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Notification Preferences
        </h3>
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm px-3 py-1.5">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-0">
        <div />
        <div className="flex items-center gap-1 text-xs font-medium text-dark-500 mb-2 justify-center">
          <Mail className="w-3.5 h-3.5" /> Email
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-dark-500 mb-2 justify-center">
          <Smartphone className="w-3.5 h-3.5" /> In-App
        </div>

        {Object.entries(NOTIFICATION_TYPES).map(([type, def], i) => (
          <>
            <div key={`label-${type}`} className={`py-3 ${i < Object.keys(NOTIFICATION_TYPES).length - 1 ? 'border-b border-dark-50' : ''}`}>
              <p className="text-sm font-medium">{def.label}</p>
              <p className="text-xs text-dark-400">{def.description}</p>
            </div>
            <div key={`email-${type}`} className={`flex items-center justify-center py-3 ${i < Object.keys(NOTIFICATION_TYPES).length - 1 ? 'border-b border-dark-50' : ''}`}>
              <Toggle
                checked={getPref(type, 'email')}
                onChange={(v) => setPref(type, 'email', v)}
              />
            </div>
            <div key={`inapp-${type}`} className={`flex items-center justify-center py-3 ${i < Object.keys(NOTIFICATION_TYPES).length - 1 ? 'border-b border-dark-50' : ''}`}>
              <Toggle
                checked={getPref(type, 'in_app')}
                onChange={(v) => setPref(type, 'in_app', v)}
              />
            </div>
          </>
        ))}
      </div>
    </div>
  );
}
