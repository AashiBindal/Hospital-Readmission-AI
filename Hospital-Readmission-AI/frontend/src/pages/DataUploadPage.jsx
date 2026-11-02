import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Database,
  Sparkles,
  ShieldCheck,
  Check,
  Layers,
  Clock,
  Info,
  Trash2,
  Filter,
  RefreshCw
} from 'lucide-react';
import uploadService from '../api/uploadService';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/format';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Visual style per Uploads.Status
function statusStyle(status) {
  switch (status) {
    case 'Completed':
      return 'text-[#22C55E] bg-emerald-50 border-emerald-200';
    case 'Failed':
      return 'text-[#EF4444] bg-rose-50 border-rose-200';
    case 'Processing':
      return 'text-sky-700 bg-sky-50 border-sky-200';
    default:
      return 'text-amber-700 bg-amber-50 border-amber-200';
  }
}

export default function DataUploadPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Upload workflow state: 'idle' | 'processing' | 'report'
  const [stage, setStage] = useState('idle');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processStepText, setProcessStepText] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Upload History state
  const [uploadHistory, setUploadHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'Admin':
        return 'bg-teal-50 text-[#0D9488] border-teal-200';
      case 'Doctor':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Nurse':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Fetch upload batch history from Spring Boot backend
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const data = await uploadService.getUploadHistory();
      if (Array.isArray(data)) {
        setUploadHistory(data);
      } else {
        setUploadHistory([]);
      }
    } catch (err) {
      console.error('Failed to load upload history:', err);
      setHistoryError(err.response?.data?.message || err.message || 'Unable to retrieve ingestion history from server.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // File drag & drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileSelected = (file) => {
    const formattedSize =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    setSelectedFile({
      name: file.name,
      size: formattedSize,
      rawFile: file
    });
    setUploadError(null);
  };

  // Fetch the quality report of an upload (also used to open reports from the history table)
  const openReport = async (uploadId, fileName) => {
    try {
      const report = await uploadService.getQualityReport(uploadId);
      setActiveReport(report);
      if (fileName) setSelectedFile((prev) => prev || { name: fileName, size: '', rawFile: null });
      setStage('report');
    } catch (err) {
      toast.error('Report unavailable', err.message || 'Could not load the quality report.');
    }
  };

  // Upload the file (POST /uploads), then follow the ETL through GET /uploads/{id}/quality-report
  const startProcessing = async () => {
    if (!selectedFile || !selectedFile.rawFile) {
      toast.warning('No File Selected', 'Please select a CSV file in the diabetic_data.csv format.');
      return;
    }

    setStage('processing');
    setProgress(0);
    setUploadError(null);
    setProcessStepText('Uploading file to the server...');

    try {
      const uploadRes = await uploadService.uploadFile(selectedFile.rawFile, (pct) => setProgress(pct));
      setProgress(100);
      const uploadId = uploadRes.uploadId;

      if (!uploadRes.etlStarted) {
        // Stored but not loaded: show the backend's instructions instead of pretending it was processed
        const report = await uploadService.getQualityReport(uploadId);
        setActiveReport({ ...report, message: uploadRes.message });
        setStage('report');
        toast.warning('Upload stored, not loaded', uploadRes.message);
        loadHistory();
        return;
      }

      // The Python ETL cleans, validates and loads the file; poll its status
      const started = Date.now();
      let report = null;
      while (Date.now() - started < POLL_TIMEOUT_MS) {
        const seconds = Math.round((Date.now() - started) / 1000);
        setProcessStepText(`ETL running (cleaning, validating, loading) - ${seconds}s elapsed`);
        report = await uploadService.getQualityReport(uploadId);
        if (report.status === 'Completed' || report.status === 'Failed') break;
        await sleep(POLL_INTERVAL_MS);
      }

      setActiveReport(report);
      setStage('report');
      if (report?.status === 'Completed') {
        toast.success('Dataset Loaded', `${report.cleanRecords ?? 0} admissions loaded from ${selectedFile.name}.`);
      } else if (report?.status === 'Failed') {
        toast.error('ETL Failed', report.errorMessage || 'The dataset was not loaded.');
      } else {
        toast.warning('Still Processing', 'The ETL is still running. Refresh the history table later.');
      }
      loadHistory();
    } catch (err) {
      console.error('Data upload error:', err);
      const errMsg = err.message || 'Upload failed. The backend service may be unavailable.';
      setUploadError(errMsg);
      setStage('idle');
      toast.error('Upload Failed', errMsg);
    }
  };

  // Reset to upload another file
  const handleUploadAnother = () => {
    setStage('idle');
    setSelectedFile(null);
    setProgress(0);
    setProcessStepText('');
    setActiveReport(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const reportStatus = activeReport?.status || 'Pending';
  const reportPassed = reportStatus === 'Completed';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <UploadCloud className="w-6 h-6 text-[#0D9488]" />
            MediSight Clinical Data Ingestion
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload diabetic_data.csv-format files; the project ETL validates and loads them (no values are imputed)
          </p>
        </div>

        {stage === 'report' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUploadAnother}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Upload Another File</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/risk-prediction')}
              className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>Proceed to Predictions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Global Error Banner */}
      {uploadError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-rose-800">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold">Ingestion Pipeline Error</p>
              <p className="text-xs text-rose-700 mt-0.5">{uploadError}</p>
            </div>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* STAGE 1: Drag-and-drop & File Preview */}
      {stage === 'idle' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-6">
          {/* Drag & Drop Box */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-[#0D9488] bg-teal-50/60 scale-[1.01]'
                : selectedFile
                ? 'border-teal-300 bg-teal-50/20'
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#0D9488] flex items-center justify-center mx-auto mb-3.5 shadow-2xs">
              <FileSpreadsheet className="w-7 h-7" />
            </div>

            <h2 className="text-base font-bold text-slate-900 mb-1">
              Drag & drop your CSV file here
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
              Accepts <strong>.csv</strong> in the diabetic_data.csv format (encounter_id, patient_nbr, ..., readmitted). Files up to 50MB.
            </p>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            >
              Browse Local Files
            </button>
          </div>

          {/* Selected File Preview Box */}
          {selectedFile && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#0D9488] shadow-2xs shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-900">{selectedFile.name}</p>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#22C55E] border border-emerald-200 text-[10px] font-bold">
                      Ready to Ingest
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    File Size: {selectedFile.size} · Format: CSV Delimited
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white transition-colors cursor-pointer"
                  title="Remove file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={startProcessing}
                  className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Upload & Run Data Quality Checks</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STAGE 2: Processing Progress Bar */}
      {stage === 'processing' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-[#0D9488] flex items-center justify-center mx-auto shadow-sm animate-pulse">
            <Sparkles className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-lg font-bold text-slate-900">
              Uploading & Loading Clinical Data
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              {selectedFile?.name || 'Dataset'} ({selectedFile?.size})
            </p>
          </div>

          {/* Progress Bar Container */}
          <div className="max-w-lg mx-auto space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0D9488] animate-ping" />
                {processStepText}
              </span>
              <span className="font-mono text-[#0D9488] text-sm tabular-nums">upload {progress}%</span>
            </div>

            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0D9488] to-teal-400 transition-all duration-200 ease-out shadow-xs"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 text-[11px] text-slate-400 pt-2">
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-slate-300" /> Clean (etl/cleaning.py)
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-slate-300" /> Validate (etl/validation.py)
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-slate-300" /> Load (one SQL transaction)
            </span>
          </div>
        </div>
      )}

      {/* STAGE 3: Data Quality Report */}
      {stage === 'report' && activeReport && (
        <div className="space-y-6">
          {/* Top Banner: real ETL status */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              reportPassed
                ? 'bg-gradient-to-r from-teal-50 to-emerald-50/40 border-teal-200/80'
                : reportStatus === 'Failed'
                ? 'bg-rose-50 border-rose-200'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-11 h-11 rounded-2xl text-white flex items-center justify-center shadow-xs shrink-0 ${
                  reportPassed ? 'bg-[#0D9488]' : reportStatus === 'Failed' ? 'bg-[#EF4444]' : 'bg-[#F59E0B]'
                }`}
              >
                {reportPassed ? <ShieldCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    {reportPassed
                      ? 'Validated & Loaded'
                      : reportStatus === 'Failed'
                      ? 'Load Failed'
                      : reportStatus === 'Processing'
                      ? 'ETL Still Running'
                      : 'Stored - Waiting for ETL'}
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusStyle(reportStatus)}`}>
                    Upload #{activeReport.uploadId} · {reportStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 break-all">
                  File: <strong className="font-semibold text-slate-800">{activeReport.fileName}</strong>
                  {(activeReport.message || activeReport.errorMessage) && (
                    <> · {activeReport.message || activeReport.errorMessage}</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleUploadAnother}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload Another File</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/risk-prediction')}
                className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <span>Proceed to Predictions</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 5 Quality Metric Cards (counts from dbo.Uploads and dbo.DataQualityLogs) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Total Records
                </span>
                <Database className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {activeReport.totalRecords === null || activeReport.totalRecords === undefined ? '—' : Number(activeReport.totalRecords).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Rows read from the file</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Errors
                </span>
                <AlertCircle className="w-4 h-4 text-[#EF4444]" />
              </div>
              <p className="text-2xl font-bold text-[#EF4444] font-mono tabular-nums">
                {activeReport.errorCount === null || activeReport.errorCount === undefined ? '—' : Number(activeReport.errorCount).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">{`${activeReport.errorRows ?? 0} affected rows · block loading`}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Warnings
                </span>
                <Filter className="w-4 h-4 text-[#F59E0B]" />
              </div>
              <p className="text-2xl font-bold text-[#F59E0B] font-mono tabular-nums">
                {activeReport.warningCount === null || activeReport.warningCount === undefined ? '—' : Number(activeReport.warningCount).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">{`${activeReport.warningRows ?? 0} affected rows · kept, flagged`}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Notes
                </span>
                <Info className="w-4 h-4 text-sky-500" />
              </div>
              <p className="text-2xl font-bold text-sky-600 font-mono tabular-nums">
                {activeReport.infoCount === null || activeReport.infoCount === undefined ? '—' : Number(activeReport.infoCount).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">{'Informational checks'}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Records Loaded
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              </div>
              <p className="text-2xl font-bold text-[#22C55E] font-mono tabular-nums">
                {activeReport.cleanRecords === null || activeReport.cleanRecords === undefined ? '—' : Number(activeReport.cleanRecords).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">{activeReport.rejectedRecords ? `${activeReport.rejectedRecords} rejected` : 'New admissions stored'}</p>
            </div>
          </div>

          {/* Validation issues written by the ETL (dbo.DataQualityLogs) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#0D9488]" />
                  Data Quality Log
                </h3>
                <p className="text-xs text-slate-500">
                  Every check recorded by the ETL for this upload. Values are reported, never silently fixed.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
                {(activeReport.issues || []).length} entries
              </span>
            </div>

            {(activeReport.issues || []).length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {reportStatus === 'Completed'
                  ? 'The ETL recorded no data quality entries for this upload.'
                  : 'No entries yet. They appear once the ETL has processed the file.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                      <th className="py-3 px-6">Column</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">Rule</th>
                      <th className="py-3 px-4 text-right">Affected Rows</th>
                      <th className="py-3 px-6">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {activeReport.issues.map((issue, idx) => (
                      <tr key={`${issue.rule}-${issue.column}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-6 font-semibold text-slate-900 font-mono">{issue.column || '—'}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              issue.severity === 'ERROR'
                                ? 'bg-rose-50 text-[#EF4444] border-rose-200'
                                : issue.severity === 'WARNING'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-sky-50 text-sky-700 border-sky-200'
                            }`}
                          >
                            {issue.severity}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-mono">{issue.rule}</td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">{Number(issue.affectedRows).toLocaleString()}</td>
                        <td className="py-3.5 px-6 text-slate-600 max-w-md">{issue.details || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historical Batch Ingestions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Recent Batch Ingestions History
            </h3>
            <p className="text-xs text-slate-500">
              Uploads recorded in dbo.Uploads. Click a row to open its data quality report.
            </p>
          </div>
          <button
            type="button"
            onClick={loadHistory}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin text-[#0D9488]' : ''}`} />
          </button>
        </div>

        {historyError ? (
          <div className="p-6 text-center">
            <p className="text-xs text-rose-600 font-medium mb-3">{historyError}</p>
            <button
              onClick={loadHistory}
              className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 shadow-2xs"
            >
              Retry
            </button>
          </div>
        ) : isLoadingHistory ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : uploadHistory.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            <Database className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600">No batch ingestions recorded</p>
            <p className="mt-0.5">Upload a CSV file above to load it into the database.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-6">Batch ID &amp; Filename</th>
                  <th className="py-3 px-4">Uploaded By</th>
                  <th className="py-3 px-4 text-right">Records / Loaded</th>
                  <th className="py-3 px-4 text-right">Scored High Risk</th>
                  <th className="py-3 px-6 text-right">Pipeline Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {uploadHistory.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => openReport(u.id, u.fileName)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    title="Open data quality report"
                  >
                    <td className="py-3.5 px-6">
                      <p className="font-semibold text-slate-900">{u.fileName}</p>
                      <p className="text-[10px] text-slate-400 tabular-nums">
                        #{u.id} · {formatDateTime(u.date)}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                        <span className="font-medium text-slate-900">{u.uploadedBy || 'ETL (command line)'}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border w-fit ${getRoleBadgeStyle(
                            u.role
                          )}`}
                        >
                          {u.role || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-800">
                      {u.recordsCount === null || u.recordsCount === undefined ? '—' : u.recordsCount.toLocaleString()}
                      {' / '}
                      {u.loadedCount === null || u.loadedCount === undefined ? '—' : u.loadedCount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-[#EF4444]">
                      {u.highRiskFound ?? 0}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusStyle(u.status)}`}
                        title={u.errorMessage || ''}
                      >
                        {u.status === 'Completed' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
