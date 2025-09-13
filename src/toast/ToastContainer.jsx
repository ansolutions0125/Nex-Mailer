// components/Toast/ToastContainer.jsx
"use client";

import React from "react";
import { FiX } from "react-icons/fi";
import { useToastStore } from "@/store/useToastStore";
import { ShieldX } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { CloudCheck } from "lucide-react";
import { Info } from "lucide-react";

const ToastContainer = () => {
  const { toasts, removeToast } = useToastStore();

  const getToastStyles = (type) => {
    const baseStyles =
      "flex items-center gap-2 px-4 pt-2 pb-3 rounded-sm max-w-md min-w-72 border border-y-2 relative overflow-hidden bg-white";

    switch (type) {
      case "success":
        return `${baseStyles} border-green-400 text-green-800`;
      case "error":
        return `${baseStyles} border-red-400 text-red-800`;
      case "warning":
        return `${baseStyles} bg-yellow-50 border-yellow-200 text-yellow-800`;
      case "info":
      default:
        return `${baseStyles} bg-blue-50 border-blue-200 text-blue-800`;
    }
  };

  const getIcon = (type) => {
    const iconClass = "h-5 xl:w-7 w-5 xl:h-7 flex-shrink-0";

    switch (type) {
      case "success":
        return <CloudCheck className={`${iconClass} text-green-600`} />;
      case "error":
        return <ShieldX className={`${iconClass} text-red-600`} />;
      case "warning":
        return <AlertTriangle className={`${iconClass} text-yellow-600`} />;
      case "info":
      default:
        return <Info className={`${iconClass} text-blue-600`} />;
    }
  };

  const getProgressBarColor = (type) => {
    switch (type) {
      case "success":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "warning":
        return "bg-yellow-500";
      case "info":
      default:
        return "bg-blue-500";
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.message}
          className={`${getToastStyles(toast.type)} animate-toast-in`}
        >
          {/* Icon */}
          {getIcon(toast.type)}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium break-words">{toast.message}</p>
            {toast.description && (
              <p className="text-xs mt-1 opacity-80">{toast.description}</p>
            )}
          </div>

          {/* Action Button (if provided) */}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="text-xs font-medium underline hover:no-underline flex-shrink-0"
            >
              {toast.action.label}
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={() => removeToast(toast.id)}
            className="bg-white p-1 text-sm rounded hover:bg-zinc-200 ml-10"
            title="Close"
          >
            <FiX className="h-4 w-4" />
          </button>

          {/* Progress Bar (if duration > 0) */}
          {toast.duration > 0 && (
            <div
              className={`absolute bottom-0 left-0 h-1 ${getProgressBarColor(
                toast.type
              )} animate-progress-bar`}
              style={{ animationDuration: `${toast.duration}ms` }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
