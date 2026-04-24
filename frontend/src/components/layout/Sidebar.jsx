import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { hasRole } from '../../utils/helpers';
import toast from 'react-hot-toast';

const NavItem = ({ to, icon, label, collapsed }) => (
  <NavLink to={to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
    <span className="text-lg flex-shrink-0">{icon}</span>
    {!collapsed && <span className="truncate">{label}</span>}
  </NavLink>
);

export default function Sidebar({ collapsed }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);

  const isAdmin = hasRole(user, 'admin');
  const isAccountant = hasRole(user, 'admin', 'accountant');

  const handleLogout = async () => {
    await dispatch(logout());
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-primary-900 flex flex-col z-40 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-primary-800 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 bg-gold-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-primary-900 font-bold text-sm">QH</span>
        </div>
        {!collapsed && (
          <div>
            <p className="text-white font-bold text-sm leading-tight">Qardan Hasana</p>
            <p className="text-primary-300 text-xs">Cash Management</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <NavItem to="/dashboard" icon="📊" label="Dashboard" collapsed={collapsed} />

        {isAccountant && (
          <>
            {!collapsed && <p className="px-3 pt-3 pb-1 text-xs font-semibold text-primary-400 uppercase tracking-wider">Accounts</p>}
            <NavItem to="/accounts" icon="🏦" label="All Accounts" collapsed={collapsed} />
            <NavItem to="/users" icon="👥" label="Users" collapsed={collapsed} />
          </>
        )}

        {!collapsed && <p className="px-3 pt-3 pb-1 text-xs font-semibold text-primary-400 uppercase tracking-wider">Finance</p>}
        <NavItem to="/loans" icon="📋" label="Loan Applications" collapsed={collapsed} />
        <NavItem to="/transactions" icon="💳" label="Transactions" collapsed={collapsed} />
        <NavItem to="/ledger" icon="📒" label="My Ledger" collapsed={collapsed} />
        <NavItem to="/documents" icon="📎" label="Documents" collapsed={collapsed} />

        {isAccountant && (
          <>
            {!collapsed && <p className="px-3 pt-3 pb-1 text-xs font-semibold text-primary-400 uppercase tracking-wider">Management</p>}
            <NavItem to="/approvals" icon="✅" label="Approvals" collapsed={collapsed} />
            <NavItem to="/reports" icon="📈" label="Reports" collapsed={collapsed} />
            <NavItem to="/audit" icon="🔍" label="Audit Logs" collapsed={collapsed} />
          </>
        )}

        {isAdmin && (
          <>
            {!collapsed && <p className="px-3 pt-3 pb-1 text-xs font-semibold text-primary-400 uppercase tracking-wider">Administration</p>}
            <NavItem to="/rbac" icon="🛡️" label="RBAC / Roles" collapsed={collapsed} />
            <NavItem to="/settings" icon="⚙️" label="Settings" collapsed={collapsed} />
          </>
        )}
        {!isAdmin && (
          <NavItem to="/settings" icon="⚙️" label="Settings" collapsed={collapsed} />
        )}
      </nav>

      {/* User info & logout */}
      <div className={`border-t border-primary-800 p-2 ${collapsed ? '' : ''}`}>
        <NavLink to="/profile" className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-primary-800 transition-colors mb-1">
          <div className="w-8 h-8 bg-gold-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-primary-900 font-bold text-xs">
              {(user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')}
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.first_name} {user?.last_name}</p>
              <p className="text-primary-300 text-xs truncate">ITS: {user?.its_number}</p>
            </div>
          )}
        </NavLink>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-primary-200 hover:bg-red-800 hover:text-white transition-colors text-sm ${collapsed ? 'justify-center' : ''}`}
        >
          <span>🚪</span>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
