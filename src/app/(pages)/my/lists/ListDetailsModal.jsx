"use client";
import React from "react";
import {
  FiEdit2,
  FiX,
  FiCalendar,
  FiMail,
  FiLink,
  FiPackage,
  FiUser,
  FiFlag,
} from "react-icons/fi";
import { FaListCheck } from "react-icons/fa6";
import { AnimatePresence, motion } from "framer-motion";

const formatDate = (d) =>
  d
    ? new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(new Date(d))
    : "—";

export default function ListDetailsModal({ list, onClose }) {
  return (
    <AnimatePresence>
      {list && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm center-flex p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
            className="bg-white rounded-lg w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col border border-zinc-200/50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-zinc-50 border-b border-zinc-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-md bg-white border border-b-2 border-zinc-200">
                    <FaListCheck className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">
                      {list.name}
                    </h2>
                    <p className="text-sm text-zinc-600 mt-1">
                      {list.description || "—"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 center-flex bg-white border border-zinc-200 rounded hover:bg-zinc-200 transition-all"
                >
                  <FiX className="h-5 w-5 text-zinc-600" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 bg-white">
              <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 divide-x divide-zinc-300">
                {/* Left: List Info */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                      Status
                    </p>
                    <span
                      className={`px-2 py-0.5 text-xs rounded border ${
                        list.isActive
                          ? "bg-green-100 text-green-800 border-green-200"
                          : "bg-red-100 text-red-800 border-red-200"
                      }`}
                    >
                      {list.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                      Automation
                    </p>
                    {list.automationId ? (
                      <span className="px-2 py-0.5 text-xs rounded border bg-blue-100 text-blue-800 border-blue-200">
                        Connected
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded border bg-gray-100 text-gray-800 border-gray-200">
                        Not Connected
                      </span>
                    )}
                  </div>

                  <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                      Total Subscribers
                    </p>
                    <p className="text-sm font-medium text-zinc-800">
                      {list.stats?.totalSubscribers || 0}
                    </p>
                  </div>

                  <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                      Created At
                    </p>
                    <p className="text-sm font-medium text-zinc-800">
                      {formatDate(list.createdAt)}
                    </p>
                  </div>

                  <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                      Last Updated
                    </p>
                    <p className="text-sm font-medium text-zinc-800">
                      {formatDate(list.updatedAt)}
                    </p>
                  </div>
                </div>

                {/* Right: Customer Info */}
                <div className="lg:col-span-7">
                  <div className="bg-white px-6">
                    <h3 className="text-lg font-medium text-zinc-800 mb-3 flex items-center gap-2">
                      <div className="w-1 h-6 bg-primary rounded-full"></div>
                      Customer Details
                    </h3>
                    {list.customerId ? (
                      <div className="space-y-2">
                        <p className="text-sm text-zinc-700">
                          <span className="font-medium">Name:</span>{" "}
                          {`${list.customerId?.firstName || ""} ${
                            list.customerId?.lastName || ""
                          }`.trim()}
                        </p>
                        <p className="text-sm text-zinc-700">
                          <span className="font-medium">Email:</span>{" "}
                          {list.customerId?.email}
                        </p>
                        {/* Add more customer details if available */}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">
                        No customer associated with this list.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="btn btn-sm md:btn-md btn-second"
              >
                Close
              </button>
              {/* You can add an edit button here if needed */}
              {/* <button
                onClick={() => {
                  onClose();
                  // router.push(`/my/lists/edit?listId=${list._id}`); // Example for navigation
                }}
                className="btn btn-sm md:btn-md btn-primary-two"
              >
                <FiEdit2 className="h-4 w-4" />
                Edit List
              </button> */}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-zinc-400">{icon}</div>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <div className="text-zinc-800">{children}</div>
      </div>
    </div>
  );
}
