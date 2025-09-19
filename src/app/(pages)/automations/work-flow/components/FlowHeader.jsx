"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { Dropdown } from "@/components/Dropdown";
import { useToastStore } from "@/store/useToastStore";
import useCustomerStore from "@/store/useCustomerStore";
import { fetchWithAuthCustomer } from "@/helpers/front-end/request";

import {
  FiArrowLeft,
  FiCheck,
  FiEdit,
  FiPause,
  FiPlay,
  FiSave,
  FiTrash2,
  FiX,
  FiXCircle,
  FiBarChart2,
  FiUserPlus,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { inputStyles } from "@/presets/styles";

const MiniPill = ({ label, value }) => (
  <div className="flex items-center gap-2 px-2 py-1 text-xs">
    <span className="uppercase tracking-wider text-zinc-500 font-semibold text-[0.65rem]">
      {label}
    </span>
    <span className="text-zinc-800 font-medium bg-zinc-100 border px-2 py-1 rounded-sm">
      {value}
    </span>
  </div>
);

function FlowHeader({
  flow,
  saving,
  currentList,
  toggleFlowStatus,
  saveFlow,
  hasUnsavedChanges,
  hasUnsavedStatusChanges,
  discardAllChanges,
  editFlowName,
  deleteFlow,
  hasUnsavedNameChanges,
  automationStats = {},
}) {
  const { showSuccess, showError } = useToastStore();
  const { customer, token } = useCustomerStore();

  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(flow?.name || "");
  const [showStats, setShowStats] = useState(false);
  const [showSubscriberModal, setShowSubscriberModal] = useState(false);
  const [addingSubscriber, setAddingSubscriber] = useState(false);
  const [subscriberData, setSubscriberData] = useState({
    email: "",
    fullName: "",
    source: "",
    listId: currentList?._id || "",
  });

  useEffect(() => setTempName(flow?.name || ""), [flow?.name]);

  const hasNameChanges = useMemo(
    () => tempName !== (flow?.name || ""),
    [tempName, flow?.name]
  );

  const statusIndicatorColor = useMemo(
    () =>
      flow?.isActive
        ? "bg-green-500/80 shadow-lg shadow-white/30"
        : "bg-red-300",
    [flow?.isActive]
  );
  const statusMessage = useMemo(
    () => (flow?.isActive ? "Active" : "Paused"),
    [flow?.isActive]
  );

  const handleNameSave = useCallback(() => {
    if (tempName.trim() && tempName !== flow?.name)
      editFlowName(tempName.trim());
    setEditingName(false);
  }, [tempName, flow?.name, editFlowName]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") handleNameSave();
      if (e.key === "Escape") setEditingName(false);
    },
    [handleNameSave]
  );

  const labelStyles = (type) =>
    type === "mini"
      ? "font-semibold text-zinc-500 uppercase tracking-wider text-[0.6rem]"
      : "font-semibold text-zinc-500 uppercase tracking-wider text-xs";

  // Add subscriber (uses auth helper)
  const handleAddSubscriber = async () => {
    if (!subscriberData.email) return;
    try {
      setAddingSubscriber(true);
      const res = await fetchWithAuthCustomer({
        url: "/api/contact",
        method: "POST",
        payload: subscriberData,
        customer,
        token,
      });
      if (!res?.success)
        throw new Error(res?.message || "Failed to add subscriber");
      setShowSubscriberModal(false);
      setSubscriberData({
        email: "",
        fullName: "",
        source: "",
        listId: currentList?._id || "",
      });
      showSuccess?.("Subscriber added!");
    } catch (err) {
      showError?.(err.message || "Failed to add subscriber");
      console.error("Error adding subscriber:", err);
    } finally {
      setAddingSubscriber(false);
    }
  };

  const renderStats = () => {
    const entries = Object.entries(automationStats || {}).filter(
      ([, v]) => v !== null && v !== undefined
    );
    if (entries.length === 0) return null;

    const prettyKey = (k) =>
      k
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .trim();

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {entries.map(([k, v]) => {
          const isPct = k.includes("Rate");
          const isTime = k === "averageProcessingTime";
          const isLastRun = k === "lastProcessedAt";
          const val = isPct
            ? `${Number(v).toFixed(1)}%`
            : isTime
            ? `${Number(v).toFixed(1)}s`
            : isLastRun
            ? v
              ? new Date(v).toLocaleString()
              : "Never"
            : Number(v).toLocaleString();

          return (
            <div
              key={k}
              className="bg-primary text-white text-sm px-4 py-3 rounded flex items-center justify-start gap-3"
            >
              <div className="w-1 h-full rounded-sm bg-white/30" />
              <div className=" flex flex-col">
                <span className="text-base">{val}</span>{" "}
                <span>{prettyKey(k)}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="sticky top-0 z-30 w-full bg-primary text-white p-2 rounded-b-lg">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 mb-2">
        {/* Left */}
        <div className="flex items-center gap-3">
          <Link
            href="/automations"
            className="btn btn-sm bg-white/10 border border-white/20 hover:bg-white/70 hover:text-primary center-flex gap-2"
            title="Back to Automations"
          >
            <FiArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Go Back</span>
          </Link>
          <div
            className={`center-flex gap-3 text-xs rounded-sm px-3 py-2 border ${
              flow?.isActive
                ? "text-white bg-white/10 border-white/30"
                : "text-red-600 bg-red-500/20 border-red-500/50"
            }`}
          >
            <div className="relative">
              <div
                className={`w-3.5 h-3.5 rounded-full ${statusIndicatorColor}`}
              >
                {flow?.isActive && (
                  <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
                )}
              </div>
            </div>
            {statusMessage}
          </div>
        </div>

        {/* Center */}
        <div className="flex-1 flex items-center justify-center min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2 w-full max-w-xl">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className={inputStyles}
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder="Enter automation name"
              />
              <button
                onClick={handleNameSave}
                disabled={!tempName.trim() || tempName === flow?.name}
                className="btn btn-xxs btn-second"
                title="Save name"
              >
                <FiCheck className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="btn btn-xxs btn-delete"
                title="Cancel"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="truncate text-base sm:text-lg md:text-xl font-semibold text-white max-w-[60vw] md:max-w-[50vw]">
                {flow?.name || "Untitled Automation"}
              </h1>
              {(hasUnsavedChanges ||
                hasUnsavedNameChanges ||
                hasNameChanges) && (
                <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-sm border border-third uppercase">
                  Un-saved
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <button
              onClick={discardAllChanges}
              disabled={saving}
              className="btn btn-xs sm:btn-sm btn-primary disabled:opacity-50"
              title="Discard all unsaved changes"
            >
              <FiXCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Discard</span>
            </button>
          )}

          <button
            onClick={() => toggleFlowStatus(!flow?.isActive)}
            disabled={saving}
            className={`btn btn-xs sm:btn-sm center-flex flex-col gap-2 disabled:opacity-50 border border-white/30 bg-white/10 hover:bg-white/20`}
            title={flow?.isActive ? "Pause automation" : "Activate automation"}
          >
            <div className="center-flex gap-2">
              {flow?.isActive ? (
                <>
                  <FiPause className="w-4 h-4" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <FiPlay className="w-4 h-4" />
                  <span className="hidden sm:inline">Activate</span>
                </>
              )}
            </div>
            {hasUnsavedStatusChanges && (
              <div
                className="w-full h-[2px] rounded-sm bg-yellow-200 animate-pulse"
                title="Status change pending"
              />
            )}
          </button>

          <button
            onClick={saveFlow}
            disabled={saving || !hasUnsavedChanges}
            className={`btn btn-xs sm:btn-sm border ${
              hasUnsavedChanges
                ? "border-white/30 bg-white/10 hover:bg-white/20 gap-2"
                : "btn-primary-disabled"
            } disabled:opacity-50`}
            title={
              hasUnsavedChanges ? "Save all changes" : "No changes to save"
            }
          >
            {saving ? (
              <ImSpinner5 className="w-4 h-4 animate-spin" />
            ) : (
              <FiSave className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Save</span>
          </button>

          <Dropdown
            position="bottom-right"
            options={[
              {
                value: "name",
                label: (
                  <div className="flex items-center gap-2 w-full">
                    <FiEdit />
                    Edit Name
                  </div>
                ),
              },
              {
                value: "addContact",
                label: (
                  <div className="flex items-center gap-2 w-full">
                    <FiUserPlus />
                    Add New Contact
                  </div>
                ),
              },
              {
                value: "stats",
                label: (
                  <div className="flex items-center gap-2 w-full">
                    <FiBarChart2 />
                    Toggle Stats
                  </div>
                ),
              },
              {
                value: "delete",
                label: (
                  <div className="flex items-center gap-2 w-full text-red-600">
                    <FiTrash2 />
                    Delete Automation
                  </div>
                ),
              },
            ]}
            placeholder="Actions"
            onChange={(val) => {
              if (val === "addContact") setShowSubscriberModal(true);
              if (val === "stats") setShowStats((s) => !s);
              if (val === "delete") deleteFlow();
              if (val === "name") setEditingName(true);
            }}
          />
        </div>
      </div>

      {/* Meta row (only List now) */}
      <div className="bg-white/20 border border-white/30 rounded-sm p-3">
        <div className="flex flex-wrap items-center gap-2 divide-x divide-zinc-300">
          {currentList ? (
            <MiniPill label="List" value={currentList.name} />
          ) : (
            <span className="text-xs text-white">Not connected to a list</span>
          )}
        </div>
      </div>

      {/* Stats */}
      {showStats && (
        <div className="fixed inset-0 top-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg border border-zinc-200 w-full max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-800">
                Automation Stats
              </h3>
              <button
                onClick={() => setShowStats(false)}
                className="text-zinc-500 bg-zinc-200 border border-zinc-300 p-1.5 rounded hover:bg-second hover:text-white transition-all"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
            {renderStats()}
          </div>
        </div>
      )}
      {/* Add Subscriber modal */}
      {showSubscriberModal && (
        <div className="fixed inset-0 top-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Subscriber</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className={labelStyles("base")}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={subscriberData.email}
                  onChange={(e) =>
                    setSubscriberData((p) => ({ ...p, email: e.target.value }))
                  }
                  className={inputStyles}
                />
              </div>
              <div>
                <label htmlFor="fullName" className={labelStyles("base")}>
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  placeholder="Full Name"
                  value={subscriberData.fullName}
                  onChange={(e) =>
                    setSubscriberData((p) => ({
                      ...p,
                      fullName: e.target.value,
                    }))
                  }
                  className={inputStyles}
                />
              </div>
              <div>
                <label htmlFor="source" className={labelStyles("base")}>
                  Source (optional)
                </label>
                <Dropdown
                  options={[
                    { value: "api", label: "API" },
                    { value: "manual", label: "Manual" },
                    { value: "import", label: "Import" },
                    { value: "form", label: "Form" },
                    { value: "automation", label: "Automation" },
                    { value: "campaign", label: "Campaign" },
                  ]}
                  value={subscriberData.source}
                  onChange={(value) =>
                    setSubscriberData((prev) => ({ ...prev, source: value }))
                  }
                  placeholder="Select source"
                  className="w-full"
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowSubscriberModal(false)}
                  className="btn btn-sm btn-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSubscriber}
                  disabled={addingSubscriber || !subscriberData.email}
                  className="btn btn-sm btn-third"
                >
                  {addingSubscriber ? (
                    <ImSpinner5 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Add Subscriber"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlowHeader;

FlowHeader.propTypes = {
  flow: PropTypes.object,
  saving: PropTypes.bool.isRequired,
  currentList: PropTypes.object,
  toggleFlowStatus: PropTypes.func.isRequired,
  saveFlow: PropTypes.func.isRequired,
  hasUnsavedChanges: PropTypes.bool.isRequired,
  hasUnsavedStatusChanges: PropTypes.bool,
  discardAllChanges: PropTypes.func.isRequired,
  editFlowName: PropTypes.func.isRequired,
  deleteFlow: PropTypes.func.isRequired,
  hasUnsavedNameChanges: PropTypes.bool,
  automationStats: PropTypes.object,
  handleChange: PropTypes.func.isRequired,
  errors: PropTypes.object,
};
