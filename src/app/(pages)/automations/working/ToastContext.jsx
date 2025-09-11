// app/components/ToastContainer.jsx
"use client";

import { useToastStore } from "@/store/useToastStore";
import { AnimatePresence, motion } from "framer-motion";
import React from "react";
import { FiAlertCircle, FiCheckCircle, FiX } from "react-icons/fi";

const ToastContainer = () => {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className={`p-4 rounded-md shadow-lg flex items-center gap-3 max-w-sm w-full backdrop-blur-md border pointer-events-auto ${
              toast.type === "success"
                ? "bg-emerald-50/70 border-emerald-300"
                : "bg-red-50/70 border-red-300"
            }`}
          >
            <div
              className={`flex-shrink-0 ${
                toast.type === "success" ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {toast.type === "success" ? (
                <FiCheckCircle className="w-5 h-5" />
              ) : (
                <FiAlertCircle className="w-5 h-5" />
              )}
            </div>
            <span className="flex-1 text-sm text-zinc-800">
              {toast.message}
            </span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-zinc-500 hover:text-zinc-700 transition-colors pointer-events-auto"
            >
              <FiX className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;