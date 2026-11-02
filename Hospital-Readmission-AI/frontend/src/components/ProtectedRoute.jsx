import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, isInitializing } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 rounded-full border-2 border-[#0D9488] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#EF4444]/10 text-[#EF4444] flex items-center justify-center mx-auto mb-5">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Role Access Restricted
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Your current session role is <span className="font-semibold text-slate-900">{currentUser.role}</span>.
          This clinical module requires{' '}
          <span className="font-semibold text-[#0D9488]">{allowedRoles.join(' or ')}</span> permissions to access.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-medium transition-colors cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return children;
}
