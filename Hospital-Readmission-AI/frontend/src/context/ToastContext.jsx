import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ title, description, type = 'success', action, duration = 4000 }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newToast = { id, title, description, type, action };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (title, description, action) => addToast({ title, description, type: 'success', action }),
    error: (title, description, action) => addToast({ title, description, type: 'error', action }),
    warning: (title, description, action) => addToast({ title, description, type: 'warning', action }),
    info: (title, description, action) => addToast({ title, description, type: 'info', action })
  };

  React.useEffect(() => {
    const handleGlobalToast = (e) => {
      if (e.detail) {
        addToast(e.detail);
      }
    };
    window.addEventListener('medisight_toast', handleGlobalToast);
    return () => window.removeEventListener('medisight_toast', handleGlobalToast);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      {/* Toast Notification Stack Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-2xl p-4 shadow-xl border flex items-start gap-3 backdrop-blur-md transition-all duration-300 ${
              t.type === 'success'
                ? 'bg-slate-900/95 text-white border-teal-500/30'
                : t.type === 'error'
                ? 'bg-red-950/95 text-white border-red-500/30'
                : t.type === 'warning'
                ? 'bg-amber-950/95 text-white border-amber-500/30'
                : 'bg-slate-900/95 text-white border-slate-700'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#2DD4BF]" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-[#EF4444]" />}
              {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-sky-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold leading-snug">{t.title}</p>
              {t.description && (
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{t.description}</p>
              )}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action.onClick?.();
                    removeToast(t.id);
                  }}
                  className="mt-2 text-[11px] font-bold text-[#2DD4BF] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
              aria-label="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx.toast;
}
