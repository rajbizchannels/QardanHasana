export const formatCurrency = (amount, currency = 'INR') => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
};

export const getStatusBadgeClass = (status) => {
  const map = {
    active: 'badge-green', approved: 'badge-green', completed: 'badge-green',
    pending: 'badge-yellow', under_review: 'badge-yellow',
    rejected: 'badge-red', defaulted: 'badge-red', cancelled: 'badge-red',
    inactive: 'badge-gray', suspended: 'badge-gray',
    overdue: 'badge-red',
  };
  return map[status] || 'badge-gray';
};

export const truncate = (str, max = 30) =>
  str && str.length > max ? `${str.substring(0, max)}...` : str || '—';

export const hasPermission = (user, permission) => {
  if (!user) return false;
  if (user.roles?.includes('admin')) return true;
  return user.permissions?.includes(permission) || false;
};

export const hasRole = (user, ...roles) => {
  if (!user) return false;
  return roles.some(r => user.roles?.includes(r));
};

export const getInitials = (firstName, lastName) => {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
