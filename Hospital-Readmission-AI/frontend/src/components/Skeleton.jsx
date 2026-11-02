import React from 'react';

export function SkeletonLine({ className = 'h-4 w-full' }) {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded-lg ${className}`}
    />
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div
      className={`bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs animate-pulse space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="h-3.5 bg-slate-200 rounded-md w-28" />
        <div className="w-8 h-8 bg-slate-200 rounded-xl" />
      </div>
      <div className="h-8 bg-slate-200 rounded-lg w-20" />
      <div className="h-3 bg-slate-100 rounded-md w-36" />
    </div>
  );
}

export function SkeletonChart({ height = 'h-72', title = 'Loading chart...' }) {
  return (
    <div
      className={`bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs animate-pulse flex flex-col justify-between ${height}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          <div className="h-4 bg-slate-200 rounded-md w-44" />
          <div className="h-3 bg-slate-100 rounded-md w-60" />
        </div>
        <div className="h-7 bg-slate-100 rounded-xl w-32" />
      </div>
      <div className="flex-1 flex items-end gap-3 pt-6 pb-2 px-2">
        <div className="flex-1 bg-slate-100 rounded-t-lg h-[40%]" />
        <div className="flex-1 bg-slate-200/80 rounded-t-lg h-[65%]" />
        <div className="flex-1 bg-slate-100 rounded-t-lg h-[50%]" />
        <div className="flex-1 bg-slate-200/80 rounded-t-lg h-[80%]" />
        <div className="flex-1 bg-slate-100 rounded-t-lg h-[60%]" />
        <div className="flex-1 bg-slate-200/80 rounded-t-lg h-[75%]" />
        <div className="flex-1 bg-slate-100 rounded-t-lg h-[45%]" />
      </div>
      <div className="flex justify-between pt-2 border-t border-slate-100">
        <div className="h-3 bg-slate-100 rounded w-16" />
        <div className="h-3 bg-slate-100 rounded w-16" />
        <div className="h-3 bg-slate-100 rounded w-16" />
        <div className="h-3 bg-slate-100 rounded w-16" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden animate-pulse">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="h-4 bg-slate-200 rounded-md w-36" />
        <div className="h-8 bg-slate-100 rounded-xl w-48" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-4 flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-4 bg-slate-100 rounded w-2/3 hidden sm:block" />
              <div className="h-4 bg-slate-200 rounded w-1/3 hidden sm:block" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
