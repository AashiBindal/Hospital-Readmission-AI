import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  CalendarCheck,
  Sparkles,
  Stethoscope,
  Info,
  ChevronRight,
  Loader2,
  AlertCircle,
  Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import predictionService from '../api/predictionService';
import patientService from '../api/patientService';
import followUpService from '../api/followUpService';
import { OUTREACH_CHANNELS, READMISSION_STATUS_LABELS } from '../constants/enums';
import { displayValue, formatAgeGroup, formatDateTime } from '../utils/format';

// Read-only value box used for the admission's recorded features
function FeatureField({ label, value }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
      <div className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium min-h-[34px] truncate">
        {value}
      </div>
    </div>
  );
}

export default function RiskPredictionPage() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Patients list loaded from Spring Boot REST API for the picker (highest risk first)
  const [patientRegistry, setPatientRegistry] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [recordInput, setRecordInput] = useState('');

  // Selected patient (GET /patients/{id}) and admission to score
  const [patientDetail, setPatientDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState('');

  // Prediction state: null until the ML service has scored the admission (or a stored prediction exists)
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);

  const [isCreatingFollowUp, setIsCreatingFollowUp] = useState(false);
  const [followUpSuccess, setFollowUpSuccess] = useState(null);
  const [apiError, setApiError] = useState(null);

  const admission =
    patientDetail?.admissions?.find((a) => String(a.admissionId) === String(selectedAdmissionId)) || null;

  // Load patients for the pre-fill dropdown from GET /patients
  useEffect(() => {
    async function fetchPatientList() {
      setLoadingPatients(true);
      try {
        const data = await patientService.getPatients({ size: 50 });
        if (data && data.content) {
          setPatientRegistry(data.content);
        }
      } catch (err) {
        console.warn('Could not load patient registry for picker:', err);
      } finally {
        setLoadingPatients(false);
      }
    }
    fetchPatientList();
  }, []);

  const loadPatient = useCallback(async (patientId, preferredAdmissionId) => {
    setSelectedPatientId(patientId ? String(patientId) : '');
    setPatientDetail(null);
    setSelectedAdmissionId('');
    setPredictionResult(null);
    setFollowUpSuccess(null);
    setApiError(null);
    if (!patientId) return;

    setLoadingDetail(true);
    try {
      const detail = await patientService.getPatientById(patientId);
      setPatientDetail(detail);
      const admissions = detail.admissions || [];
      const preferred = admissions.find((a) => String(a.admissionId) === String(preferredAdmissionId));
      const chosen = preferred || admissions[0];
      setSelectedAdmissionId(chosen ? String(chosen.admissionId) : '');
    } catch (err) {
      setApiError(err.message || 'Could not load the patient.');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Routed from the Patients page: { patientId, admissionId }
  useEffect(() => {
    if (location.state?.patientId) {
      loadPatient(location.state.patientId, location.state.admissionId);
    }
  }, [location.state, loadPatient]);

  // Show the admission's latest stored prediction (if any) when the admission changes
  useEffect(() => {
    if (!admission) {
      setPredictionResult(null);
      return;
    }
    const stored = admission.latestPrediction;
    setPredictionResult(
      stored
        ? {
            predictionId: stored.predictionId,
            probability: stored.riskScore,
            riskLevel: stored.riskLevel,
            modelVersion: stored.modelVersion,
            predictedAt: stored.predictedAt,
            factors: null, // not returned for stored predictions
            recommendedAction: null,
            stored: true
          }
        : null
    );
    // Re-run only when another admission/patient is selected, not when a new prediction updates the record
  }, [selectedAdmissionId, patientDetail?.id]);

  const handleLoadByRecord = (e) => {
    e.preventDefault();
    const id = recordInput.trim();
    if (!/^[0-9]+$/.test(id)) {
      setApiError('Enter the numeric patient record # shown in the Patients list.');
      return;
    }
    loadPatient(id);
  };

  // Submit Prediction Request to Spring Boot REST API: POST /predictions { admissionId }
  const handlePredictSubmit = async (e) => {
    e.preventDefault();
    if (!admission) {
      setApiError('Select a patient and an admission to score.');
      return;
    }
    setIsPredicting(true);
    setApiError(null);
    setFollowUpSuccess(null);

    try {
      const data = await predictionService.calculateRisk(admission.admissionId);
      setPredictionResult({
        predictionId: data.predictionId,
        probability: data.riskScore,
        riskLevel: data.riskLevel,
        modelVersion: data.modelVersion,
        predictedAt: data.predictedAt,
        factors: Array.isArray(data.factors) ? data.factors : [],
        recommendedAction: data.recommendedAction,
        stored: false
      });
      // Keep the patient view in sync with the stored prediction
      setPatientDetail((prev) =>
        prev
          ? {
              ...prev,
              admissions: prev.admissions.map((a) =>
                a.admissionId === admission.admissionId
                  ? {
                      ...a,
                      latestPrediction: {
                        predictionId: data.predictionId,
                        admissionId: a.admissionId,
                        riskScore: data.riskScore,
                        riskLevel: data.riskLevel,
                        modelVersion: data.modelVersion,
                        predictedAt: data.predictedAt
                      }
                    }
                  : a
              )
            }
          : prev
      );
      toast.success(
        'Prediction Stored',
        `30-day readmission risk scored at ${data.riskScore}% (${data.riskLevel}) by model ${data.modelVersion}.`
      );
    } catch (err) {
      console.error('Prediction API call failed:', err);
      setApiError(err.message || 'Failed to compute risk prediction with the server.');
    } finally {
      setIsPredicting(false);
    }
  };

  // Create Follow-up Button Handler: POST /follow-ups (assigned to the signed-in clinician)
  const handleCreateFollowUp = async () => {
    if (!predictionResult || !patientDetail) return;
    setIsCreatingFollowUp(true);
    const isHigh = predictionResult.riskLevel === 'High';
    const isMed = predictionResult.riskLevel === 'Medium';
    const daysOffset = isHigh ? 7 : isMed ? 14 : 30;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const dueDateStr = targetDate.toISOString().split('T')[0];

    // OUTREACH_CHANNELS: Phone, Telehealth, In-Person, Home Health, SMS
    const channelStr = isHigh ? OUTREACH_CHANNELS[2] : isMed ? OUTREACH_CHANNELS[1] : OUTREACH_CHANNELS[4];

    const payload = {
      patientId: String(patientDetail.id),
      predictionId: predictionResult.predictionId,
      assignedToUserId: currentUser?.id ?? null,
      channel: channelStr,
      priority: isHigh ? 'Urgent' : isMed ? 'High' : 'Medium',
      dueDate: dueDateStr,
      notes: `Predicted 30-day readmission risk: ${predictionResult.probability}% (${predictionResult.riskLevel}, model ${predictionResult.modelVersion}, admission #${selectedAdmissionId}).`
    };

    try {
      const created = await followUpService.createFollowUp(payload);
      setFollowUpSuccess(created);
      toast.success(
        'Follow-up Scheduled',
        `Follow-up created for ${created.patientName} (${created.dueDate}).`,
        {
          label: 'View in Follow-ups →',
          onClick: () => navigate('/follow-ups')
        }
      );
    } catch (err) {
      console.error('Failed to create follow-up:', err);
      toast.error('Follow-up Failed', err.message || 'Could not save follow-up to server.');
    } finally {
      setIsCreatingFollowUp(false);
    }
  };

  // Styling based on risk level
  const getRiskTheme = (level) => {
    if (level === 'High') {
      return {
        badgeBg: 'bg-rose-50 text-[#EF4444] border-rose-200',
        color: '#EF4444',
        glow: 'rgba(239, 68, 68, 0.25)',
        bannerBg: 'bg-red-50/70 border-red-200 text-red-900',
        actionBorder: 'border-l-4 border-l-[#EF4444]'
      };
    }
    if (level === 'Medium') {
      return {
        badgeBg: 'bg-amber-50 text-[#F59E0B] border-amber-200',
        color: '#F59E0B',
        glow: 'rgba(245, 158, 11, 0.25)',
        bannerBg: 'bg-amber-50/70 border-amber-200 text-amber-900',
        actionBorder: 'border-l-4 border-l-[#F59E0B]'
      };
    }
    return {
      badgeBg: 'bg-emerald-50 text-[#22C55E] border-emerald-200',
      color: '#22C55E',
      glow: 'rgba(34, 197, 94, 0.25)',
      bannerBg: 'bg-green-50/70 border-green-200 text-green-900',
      actionBorder: 'border-l-4 border-l-[#22C55E]'
    };
  };

  const riskTheme = getRiskTheme(predictionResult?.riskLevel);
  const probability = predictionResult?.probability ?? 0;

  // SVG Semicircle Gauge Calculations
  const arcRadius = 85;
  const centerX = 110;
  const centerY = 100;
  const arcLength = Math.PI * arcRadius;
  const strokeDashoffset = arcLength * (1 - probability / 100);
  const theta = Math.PI * (1 - probability / 100);
  const needleX = centerX + arcRadius * Math.cos(theta);
  const needleY = centerY - arcRadius * Math.sin(theta);

  return (
    <div className="space-y-6">
      {/* Toast Alert with link to view follow-up */}
      {followUpSuccess && (
        <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xl border border-slate-700/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-[#22C55E] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Follow-up Recorded in Backend</p>
              <p className="text-[11px] text-slate-300">
                {followUpSuccess.patientName} · {followUpSuccess.channel} · Due {followUpSuccess.dueDate}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/follow-ups')}
            className="px-3.5 py-1.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Open Follow-ups</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-[#0D9488]" />
            Readmission Risk Predictor
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Scores a recorded admission with the ML service and stores the prediction
          </p>
        </div>

        {/* Patient Pre-fill Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
            Load Patient:
          </label>
          <select
            value={patientRegistry.some((p) => p.id === selectedPatientId) ? selectedPatientId : ''}
            onChange={(e) => loadPatient(e.target.value)}
            disabled={loadingPatients}
            aria-label="Load patient from registry"
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:border-[#0D9488] max-w-xs truncate"
          >
            <option value="">-- Select (highest risk first) --</option>
            {patientRegistry.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (#{p.id} · {formatAgeGroup(p.ageGroup)})
              </option>
            ))}
          </select>
          <form onSubmit={handleLoadByRecord} className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={recordInput}
              onChange={(e) => setRecordInput(e.target.value)}
              placeholder="Record #"
              aria-label="Load patient by record number"
              className="w-24 px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-mono focus:outline-none focus:border-[#0D9488]"
            />
            <button
              type="submit"
              title="Load patient by record #"
              className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-[#0D9488] cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Inline API Error Notice */}
      {apiError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-xs text-[#EF4444]">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">Prediction Engine Error</p>
            <p className="text-red-700 mt-0.5">{apiError}</p>
          </div>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Clinical Parameters Input Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-[#0D9488]" />
              Admission Features &amp; Clinical History
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Features recorded for the selected admission (sent to the ML service as stored)
            </p>
          </div>

          {loadingDetail && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0D9488]" />
              <span>Loading patient record from server...</span>
            </div>
          )}

          {!patientDetail && !loadingDetail ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
              Select a patient above (or enter a record #) to load their recorded admissions.
            </div>
          ) : patientDetail ? (
            <form onSubmit={handlePredictSubmit} className="space-y-5" noValidate>
              {/* Row 1: Patient & Admission */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <FeatureField label="Patient" value={`${patientDetail.name} (#${patientDetail.id})`} />
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Admission to Score *
                  </label>
                  <select
                    value={selectedAdmissionId}
                    onChange={(e) => setSelectedAdmissionId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                  >
                    {(patientDetail.admissions || []).map((a) => (
                      <option key={a.admissionId} value={String(a.admissionId)}>
                        #{a.admissionId}
                        {a.externalAdmissionId ? ` (encounter ${a.externalAdmissionId})` : ''} · {displayValue(a.primaryDiagnosisCode)} ·{' '}
                        {a.latestPrediction ? `scored ${a.latestPrediction.riskScore}%` : 'not scored'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {admission && (
                <>
                  {/* Row 2: Demographics recorded for this stay */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <FeatureField label="Age Band" value={formatAgeGroup(admission.ageGroup)} />
                    <FeatureField label="Gender" value={displayValue(admission.gender)} />
                    <FeatureField label="Department" value={displayValue(admission.department)} />
                  </div>

                  {/* Row 3: Primary Diagnosis */}
                  <FeatureField
                    label="Primary Admission Diagnosis (ICD-9)"
                    value={admission.primaryDiagnosisCode ? `${admission.primaryDiagnosisCode} · ${admission.diagnosisCategory}` : '—'}
                  />

                  {/* Row 4: Stay & Admission Counters */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <FeatureField label="Length of Stay (Days)" value={displayValue(admission.lengthOfStay)} />
                    <FeatureField label="Prior Inpatient Admissions (1 Yr)" value={displayValue(admission.priorAdmissions)} />
                    <FeatureField label="Medications Count" value={displayValue(admission.numMedications)} />
                  </div>

                  {/* Row 5: Diagnoses & labs on record */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-700">
                        Diagnoses &amp; Results on Record
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {displayValue(admission.numDiagnoses)} coded diagnoses
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        ['Secondary Dx', admission.secondaryDiagnosisCode],
                        ['Tertiary Dx', admission.tertiaryDiagnosisCode],
                        ['HbA1c', admission.a1cResult],
                        ['Max Glucose', admission.maxGluSerum],
                        ['Emergency Visits', admission.emergencyVisits],
                        ['Outpatient Visits', admission.outpatientVisits]
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="px-3 py-2 rounded-xl text-xs font-medium border text-left flex items-center justify-between border-slate-200 text-slate-600 bg-white"
                        >
                          <span className="truncate">{label}</span>
                          <span className="font-semibold text-slate-900 ml-1 shrink-0">{displayValue(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Row 6: Discharge Disposition & outcome */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <FeatureField label="Discharge Disposition" value={displayValue(admission.dischargeDisposition)} />
                    <FeatureField
                      label="Recorded Outcome"
                      value={
                        admission.readmissionStatus
                          ? READMISSION_STATUS_LABELS[admission.readmissionStatus] || admission.readmissionStatus
                          : 'Not recorded'
                      }
                    />
                  </div>

                  {admission.expiredAtDischarge && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      This stay ended in death; a readmission prediction does not apply.
                    </p>
                  )}
                </>
              )}

              {/* Submit Predict Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPredicting || !admission || admission.expiredAtDischarge}
                  className="w-full py-3 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-60 text-white font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isPredicting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Requesting ML Risk Score...</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4" />
                      <span>Predict 30-Day Readmission Risk</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {/* Right Column: Prediction Score Gauge & Contributing Factors (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Risk Assessment Gauge
                </h3>
                <p className="text-xs text-slate-500">
                  Predicted 30-day post-discharge probability
                </p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${predictionResult ? riskTheme.badgeBg : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {predictionResult ? `${predictionResult.riskLevel} Risk` : 'Not scored'}
              </span>
            </div>

            {/* Semicircle Gauge SVG */}
            <div className="flex flex-col items-center justify-center pt-2">
              <div className="relative w-64 h-36 flex items-center justify-center">
                <svg viewBox="0 0 220 120" className="w-full h-full overflow-visible">
                  {/* Gauge background track */}
                  <path
                    d="M 25 100 A 85 85 0 0 1 195 100"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />
                  {/* Gauge progress stroke */}
                  <path
                    d="M 25 100 A 85 85 0 0 1 195 100"
                    fill="none"
                    stroke={predictionResult ? riskTheme.color : '#E2E8F0'}
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray={arcLength}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-700 ease-out"
                  />
                  {/* Needle indicator dot */}
                  <circle
                    cx={needleX}
                    cy={needleY}
                    r="8"
                    fill="#FFFFFF"
                    stroke={predictionResult ? riskTheme.color : '#CBD5E1'}
                    strokeWidth="4"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>

                {/* Center score readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-8 pointer-events-none">
                  <span className="text-4xl font-extrabold font-mono text-slate-900 tabular-nums">
                    {predictionResult ? `${predictionResult.probability}%` : '—'}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 mt-0.5">
                    {predictionResult ? 'Readmission Probability' : 'No prediction yet'}
                  </span>
                </div>
              </div>

              {/* Gauge labels */}
              <div className="w-64 flex justify-between text-[11px] font-semibold text-slate-400 mt-1 px-4">
                <span>0% (Low)</span>
                <span>50%</span>
                <span>100% (High)</span>
              </div>
            </div>

            {predictionResult && (
              <p className="text-[11px] text-slate-500 text-center -mt-2">
                Model {predictionResult.modelVersion} · {formatDateTime(predictionResult.predictedAt)}
                {predictionResult.stored ? ' · stored prediction' : ''}
              </p>
            )}

            {/* Top Contributing Factors Horizontal Bars */}
            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Top Contributing Factors</span>
                <span className="text-[11px] font-normal text-slate-400">From the model</span>
              </h4>

              {!predictionResult ? (
                <p className="text-xs text-slate-400">Run a prediction to see the model output.</p>
              ) : !predictionResult.factors || predictionResult.factors.length === 0 ? (
                <p className="text-xs text-slate-400">
                  {predictionResult.stored
                    ? 'Factor attributions are shown right after a new prediction.'
                    : 'The ML service did not return factor attributions for this prediction.'}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {predictionResult.factors.map((f, i) => (
                    <div key={`${f.label}-${i}`} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-700 font-medium truncate pr-2">{f.label}</span>
                        <span className="text-slate-900 font-bold font-mono tabular-nums">{f.contribution}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${Math.min(100, Math.max(3, (Math.abs(f.contribution) / Math.max(...predictionResult.factors.map((x) => Math.abs(x.contribution)), 1e-9)) * 100))}%`,
                            backgroundColor: i === 0 ? riskTheme.color : i === 1 ? '#0D9488' : '#64748B'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommended Action Box */}
            {predictionResult && (
              <div className={`p-4 rounded-xl border bg-slate-50/80 ${riskTheme.actionBorder} space-y-1.5`}>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Recommended Follow-up Protocol:</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {predictionResult.recommendedAction ||
                    (predictionResult.riskLevel === 'High'
                      ? 'High risk: schedule a post-discharge follow-up within 7 days.'
                      : predictionResult.riskLevel === 'Medium'
                      ? 'Medium risk: schedule a follow-up within 14 days.'
                      : 'Low risk: routine follow-up within 30 days.')}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-1">
              <button
                type="button"
                disabled={isCreatingFollowUp || !predictionResult}
                onClick={handleCreateFollowUp}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isCreatingFollowUp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Scheduling Follow-up...</span>
                  </>
                ) : (
                  <>
                    <CalendarCheck className="w-4 h-4 text-teal-400" />
                    <span>Create Follow-up in Queue</span>
                  </>
                )}
              </button>
            </div>

            {/* Mandatory Diagnostic Disclaimer */}
            <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                <strong>Clinical Disclaimer:</strong> This is an algorithmic risk estimate, not a definitive diagnosis. Clinical judgment supersedes predictive modeling.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
