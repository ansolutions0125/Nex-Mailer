"use client";
import { FiLoader } from "react-icons/fi";

export function LoadingSpinner({ size = "md", className = "" }) {
  const sizeClasses = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8", xl: "w-12 h-12" };
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <FiLoader className={`animate-spin text-blue-500 ${sizeClasses[size]}`} />
    </div>
  );
}

export function SkeletonLoader({ lines = 3, className = "" }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-zinc-200 rounded animate-pulse" style={{ width: `${100 - i * 10}%` }} />
      ))}
    </div>
  );
}

export function StepSkeleton() {
  return (
    <div className="w-full flex gap-3 group opacity-70">
      <div className="flex-1 overflow-hidden rounded-md border bg-white border-zinc-200">
        <div className="flex border-b border-zinc-200">
          <div className="w-10 p-2 bg-zinc-100 center-flex border-r border-zinc-200">
            <div className="w-6 h-6 bg-zinc-200 rounded animate-pulse" />
          </div>
          <div className="flex-1 p-3 between-flex gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-zinc-200 animate-pulse" />
              <div className="h-4 bg-zinc-200 rounded animate-pulse w-32" />
            </div>
            <div className="w-7 h-7 bg-zinc-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="p-4">
          <SkeletonLoader lines={2} />
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200">
          <div className="w-16 h-8 bg-zinc-200 rounded animate-pulse" />
          <div className="w-16 h-8 bg-zinc-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
