import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  Activity,
  CalendarCheck,
  Stethoscope,
  HeartPulse,
  ArrowRight,
  Pill,
  AlertCircle,
  FileText,
  Clock,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { SkeletonTable } from '../components/Skeleton';
import patientService from '../api/patientService';
import useDepartments from '../hooks/useDepartments';
import {
  A1C_RESULTS,
  AGE_GROUPS,
  CLINICAL_ROLES,
  GENDERS,
  GLUCOSE_RESULTS,
  ICD9_PATTERN,
  RACES,
  READMISSION_STATUS_LABELS
} from '../constants/enums';
import { displayValue, formatAgeGroup, formatDateTime, formatRisk, initialsFor, riskStyle } from '../utils/format';

const EMPTY_PATIENT_FORM = {
  externalPatientId: '',
  gender: '',
  race: '',
  ageGroup: '',
  department: '',
  primaryDiagnosisCode: '',
  secondaryDiagnosisCode: '',
  lengthOfStay: '',
  priorAdmissions: '',
  emergencyVisits: '',
  outpatientVisits: '',
  medicationsCount: '',
  numDiagnoses: '',
  numLabTests: '',
  numProcedures: '',
  a1cResult: '',
  maxGluSerum: ''
};

// '' -> null, '7' -> 7 (nothing is defaulted)
function toIntOrNull(value) {
  return value === '' || value === null || value === undefined ? null : parseInt(value, 10);
}

// Page numbers to show around the current page (the registry has thousands of pages)
function pageWindow(current, total) {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  const pages = [];
  for (let i = start; i <= end; i += 1) pages.push(i);
  return pages;
}

