// store/useToastStore.js
import { create } from "zustand";

export const useToastStore = create((set, get) => ({
  toasts: [],

  showToast: (message, type = "info", duration = 7000, options = {}) => {
    const id = Date.now() + Math.random();
    const toast = {
      id,
      message,
      type, // 'success', 'error', 'info', 'warning'
      duration,
      timestamp: Date.now(),
      ...options, // Allow custom properties like action buttons, etc.
    };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-remove toast after duration (unless duration is 0 for persistent toasts)
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    return id; // Return ID in case caller wants to manually remove it
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  clearAllToasts: () => {
    set({ toasts: [] });
  },

  // Convenience methods
  showSuccess: (message, duration = 7000, options = {}) => {
    return get().showToast(message, "success", duration, options);
  },

  showError: (message, duration = 70000, options = {}) => {
    return get().showToast(message, "error", duration, options);
  },

  showInfo: (message, duration = 7000, options = {}) => {
    return get().showToast(message, "info", duration, options);
  },

  showWarning: (message, duration = 500, options = {}) => {
    return get().showToast(message, "warning", duration, options);
  },
}));
