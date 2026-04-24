import { getStatusBadgeClass } from '../../utils/helpers';

export default function StatusBadge({ status, label }) {
  return (
    <span className={`badge ${getStatusBadgeClass(status)}`}>
      {label || status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—'}
    </span>
  );
}
