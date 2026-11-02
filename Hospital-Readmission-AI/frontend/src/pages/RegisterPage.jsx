import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Stethoscope,
  Activity,
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  User,
  UserCheck,
  BadgeCheck,
  BarChart3,
  CalendarCheck
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

const DEPARTMENTS = [
  'Cardiology',
  'Medicine',
  'Pediatrics',
  'Orthopedics',
  'General'
];

export default function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Multi-step state: 1, 2, 3, or 'success'
  const [currentStep, setCurrentStep] = useState(1);

  // Form Fields
  // Step 1: Personal Info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2: Professional Info
  const [role, setRole] = useState('Doctor'); // 'Doctor' | 'Nurse'
  const [department, setDepartment] = useState('Cardiology');
  const [licenseId, setLicenseId] = useState('');

  // Step 3: Password & Security
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Status & Validation
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);

  // Live password strength calculation
  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '', width: '0%' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) {
      return { score: 1, label: 'Weak', color: '#EF4444', textColor: 'text-[#EF4444]', width: '33%' };
    }
    if (score <= 4) {
      return { score: 2, label: 'Medium', color: '#F59E0B', textColor: 'text-[#F59E0B]', width: '66%' };
    }
    return { score: 3, label: 'Strong', color: '#22C55E', textColor: 'text-[#22C55E]', width: '100%' };
  };

  const passwordStrength = calculatePasswordStrength(password);

  // Step 1 validation
  const validateStep1 = () => {
    const nextErrors = {};
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    // Strip non-digits to test 10-digit phone requirement
    const digitsOnlyPhone = phone.replace(/\D/g, '');

    if (!trimmedName) {
      nextErrors.fullName = 'Full name is required.';
    } else if (trimmedName.length < 2) {
      nextErrors.fullName = 'Full name must be at least 2 characters.';
    }

    if (!trimmedEmail) {
      nextErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Please enter a valid clinical email address.';
    }

    if (!phone.trim()) {
      nextErrors.phone = 'Phone number is required.';
    } else if (digitsOnlyPhone.length !== 10) {
      nextErrors.phone = 'Phone number must be exactly 10 digits.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Step 2 validation
  const validateStep2 = () => {
    const nextErrors = {};
    if (!role) {
      nextErrors.role = 'Please select your clinical role.';
    }
    if (!department) {
      nextErrors.department = 'Department selection is required.';
    }
    if (!licenseId.trim()) {
      nextErrors.licenseId = 'Employee / License ID is required.';
    } else if (licenseId.trim().length < 3) {
      nextErrors.licenseId = 'Employee / License ID must be at least 3 characters.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Step 3 validation
  const validateStep3 = () => {
    const nextErrors = {};

    if (!password) {
      nextErrors.password = 'Password is required.';
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    } else if (password.length > 72) {
      nextErrors.password = 'Password must be at most 72 characters.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirmation password is required.';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!agreedToTerms) {
      nextErrors.terms = 'You must accept the MediSight Terms and HIPAA data handling guidelines.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNextFromStep1 = (e) => {
    e.preventDefault();
    setServerError('');
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleNextFromStep2 = (e) => {
    e.preventDefault();
    setServerError('');
    if (validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validateStep3()) return;

    setIsSubmitting(true);
    try {
      const newUser = await register({
        name: fullName.trim(),
        email: email.trim(),
        phone: phone.replace(/\D/g, ''), // backend expects exactly 10 digits
        role, // Permanently saved role
        department,
        licenseId: licenseId.trim(),
        password
      });

      setRegisteredUser(newUser);
      setCurrentStep('success');
      toast.success('Registration Complete', `Staff account created for ${newUser.name}.`);
    } catch (err) {
      // Handles duplicate email with "Email already registered"
      setServerError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    { number: 1, title: 'Personal Info' },
    { number: 2, title: 'Professional Info' },
    { number: 3, title: 'Password' }
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8FAFC]">
      {/* Left Branding Panel: Same rich gradient as Login page */}
      <div className="lg:w-1/2 bg-gradient-to-br from-[#0F172A] via-[#0F172A] to-[#0D9488] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        {/* Soft glowing circles & subtle background grid */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#0D9488]/20 blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-[#0D9488]/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-1/4 w-96 h-96 rounded-full bg-teal-400/15 blur-3xl pointer-events-none" />

        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]"
          aria-hidden="true"
        />

        <div className="relative z-10">
          <div className="mb-10">
            <MediSightLogo variant="dark" size="lg" showTagline />
          </div>

          <div className="max-w-lg mb-10">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight mb-4">
              Predict risk. Prevent readmissions.
            </h1>
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
              Empowering clinical teams with proactive readmission intelligence, unified cohort
              surveillance, and automated post-discharge outreach workflows.
            </p>
          </div>

          {/* 3 Feature Highlights with icons */}
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

        {/* Small footer line on auth pages */}
        <div className="relative z-10 mt-10 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <span>MediSight © 2026 · Decision-support tool, not a diagnosis.</span>
          <span className="text-teal-300 font-medium">HIPAA-Compliant Architecture</span>
        </div>
      </div>

      {/* Right Form Container */}
      <div className="lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-9">
          {/* Header */}
          {currentStep !== 'success' && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Create Clinical Account
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Step-by-step registration for verified hospital care providers.
              </p>

              {/* 3-Step Progress Indicator */}
              <div className="mt-6 mb-2">
                <div className="flex items-center justify-between relative">
                  {/* Background Progress Bar Line */}
                  <div className="absolute left-6 right-6 top-4 h-0.5 bg-slate-200 -z-0">
                    <div
                      className="h-full bg-[#0D9488] transition-all duration-300"
                      style={{
                        width:
                          currentStep === 1
                            ? '0%'
                            : currentStep === 2
                            ? '50%'
                            : '100%'
                      }}
                    />
                  </div>

                  {stepsList.map((step) => {
                    const isCompleted = currentStep > step.number;
                    const isCurrent = currentStep === step.number;

                    return (
                      <div
                        key={step.number}
                        className="flex flex-col items-center relative z-10"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                            isCompleted
                              ? 'bg-[#0D9488] text-white shadow-xs'
                              : isCurrent
                              ? 'bg-[#0D9488] text-white ring-4 ring-[#0D9488]/20 shadow-xs'
                              : 'bg-white text-slate-400 border-2 border-slate-200'
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            step.number
                          )}
                        </div>
                        <span
                          className={`text-xs mt-2 font-semibold transition-colors text-center ${
                            isCurrent
                              ? 'text-[#0D9488]'
                              : isCompleted
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {step.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Server Error Alert */}
          {serverError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-[#EF4444]"
            >
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
              <span className="font-semibold">{serverError}</span>
            </div>
          )}

          {/* STEP 1: Personal Info */}
          {currentStep === 1 && (
            <form onSubmit={handleNextFromStep1} noValidate className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name & Title
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                    }}
                    placeholder="e.g. Dr. Jordan Patel or Sarah Jenkins, RN"
                    className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                      errors.fullName
                        ? 'border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/15'
                        : 'border-slate-200 focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15'
                    }`}
                  />
                </div>
                {errors.fullName && (
                  <p className="mt-1.5 text-xs font-medium text-[#EF4444] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Clinical Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                      if (serverError) setServerError('');
                    }}
                    placeholder="name@hospital.org"
                    className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                      errors.email
                        ? 'border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/15'
                        : 'border-slate-200 focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15'
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-xs font-medium text-[#EF4444] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Phone Number (10 digits)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      // Allow digits and basic formatting
                      const val = e.target.value;
                      setPhone(val);
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                    placeholder="e.g. 5550198822"
                    maxLength={14}
                    className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all tabular-nums ${
                      errors.phone
                        ? 'border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/15'
                        : 'border-slate-200 focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15'
                    }`}
                  />
                </div>
                {errors.phone ? (
                  <p className="mt-1.5 text-xs font-medium text-[#EF4444] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.phone}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Used for critical patient escalation calls and 2FA verification.
                  </p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Next: Professional Info</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-600">
                  Already have an account?{' '}
                  <Link to="/login" className="font-semibold text-[#0D9488] hover:underline">
                    Login
                  </Link>
                </p>
              </div>
            </form>
          )}

          {/* STEP 2: Professional Info */}
          {currentStep === 2 && (
            <form onSubmit={handleNextFromStep2} noValidate className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Select Clinical Role (Permanently applied to your session)
                </label>
                {/* ROLE selector as two selectable cards: Doctor / Nurse (NO Admin option) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Doctor Card */}
                  <div
                    onClick={() => {
                      setRole('Doctor');
                      if (errors.role) setErrors((prev) => ({ ...prev, role: '' }));
                    }}
                    className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                      role === 'Doctor'
                        ? 'border-[#0D9488] bg-teal-50/40 ring-2 ring-[#0D9488]/10 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          role === 'Doctor'
                            ? 'bg-[#0D9488] text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Stethoscope className="w-5 h-5" />
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                          role === 'Doctor'
                            ? 'bg-[#0D9488] text-white'
                            : 'border-2 border-slate-300 bg-white'
                        }`}
                      >
                        {role === 'Doctor' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Doctor</h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Attending physician with access to EHR batch data upload and predictive risk scoring.
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-semibold text-[#0D9488]">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      <span>Data Upload & Clinical Scoring</span>
                    </div>
                  </div>

                  {/* Nurse Card */}
                  <div
                    onClick={() => {
                      setRole('Nurse');
                      if (errors.role) setErrors((prev) => ({ ...prev, role: '' }));
                    }}
                    className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                      role === 'Nurse'
                        ? 'border-[#0D9488] bg-teal-50/40 ring-2 ring-[#0D9488]/10 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          role === 'Nurse'
                            ? 'bg-[#0D9488] text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Activity className="w-5 h-5" />
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                          role === 'Nurse'
                            ? 'bg-[#0D9488] text-white'
                            : 'border-2 border-slate-300 bg-white'
                        }`}
                      >
                        {role === 'Nurse' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Nurse</h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Registered nurse coordinating patient outreach, vital tracking, and follow-ups.
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                      <span>Follow-up Coordination</span>
                    </div>
                  </div>
                </div>

                {errors.role && (
                  <p className="mt-1.5 text-xs font-medium text-[#EF4444] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.role}
                  </p>
                )}
              </div>

              {/* Department Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Clinical Department
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={department}
                    onChange={(e) => {
                      setDepartment(e.target.value);
                      if (errors.department) setErrors((prev) => ({ ...prev, department: '' }));
                    }}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.department && (
                  <p className="mt-1.5 text-xs font-medium text-[#EF4444] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.department}
                  </p>
                )}
              </div>

              {/* Employee / License ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Employee / Medical License ID
                </label>
                <div className="relative">
                  <BadgeCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={licenseId}
                    onChange={(e) => {
                      setLicenseId(e.target.value);
                      if (errors.licenseId) setErrors((prev) => ({ ...prev, licenseId: '' }));
                    }}
                    placeholder={role === 'Doctor' ? 'e.g. MD-94021' : 'e.g. RN-88310'}
                    className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all uppercase ${
                      errors.licenseId
                        ? 'border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/15'
                        : 'border-slate-200 focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15'
                    }`}
                  />
                </div>
                {errors.licenseId && (
                  <p className="mt-1.5 text-xs font-medium text-[#EF4444] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.licenseId}
                  </p>
                )}
              </div>

              {/* Navigation buttons: Back / Next */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Next: Set Password</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-600">
                  Already have an account?{' '}
                  <Link to="/login" className="font-semibold text-[#0D9488] hover:underline">
                    Login
                  </Link>
                </p>
              </div>
            </form>
          )}

          {/* STEP 3: Password & Security */}
          {currentStep === 3 && (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Password with Show/Hide toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Account Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                    }}
                    placeholder="Create a strong password (min. 8 chars)"
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

                {/* Live Password Strength Meter */}
                {password && (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Password Strength:</span>
                      <span
                        className={`font-bold transition-colors ${passwordStrength.textColor}`}
                      >
                        {passwordStrength.label}
                      </span>
                    </div>
                    {/* Visual Segmented Progress Bar */}
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1">
                      <div
                        className={`h-full flex-1 rounded-full transition-all ${
                          passwordStrength.score >= 1 ? 'bg-[#EF4444]' : 'bg-slate-200'
                        }`}
                      />
                      <div
                        className={`h-full flex-1 rounded-full transition-all ${
                          passwordStrength.score >= 2
                            ? 'bg-[#F59E0B]'
                            : 'bg-slate-200'
                        }`}
                      />
                      <div
                        className={`h-full flex-1 rounded-full transition-all ${
                          passwordStrength.score >= 3
                            ? 'bg-[#22C55E]'
                            : 'bg-slate-200'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password with Show/Hide toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) {
                        setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                      }
                    }}
                    placeholder="Re-enter your password"
                    className={`w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                      errors.confirmPassword
                        ? 'border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/15'
                        : 'border-slate-200 focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-xs font-medium text-[#EF4444] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Terms Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => {
                      setAgreedToTerms(e.target.checked);
                      if (errors.terms) setErrors((prev) => ({ ...prev, terms: '' }));
                    }}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#0D9488] focus:ring-[#0D9488]"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed">
                    I agree to the MediSight Clinical Privacy Terms and HIPAA data handling guidelines for protected health information.
                  </span>
                </label>
                {errors.terms && (
                  <p className="mt-1.5 text-xs font-medium text-[#EF4444] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.terms}
                  </p>
                )}
              </div>

              {/* Account role confirmation preview pill */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between">
                <span>Account configured as:</span>
                <span className="font-semibold text-[#0D9488]">
                  {role} · {department}
                </span>
              </div>

              {/* Buttons: Back / Submit */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-60 text-white font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Account...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Complete Registration</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-600">
                  Already have an account?{' '}
                  <Link to="/login" className="font-semibold text-[#0D9488] hover:underline">
                    Login
                  </Link>
                </p>
              </div>
            </form>
          )}

          {/* SUCCESS SCREEN */}
          {currentStep === 'success' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 text-[#0D9488] flex items-center justify-center mx-auto mb-4 shadow-sm border border-teal-100">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
                Registration Successful!
              </h2>

              <p className="text-sm font-semibold text-[#0D9488] mb-6">
                Registration successful! You can now login as {registeredUser?.role || role}.
              </p>

              {/* Profile Confirmation Card */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-left mb-6 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Provider Name:</span>
                  <span className="text-slate-900 font-semibold">{registeredUser?.name}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Clinical Email:</span>
                  <span className="text-slate-900 font-semibold">{registeredUser?.email}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Permanently Assigned Role:</span>
                  <span className="text-[#0D9488] font-bold">{registeredUser?.role}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Department:</span>
                  <span className="text-slate-800 font-semibold">{registeredUser?.department}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">License / Staff ID:</span>
                  <span className="text-slate-800 font-mono font-semibold">{registeredUser?.licenseId}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-medium">Account Status:</span>
                  <span className="inline-flex items-center gap-1 text-[#22C55E] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                    {registeredUser?.status || 'Active'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate('/login', {
                    state: {
                      registeredEmail: registeredUser?.email,
                      registeredMessage: `Registration successful! You can now login as ${registeredUser?.role}.`
                    }
                  })
                }
                className="w-full py-2.5 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Login</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Small footer line on right auth panel */}
        <p className="mt-6 text-xs text-slate-400 text-center">
          MediSight © 2026 · Decision-support tool, not a diagnosis.
        </p>
      </div>
    </div>
  );
}
