import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-50">
      <div className="text-center">
        <div className="text-8xl mb-4">🔍</div>
        <h1 className="text-4xl font-bold text-primary-900 mb-2">404</h1>
        <p className="text-dark-500 mb-6">The page you're looking for doesn't exist.</p>
        <Link to="/dashboard" className="btn-primary">Return to Dashboard</Link>
      </div>
    </div>
  );
}
