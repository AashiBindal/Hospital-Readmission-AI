import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UploadCloud,
  Search,
  Trash2,
  Eye,
  EyeOff,
  ArrowRight,
  Inbox,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/EmptyState';

export default function NotificationsPage() {
  const {
    notifications,
    markNotificationRead,
    toggleNotificationRead,
    deleteNotification,
    markAllNotificationsRead,
    fetchNotifications
  } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'high_risk' | 'overdue' | 'upload'
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const ok = await fetchNotifications?.();
      if (ok === false) {
        toast.error('Failed to refresh notifications');
      } else {
        toast.info('Notifications Refreshed');
      }
    } catch (e) {
      toast.error('Failed to refresh notifications');
    } finally {
      setIsRefreshing(false);
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // Category / Tab filter
      if (activeFilter === 'unread' && !item.unread) return false;
      if (activeFilter === 'high_risk') {
        const isHigh =
          item.category === 'high_risk' ||
          item.title.toLowerCase().includes('high-risk') ||
          item.title.toLowerCase().includes('high risk');
        if (!isHigh) return false;
      }
      if (activeFilter === 'overdue') {
        const isOverdue =
          item.category === 'overdue' ||
          item.title.toLowerCase().includes('overdue') ||
          item.description.toLowerCase().includes('overdue');
        if (!isOverdue) return false;
      }
      if (activeFilter === 'upload') {
        const isUpload =
          item.category === 'upload' ||
          item.title.toLowerCase().includes('upload') ||
          item.description.toLowerCase().includes('upload');
        if (!isUpload) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [notifications, activeFilter, searchQuery]);

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    toast.success('All Notifications Read', 'All pending alerts marked as read.');
  };

  const handleToggleRead = (id) => {
    const item = notifications.find((n) => n.id === id);
    toggleNotificationRead(id);
    if (item?.unread) {
      toast.info('Alert marked as read');
    } else {
      toast.info('Alert marked as unread');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id);
      toast.info('Alert deleted');
    } catch (err) {
      toast.error('Delete failed', err.message || 'The alert could not be deleted on the server.');
    }
  };

  const handleNotificationClick = (item) => {
    markNotificationRead(item.id);
    const target =
      item.targetPath ||
      (item.title.toLowerCase().includes('follow-up')
        ? '/follow-ups'
        : item.title.toLowerCase().includes('upload')
        ? '/data-upload'
        : '/patients');
    navigate(target, { state: item.targetState });
  };

  const getAlertIcon = (item) => {
    const titleLower = item.title.toLowerCase();
    const cat = item.category;

    if (cat === 'upload' || titleLower.includes('upload')) {
      return (
        <span className="p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
          <UploadCloud className="w-5 h-5" />
        </span>
      );
    }

    if (cat === 'overdue' || titleLower.includes('overdue')) {
      return (
        <span className="p-2.5 rounded-xl bg-red-50 text-[#EF4444] border border-red-100 shrink-0">
          <Clock className="w-5 h-5" />
        </span>
      );
    }

    if (cat === 'high_risk' || titleLower.includes('high')) {
      return (
        <span className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </span>
      );
    }

    return (
      <span className="p-2.5 rounded-xl bg-teal-50 text-[#0D9488] border border-teal-100 shrink-0">
        <Bell className="w-5 h-5" />
      </span>
    );
  };

  const getBadgeCategory = (item) => {
    const titleLower = item.title.toLowerCase();
    const cat = item.category;

    if (cat === 'upload' || titleLower.includes('upload')) {
      return {
        label: 'Data Upload',
        classes: 'bg-sky-50 text-sky-700 border-sky-200'
      };
    }
    if (cat === 'overdue' || titleLower.includes('overdue')) {
      return {
        label: 'Follow-up Overdue',
        classes: 'bg-red-50 text-[#EF4444] border-red-200'
      };
    }
    if (cat === 'high_risk' || titleLower.includes('high')) {
      return {
        label: 'New High-Risk Patient',
        classes: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    }
    return {
      label: 'Clinical Notice',
      classes: 'bg-teal-50 text-teal-700 border-teal-200'
    };
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-teal-50 text-[#0D9488]">
              <Bell className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Clinical Alerts &amp; Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#EF4444] text-white text-xs font-bold tabular-nums">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            Real-time critical readmission flags, overdue follow-up escalations, and automated batch upload logs.
          </p>
        </div>

        {/* Global Actions: Refresh and Mark all as read */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${isRefreshing ? 'animate-spin text-[#0D9488]' : ''}`} />
            <span>Refresh</span>
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-[#0D9488] hover:border-teal-200 transition-colors shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-[#0D9488]" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-[#0D9488] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Alerts ({notifications.length})
          </button>
          <button
            onClick={() => setActiveFilter('unread')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeFilter === 'unread'
                ? 'bg-[#0D9488] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setActiveFilter('high_risk')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeFilter === 'high_risk'
                ? 'bg-[#0D9488] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            High-Risk Patients
          </button>
          <button
            onClick={() => setActiveFilter('overdue')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeFilter === 'overdue'
                ? 'bg-[#0D9488] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Overdue Follow-ups
          </button>
          <button
            onClick={() => setActiveFilter('upload')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeFilter === 'upload'
                ? 'bg-[#0D9488] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Batch Uploads
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search alerts by name, ID, or file..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No notifications found"
            description={
              searchQuery || activeFilter !== 'all'
                ? `No alerts match filter "${activeFilter}" or query "${searchQuery || 'any'}".`
                : 'Your clinical activity inbox is completely clear.'
            }
            actionLabel={searchQuery || activeFilter !== 'all' ? 'Show All Alerts' : undefined}
            onAction={() => {
              setSearchQuery('');
              setActiveFilter('all');
            }}
          />
        ) : (
          filteredNotifications.map((item) => {
            const badge = getBadgeCategory(item);
            return (
              <div
                key={item.id}
                className={`group rounded-2xl border transition-all duration-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  item.unread
                    ? 'bg-white border-teal-300/80 shadow-xs ring-1 ring-teal-500/10'
                    : 'bg-white/80 border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Left: Icon, Details */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  {getAlertIcon(item)}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.unread && (
                        <span className="w-2 h-2 rounded-full bg-[#0D9488] shrink-0" title="Unread" />
                      )}
                      <h3
                        onClick={() => handleNotificationClick(item)}
                        className="text-sm font-bold text-slate-900 hover:text-[#0D9488] transition-colors cursor-pointer truncate"
                      >
                        {item.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed pr-2">
                      {item.description}
                    </p>

                    <div className="flex items-center gap-4 pt-0.5 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.time}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-slate-400">ID: {item.id}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {/* Toggle Read/Unread */}
                  <button
                    onClick={() => handleToggleRead(item.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title={item.unread ? 'Mark as read' : 'Mark as unread'}
                    aria-label={item.unread ? 'Mark as read' : 'Mark as unread'}
                  >
                    {item.unread ? (
                      <Eye className="w-4 h-4 text-[#0D9488]" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>

                  {/* Delete Alert */}
                  {deleteNotification && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete alert"
                      aria-label="Delete alert"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Primary Target Navigate Button */}
                  <button
                    onClick={() => handleNotificationClick(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-[#0D9488] text-slate-700 hover:text-white transition-all cursor-pointer"
                  >
                    <span>View</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
