import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Activity,
  CalendarCheck,
  BarChart3,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import MediSightLogo from '../components/MediSightLogo';

const FEATURE_HIGHLIGHTS = [
  {
    title: 'Risk Prediction',
    description:
      'Stratify 30-day hospital readmission probability using clinical vitals, lab markers, and comorbidity history.',
    icon: Activity
  },
  {
    title: 'Follow-up Tracking',
    description:
      'Coordinate post-discharge outreach calls, telehealth visits, and medication reconciliation workflows.',
    icon: CalendarCheck
  },
  {
    title: 'Analytics',
    description:
      'Monitor ward-level readmission trends, cohort risk distributions, and intervention outcomes in real time.',
    icon: BarChart3
  }
];

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const registeredMessage = location.state?.registeredMessage || '';
  const prefilledEmail = location.state?.registeredEmail || '';

  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password modal state
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  const validateForm = () => {
    const nextErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      nextErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Please enter a valid clinical email address.';
    }

    if (!password) {
      nextErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login(email, password);
      toast.success('Welcome back', `Logged in as ${user?.name || 'Authorized User'}.`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setAuthError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8FAFC]">
      {/* Left Branding Panel: Large gradient background (navy #0F172A to teal #0D9488) + soft glowing circles */}
      <div className="lg:w-1/2 bg-gradient-to-br from-[#0F172A] via-[#0F172A] to-[#0D9488] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        {/* Subtle decorative glowing circles & medical pattern */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#0D9488]/20 blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-[#0D9488]/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-1/4 w-96 h-96 rounded-full bg-teal-400/15 blur-3xl pointer-events-none" />

        {/* Subtle SVG Medical Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]"
          aria-hidden="true"
        />

        <div className="relative z-10">
          {/* MediSight Logo */}
          <div className="mb-10">
            <MediSightLogo variant="dark" size="lg" showTagline />
          </div>

          {/* Headline & Body */}
          <div className="max-w-lg mb-10">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight mb-4">
              Predict risk. Prevent readmissions.
            </h1>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
              Empowering clinical teams with proactive readmission intelligence, unified cohort
              surveillance, and automated post-discharge outreach workflows.
            </p>
          </div>

          {/* 3 Feature Highlights */}
          <div className="space-y-4 max-w-lg">
            {FEATURE_HIGHLIGHTS.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-slate-900/70 backdrop-blur-xs border border-white/10 shadow-xs transition-colors hover:bg-slate-900/90"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#0D9488] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Auth page left footer */}
        <div className="relative z-10 mt-10 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <span>MediSight © 2026 · Decision-support tool, not a diagnosis.</span>
          <span className="text-teal-300 font-medium">HIPAA-Compliant Architecture</span>
        </div>
      </div>

      {/* Right Authentication Area */}
      <div className="lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-16 my-auto">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 sm:p-10">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Sign in to MediSight
            </h2>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              Enter your clinical credentials to access your workspace. Your role is loaded automatically.
            </p>
          </div>

          {registeredMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-green-50 border border-green-200 flex items-start gap-2.5 text-xs text-green-800">
              <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
              <span>{registeredMessage}</span>
            </div>
          )}

          {authError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-[#EF4444]"
            >
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
              <span className="font-medium">{authError}</span>
            </div>
          )}

          {/* Form with ONLY email & password */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                }}
                placeholder="name@hospital.org"
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                  errors.email
                    ? 'border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/15'
                    : 'border-slate-200 focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15'
                }`}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs font-medium text-[#EF4444] flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  placeholder="Enter your password"
                  className={`w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                    errors.password
                      ? 'border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/15'
                      : 'border-slate-200 focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs font-medium text-[#EF4444] flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.password}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setForgotModalOpen(true);
                }}
                className="text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-60 text-white font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer mt-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              Don&apos;t have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-[#0D9488] hover:underline"
              >
                Register
              </Link>
            </p>
          </div>
        </div>

        {/* Small footer line on right auth panel */}
        <p className="mt-6 text-xs text-slate-400 text-center">
          MediSight © 2026 · Decision-support tool, not a diagnosis.
        </p>
      </div>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Reset MediSight Password
              </h3>
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-0.5">Self-service reset is not available</p>
                  <p>
                    MediSight does not send password reset e-mails. Ask your MediSight administrator to reset the
                    password for <span className="font-semibold">{email.trim() || 'your account'}</span>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E] cursor-pointer"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
