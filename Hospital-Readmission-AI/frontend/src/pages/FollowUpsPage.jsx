import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  X,
  Check,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';
import { SkeletonTable } from '../components/Skeleton';
import followUpService from '../api/followUpService';
import patientService from '../api/patientService';
import userService from '../api/userService';
import { PRIORITIES, OUTREACH_CHANNELS } from '../constants/enums';
import { riskStyle } from '../utils/format';

function defaultDueDate() {
  return new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
}

// Status category used by the UI: 'Pending' | 'Done' | 'Overdue'
// API statuses: Scheduled | Completed | Missed | Cancelled (same grouping as the backend filter)
function normalizeStatus(item) {
  if (item.status === 'Completed' || item.status === 'Cancelled') {
    return 'Done';
  }
  if (item.status === 'Missed') {
    return 'Overdue';
  }
  const today = new Date().toISOString().split('T')[0];
  if (item.dueDate && item.dueDate < today) {
    return 'Overdue';
  }
  return 'Pending';
}

export default function FollowUpsPage() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const location = useLocation();

  const initialStatusFilter = location.state?.statusFilter || 'All';
  const highlightPatientName = location.state?.highlightPatientName || '';

  // Filter & Search State
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter); // 'All' | 'Pending' | 'Overdue' | 'Done'
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState(highlightPatientName);

  // Live follow-ups data from Spring Boot REST API
  const [followUps, setFollowUps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  // Patient cohort registry for Add Reminder modal picker
  const [patients, setPatients] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalErrors, setModalErrors] = useState({});

  // Clinical staff for the "Assigned Clinician" picker (GET /users)
  const [staff, setStaff] = useState([]);

  const emptyForm = useCallback(
    () => ({
      patientId: '',
      patientLabel: '',
      assignedToUserId: currentUser?.id ? String(currentUser.id) : '',
      channel: OUTREACH_CHANNELS[0],
      dueDate: defaultDueDate(),
      priority: 'Urgent',
      notes: ''
    }),
    [currentUser]
  );
  const [modalForm, setModalForm] = useState(emptyForm);

  // Fetch follow-ups from Spring Boot API: GET /follow-ups?status=&priority=
  const loadFollowUps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await followUpService.getFollowUps({
        status: statusFilter,
        priority: priorityFilter
      });
      if (Array.isArray(data)) {
        setFollowUps(data);
      } else {
        setFollowUps([]);
      }
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
      setError(err.message || 'Failed to load follow-ups from server.');
      setFollowUps([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    loadFollowUps();
  }, [loadFollowUps]);

  // Load patients for autofill modal picker from GET /patients
  useEffect(() => {
    async function loadPatientsForPicker() {
      try {
        const data = await patientService.getPatients({ size: 50 });
        if (data && data.content) {
          setPatients(data.content);
        }
      } catch (err) {
        console.warn('Could not load patient picker in FollowUpsPage:', err);
      }
    }
    loadPatientsForPicker();
  }, []);

  useEffect(() => {
    userService
      .getUsers()
      .then((data) => {
        if (Array.isArray(data)) {
          setStaff(data.filter((u) => u.active !== false && u.role !== 'Analyst'));
        }
      })
      .catch((err) => console.warn('Could not load staff list:', err));
  }, []);

  // Summary counts
  const pendingCount = useMemo(
    () => followUps.filter((f) => normalizeStatus(f) === 'Pending').length,
    [followUps]
  );
  const overdueCount = useMemo(
    () => followUps.filter((f) => normalizeStatus(f) === 'Overdue').length,
    [followUps]
  );
  const doneCount = useMemo(
    () => followUps.filter((f) => normalizeStatus(f) === 'Done').length,
    [followUps]
  );

  // Client-side text search on fetched list
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return followUps;
    const q = searchQuery.toLowerCase();
    return followUps.filter(
      (item) =>
        item.patientName?.toLowerCase().includes(q) ||
        item.patientId?.toLowerCase().includes(q) ||
        item.externalPatientId?.toLowerCase().includes(q) ||
        item.assignedTo?.toLowerCase().includes(q) ||
        item.channel?.toLowerCase().includes(q)
    );
  }, [followUps, searchQuery]);

  // Mark follow-up as done via API: PATCH /follow-ups/{id}/status
  const handleMarkAsDone = async (id) => {
    setUpdatingId(id);
    try {
      await followUpService.updateStatus(id, 'Done');
      // Optimistically update list
      setFollowUps((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'Completed' } : item))
      );
      toast.success('Task Completed', 'Follow-up marked as completed in backend.');
    } catch (err) {
      console.error('Failed to update follow-up status:', err);
      toast.error('Update Failed', err.message || 'Could not update status on server.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Add Reminder Modal Submit: POST /follow-ups
  const handleAddReminderSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^[0-9]+$/.test(modalForm.patientId.trim())) {
      errs.patientId = 'Choose a patient or enter the numeric patient record #.';
    }
    if (!modalForm.dueDate) {
      errs.dueDate = 'Due date is required.';
    }
    if (Object.keys(errs).length > 0) {
      setModalErrors(errs);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        patientId: modalForm.patientId.trim(),
        assignedToUserId: modalForm.assignedToUserId ? Number(modalForm.assignedToUserId) : null,
        channel: modalForm.channel,
        dueDate: modalForm.dueDate,
        priority: modalForm.priority,
        notes: modalForm.notes.trim() || null
      };

      const created = await followUpService.createFollowUp(payload);
      toast.success(
        'Reminder Created',
        `Follow-up scheduled for ${created?.patientName || `patient #${payload.patientId}`} (${payload.dueDate}).`
      );

      setShowAddModal(false);
      setModalForm(emptyForm());
      setModalErrors({});

      // Refresh list from server
      loadFollowUps();
    } catch (err) {
      console.error('Failed to create follow-up:', err);
      toast.error('Failed to Create Reminder', err.message || 'Server error creating reminder.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPatientPreset = (pId) => {
    if (!pId) return;
    const matched = patients.find((p) => p.id === pId);
    if (matched) {
      setModalForm({
        ...modalForm,
        patientId: matched.id,
        patientLabel: `${matched.name} · ${matched.riskLevel ? `${matched.riskLevel} risk (${matched.riskScore}%)` : 'not scored'}`,
        priority: matched.riskLevel === 'High' ? 'Urgent' : matched.riskLevel === 'Medium' ? 'High' : 'Medium'
      });
      if (modalErrors.patientId) {
        setModalErrors({ ...modalErrors, patientId: '' });
      }
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-50 text-[#EF4444] border-red-200';
      case 'High':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Low':
      case 'Routine':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getRiskBadge = (level) => riskStyle(level).badgeClass;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <CalendarCheck className="w-6 h-6 text-[#0D9488]" />
            Post-Discharge Follow-ups
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage transitional care outreach, medication reconciliation, and urgent care escalations
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Reminder</span>
        </button>
      </div>

      {/* Inline Server Error Banner with Retry */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-[#EF4444]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-[#EF4444]" />
            <div>
              <p className="font-bold">Failed to load follow-up records</p>
              <p className="text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => loadFollowUps()}
            className="px-3 py-1.5 rounded-xl bg-white border border-red-300 hover:bg-red-100 text-xs font-semibold text-red-800 transition-colors cursor-pointer shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Summary Chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Pending Chip */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'Pending' ? 'All' : 'Pending')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'Pending'
              ? 'bg-amber-50/70 border-amber-300 shadow-xs ring-1 ring-amber-400'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500">Pending Actions</span>
            <span className="w-7 h-7 rounded-lg bg-amber-100 text-[#F59E0B] flex items-center justify-center font-bold text-xs">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
            {pendingCount}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Awaiting outreach call or visit</span>
        </button>

        {/* Overdue Chip */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'Overdue' ? 'All' : 'Overdue')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'Overdue'
              ? 'bg-red-50/70 border-red-300 shadow-xs ring-1 ring-red-400'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[#EF4444]">Overdue Escalations</span>
            <span className="w-7 h-7 rounded-lg bg-red-100 text-[#EF4444] flex items-center justify-center font-bold text-xs">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-[#EF4444] tabular-nums">
            {overdueCount}
          </p>
          <span className="text-[11px] text-red-500 mt-1 block font-medium">Critical milestone passed</span>
        </button>

        {/* Done Chip */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'Done' ? 'All' : 'Done')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'Done'
              ? 'bg-teal-50/70 border-teal-300 shadow-xs ring-1 ring-teal-400'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500">Completed Follow-ups</span>
            <span className="w-7 h-7 rounded-lg bg-teal-100 text-[#0D9488] flex items-center justify-center font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
            {doneCount}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Successfully reconciled &amp; closed</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient ID, clinician, or channel..."
            className="w-full pl-10 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {['All', 'Pending', 'Overdue', 'Done'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Priority Selector */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            aria-label="Filter follow-ups by priority"
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none focus:border-[#0D9488] cursor-pointer"
          >
            <option value="All">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Follow-ups Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <SkeletonTable rows={6} cols={7} />
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No follow-up items found"
            description={
              searchQuery || statusFilter !== 'All' || priorityFilter !== 'All'
                ? 'No follow-up tasks match the selected search query or filters.'
                : 'Follow-up outreach queue is clear. No pending interventions.'
            }
            actionLabel={
              searchQuery || statusFilter !== 'All' || priorityFilter !== 'All'
                ? 'Clear Filters'
                : 'Schedule Follow-up'
            }
            onAction={() => {
              if (searchQuery || statusFilter !== 'All' || priorityFilter !== 'All') {
                setSearchQuery('');
                setStatusFilter('All');
                setPriorityFilter('All');
              } else {
                setShowAddModal(true);
              }
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-6">Patient Name</th>
                  <th className="py-3 px-4">Risk Badge</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Outreach Channel</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.map((item) => {
                  const normalized = normalizeStatus(item);
                  const isOverdue = normalized === 'Overdue';
                  const isDone = normalized === 'Done';
                  const priorityClass = getPriorityBadge(item.priority);
                  const riskClass = getRiskBadge(item.riskLevel);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isOverdue ? 'bg-red-50/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-6">
                        <p className="font-semibold text-slate-900">{item.patientName}</p>
                        <p className="text-[10px] text-slate-400 font-mono tabular-nums">
                          #{item.patientId} · task {item.id}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${riskClass}`}>
                          {item.riskLevel || 'Not scored'} {item.riskScore !== null && item.riskScore !== undefined ? `(${item.riskScore}%)` : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold tabular-nums">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ${
                            isOverdue
                              ? 'text-[#EF4444] bg-red-50 border border-red-200 font-bold'
                              : isDone
                              ? 'text-slate-400 line-through'
                              : 'text-slate-700'
                          }`}
                        >
                          {isOverdue && <AlertTriangle className="w-3 h-3 text-[#EF4444]" />}
                          {item.dueDate}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${priorityClass}`}>
                          {item.priority || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {item.assignedTo || 'Unassigned'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={item.channel}>
                        {item.channel}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isDone
                              ? 'bg-teal-50 text-[#0D9488] border border-teal-200'
                              : isOverdue
                              ? 'bg-red-50 text-[#EF4444] border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isDone ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-[#0D9488]" />
                              <span>{item.status === 'Cancelled' ? 'Cancelled' : 'Done'}</span>
                            </>
                          ) : isOverdue ? (
                            <>
                              <AlertTriangle className="w-3 h-3 text-[#EF4444]" />
                              <span>{item.status === 'Missed' ? 'Missed' : 'Overdue'}</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pending</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        {!isDone && (
                          <button
                            type="button"
                            disabled={updatingId === item.id}
                            onClick={() => handleMarkAsDone(item.id)}
                            className="px-3 py-1.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 inline-flex items-center gap-1.5"
                          >
                            {updatingId === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            <span>Mark as done</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* "Add Reminder" Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0D9488] flex items-center justify-center">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Follow-up Reminder</h3>
                  <p className="text-xs text-slate-500">
                    Schedule a post-discharge patient care intervention
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddReminderSubmit} className="space-y-4">
              {/* Preset Patient Quick Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Autofill from Patient Cohort (Optional)
                </label>
                <select
                  onChange={(e) => handleSelectPatientPreset(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:border-[#0D9488]"
                >
                  <option value="">-- Choose registered patient (highest risk first) --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (#{p.id} · {p.riskLevel ? `${p.riskLevel} Risk` : 'Not scored'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Patient record */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Patient Record # *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={modalForm.patientId}
                  onChange={(e) => {
                    setModalForm({ ...modalForm, patientId: e.target.value, patientLabel: '' });
                    if (modalErrors.patientId) {
                      setModalErrors({ ...modalErrors, patientId: '' });
                    }
                  }}
                  placeholder="Numeric record # shown in the Patients list, e.g. 1044"
                  className={`w-full px-3 py-2 text-xs rounded-xl border bg-white font-mono focus:outline-none ${
                    modalErrors.patientId
                      ? 'border-[#EF4444]'
                      : 'border-slate-200 focus:border-[#0D9488]'
                  }`}
                />
                {modalForm.patientLabel && (
                  <p className="text-[11px] text-slate-500 mt-1">{modalForm.patientLabel}</p>
                )}
                {modalErrors.patientId && (
                  <p className="text-[11px] text-[#EF4444] mt-1">{modalErrors.patientId}</p>
                )}
              </div>

              {/* Priority & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Priority Level *
                  </label>
                  <select
                    value={modalForm.priority}
                    onChange={(e) => setModalForm({ ...modalForm, priority: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={modalForm.dueDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setModalForm({ ...modalForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                  />
                  {modalErrors.dueDate && (
                    <p className="text-[11px] text-[#EF4444] mt-1">{modalErrors.dueDate}</p>
                  )}
                </div>
              </div>

              {/* Assigned To & Channel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Clinician *
                  </label>
                  <select
                    value={modalForm.assignedToUserId}
                    onChange={(e) => setModalForm({ ...modalForm, assignedToUserId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                  >
                    {staff.length === 0 && currentUser && (
                      <option value={String(currentUser.id)}>{currentUser.name} (you)</option>
                    )}
                    {staff.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.name} · {u.role}{u.id === currentUser?.id ? ' (you)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Outreach Channel *
                  </label>
                  <select
                    value={modalForm.channel}
                    onChange={(e) => setModalForm({ ...modalForm, channel: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                  >
                    {OUTREACH_CHANNELS.map((ch) => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Intervention Protocol Notes
                </label>
                <textarea
                  rows="2"
                  value={modalForm.notes}
                  onChange={(e) => setModalForm({ ...modalForm, notes: e.target.value })}
                  placeholder="e.g. Verify loop diuretic adherence and review home blood pressure readings."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#0D9488]"
                />
              </div>

              {/* Modal Buttons */}
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
                    <span>Create Reminder</span>
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
