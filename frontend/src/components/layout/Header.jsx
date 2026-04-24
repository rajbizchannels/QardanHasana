import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Menu, Bell, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import { formatDateTime } from '../../utils/helpers';

const typeIcon = {
  info: <Info className="w-4 h-4 text-blue-500" />,
  success: <CheckCircle className="w-4 h-4 text-green-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
};

export default function Header({ onToggleSidebar, sidebarCollapsed }) {
  const { user } = useSelector((s) => s.auth);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications?limit=10&unread=true');
      setNotifications(res.data.data.notifications || []);
      setUnreadCount(res.data.data.total || 0);
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setUnreadCount(0);
      setNotifications([]);
    } catch {}
  };

  return (
    <header className="fixed top-0 right-0 left-0 z-30 bg-white border-b border-dark-100 h-16 flex items-center px-4 gap-4 shadow-sm"
      style={{ paddingLeft: sidebarCollapsed ? '4.5rem' : '17rem' }}>
      {/* Sidebar toggle */}
      <button onClick={onToggleSidebar} className="p-2 rounded-lg hover:bg-dark-100 transition-colors text-dark-600">
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          className="relative p-2 rounded-lg hover:bg-dark-100 transition-colors"
        >
          <Bell className="w-5 h-5 text-dark-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {showNotifs && (
          <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-lg border border-dark-100 z-50 animate-slide-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-100">
              <h3 className="font-semibold text-dark-900 text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary-800 hover:underline">Mark all read</button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center text-dark-400 py-6 text-sm">No new notifications</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="px-4 py-3 border-b border-dark-50 hover:bg-dark-50 transition-colors">
                    <div className="flex gap-2">
                      <span className="mt-0.5">{typeIcon[n.type] || typeIcon.info}</span>
                      <div>
                        <p className="text-sm font-medium text-dark-800">{n.title}</p>
                        <p className="text-xs text-dark-500 mt-0.5">{n.message}</p>
                        <p className="text-xs text-dark-400 mt-1">{formatDateTime(n.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* User avatar */}
      <Link to="/profile" className="flex items-center gap-2 hover:bg-dark-50 rounded-lg px-2 py-1.5 transition-colors">
        <div className="w-8 h-8 bg-primary-900 rounded-full flex items-center justify-center">
          <span className="text-gold-400 font-bold text-xs">
            {(user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')}
          </span>
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-dark-900 leading-tight">{user?.first_name} {user?.last_name}</p>
          <p className="text-xs text-dark-500">ITS: {user?.its_number}</p>
        </div>
      </Link>

      {showNotifs && <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />}
    </header>
  );
}
