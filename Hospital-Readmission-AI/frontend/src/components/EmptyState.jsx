import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no items matching your criteria at this moment.',
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  secondaryActionLabel,
  onSecondaryAction,
  className = ''
}) {
  return (
    <div
      className={`bg-white rounded-2xl p-10 sm:p-14 text-center border border-slate-200/90 shadow-xs flex flex-col items-center justify-center max-w-lg mx-auto ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100 text-[#0D9488] flex items-center justify-center mb-4 shadow-2xs">
        <Icon className="w-7 h-7" />
      </div>

      <h3 className="text-base font-bold text-slate-900 tracking-tight">
        {title}
      </h3>

      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-sm">
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white shadow-xs transition-all cursor-pointer"
            >
              {ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
              <span>{actionLabel}</span>
            </button>
          )}

          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              <span>{secondaryActionLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
