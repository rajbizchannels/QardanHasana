import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-50">
      <div className="text-center">
        <div className="flex justify-center mb-4"><SearchX className="w-24 h-24 text-primary-300" /></div>
        <h1 className="text-4xl font-bold text-primary-900 mb-2">404</h1>
        <p className="text-dark-500 mb-6">The page you're looking for doesn't exist.</p>
        <Link to="/dashboard" className="btn-primary">Return to Dashboard</Link>
      </div>
    </div>
  );
}
