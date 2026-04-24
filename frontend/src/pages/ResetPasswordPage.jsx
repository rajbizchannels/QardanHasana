import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error('Passwords do not match');
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: form.password });
      toast.success('Password reset successfully!');
      navigate('/login');
    } catch {
      toast.error('Invalid or expired reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-50 p-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="w-12 h-12 bg-primary-900 rounded-xl flex items-center justify-center mb-4">
          <span className="text-gold-400 font-bold">QH</span>
        </div>
        <h2 className="text-2xl font-bold text-dark-900">Create new password</h2>
        <p className="text-dark-500 mt-1 mb-6">Enter your new password below</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">New Password</label>
            <input type="password" className="input-field" placeholder="Min. 8 characters"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          </div>
          <div>
            <label className="input-label">Confirm Password</label>
            <input type="password" className="input-field" placeholder="Repeat password"
              value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
          <p className="text-center text-sm"><Link to="/login" className="text-primary-800 hover:underline">Back to Login</Link></p>
        </form>
      </div>
    </div>
  );
}
