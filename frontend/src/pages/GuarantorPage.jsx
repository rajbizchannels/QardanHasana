import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useCurrency } from '../utils/currency';
import { formatDate } from '../utils/helpers';
import Pagination from '../components/common/Pagination';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

export default function GuarantorPage() {
  const fmt = useCurrency();
  const [guarantors, setGuarantors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { fetchGuarantors(); }, [page]);

  const fetchGuarantors = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/profiles/guarantors?page=${page}&limit=20`);
      setGuarantors(res.data.data.guarantors);
      setTotal(res.data.data.total);
      setTotalPages(res.data.data.totalPages);
    } catch { toast.error('Failed to load guarantors'); }
    finally { setLoading(false); }
  };

  const totalActiveValue = guarantors.reduce((s, g) => s + parseFloat(g.active_guaranteed_value || 0), 0);
  const totalValue = guarantors.reduce((s, g) => s + parseFloat(g.total_guaranteed_value || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Guarantors</h1>
          <p className="page-subtitle">{total} guarantor{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {guarantors.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-xs text-dark-400 mb-1">Total Guarantors</p>
            <p className="text-2xl font-bold text-dark-900">{total}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-dark-400 mb-1">Active Guaranteed Value</p>
            <p className="text-2xl font-bold text-primary-900">{fmt(totalActiveValue)}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-dark-400 mb-1">Total Guaranteed (All Time)</p>
            <p className="text-2xl font-bold text-dark-700">{fmt(totalValue)}</p>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>ITS</th>
                    <th>Guarantor #</th>
                    <th>Active Guarantees</th>
                    <th>Total Guarantees</th>
                    <th>Active Value</th>
                    <th>Total Value</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {guarantors.map((g) => (
                    <tr key={g.id}>
                      <td className="font-medium">{g.name}</td>
                      <td className="font-mono text-xs">{g.its_number}</td>
                      <td className="font-mono text-xs text-dark-500">{g.guarantor_number}</td>
                      <td>
                        <span className={`font-semibold ${parseInt(g.active_guarantees) > 0 ? 'text-primary-900' : 'text-dark-400'}`}>
                          {g.active_guarantees}
                        </span>
                      </td>
                      <td className="text-dark-600">{g.total_guarantees}</td>
                      <td className={`font-semibold ${parseFloat(g.active_guaranteed_value) > 0 ? 'text-primary-900' : 'text-dark-400'}`}>
                        {fmt(g.active_guaranteed_value)}
                      </td>
                      <td className="text-dark-600">{fmt(g.total_guaranteed_value)}</td>
                      <td><StatusBadge status={g.status || 'active'} /></td>
                      <td>
                        <Link to={`/users/${g.user_id}`} className="text-primary-800 hover:underline text-sm">
                          View Profile
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {guarantors.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-10 text-dark-400">No guarantors found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={20} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
