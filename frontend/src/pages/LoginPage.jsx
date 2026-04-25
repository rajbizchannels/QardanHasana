import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login } from '../store/slices/authSlice';
import { fetchCurrency } from '../store/slices/settingsSlice';
import { Shield, BarChart2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await dispatch(login(form));
    if (login.fulfilled.match(result)) {
      dispatch(fetchCurrency());
      toast.success('Welcome back!');
      navigate('/dashboard');
    } else {
      toast.error(result.payload || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-900 flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gold-500 rounded-xl flex items-center justify-center">
              <span className="text-primary-900 font-bold text-xl">QH</span>
            </div>
            <div>
              <p className="text-white font-bold text-2xl leading-tight">Qardan Hasana</p>
              <p className="text-primary-300 text-sm">Cash Management System</p>
            </div>
          </div>
          <div className="mt-16">
            <h1 className="text-4xl font-bold text-white leading-tight">
              Ethical Finance.<br />
              <span className="text-gold-400">Transparent Accounting.</span>
            </h1>
            <p className="text-primary-200 mt-4 text-lg leading-relaxed">
              A comprehensive cash management system for Qardan Hasana — interest-free financial support for the community.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          {[
            { icon: <Shield className="w-5 h-5" />, text: 'Bank-level security with role-based access' },
            { icon: <BarChart2 className="w-5 h-5" />, text: 'Real-time ledger tracking and reporting' },
            { icon: <CheckCircle className="w-5 h-5" />, text: 'Full audit trail for all transactions' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-gold-400">{item.icon}</span>
              <p className="text-primary-200 text-sm">{item.text}</p>
            </div>
          ))}
        </div>
        <p className="text-primary-400 text-xs">
          © {new Date().getFullYear()} Qardan Hasana. All rights reserved.
        </p>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 bg-primary-900 rounded-lg flex items-center justify-center">
              <span className="text-gold-400 font-bold">QH</span>
            </div>
            <span className="text-primary-900 font-bold text-xl">Qardan Hasana</span>
          </div>

          <h2 className="text-2xl font-bold text-dark-900">Sign in to your account</h2>
          <p className="text-dark-500 mt-1 mb-8">Use your email address and password to continue</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="input-label">Email Address</label>
              <input
                type="email"
                className="input-field"
                placeholder="Enter your email address"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="input-label">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link to="/forgot-password" className="text-sm text-primary-800 hover:underline font-medium">
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-dark-100">
            <p className="text-center text-dark-400 text-xs">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
