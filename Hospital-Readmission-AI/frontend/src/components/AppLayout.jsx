import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UploadCloud,
  Activity,
  CalendarCheck,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Lock,
  CheckCircle2,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import MediSightLogo from './MediSightLogo';

const NAV_ITEMS = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    allowedRoles: ['Admin', 'Doctor', 'Nurse', 'Analyst']
  },
  {
    name: 'Patients',
    path: '/patients',
    icon: Users,
    allowedRoles: ['Admin', 'Doctor', 'Nurse', 'Analyst']
  },
  {
    name: 'Data Upload',
    path: '/data-upload',
    icon: UploadCloud,
    allowedRoles: ['Admin', 'Doctor', 'Nurse']
  },
  {
    name: 'Risk Prediction',
    path: '/risk-prediction',
    icon: Activity,
    allowedRoles: ['Admin', 'Doctor', 'Nurse']
  },
  {
    name: 'Analytics',
    path: '/analytics',
    icon: BarChart3,
    allowedRoles: ['Admin', 'Doctor', 'Nurse', 'Analyst']
  },
  {
    name: 'Follow-ups',
    path: '/follow-ups',
    icon: CalendarCheck,
    allowedRoles: ['Admin', 'Doctor', 'Nurse']
  },
  {
    name: 'Notifications',
    path: '/notifications',
    icon: Bell,
    badge: true,
    allowedRoles: ['Admin', 'Doctor', 'Nurse', 'Analyst']
  }
];

