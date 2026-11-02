import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  Activity,
  CalendarCheck,
  ArrowRight,
  ArrowUpRight,
  Clock,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ChevronRight,
  UploadCloud
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
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SkeletonCard, SkeletonChart, SkeletonTable } from '../components/Skeleton';
import dashboardService from '../api/dashboardService';
import analyticsService from '../api/analyticsService';
import { formatAgeGroup, formatPercent, formatRisk } from '../utils/format';

const RISK_COLORS = {
  Low: '#22C55E',
  Medium: '#F59E0B',
  High: '#EF4444'
};

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [lastUpdated, setLastUpdated] = useState('Just now');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dashboard Data State from real Spring Boot REST API
  const [summaryData, setSummaryData] = useState({
    totalPatients: 0,
    totalAdmissions: 0,
    scoredPatients: 0,
    unscoredPatients: 0,
    lowRiskCount: 0,
    mediumRiskCount: 0,
    highRiskCount: 0,
    avgPredictedRisk: null,
    overallObservedRate: null,
    pendingFollowUpsCount: 0,
    overdueFollowUpsCount: 0,
    recommendedInterventions: [],
    top5HighRiskPatients: []
  });

  const [trendData, setTrendData] = useState([]);
  const [ageGroupData, setAgeGroupData] = useState([]);

  // Fetch all dashboard data from API
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Parallel API queries to dashboard and analytics services.
      // The summary is required; the two charts fail independently (shown as "no data" + console warning).
      const [summaryRes, losRes, ageGroupsRes] = await Promise.all([
        dashboardService.getSummary(),
        analyticsService.getLengthOfStay().catch((e) => {
          console.warn('Length-of-stay analytics failed:', e);
          return [];
        }),
        analyticsService.getAgeGroups().catch((e) => {
          console.warn('Age-group analytics failed:', e);
          return [];
        })
      ]);

      if (summaryRes) {
        setSummaryData({
          totalPatients: summaryRes.totalPatients ?? 0,
          totalAdmissions: summaryRes.totalAdmissions ?? 0,
          scoredPatients: summaryRes.scoredPatients ?? 0,
          unscoredPatients: summaryRes.unscoredPatients ?? 0,
          lowRiskCount: summaryRes.lowRiskCount ?? 0,
          mediumRiskCount: summaryRes.mediumRiskCount ?? 0,
          highRiskCount: summaryRes.highRiskCount ?? 0,
          avgPredictedRisk: summaryRes.avgPredictedRisk ?? null,
          overallObservedRate: summaryRes.overallObservedRate ?? null,
          pendingFollowUpsCount: summaryRes.pendingFollowUpsCount ?? 0,
          overdueFollowUpsCount: summaryRes.overdueFollowUpsCount ?? 0,
          recommendedInterventions: summaryRes.recommendedInterventions || [],
          top5HighRiskPatients: summaryRes.top5HighRiskPatients || []
        });
      }

      setTrendData(Array.isArray(losRes) ? losRes : []);
      setAgeGroupData(Array.isArray(ageGroupsRes) ? ageGroupsRes : []);

      const now = new Date();
      setLastUpdated(`Today at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      if (isRefresh) {
        toast.success('Clinical data refreshed', 'Active cohort metrics updated from server.');
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message || 'Failed to load clinical dashboard data from server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Donut: patients with a stored ML prediction, by the tier of their latest prediction
  const riskDonutData = [
    { name: 'Low Risk', value: summaryData.lowRiskCount, color: RISK_COLORS.Low, level: 'Low' },
    { name: 'Medium Risk', value: summaryData.mediumRiskCount, color: RISK_COLORS.Medium, level: 'Medium' },
    { name: 'High Risk', value: summaryData.highRiskCount, color: RISK_COLORS.High, level: 'High' }
  ];

  const totalPatients = summaryData.totalPatients;
  const scoredPatients = summaryData.scoredPatients;

  // Age band with the highest observed readmission rate (for the chart footnote)
  const peakAgeGroup = ageGroupData.reduce(
    (best, g) => (g.readmissionRate !== null && (!best || g.readmissionRate > best.readmissionRate) ? g : best),
    null
  );

  return (
    <div className="space-y-6">
      {/* 1. Header with Title, Controls, Date Range, and Timestamp */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            MediSight Clinical Dashboard
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>
              Welcome back, <strong className="text-slate-700">{currentUser?.name || 'Clinician'}</strong> ({currentUser?.role})
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 tabular-nums text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Last updated: {lastUpdated}
            </span>
            <button
              onClick={() => loadDashboardData(true)}
              disabled={isRefreshing || isLoading}
              title="Refresh timestamp and data"
              className="p-1 rounded-md text-slate-400 hover:text-[#0D9488] hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#0D9488]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Date Range Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/data-upload')}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Upload clinical EHR dataset or CSV batch"
          >
            <UploadCloud className="w-4 h-4 text-[#0D9488]" />
            <span>Upload Data</span>
          </button>

          <button
            onClick={() => navigate('/risk-prediction')}
            className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold transition-colors inline-flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Activity className="w-4 h-4" />
            Run MediSight Predictor
          </button>
        </div>
      </div>

      {/* Inline Server Error Banner with Retry */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-[#EF4444]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-[#EF4444]" />
            <div>
              <p className="font-bold">Failed to connect to backend server</p>
              <p className="text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => loadDashboardData()}
            className="px-3 py-1.5 rounded-xl bg-white border border-red-300 hover:bg-red-100 text-xs font-semibold text-red-800 transition-colors cursor-pointer shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* 2. Recommended Actions Box */}
      {summaryData.recommendedInterventions?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0D9488] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Recommended Clinical Interventions
                </h2>
                <p className="text-xs text-slate-500">
                  Actionable post-discharge recommendations generated from current cohort risk scoring
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/follow-ups')}
              className="text-xs font-semibold text-[#0D9488] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              View Follow-up Queue
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {summaryData.recommendedInterventions.map((rec, idx) => (
              <div
                key={rec.id || idx}
                onClick={() => navigate(rec.targetPath || '/follow-ups')}
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-teal-50/40 border border-slate-200/70 hover:border-teal-200 transition-all cursor-pointer flex items-start gap-3"
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    rec.level === 'High'
                      ? 'bg-red-100 text-[#EF4444]'
                      : rec.level === 'Medium'
                      ? 'bg-amber-100 text-[#F59E0B]'
                      : 'bg-teal-100 text-[#0D9488]'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">{rec.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {rec.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. The 4 Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Active Monitored Cohort -> Opens Patients */}
          <div
            onClick={() => navigate('/patients', { state: { riskFilter: 'All' } })}
            className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 hover:border-teal-300 hover:shadow-md transition-all cursor-pointer group"
            title="Click to view all patients"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 group-hover:text-[#0D9488] transition-colors">
                Active Monitored Cohort
              </span>
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0D9488] flex items-center justify-center group-hover:bg-[#0D9488] group-hover:text-white transition-colors">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
              {totalPatients}
            </p>
            <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
              Low: <span className="font-semibold text-[#22C55E]">{summaryData.lowRiskCount}</span> · Med:{' '}
              <span className="font-semibold text-[#F59E0B]">{summaryData.mediumRiskCount}</span> · High:{' '}
              <span className="font-semibold text-[#EF4444]">{summaryData.highRiskCount}</span> · Not scored:{' '}
              <span className="font-semibold text-slate-600">{summaryData.unscoredPatients}</span>
            </p>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center text-[11px] text-[#0D9488] font-semibold gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>View All Patients</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 2: High-Risk Readmission Alerts -> Opens Patients filtered by High Risk */}
          <div
            onClick={() => navigate('/patients', { state: { riskFilter: 'High' } })}
            className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 hover:border-red-300 hover:shadow-md transition-all cursor-pointer group"
            title="Click to view high-risk cohort"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 group-hover:text-[#EF4444] transition-colors">
                High-Risk Alerts
              </span>
              <div className="w-9 h-9 rounded-xl bg-red-50 text-[#EF4444] flex items-center justify-center group-hover:bg-[#EF4444] group-hover:text-white transition-colors">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-[#EF4444] tabular-nums">
              {summaryData.highRiskCount}
            </p>
            <p className="text-xs text-slate-500 mt-1.5">
              Latest ML prediction tier is High
            </p>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center text-[11px] text-[#EF4444] font-semibold gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Filter High-Risk Patients</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 3: Average Predicted Risk */}
          <div
            onClick={() => navigate('/risk-prediction')}
            className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group"
            title="Click to explore risk prediction engine"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 group-hover:text-[#F59E0B] transition-colors">
                Average Predicted Risk
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#F59E0B] flex items-center justify-center group-hover:bg-[#F59E0B] group-hover:text-white transition-colors">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
              {formatPercent(summaryData.avgPredictedRisk)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
              {summaryData.avgPredictedRisk === null ? 'No stored predictions yet. ' : `Across ${scoredPatients} scored patients. `}
              Observed 30-day readmission rate:{' '}
              <span className="font-semibold text-slate-700">{formatPercent(summaryData.overallObservedRate)}</span>
            </p>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center text-[11px] text-[#F59E0B] font-semibold gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Open Predictor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 4: Pending Follow-ups */}
          <div
            onClick={() => navigate('/follow-ups')}
            className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 hover:border-teal-300 hover:shadow-md transition-all cursor-pointer group"
            title="Click to view post-discharge follow-ups"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 group-hover:text-[#0D9488] transition-colors">
                Pending Follow-ups
              </span>
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0D9488] flex items-center justify-center group-hover:bg-[#0D9488] group-hover:text-white transition-colors">
                <CalendarCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
              {summaryData.pendingFollowUpsCount}
            </p>
            <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
              <span className="font-semibold text-[#EF4444]">{summaryData.overdueFollowUpsCount}</span> overdue post-discharge call{summaryData.overdueFollowUpsCount === 1 ? '' : 's'}
            </p>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center text-[11px] text-[#0D9488] font-semibold gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Manage Follow-ups</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      )}

      {/* 4. Readmission by Length of Stay (the dataset has no admission dates, so no monthly trend) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Readmission Rate by Length of Stay: Observed vs. Predicted (%)
            </h2>
            <p className="text-xs text-slate-500">
              Observed 30-day readmission rate per length of stay; predicted line = average stored ML risk (shown where admissions are scored)
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {summaryData.totalAdmissions.toLocaleString()} admissions
          </span>
        </div>

        {isLoading ? (
          <SkeletonChart height="h-72" />
        ) : trendData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-xs text-slate-400">
            No length-of-stay data returned from the backend.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="trendTealGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  unit="%"
                  domain={[0, 'auto']}
                />
                <Tooltip
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullLabel || label}
                  formatter={(value, name, item) => [
                    value === null || value === undefined
                      ? 'not scored'
                      : `${value}% (${item.payload?.totalDischarges ?? 0} discharges)`,
                    name
                  ]}
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="observedRate"
                  name="Observed Rate (%)"
                  stroke="#0D9488"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#trendTealGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="predictedRate"
                  name="Avg Predicted Risk (%)"
                  stroke="#0F172A"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="none"
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 5. Middle Grid: Risk Distribution Donut Chart + Age Group Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution Donut Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-col justify-between">
          <div className="mb-2">
            <h2 className="text-base font-bold text-slate-900">
              Risk Distribution Donut Chart
            </h2>
            <p className="text-xs text-slate-500">
              Scored patients by the tier of their latest ML prediction ({summaryData.unscoredPatients} not scored yet)
            </p>
          </div>

          {isLoading ? (
            <SkeletonChart height="h-64" />
          ) : scoredPatients === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400 text-center px-6">
              No stored predictions yet. Score admissions in the Risk Predictor to see the distribution.
            </div>
          ) : (
            <div className="h-64 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {riskDonutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      `${value} patients (${scoredPatients > 0 ? ((value / scoredPatients) * 100).toFixed(1) : 0}%)`,
                      name
                    ]}
                    contentStyle={{
                      borderRadius: '12px',
                      borderColor: '#E2E8F0',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Metric */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                  {scoredPatients}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Scored
                </span>
              </div>
            </div>
          )}

          {/* Donut Legend Strip */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
            <div className="p-2 rounded-xl bg-green-50/50 border border-green-100">
              <span className="text-[11px] font-semibold text-slate-500 block">Low Risk</span>
              <span className="text-sm font-bold text-[#22C55E] tabular-nums">
                {summaryData.lowRiskCount} ({scoredPatients > 0 ? ((summaryData.lowRiskCount / scoredPatients) * 100).toFixed(0) : 0}%)
              </span>
            </div>
            <div className="p-2 rounded-xl bg-amber-50/50 border border-amber-100">
              <span className="text-[11px] font-semibold text-slate-500 block">Medium Risk</span>
              <span className="text-sm font-bold text-[#F59E0B] tabular-nums">
                {summaryData.mediumRiskCount} ({scoredPatients > 0 ? ((summaryData.mediumRiskCount / scoredPatients) * 100).toFixed(0) : 0}%)
              </span>
            </div>
            <div className="p-2 rounded-xl bg-red-50/50 border border-red-100">
              <span className="text-[11px] font-semibold text-slate-500 block">High Risk</span>
              <span className="text-sm font-bold text-[#EF4444] tabular-nums">
                {summaryData.highRiskCount} ({scoredPatients > 0 ? ((summaryData.highRiskCount / scoredPatients) * 100).toFixed(0) : 0}%)
              </span>
            </div>
          </div>
        </div>

        {/* Readmission Rate by Age Group Bar Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-col justify-between">
          <div className="mb-2">
            <h2 className="text-base font-bold text-slate-900">
              Readmission Rate by Age Group (%)
            </h2>
            <p className="text-xs text-slate-500">
              Observed 30-day readmission rate and average stored ML risk per 10-year age band
            </p>
          </div>

          {isLoading ? (
            <SkeletonChart height="h-64" />
          ) : ageGroupData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              No age group breakdown returned from API.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageGroupData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} unit="%" domain={[0, 'auto']} />
                  <Tooltip
                    formatter={(value, name, item) => [
                      value === null || value === undefined
                        ? 'not scored'
                        : `${value}% (${item.payload?.patients ?? 0} admissions)`,
                      name
                    ]}
                    contentStyle={{
                      borderRadius: '12px',
                      borderColor: '#E2E8F0',
                      fontSize: '12px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="avgRisk"
                    name="Avg Predicted Risk (%)"
                    fill="#0D9488"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="readmissionRate"
                    name="Observed Readmission (%)"
                    fill="#0F172A"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              {peakAgeGroup
                ? `Highest observed rate: ages ${peakAgeGroup.label} (${peakAgeGroup.readmissionRate}%).`
                : 'No age-band data.'}
            </span>
          </div>
        </div>
      </div>

      {/* 6. Top 5 High-Risk Patients Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Top 5 High-Risk Patients
            </h2>
            <p className="text-xs text-slate-500">
              Patients with the highest 30-day readmission risk probability in the active cohort
            </p>
          </div>
          <button
            onClick={() => navigate('/patients', { state: { riskFilter: 'High' } })}
            className="text-xs font-semibold text-[#0D9488] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>View All High-Risk Patients</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-6">
            <SkeletonTable rows={5} cols={6} />
          </div>
        ) : summaryData.top5HighRiskPatients?.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No high-risk patients currently flagged in cohort.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-6">Patient Name & ID</th>
                  <th className="py-3 px-4 text-right">Age Band</th>
                  <th className="py-3 px-4">Primary Diagnosis</th>
                  <th className="py-3 px-4 text-right">Risk %</th>
                  <th className="py-3 px-4">Risk Badge</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {summaryData.top5HighRiskPatients.map((patient) => {
                  return (
                    <tr
                      key={patient.id}
                      onClick={() =>
                        navigate('/patients', {
                          state: { selectedPatientId: patient.id }
                        })
                      }
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-6">
                        <p className="font-semibold text-slate-900 group-hover:text-[#0D9488] transition-colors">
                          {patient.name}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums font-mono">
                          #{patient.id} · {patient.gender || '—'} · {patient.department || 'No department'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                        {formatAgeGroup(patient.ageGroup)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-sm truncate" title={patient.primaryDiagnosis}>
                        {patient.primaryDiagnosis}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-sm font-bold text-[#EF4444] tabular-nums">
                        {formatRisk(patient.riskScore)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold bg-red-50 text-[#EF4444] border border-red-200">
                          High Risk
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/patients', {
                              state: { selectedPatientId: patient.id }
                            });
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-[#0D9488] text-[#0D9488] hover:text-white text-xs font-semibold transition-colors cursor-pointer border border-teal-200 hover:border-transparent inline-flex items-center gap-1 shadow-xs"
                        >
                          <span>View</span>
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
      </div>
    </div>
  );
}
