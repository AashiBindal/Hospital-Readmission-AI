import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  TrendingDown,
  AlertTriangle,
  Users,
  Activity,
  Filter,
  Download,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import analyticsService from '../api/analyticsService';
import useDepartments from '../hooks/useDepartments';
import { formatPercent } from '../utils/format';
import { useToast } from '../context/ToastContext';

const RISK_COLORS = {
  Low: '#22C55E',
  Medium: '#F59E0B',
  High: '#EF4444'
};

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { departments } = useDepartments();
  const DEPARTMENT_OPTIONS = ['All Departments', ...departments];
  const [selectedDept, setSelectedDept] = useState('All Departments');

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data States
  const [trendData, setTrendData] = useState([]);
  const [ageGroupData, setAgeGroupData] = useState([]);
  const [topRiskFactors, setTopRiskFactors] = useState([]);
  const [diagnosisData, setDiagnosisData] = useState([]);
  const [cohortSummary, setCohortSummary] = useState({
    totalPatients: 0,
    totalAdmissions: 0,
    scoredPatients: 0,
    unscoredPatients: 0,
    avgPredictedRisk: null,
    observedReadmissionRate: null,
    lowRiskCount: 0,
    mediumRiskCount: 0,
    highRiskCount: 0
  });

  // Fetch real analytics from backend
  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [trendRes, ageRes, factorsRes, diagRes, summaryRes] = await Promise.allSettled([
        analyticsService.getLengthOfStay(selectedDept),
        analyticsService.getAgeGroups(selectedDept),
        analyticsService.getRiskFactors(selectedDept),
        analyticsService.getByDiagnosis(selectedDept),
        analyticsService.getSummary(selectedDept)
      ]);

      if (trendRes.status === 'fulfilled' && Array.isArray(trendRes.value)) {
        setTrendData(trendRes.value);
      } else {
        setTrendData([]);
      }

      if (ageRes.status === 'fulfilled' && Array.isArray(ageRes.value)) {
        setAgeGroupData(ageRes.value);
      } else {
        setAgeGroupData([]);
      }

      if (factorsRes.status === 'fulfilled' && Array.isArray(factorsRes.value)) {
        setTopRiskFactors(factorsRes.value);
      } else {
        setTopRiskFactors([]);
      }

      if (diagRes.status === 'fulfilled' && Array.isArray(diagRes.value)) {
        setDiagnosisData(diagRes.value);
      } else {
        setDiagnosisData([]);
      }

      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        const d = summaryRes.value;
        setCohortSummary({
          totalPatients: d.totalPatients ?? 0,
          totalAdmissions: d.totalAdmissions ?? 0,
          scoredPatients: d.scoredPatients ?? 0,
          unscoredPatients: d.unscoredPatients ?? 0,
          avgPredictedRisk: d.avgPredictedRisk ?? null,
          observedReadmissionRate: d.observedReadmissionRate ?? null,
          lowRiskCount: d.lowRiskCount ?? 0,
          mediumRiskCount: d.mediumRiskCount ?? 0,
          highRiskCount: d.highRiskCount ?? 0
        });
      }

      // Report any failed request instead of silently showing empty charts
      const failed = [trendRes, ageRes, factorsRes, diagRes, summaryRes].filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        const rejectedErr = failed[0].reason;
        throw new Error(
          `${failed.length} of 5 analytics requests failed: ${rejectedErr?.message || 'Failed to connect to analytics services.'}`
        );
      }
    } catch (err) {
      console.error('Analytics load error:', err);
      setError(err.message || 'Unable to retrieve clinical analytics from server.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDept]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const overallRate = cohortSummary.observedReadmissionRate;

  // Age band with the highest observed readmission rate
  const peakAgeGroup = ageGroupData.reduce(
    (best, g) => (g.readmissionRate !== null && (!best || g.readmissionRate > best.readmissionRate) ? g : best),
    null
  );

  // Risk Distribution Data for Donut
  const riskDistributionData = useMemo(() => {
    return [
      { name: 'Low Risk', value: cohortSummary.lowRiskCount, color: RISK_COLORS.Low, level: 'Low' },
      { name: 'Medium Risk', value: cohortSummary.mediumRiskCount, color: RISK_COLORS.Medium, level: 'Medium' },
      { name: 'High Risk', value: cohortSummary.highRiskCount, color: RISK_COLORS.High, level: 'High' }
    ];
  }, [cohortSummary]);

  const handleExportSummary = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'MediSight Clinical Analytics Report',
        `Department: ${selectedDept}`,
        `Generated: ${new Date().toISOString()}`,
        `Cohort Size: ${cohortSummary.totalPatients}`,
        `Admissions: ${cohortSummary.totalAdmissions}`,
        `Scored Patients: ${cohortSummary.scoredPatients}`,
        `Average Predicted Risk: ${formatPercent(cohortSummary.avgPredictedRisk)}`,
        `Observed 30-day Readmission Rate: ${formatPercent(cohortSummary.observedReadmissionRate)}`,
        `High-Risk Count: ${cohortSummary.highRiskCount}`,
        '',
        'Diagnosis Category (ICD-9),Admissions,Observed Readmission Rate (%),Avg Predicted Risk (%)',
        ...diagnosisData.map((d) => `"${d.name}",${d.count ?? 0},${d.readmissionRate ?? ''},${d.avgRiskScore ?? ''}`),
        '',
        'Age Group,Admissions,Avg Predicted Risk (%),Readmission Rate (%)',
        ...ageGroupData.map((a) => `"${a.ageGroup}",${a.patients ?? 0},${a.avgRisk ?? ''},${a.readmissionRate ?? ''}`),
        '',
        'Length of Stay (days),Discharges,Observed Rate (%),Avg Predicted Risk (%)',
        ...trendData.map((t) => `${t.lengthOfStay},${t.totalDischarges ?? 0},${t.observedRate ?? ''},${t.predictedRate ?? ''}`)
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `medisight_analytics_${selectedDept.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Analytics Report Exported', `Downloaded CSV report for ${selectedDept}.`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header with Department Filter & Export */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-teal-50 text-[#0D9488]">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Clinical Readmission Analytics
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Cohort trajectory, diagnosis breakdown, risk clustering, and multi-factor vulnerability analysis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter Dropdown */}
          <div className="relative flex items-center">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 font-medium hover:border-slate-300 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15 cursor-pointer shadow-xs appearance-none"
              aria-label="Department Filter"
            >
              {DEPARTMENT_OPTIONS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 text-slate-400 text-xs">▼</div>
          </div>

          {/* Export Report */}
          <button
            onClick={handleExportSummary}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Inline Error Alert with Retry */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-800">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0" />
            <div>
              <p className="text-xs font-bold">Analytics Data Error</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchAnalytics}
            className="px-3.5 py-1.5 bg-white border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 hover:bg-rose-100/50 shadow-2xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse p-5" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 rounded-2xl bg-white border border-slate-200 animate-pulse p-6" />
            <div className="h-96 rounded-2xl bg-white border border-slate-200 animate-pulse p-6" />
          </div>
        </div>
      ) : (
        <>
          {/* Cohort KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Patients */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Selected Cohort
                </span>
                <span className="p-2 rounded-xl bg-teal-50 text-[#0D9488]">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {cohortSummary.totalPatients.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 font-medium">Patients</span>
              </div>
              <p className="text-xs text-slate-500 mt-2 truncate">
                {selectedDept === 'All Departments'
                  ? `${cohortSummary.totalAdmissions.toLocaleString()} admissions, all departments`
                  : `${cohortSummary.totalAdmissions.toLocaleString()} admissions in ${selectedDept}`}
              </p>
            </div>

            {/* Average Predicted Risk */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Avg Predicted Risk
                </span>
                <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
                  <Activity className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {formatPercent(cohortSummary.avgPredictedRisk)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {cohortSummary.scoredPatients > 0
                  ? `Latest stored ML prediction, ${cohortSummary.scoredPatients} scored patients`
                  : 'No stored ML predictions yet'}
              </p>
            </div>

            {/* Observed Readmission Rate */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Observed Readmission
                </span>
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <TrendingDown className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {formatPercent(cohortSummary.observedReadmissionRate)}
                </span>
                <span className="text-xs text-slate-400 font-medium">Actual &lt;30d</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Recorded outcome; stays that ended in death excluded
              </p>
            </div>

            {/* High Risk Share */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  High Risk Share
                </span>
                <span className="p-2 rounded-xl bg-red-50 text-[#EF4444]">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#EF4444] tabular-nums">
                  {cohortSummary.highRiskCount}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  ({cohortSummary.scoredPatients > 0 ? Math.round((cohortSummary.highRiskCount / cohortSummary.scoredPatients) * 100) : 0}% of scored)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Latest ML prediction tier is High
              </p>
            </div>
          </div>

          {/* Row 1: Readmission Trend by Month & Risk Distribution Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend Chart (2 Cols) */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>Readmission by Length of Stay</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-teal-50 text-[#0D9488] font-medium border border-teal-200/60">
                        {selectedDept}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Observed 30-day readmission rate vs. average stored ML risk, per length of stay (the dataset has no admission dates)
                    </p>
                  </div>
                </div>

                <div className="h-72 w-full pt-2">
                  {trendData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No length-of-stay data returned for {selectedDept}.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="trendObservedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0D9488" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                          </linearGradient>
                          <linearGradient id="trendPredictedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: '#64748B' }}
                          tickLine={false}
                          axisLine={{ stroke: '#E2E8F0' }}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#64748B' }}
                          tickLine={false}
                          axisLine={false}
                          unit="%"
                          domain={[0, 'auto']}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-[#0F172A] text-white p-3 rounded-xl shadow-lg text-xs space-y-1">
                                  <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1.5">
                                    {payload[0]?.payload?.fullLabel || label}
                                  </p>
                                  <p className="flex items-center justify-between gap-4">
                                    <span className="text-[#2DD4BF] flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-[#0D9488]" /> Observed Rate:
                                    </span>
                                    <span className="font-bold tabular-nums">
                                      {formatPercent(payload[0]?.payload?.observedRate)}
                                    </span>
                                  </p>
                                  <p className="flex items-center justify-between gap-4">
                                    <span className="text-indigo-300 flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-indigo-400" /> Predicted Rate:
                                    </span>
                                    <span className="font-bold tabular-nums">
                                      {payload[0]?.payload?.predictedRate === null || payload[0]?.payload?.predictedRate === undefined
                                        ? 'not scored'
                                        : `${payload[0].payload.predictedRate}%`}
                                    </span>
                                  </p>
                                  {payload[0]?.payload?.totalDischarges !== undefined && (
                                    <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                                      Discharges: {payload[0]?.payload?.totalDischarges} · Readmitted &lt;30d:{' '}
                                      {payload[0]?.payload?.readmitted} · Scored: {payload[0]?.payload?.scoredCount}
                                    </p>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="observedRate"
                          name="Observed Rate"
                          stroke="#0D9488"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#trendObservedGrad)"
                        />
                        <Area
                          type="monotone"
                          dataKey="predictedRate"
                          name="Predicted Risk"
                          stroke="#6366F1"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          fillOpacity={1}
                          fill="url(#trendPredictedGrad)"
                          connectNulls
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                <span className="flex items-center gap-1 text-teal-700 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" />
                  Overall observed rate: {formatPercent(cohortSummary.observedReadmissionRate)}
                </span>
                <span>
                  {cohortSummary.scoredPatients > 0
                    ? `${cohortSummary.scoredPatients} patients scored`
                    : 'No predictions stored yet'}
                </span>
              </div>
            </div>

            {/* Risk Distribution Donut Chart */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Risk Distribution
                  </h2>
                  <span className="text-xs text-slate-400 font-medium tabular-nums">
                    n = {cohortSummary.scoredPatients} scored
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Latest ML prediction tier per patient ({cohortSummary.unscoredPatients} not scored)
                </p>

                <div className="h-56 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {riskDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const pct = cohortSummary.scoredPatients > 0 ? Math.round((data.value / cohortSummary.scoredPatients) * 100) : 0;
                            return (
                              <div className="bg-[#0F172A] text-white px-3 py-2 rounded-xl text-xs shadow-md">
                                <span className="font-semibold">{data.name}: </span>
                                <span className="font-bold tabular-nums">{data.value} patients ({pct}%)</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Centered Total */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900 tabular-nums">
                      {cohortSummary.scoredPatients}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Scored
                    </span>
                  </div>
                </div>
              </div>

              {/* Breakdown Badges */}
              <div className="space-y-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                {riskDistributionData.map((item) => {
                  const pct = cohortSummary.scoredPatients > 0 ? Math.round((item.value / cohortSummary.scoredPatients) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium text-slate-700">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-semibold">
                        <span className="text-slate-900 tabular-nums">{item.value}</span>
                        <span className="text-slate-400 text-[11px] tabular-nums">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Readmission by Diagnosis & Age-Group Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Readmission by Diagnosis (Bar Chart) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Readmission by Diagnosis
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                    Primary ICD-9 Category
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Observed 30-day readmission rate by primary-diagnosis category (Strack et al. grouping)
                </p>

                <div className="h-64 w-full">
                  {diagnosisData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No diagnosis records returned for {selectedDept}.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={diagnosisData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 35, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                        <XAxis
                          type="number"
                          unit="%"
                          domain={[0, 'auto']}
                          tick={{ fontSize: 11, fill: '#64748B' }}
                          tickLine={false}
                          axisLine={{ stroke: '#E2E8F0' }}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
                          tickLine={false}
                          axisLine={false}
                          width={95}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              return (
                                <div className="bg-[#0F172A] text-white p-2.5 rounded-xl text-xs space-y-1 shadow-md">
                                  <p className="font-bold text-slate-200">{item.name}</p>
                                  <p className="text-teal-300">
                                    Readmission Rate: <span className="font-bold text-white">{item.readmissionRate}%</span>
                                  </p>
                                  <p className="text-slate-300">
                                    Admissions: <span className="font-bold text-white">{item.count || 0}</span>
                                  </p>
                                  {item.avgRiskScore !== null && item.avgRiskScore !== undefined && (
                                    <p className="text-slate-400">
                                      Avg Risk Score: <span className="font-bold text-white">{item.avgRiskScore}%</span>
                                    </p>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar
                          dataKey="readmissionRate"
                          name="Readmission Rate"
                          fill="#0D9488"
                          radius={[0, 6, 6, 0]}
                          barSize={18}
                        >
                          {diagnosisData.map((entry, index) => (
                            <Cell
                              key={`diag-${index}`}
                              fill={
                                overallRate !== null && (entry.readmissionRate ?? 0) >= overallRate * 1.2
                                  ? '#EF4444'
                                  : overallRate !== null && (entry.readmissionRate ?? 0) >= overallRate
                                  ? '#F59E0B'
                                  : '#0D9488'
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Color vs overall rate ({formatPercent(overallRate)}): <span className="text-[#EF4444] font-semibold">≥1.2×</span> · <span className="text-[#F59E0B] font-semibold">above</span> · <span className="text-[#0D9488] font-semibold">below</span></span>
                <button
                  onClick={() => navigate('/patients')}
                  className="text-[#0D9488] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View in Patients <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Age-Group Comparison (Bar Chart) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Age-Group Comparison
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                    Demographic Vulnerability
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Average stored ML risk vs. observed 30-day readmission rate by 10-year age band
                </p>

                <div className="h-64 w-full">
                  {ageGroupData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No age bracket data available.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={ageGroupData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: '#64748B' }}
                          tickLine={false}
                          axisLine={{ stroke: '#E2E8F0' }}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#64748B' }}
                          tickLine={false}
                          axisLine={false}
                          unit="%"
                          domain={[0, 'auto']}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              return (
                                <div className="bg-[#0F172A] text-white p-2.5 rounded-xl text-xs space-y-1 shadow-md">
                                  <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1">
                                    Age Bracket: {label}
                                  </p>
                                  <p className="text-indigo-300">
                                    Avg Predicted Risk: <span className="font-bold text-white">{item.avgRisk === null ? 'not scored' : `${item.avgRisk}%`}</span>
                                  </p>
                                  <p className="text-teal-300">
                                    Observed Readmission: <span className="font-bold text-white">{item.readmissionRate}%</span>
                                  </p>
                                  <p className="text-slate-400">
                                    Admissions: <span className="font-bold text-white">{item.patients}</span>
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ paddingBottom: 10, fontSize: 12 }}
                        />
                        <Bar
                          dataKey="avgRisk"
                          name="Avg Risk Score (%)"
                          fill="#6366F1"
                          radius={[4, 4, 0, 0]}
                          barSize={22}
                        />
                        <Bar
                          dataKey="readmissionRate"
                          name="Readmission Rate (%)"
                          fill="#0D9488"
                          radius={[4, 4, 0, 0]}
                          barSize={22}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {peakAgeGroup
                    ? `Highest observed rate: ages ${peakAgeGroup.label} (${peakAgeGroup.readmissionRate}%)`
                    : 'No age-band data'}
                </span>
                <span className="font-medium text-slate-700">Age recorded in 10-year bands</span>
              </div>
            </div>
          </div>

          {/* Row 3: Top Risk Factors Ranking */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#0D9488]" />
                  Top Readmission Risk Factors
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ranked by observed relative risk of 30-day readmission (with vs. without the factor) in {selectedDept}
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                Observed in loaded data (not model weights)
              </span>
            </div>

            <div className="space-y-4 pt-1">
              {topRiskFactors.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No risk factor weighting data returned.
                </div>
              ) : (
                topRiskFactors.map((factor, index) => (
                  <div
                    key={factor.key || factor.name}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {factor.name}
                        </span>
                        {factor.multiplier && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                            {factor.multiplier}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs font-medium text-slate-600 sm:text-right shrink-0">
                        {factor.affectedCount !== undefined && (
                          <span>
                            Cohort Prevalence:{' '}
                            <strong className="text-slate-900">{factor.affectedCount}</strong>
                            {factor.totalCohort ? ` / ${factor.totalCohort}` : ''} ({factor.prevalencePct || 0}%)
                          </span>
                        )}
                        <span className="text-[#0D9488] font-bold">
                          {factor.relativeImpact === null || factor.relativeImpact === undefined
                            ? 'n/a'
                            : `${factor.relativeImpact} relative strength`}
                        </span>
                      </div>
                    </div>

                    {/* Progress Impact Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${factor.relativeImpact ?? 0}%`,
                          backgroundColor:
                            index === 0
                              ? '#EF4444'
                              : index === 1
                              ? '#F97316'
                              : index === 2
                              ? '#F59E0B'
                              : '#0D9488'
                        }}
                      />
                    </div>

                    {factor.clinicalNote && (
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {factor.clinicalNote}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
