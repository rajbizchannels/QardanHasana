import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('Reset link sent if email exists');
    } catch {
      toast.error('Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-50 p-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-2 mb-6">
          <Link to="/login" className="text-dark-400 hover:text-dark-700 text-sm">← Back to Login</Link>
        </div>
        <div className="w-12 h-12 bg-primary-900 rounded-xl flex items-center justify-center mb-4">
          <span className="text-gold-400 font-bold">QH</span>
        </div>
        <h2 className="text-2xl font-bold text-dark-900">Reset your password</h2>
        <p className="text-dark-500 mt-1 mb-6">Enter your email and we'll send a reset link</p>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-green-700 font-medium">If your email exists, a reset link has been sent.</p>
            <Link to="/login" className="text-primary-800 text-sm mt-2 block hover:underline">Return to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="input-label">Email Address</label>
              <input type="email" className="input-field" placeholder="your@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
