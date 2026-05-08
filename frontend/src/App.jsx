import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMe } from './store/slices/authSlice';
import { fetchCurrency } from './store/slices/settingsSlice';

import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import UserProfilePage from './pages/UserProfilePage';
import LoansPage from './pages/LoansPage';
import LoanDetailPage from './pages/LoanDetailPage';
import TransactionsPage from './pages/TransactionsPage';
import LedgerPage from './pages/LedgerPage';
import ReportsPage from './pages/ReportsPage';
import ApprovalsPage from './pages/ApprovalsPage';
import DocumentsPage from './pages/DocumentsPage';
import SettingsPage from './pages/SettingsPage';
import RBACPage from './pages/RBACPage';
import AuditLogsPage from './pages/AuditLogsPage';
import AccountsPage from './pages/AccountsPage';
import DepositsPage from './pages/DepositsPage';
import GuarantorPage from './pages/GuarantorPage';
import NotFoundPage from './pages/NotFoundPage';
import LoadingSpinner from './components/common/LoadingSpinner';

const ProtectedRoute = ({ children, roles }) => {
  const { user, initialized } = useSelector((s) => s.auth);
  if (!initialized) return <LoadingSpinner fullScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.some(r => user.role_names?.includes(r) || user.roles?.includes(r))) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, initialized } = useSelector((s) => s.auth);
  if (!initialized) return <LoadingSpinner fullScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      dispatch(fetchMe()).then((result) => {
        if (fetchMe.fulfilled.match(result)) dispatch(fetchCurrency());
      });
    } else {
      dispatch({ type: 'auth/fetchMe/rejected' });
    }
  }, [dispatch]);

  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password/:token" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="users" element={<ProtectedRoute roles={['admin', 'accountant']}><UsersPage /></ProtectedRoute>} />
        <Route path="users/:id" element={<UserProfilePage />} />
        <Route path="users/new" element={<ProtectedRoute roles={['admin']}><UserProfilePage isNew /></ProtectedRoute>} />
        <Route path="accounts" element={<ProtectedRoute roles={['admin', 'accountant']}><AccountsPage /></ProtectedRoute>} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="loans/:id" element={<LoanDetailPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        <Route path="ledger/:userId" element={<LedgerPage />} />
        <Route path="reports" element={<ProtectedRoute roles={['admin', 'accountant']}><ReportsPage /></ProtectedRoute>} />
        <Route path="approvals" element={<ProtectedRoute roles={['admin', 'accountant']}><ApprovalsPage /></ProtectedRoute>} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="deposits" element={<ProtectedRoute roles={['admin', 'accountant']}><DepositsPage /></ProtectedRoute>} />
        <Route path="guarantors" element={<ProtectedRoute roles={['admin', 'accountant']}><GuarantorPage /></ProtectedRoute>} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="rbac" element={<ProtectedRoute roles={['admin']}><RBACPage /></ProtectedRoute>} />
        <Route path="audit" element={<ProtectedRoute roles={['admin', 'accountant']}><AuditLogsPage /></ProtectedRoute>} />
        <Route path="profile" element={<UserProfilePage isSelf />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
