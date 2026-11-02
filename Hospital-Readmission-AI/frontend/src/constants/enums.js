// MediSight domain enums & form options.
// Values match the SQL Server schema (database/schema.sql CHECK constraints) and the
// Spring Boot API. Lists that depend on the loaded data (e.g. departments) are fetched
// from the API instead of being hard-coded here.

export const ROLES = {
  ADMIN: 'Admin',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  ANALYST: 'Analyst'
};

// Roles a user may choose at self-registration (Admin accounts are created by an administrator).
export const ROLE_OPTIONS = ['Doctor', 'Nurse'];
export const ALL_ROLES = ['Admin', 'Doctor', 'Nurse', 'Analyst'];
// Roles allowed to change clinical data (upload, predict, follow-ups, add patients).
export const CLINICAL_ROLES = ['Admin', 'Doctor', 'Nurse'];

// Admissions.GenderAtAdmission CHECK values
export const GENDERS = ['Female', 'Male', 'Unknown/Invalid'];

// Admissions.RaceAtAdmission CHECK values (dataset categories)
export const RACES = ['Caucasian', 'AfricanAmerican', 'Hispanic', 'Asian', 'Other'];

// Admissions.AgeGroup CHECK values (the dataset records 10-year age bands, not exact ages)
export const AGE_GROUPS = [
  '[0-10)', '[10-20)', '[20-30)', '[30-40)', '[40-50)',
  '[50-60)', '[60-70)', '[70-80)', '[80-90)', '[90-100)'
];

// Admissions.A1CResult / MaxGluSerum CHECK values
export const A1C_RESULTS = ['NotTested', 'Norm', '>7', '>8'];
export const GLUCOSE_RESULTS = ['NotTested', 'Norm', '>200', '>300'];

// Admissions.ReadmissionStatus (original dataset labels)
export const READMISSION_STATUS_LABELS = {
  NO: 'Not readmitted',
  '>30': 'Readmitted after 30 days',
  '<30': 'Readmitted within 30 days'
};

// ICD-9-CM code as stored by the ETL (e.g. 428, 250.83, V57, E909)
export const ICD9_PATTERN = /^([0-9]{3}(\.[0-9]{1,2})?|V[0-9]{2}(\.[0-9]{1,2})?|E[0-9]{3}(\.[0-9])?)$/;

export const RISK_LEVELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High'
};

// Colours only. The risk tier of a patient is the one assigned by the ML service;
// the UI never derives a tier from a score.
export const RISK_LEVEL_CONFIG = {
  Low: {
    label: 'Low',
    color: '#22C55E',
    badgeClass: 'bg-green-50 text-[#22C55E] border-green-200',
    bgSubtle: 'bg-green-50/50'
  },
  Medium: {
    label: 'Medium',
    color: '#F59E0B',
    badgeClass: 'bg-amber-50 text-[#F59E0B] border-amber-200',
    bgSubtle: 'bg-amber-50/50'
  },
  High: {
    label: 'High',
    color: '#EF4444',
    badgeClass: 'bg-red-50 text-[#EF4444] border-red-200',
    bgSubtle: 'bg-red-50/50'
  }
};

// Neutral style for patients without a stored prediction
export const UNSCORED_STYLE = {
  label: 'Not scored',
  color: '#64748B',
  badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
  bgSubtle: 'bg-slate-50'
};

// Followups.Status values returned by the API
export const FOLLOW_UP_STATUSES = ['Scheduled', 'Completed', 'Missed', 'Cancelled'];

// Followups.Priority CHECK values (migration 002)
export const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low', 'Routine'];

// Stored in Followups.FollowupType (max 50 characters)
export const OUTREACH_CHANNELS = [
  'Phone Outreach',
  'Telehealth Consult',
  'In-Person Clinic Visit',
  'Home Health Nurse Visit',
  'Automated SMS Check-in'
];

export const NOTIFICATION_CATEGORIES = [
  { id: 'all', label: 'All Alerts' },
  { id: 'unread', label: 'Unread' },
  { id: 'high_risk', label: 'High-Risk Patients' },
  { id: 'overdue', label: 'Overdue Follow-ups' },
  { id: 'upload', label: 'Batch Uploads' }
];

export const NOTIFICATION_TYPES = {
  HIGH: 'high',
  LOW: 'low',
  INFO: 'info'
};