export default function PatientsPage() {
  const { globalSearch, setGlobalSearch, currentUser } = useAuth();
  const { departments } = useDepartments();
  const canEdit = CLINICAL_ROLES.includes(currentUser?.role);
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // Search, filter & pagination state
  const queryParams = new URLSearchParams(location.search);
  const initialSearch = queryParams.get('search') || globalSearch || '';
  const initialRisk = location.state?.riskFilter || 'All';

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedRiskFilter, setSelectedRiskFilter] = useState(initialRisk);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Patient data from real Spring Boot REST API
  const [patients, setPatients] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detail panel state
  const [selectedPatientId, setSelectedPatientId] = useState(
    location.state?.selectedPatientId || null
  );
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Add Patient Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalErrors, setModalErrors] = useState({});

  const [newPatient, setNewPatient] = useState(EMPTY_PATIENT_FORM);

  // Sync navbar globalSearch with local search query
  useEffect(() => {
    if (globalSearch && globalSearch !== searchQuery) {
      setSearchQuery(globalSearch);
      setCurrentPage(1);
    }
  }, [globalSearch]);

  // Load patients from Spring Boot API: GET /patients?search=&riskLevel=&department=&page=&size=
  const loadPatients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await patientService.getPatients({
        search: searchQuery,
        riskLevel: selectedRiskFilter,
        department: selectedDeptFilter,
        page: currentPage - 1, // Spring Boot Pageable is 0-indexed
        size: pageSize
      });

      // Response: { content: [...], totalElements, totalPages, page }
      if (data) {
        setPatients(data.content || []);
        setTotalPages(data.totalPages || 1);
        setTotalElements(data.totalElements || 0);
      }
    } catch (err) {
      console.error('Failed to load patients:', err);
      setError(err.message || 'Failed to load patients from the server.');
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedRiskFilter, selectedDeptFilter, currentPage]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  // Load patient detail when selectedPatientId changes: GET /patients/{id}
  useEffect(() => {
    async function loadDetail() {
      if (!selectedPatientId) {
        setSelectedPatient(null);
        return;
      }

      // Check if patient exists in current page content for instant preview
      const localFound = patients.find((p) => p.id === selectedPatientId);
      if (localFound) {
        setSelectedPatient(localFound);
      }

      setLoadingDetail(true);
      try {
        const fullPatient = await patientService.getPatientById(selectedPatientId);
        if (fullPatient) {
          setSelectedPatient(fullPatient);
        }
      } catch (err) {
        console.warn('Could not fetch full patient detail from server:', err);
      } finally {
        setLoadingDetail(false);
      }
    }

    loadDetail();
  }, [selectedPatientId, patients]);

  // Handle Add Patient Form Validation & Submission (rules mirror the backend's CreatePatientRequest)
  const validateAddForm = () => {
    const errs = {};
    const ext = newPatient.externalPatientId.trim();
    if (!ext) errs.externalPatientId = 'Patient MRN / external ID is required.';
    else if (!/^[A-Za-z0-9-]{1,50}$/.test(ext)) errs.externalPatientId = 'Use letters, digits and "-" only (max 50).';
    if (!newPatient.gender) errs.gender = 'Gender is required.';
    if (!newPatient.ageGroup) errs.ageGroup = 'Age band is required.';
    if (!ICD9_PATTERN.test(newPatient.primaryDiagnosisCode.trim())) {
      errs.primaryDiagnosisCode = 'Enter an ICD-9-CM code such as 428, 250.83 or V57.';
    }
    if (newPatient.secondaryDiagnosisCode.trim() && !ICD9_PATTERN.test(newPatient.secondaryDiagnosisCode.trim())) {
      errs.secondaryDiagnosisCode = 'Enter an ICD-9-CM code or leave empty.';
    }
    const requiredNumbers = {
      lengthOfStay: 'Length of stay is required.',
      priorAdmissions: 'Prior inpatient admissions is required.',
      medicationsCount: 'Medications count is required.',
      numDiagnoses: 'Number of diagnoses is required.'
    };
    Object.entries(requiredNumbers).forEach(([key, msg]) => {
      if (newPatient[key] === '' || Number(newPatient[key]) < 0) errs[key] = msg;
    });
    if (newPatient.numDiagnoses !== '' && Number(newPatient.numDiagnoses) < 1) {
      errs.numDiagnoses = 'At least one diagnosis is required.';
    }

    setModalErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddPatientSubmit = async (e) => {
    e.preventDefault();
    if (!validateAddForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        externalPatientId: newPatient.externalPatientId.trim(),
        gender: newPatient.gender,
        race: newPatient.race || null,
        ageGroup: newPatient.ageGroup,
        department: newPatient.department.trim() || null,
        primaryDiagnosisCode: newPatient.primaryDiagnosisCode.trim(),
        secondaryDiagnosisCode: newPatient.secondaryDiagnosisCode.trim() || null,
        lengthOfStay: toIntOrNull(newPatient.lengthOfStay),
        priorAdmissions: toIntOrNull(newPatient.priorAdmissions),
        emergencyVisits: toIntOrNull(newPatient.emergencyVisits),
        outpatientVisits: toIntOrNull(newPatient.outpatientVisits),
        medicationsCount: toIntOrNull(newPatient.medicationsCount),
        numDiagnoses: toIntOrNull(newPatient.numDiagnoses),
        numLabTests: toIntOrNull(newPatient.numLabTests),
        numProcedures: toIntOrNull(newPatient.numProcedures),
        a1cResult: newPatient.a1cResult || null,
        maxGluSerum: newPatient.maxGluSerum || null
      };

      const created = await patientService.createPatient(payload);
      toast.success(
        'Patient Enrolled',
        `${created?.name || payload.externalPatientId} has been added to the registry.`
      );

      setShowAddModal(false);
      setNewPatient(EMPTY_PATIENT_FORM);
      setModalErrors({});

      // Refresh list from API and open the new record
      loadPatients();
      if (created?.id) setSelectedPatientId(created.id);
    } catch (err) {
      console.error('Failed to create patient:', err);
      toast.error('Failed to Add Patient', err.message || 'Server error while creating patient.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRiskStyle = (riskLevel) => riskStyle(riskLevel);

  const latestAdmission = selectedPatient?.admissions?.[0] || null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#0D9488]" />
            Patient Clinical Cohort
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time readmission risk surveillance, clinical telemetry, and post-discharge outreach registry
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Patient</span>
          </button>
        )}
      </div>

      {/* Inline Server Error Banner with Retry */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-[#EF4444]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-[#EF4444]" />
            <div>
              <p className="font-bold">Failed to load patient records</p>
              <p className="text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => loadPatients()}
            className="px-3 py-1.5 rounded-xl bg-white border border-red-300 hover:bg-red-100 text-xs font-semibold text-red-800 transition-colors cursor-pointer shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by patient ID, ICD-9 code, or department..."
            className="w-full pl-10 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setGlobalSearch('');
                setCurrentPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Risk Filter Buttons + Department Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Risk Badges Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {['All', 'High', 'Medium', 'Low', 'Unscored'].map((cat) => {
              const isSelected = selectedRiskFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedRiskFilter(cat);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'Unscored' ? 'Not scored' : `${cat} ${cat !== 'All' ? 'Risk' : ''}`}
                </button>
              );
            })}
          </div>

          {/* Department Filter */}
          <select
            value={selectedDeptFilter}
            onChange={(e) => {
              setSelectedDeptFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter patients by department"
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none focus:border-[#0D9488] cursor-pointer"
          >
            <option value="All">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Patient Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <SkeletonTable rows={pageSize} cols={7} />
          </div>
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No matching patients found"
            description={
              searchQuery || selectedRiskFilter !== 'All' || selectedDeptFilter !== 'All'
                ? 'Try adjusting your search criteria, risk category, or clinical department.'
                : 'No patient records currently registered in the database.'
            }
            actionLabel={
              searchQuery || selectedRiskFilter !== 'All' || selectedDeptFilter !== 'All'
                ? 'Reset Filters'
                : canEdit
                ? 'Add First Patient'
                : undefined
            }
            onAction={() => {
              if (searchQuery || selectedRiskFilter !== 'All' || selectedDeptFilter !== 'All') {
                setSearchQuery('');
                setSelectedRiskFilter('All');
                setSelectedDeptFilter('All');
                setCurrentPage(1);
              } else if (canEdit) {
                setShowAddModal(true);
              }
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-6">Patient & ID</th>
                  <th className="py-3 px-4 text-right">Age Band</th>
                  <th className="py-3 px-4">Gender</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Primary Diagnosis</th>
                  <th className="py-3 px-4 text-right">Risk Score</th>
                  <th className="py-3 px-4">Risk Category</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {patients.map((patient) => {
                  const riskConfig = getRiskStyle(patient.riskLevel);
                  const isSelected = selectedPatientId === patient.id;

                  return (
                    <tr
                      key={patient.id}
                      onClick={() => setSelectedPatientId(patient.id)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-teal-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-[#0D9488] group-hover:text-white transition-colors">
                            {initialsFor(patient.name)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 group-hover:text-[#0D9488] transition-colors">
                              {patient.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono tabular-nums">
                              #{patient.id} · {patient.admissionsCount} admission{patient.admissionsCount === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 font-medium">
                        {formatAgeGroup(patient.ageGroup)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {displayValue(patient.gender)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {patient.department || 'Not recorded'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={patient.primaryDiagnosis || ''}>
                        {displayValue(patient.primaryDiagnosis)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-sm font-bold tabular-nums" style={{ color: riskConfig.color }}>
                        {formatRisk(patient.riskScore)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold border ${riskConfig.badgeClass}`}>
                          {patient.riskLevel || 'Not scored'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPatientId(patient.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-[#0D9488] text-[#0D9488] hover:text-white text-xs font-semibold transition-colors cursor-pointer border border-teal-200 hover:border-transparent inline-flex items-center gap-1 shadow-2xs"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        {!isLoading && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(currentPage * pageSize, totalElements)}
              </span>{' '}
              of <span className="font-semibold text-slate-900">{totalElements.toLocaleString()}</span> registered patients
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {pageWindow(currentPage, totalPages).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-[#0D9488] text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                aria-label="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right-Side Detail Panel (Opens on Row Click) */}
      {selectedPatient && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedPatientId(null)}
          />

          {/* Right Slide-Over Panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out">
            {/* Panel Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#0D9488] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                  {initialsFor(selectedPatient.name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {selectedPatient.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                        getRiskStyle(selectedPatient.riskLevel).badgeClass
                      }`}
                    >
                      {selectedPatient.riskLevel || 'Not scored'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    #{selectedPatient.id} · {displayValue(selectedPatient.gender)} · {selectedPatient.department || 'No department'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPatientId(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                aria-label="Close detail panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetail && (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0D9488]" />
                  <span>Loading full patient history from server...</span>
                </div>
              )}

              {/* Risk Score Highlight Card */}
              <div className={`p-4 rounded-2xl border ${getRiskStyle(selectedPatient.riskLevel).bgSubtle} flex items-center justify-between`}>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">
                    30-Day Readmission Risk (latest ML prediction)
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span
                      className="text-3xl font-extrabold font-mono tabular-nums"
                      style={{ color: getRiskStyle(selectedPatient.riskLevel).color }}
                    >
                      {formatRisk(selectedPatient.riskScore)}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: getRiskStyle(selectedPatient.riskLevel).color }}>
                      {selectedPatient.riskLevel ? `${selectedPatient.riskLevel} Tier` : 'Not scored yet'}
                    </span>
                  </div>
                  {selectedPatient.predictedAt && (
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Predicted {formatDateTime(selectedPatient.predictedAt)}
                    </span>
                  )}
                </div>
                <div className="w-10 h-10 rounded-xl bg-white shadow-xs flex items-center justify-center text-slate-700">
                  <Activity className="w-5 h-5" style={{ color: getRiskStyle(selectedPatient.riskLevel).color }} />
                </div>
              </div>

              {/* 1. Demographics */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Demographics</span>
                </h4>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Age Band (latest stay)</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{formatAgeGroup(selectedPatient.ageGroup)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Gender</span>
                    <span className="font-semibold text-slate-800">{displayValue(selectedPatient.gender)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Race</span>
                    <span className="font-semibold text-slate-800">{displayValue(selectedPatient.race)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Patient MRN (dataset)</span>
                    <span className="font-mono font-semibold text-slate-800">{selectedPatient.externalPatientId}</span>
                  </div>
                </div>
                {selectedPatient.hasDemographicConflict && (
                  <p className="mt-2 text-[11px] text-amber-700">
                    Admissions of this patient record different race/gender values; see each admission below.
                  </p>
                )}
              </div>

              {/* 2. Diagnoses of the latest admission */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Primary Diagnosis (ICD-9)</span>
                </h4>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <p className="text-xs font-bold text-slate-900">
                    {displayValue(selectedPatient.primaryDiagnosis)}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-700">Secondary / tertiary:</span>{' '}
                    {displayValue(latestAdmission?.secondaryDiagnosisCode)} · {displayValue(latestAdmission?.tertiaryDiagnosisCode)}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-700">Recorded outcome:</span>{' '}
                    {selectedPatient.readmissionStatus
                      ? READMISSION_STATUS_LABELS[selectedPatient.readmissionStatus] || selectedPatient.readmissionStatus
                      : 'Not recorded'}
                  </p>
                </div>
              </div>

              {/* 3. Stay of the latest admission */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Stay & Admission History</span>
                </h4>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl border border-slate-200 bg-white">
                    <span className="text-slate-400 block text-[11px]">Length of Stay</span>
                    <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                      {displayValue(selectedPatient.lengthOfStay, ' days')}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Discharge: {displayValue(latestAdmission?.dischargeDisposition)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200 bg-white">
                    <span className="text-slate-400 block text-[11px]">Prior Inpatient Admissions</span>
                    <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                      {displayValue(selectedPatient.priorAdmissions)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">In the year before the stay</span>
                  </div>
                </div>
              </div>

              {/* 4. Medications & labs */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Medications &amp; Lab Markers</span>
                </h4>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Medications During Stay</span>
                    <span className="font-mono text-base font-bold text-slate-800 tabular-nums">
                      {displayValue(selectedPatient.medicationsCount, ' Rx')}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Coded Diagnoses</span>
                    <span className="font-mono text-base font-bold text-slate-800 tabular-nums">
                      {displayValue(selectedPatient.numDiagnoses)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">HbA1c Result</span>
                    <span className="font-mono text-xs font-semibold text-slate-800">
                      {displayValue(selectedPatient.a1cResult)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Emergency Visits (prior year)</span>
                    <span className="font-mono text-xs font-semibold text-slate-800">
                      {displayValue(selectedPatient.emergencyVisits)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. All admissions */}
              {selectedPatient.admissions && selectedPatient.admissions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span>Admissions ({selectedPatient.admissions.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {selectedPatient.admissions.map((adm) => (
                      <div key={adm.admissionId} className="p-3 rounded-xl border border-slate-200 bg-white text-xs flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">
                            Admission #{adm.admissionId}
                            {adm.externalAdmissionId ? ` · encounter ${adm.externalAdmissionId}` : ''}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {displayValue(adm.primaryDiagnosisCode)} ({displayValue(adm.diagnosisCategory)}) · {displayValue(adm.lengthOfStay, 'd')} ·{' '}
                            {adm.readmissionStatus ? READMISSION_STATUS_LABELS[adm.readmissionStatus] || adm.readmissionStatus : 'outcome not recorded'}
                            {adm.expiredAtDischarge ? ' · died during stay' : ''}
                          </p>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold border ${riskStyle(adm.latestPrediction?.riskLevel).badgeClass}`}>
                          {adm.latestPrediction ? `${adm.latestPrediction.riskScore}% ${adm.latestPrediction.riskLevel}` : 'Not scored'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Panel Footer Action */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedPatientId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Close
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatientId(null);
                    navigate('/risk-prediction', {
                      state: { patientId: selectedPatient.id, admissionId: selectedPatient.latestAdmissionId }
                    });
                  }}
                  className="px-4 py-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-[#0D9488] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <HeartPulse className="w-3.5 h-3.5" />
                  <span>Score Risk</span>
                </button>
              )}
              {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPatientId(null);
                  navigate('/follow-ups', {
                    state: { highlightPatientName: selectedPatient.externalPatientId }
                  });
                }}
                className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Go to Follow-ups</span>
              </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* "Add Patient" Modal Form */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 sm:p-7 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Add New Patient to Registry
                </h3>
                <p className="text-xs text-slate-500">
                  Registers the patient with the admission being recorded (same fields as the dataset)
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPatientSubmit} noValidate className="space-y-4">
              <p className="text-[11px] text-slate-500">
                Fields marked * are required. Empty optional fields are stored as "not recorded"; nothing is filled in automatically.
              </p>
              {/* MRN, Gender, Age band */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Patient MRN / ID *
                  </label>
                  <input
                    type="text" maxLength="50"
                    value={newPatient.externalPatientId}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, externalPatientId: e.target.value });
                      if (modalErrors.externalPatientId) setModalErrors({ ...modalErrors, externalPatientId: '' });
                    }}
                    placeholder="e.g. 135-77421"
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.externalPatientId ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  />
                  {modalErrors.externalPatientId && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.externalPatientId}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender *
                  </label>
                  <select
                    value={newPatient.gender}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, gender: e.target.value });
                      if (modalErrors.gender) setModalErrors({ ...modalErrors, gender: '' });
                    }}
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.gender ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  >
                    <option value="">-- Select --</option>
                    {GENDERS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  {modalErrors.gender && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.gender}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Age Band *
                  </label>
                  <select
                    value={newPatient.ageGroup}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, ageGroup: e.target.value });
                      if (modalErrors.ageGroup) setModalErrors({ ...modalErrors, ageGroup: '' });
                    }}
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.ageGroup ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  >
                    <option value="">-- Select --</option>
                    {AGE_GROUPS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  {modalErrors.ageGroup && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.ageGroup}</p>
                  )}
                </div>
              </div>

              {/* Race & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Race
                  </label>
                  <select
                    value={newPatient.race}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, race: e.target.value });
                      if (modalErrors.race) setModalErrors({ ...modalErrors, race: '' });
                    }}
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.race ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  >
                    <option value="">Not recorded</option>
                    {RACES.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  {modalErrors.race && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.race}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department / Specialty
                  </label>
                  <input
                    type="text" list="department-options" maxLength="100"
                    value={newPatient.department}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, department: e.target.value });
                      if (modalErrors.department) setModalErrors({ ...modalErrors, department: '' });
                    }}
                    placeholder="e.g. Cardiology"
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.department ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  />
                  <datalist id="department-options">
                    {departments.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                  {modalErrors.department && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.department}</p>
                  )}
                </div>
              </div>

              {/* Diagnoses */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Diagnosis (ICD-9) *
                  </label>
                  <input
                    type="text"
                    value={newPatient.primaryDiagnosisCode}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, primaryDiagnosisCode: e.target.value });
                      if (modalErrors.primaryDiagnosisCode) setModalErrors({ ...modalErrors, primaryDiagnosisCode: '' });
                    }}
                    placeholder="e.g. 428"
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.primaryDiagnosisCode ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  />
                  {modalErrors.primaryDiagnosisCode && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.primaryDiagnosisCode}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Secondary Diagnosis (ICD-9)
                  </label>
                  <input
                    type="text"
                    value={newPatient.secondaryDiagnosisCode}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, secondaryDiagnosisCode: e.target.value });
                      if (modalErrors.secondaryDiagnosisCode) setModalErrors({ ...modalErrors, secondaryDiagnosisCode: '' });
                    }}
                    placeholder="e.g. 250.02"
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.secondaryDiagnosisCode ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  />
                  {modalErrors.secondaryDiagnosisCode && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.secondaryDiagnosisCode}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Number of Diagnoses *
                  </label>
                  <input
                    type="number" min="1" max="50"
                    value={newPatient.numDiagnoses}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, numDiagnoses: e.target.value });
                      if (modalErrors.numDiagnoses) setModalErrors({ ...modalErrors, numDiagnoses: '' });
                    }}
                    placeholder="1-50"
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.numDiagnoses ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  />
                  {modalErrors.numDiagnoses && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.numDiagnoses}</p>
                  )}
                </div>
              </div>

              {/* Stay & utilisation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Length of Stay (Days) *
                  </label>
                  <input
                    type="number" min="0" max="365"
                    value={newPatient.lengthOfStay}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, lengthOfStay: e.target.value });
                      if (modalErrors.lengthOfStay) setModalErrors({ ...modalErrors, lengthOfStay: '' });
                    }}
                    placeholder="e.g. 4"
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.lengthOfStay ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  />
                  {modalErrors.lengthOfStay && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.lengthOfStay}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Prior Inpatient Admissions (1 Yr) *
                  </label>
                  <input
                    type="number" min="0" max="100"
                    value={newPatient.priorAdmissions}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, priorAdmissions: e.target.value });
                      if (modalErrors.priorAdmissions) setModalErrors({ ...modalErrors, priorAdmissions: '' });
                    }}
                    placeholder="e.g. 1"
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.priorAdmissions ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  />
                  {modalErrors.priorAdmissions && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.priorAdmissions}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Medications During Stay *
                  </label>
                  <input
                    type="number" min="0" max="200"
                    value={newPatient.medicationsCount}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, medicationsCount: e.target.value });
                      if (modalErrors.medicationsCount) setModalErrors({ ...modalErrors, medicationsCount: '' });
                    }}
                    placeholder="e.g. 15"
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.medicationsCount ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  />
                  {modalErrors.medicationsCount && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.medicationsCount}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Emergency Visits
                  </label>
                  <input
                    type="number" min="0" max="100"
                    value={newPatient.emergencyVisits}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, emergencyVisits: e.target.value });
                      if (modalErrors.emergencyVisits) setModalErrors({ ...modalErrors, emergencyVisits: '' });
                    }}
                    placeholder=""
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.emergencyVisits ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  />
                  {modalErrors.emergencyVisits && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.emergencyVisits}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Outpatient Visits
                  </label>
                  <input
                    type="number" min="0" max="100"
                    value={newPatient.outpatientVisits}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, outpatientVisits: e.target.value });
                      if (modalErrors.outpatientVisits) setModalErrors({ ...modalErrors, outpatientVisits: '' });
                    }}
                    placeholder=""
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.outpatientVisits ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  />
                  {modalErrors.outpatientVisits && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.outpatientVisits}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lab Tests
                  </label>
                  <input
                    type="number" min="0" max="500"
                    value={newPatient.numLabTests}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, numLabTests: e.target.value });
                      if (modalErrors.numLabTests) setModalErrors({ ...modalErrors, numLabTests: '' });
                    }}
                    placeholder=""
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.numLabTests ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  />
                  {modalErrors.numLabTests && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.numLabTests}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Procedures
                  </label>
                  <input
                    type="number" min="0" max="50"
                    value={newPatient.numProcedures}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, numProcedures: e.target.value });
                      if (modalErrors.numProcedures) setModalErrors({ ...modalErrors, numProcedures: '' });
                    }}
                    placeholder=""
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.numProcedures ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  />
                  {modalErrors.numProcedures && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.numProcedures}</p>
                  )}
                </div>
              </div>

              {/* Lab results */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    HbA1c Result
                  </label>
                  <select
                    value={newPatient.a1cResult}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, a1cResult: e.target.value });
                      if (modalErrors.a1cResult) setModalErrors({ ...modalErrors, a1cResult: '' });
                    }}
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.a1cResult ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  >
                    <option value="">Not recorded</option>
                    {A1C_RESULTS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  {modalErrors.a1cResult && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.a1cResult}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Glucose Serum
                  </label>
                  <select
                    value={newPatient.maxGluSerum}
                    onChange={(e) => {
                      setNewPatient({ ...newPatient, maxGluSerum: e.target.value });
                      if (modalErrors.maxGluSerum) setModalErrors({ ...modalErrors, maxGluSerum: '' });
                    }}
                    className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none ${
                      modalErrors.maxGluSerum ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#0D9488]'
                    }`}
                  >
                    <option value="">Not recorded</option>
                    {GLUCOSE_RESULTS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  {modalErrors.maxGluSerum && (
                    <p className="mt-1 text-[11px] text-[#EF4444]">{modalErrors.maxGluSerum}</p>
                  )}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-60 text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Server...</span>
                    </>
                  ) : (
                    <span>Enroll Patient</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