export default function AppLayout() {
  const {
    currentUser,
    logout,
    globalSearch,
    setGlobalSearch,
    notifications,
    markNotificationRead,
    markAllNotificationsRead
  } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [restrictedToast, setRestrictedToast] = useState('');

  const avatarRef = useRef(null);
  const notifRef = useRef(null);
  const mainContentRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setAvatarDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileDrawerOpen(false);
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    toast.success('All notifications marked as read');
  };

  const handleLogout = () => {
    setAvatarDropdownOpen(false);
    logout();
    toast.info('Signed Out', 'You have been logged out of MediSight.');
    navigate('/login', { replace: true });
  };

  const handleNavClick = (e, item) => {
    const isAllowed = item.allowedRoles.includes(currentUser?.role);
    if (!isAllowed) {
      e.preventDefault();
      toast.warning(
        'Access Restricted',
        `${currentUser?.role} role does not have permission to open ${item.name}.`
      );
      setRestrictedToast(`Access restricted: ${currentUser?.role} role cannot open ${item.name}.`);
      setTimeout(() => setRestrictedToast(''), 3500);
    }
  };

  const getRoleBadgeColor = (role) => {
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

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-200 select-none">
      {/* Brand Header with MediSight Logo */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 shrink-0">
        <div className="flex items-center overflow-hidden">
          {isCollapsed && !isMobile ? (
            <div className="mx-auto flex justify-center w-full">
              <MediSightLogo variant="dark" iconOnly size="md" />
            </div>
          ) : (
            <MediSightLogo variant="dark" size="md" showTagline />
          )}
        </div>

        {isMobile ? (
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          !isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )
        )}
      </div>

      {isCollapsed && !isMobile && (
        <div className="py-2 flex justify-center border-b border-slate-800/60">
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 min-h-0 px-3 py-4 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isAllowed = item.allowedRoles.includes(currentUser?.role);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={(e) => handleNavClick(e, item)}
              title={
                !isAllowed
                  ? `${item.name} (Restricted for ${currentUser?.role})`
                  : isCollapsed && !isMobile
                  ? item.name
                  : undefined
              }
              className={({ isActive }) => {
                const baseClasses =
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap';
                if (!isAllowed) {
                  return `${baseClasses} text-slate-500 hover:bg-slate-800/40 cursor-not-allowed opacity-75`;
                }
                if (isActive) {
                  return `${baseClasses} bg-[#0D9488] text-white shadow-xs`;
                }
                return `${baseClasses} text-slate-300 hover:bg-slate-800/80 hover:text-white`;
              }}
            >
              <div className="relative shrink-0 flex items-center justify-center">
                <Icon className="w-5 h-5 shrink-0" />
                {item.badge && unreadCount > 0 && isCollapsed && !isMobile && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#EF4444] ring-2 ring-[#0F172A]" />
                )}
              </div>
              {(!isCollapsed || isMobile) && (
                <span className="flex-1 truncate">{item.name}</span>
              )}
              {(!isCollapsed || isMobile) && item.badge && unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#EF4444] text-white text-[10px] font-bold tabular-nums shrink-0">
                  {unreadCount}
                </span>
              )}
              {(!isCollapsed || isMobile) && !isAllowed && (
                <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Session Card */}
      <div className="p-3 border-t border-slate-800/80 shrink-0 mt-auto">
        {!isCollapsed || isMobile ? (
          <div className="px-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Active Session</span>
              <span className="text-[#0D9488] font-semibold">{currentUser?.role}</span>
            </div>
            <p className="text-xs font-medium text-slate-200 truncate">
              {currentUser?.department}
            </p>
          </div>
        ) : (
          <div
            className="w-9 h-9 mx-auto rounded-xl bg-slate-800 flex items-center justify-center text-xs font-bold text-[#0D9488]"
            title={`${currentUser?.name} (${currentUser?.role})`}
          >
            {currentUser?.role?.[0]}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#F8FAFC] text-slate-900">
      {/* Desktop Sidebar - Fixed to left of screen with full viewport height */}
      <aside
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-20 h-screen shrink-0 transition-all duration-200 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out lg:hidden ${
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Main Content Area - Offset by sidebar width, only this area scrolls */}
      <div
        ref={mainContentRef}
        className={`flex-1 flex flex-col h-screen min-w-0 overflow-y-auto transition-all duration-200 ease-in-out ${
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        {/* Top Navbar - Sticky at top with subtle shadow */}
        <header className="h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-xs shrink-0">
          {/* Left: Mobile Drawer Trigger + Search */}
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Open navigation drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigate(`/patients?search=${encodeURIComponent(globalSearch.trim())}`);
                  }
                }}
                placeholder="Search patients by name, ID, diagnosis..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15 transition-all"
              />
              {globalSearch && (
                <button
                  onClick={() => {
                    setGlobalSearch('');
                    if (location.pathname === '/patients') {
                      navigate('/patients');
                    }
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Right: Notification Bell + Avatar Dropdown */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Notification Bell Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifDropdownOpen((prev) => !prev)}
                className="relative p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-lg border border-slate-200/90 py-2 z-50">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">
                      MediSight Notifications
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs font-medium text-[#0D9488] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-slate-400">
                        No notifications at this time
                      </p>
                    ) : (
                      notifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            markNotificationRead(item.id);
                            setNotifDropdownOpen(false);
                            const target =
                              item.targetPath ||
                              (item.title.toLowerCase().includes('follow-up')
                                ? '/follow-ups'
                                : item.title.toLowerCase().includes('upload')
                                ? '/data-upload'
                                : '/patients');
                            navigate(target, { state: item.targetState });
                          }}
                          className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer block ${
                            item.unread ? 'bg-teal-50/40' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {item.unread && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488] shrink-0" />
                              )}
                              <p className="text-xs font-semibold text-slate-900 truncate">
                                {item.title}
                              </p>
                            </div>
                            <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                              {item.time}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                            {item.description}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifDropdownOpen(false);
                        navigate('/notifications');
                      }}
                      className="text-xs font-semibold text-[#0D9488] hover:text-teal-700 hover:underline flex items-center justify-center gap-1.5 cursor-pointer w-full py-0.5"
                    >
                      <span>View all notifications</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar Dropdown */}
            <div className="relative" ref={avatarRef}>
              <button
                onClick={() => setAvatarDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
              >
                <div className="w-8 h-8 rounded-xl bg-[#0D9488] text-white font-semibold text-xs flex items-center justify-center shrink-0">
                  {currentUser?.avatarInitials || 'MS'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-900 leading-tight">
                    {currentUser?.name}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    {currentUser?.role}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {avatarDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-lg border border-slate-200/90 py-2 z-50">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {currentUser?.name}
                      </p>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getRoleBadgeColor(
                          currentUser?.role
                        )}`}
                      >
                        {currentUser?.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {currentUser?.email}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">
                      {currentUser?.department}
                    </p>
                  </div>

                  <div className="px-2 pt-1.5">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#EF4444] hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout of MediSight
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Role Restriction Toast Banner */}
        {restrictedToast && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-[#EF4444] flex items-center justify-between shadow-xs">
            <span>{restrictedToast}</span>
            <button
              onClick={() => setRestrictedToast('')}
              className="text-red-500 hover:text-red-700 font-semibold ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
