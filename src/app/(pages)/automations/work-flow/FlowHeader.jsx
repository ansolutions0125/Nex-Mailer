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

const inputStyles =
  "w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary px-4 py-2 text-zinc-800 outline-none placeholder-zinc-500";

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
  handleChange,
  errors = {},
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
    () => (flow?.isActive ? "bg-second shadow-lg shadow-second/30" : "bg-zinc-300"),
    [flow?.isActive]
  );
  const statusMessage = useMemo(
    () => (flow?.isActive ? "Active" : "Paused"),
    [flow?.isActive]
  );
  const statusButtonClass = useMemo(
    () =>
      flow?.isActive
        ? "text-red-700 bg-red-500/5 hover:bg-red-100 border border-red-200"
        : "text-primary bg-second/10 hover:bg-second border border-second hover:text-white",
    [flow?.isActive]
  );

  const handleNameSave = useCallback(() => {
    if (tempName.trim() && tempName !== flow?.name) editFlowName(tempName.trim());
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
      if (!res?.success) throw new Error(res?.message || "Failed to add subscriber");
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
      k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();

    return (
      <div className="flex items-start flex-wrap gap-2">
        {entries.map(([k, v]) => {
          const isPct = k.includes("Rate");
          const isTime = k === "averageProcessingTime";
          const isLastRun = k === "lastProcessedAt";
          const val = isPct
            ? `${Number(v).toFixed(1)}%`
            : isTime
            ? `${Number(v).toFixed(1)}s`
            : isLastRun
            ? (v ? new Date(v).toLocaleString() : "Never")
            : Number(v).toLocaleString();

          return (
            <div key={k} className="p-1.5 border flex items-center gap-2 rounded-md border-third">
              <div className="w-[2px] h-4 rounded bg-third" />
              <span className="text-xs text-zinc-700">
                {val} {prettyKey(k)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="sticky top-0 z-30 w-full bg-zinc-100 p-2 rounded-md border border-zinc-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 mb-2">
        {/* Left */}
        <div className="flex items-center gap-3">
          <Link href="/automations" className="btn btn-sm btn-primary" title="Back">
            <FiArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="relative">
            <div className={`w-3.5 h-3.5 rounded ${statusIndicatorColor}`}>
              {flow?.isActive && (
                <div className="absolute inset-0 rounded-full bg-second animate-ping opacity-75" />
              )}
            </div>
          </div>
          <span
            className={`text-xs rounded-sm px-2 py-1 border ${
              flow?.isActive
                ? "text-second bg-second/10 border-second"
                : "text-red-700 bg-red-500/10 border-red-500"
            }`}
          >
            {statusMessage}
          </span>
        </div>

        {/* Center */}
        <div className="flex-1 flex items-center justify-center min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2 w-full max-w-xl">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className={`${inputStyles} h-9`}
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder="Enter automation name"
              />
              <button
                onClick={handleNameSave}
                disabled={!tempName.trim() || tempName === flow?.name}
                className="btn btn-xxs btn-add disabled:opacity-50"
                title="Save name"
              >
                <FiCheck className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="btn btn-xxs btn-second"
                title="Cancel"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="truncate text-base sm:text-lg md:text-xl font-semibold text-zinc-700 max-w-[60vw] md:max-w-[50vw]">
                {flow?.name || "Untitled Automation"}
              </h1>
              {(hasUnsavedChanges || hasUnsavedNameChanges || hasNameChanges) && (
                <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-sm border border-third">
                  Unsaved
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
            className={`btn btn-xs sm:btn-sm rounded-md center-flex gap-2 disabled:opacity-50 ${statusButtonClass}`}
            title={flow?.isActive ? "Pause automation" : "Activate automation"}
          >
            {hasUnsavedStatusChanges && (
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" title="Status change pending" />
            )}
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
          </button>

          <button
            onClick={saveFlow}
            disabled={saving || !hasUnsavedChanges}
            className={`btn btn-xs sm:btn-sm ${hasUnsavedChanges ? "btn-third" : "btn-primary-disabled"} disabled:opacity-50`}
            title={hasUnsavedChanges ? "Save all changes" : "No changes to save"}
          >
            {saving ? <ImSpinner5 className="w-4 h-4 animate-spin" /> : <FiSave className="w-4 h-4" />}
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
      <div className="bg-white border border-zinc-200 rounded p-3">
        <div className="flex flex-wrap items-center gap-2 divide-x divide-zinc-300">
          {currentList ? (
            <MiniPill label="List" value={currentList.name} />
          ) : (
            <span className="text-xs text-zinc-500">Not connected to a list</span>
          )}
        </div>
      </div>

      {/* Stats */}
      {showStats && <div className="bg-white p-3 rounded border border-zinc-200 mt-2">{renderStats()}</div>}

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
                  onChange={(e) => setSubscriberData((p) => ({ ...p, email: e.target.value }))}
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
                  onChange={(e) => setSubscriberData((p) => ({ ...p, fullName: e.target.value }))}
                  className={inputStyles}
                />
              </div>
              <div>
                <label htmlFor="source" className={labelStyles("base")}>
                  Source (optional)
                </label>
                <input
                  id="source"
                  type="text"
                  placeholder="api | manual | import | form | automation | campaign"
                  value={subscriberData.source}
                  onChange={(e) => setSubscriberData((p) => ({ ...p, source: e.target.value }))}
                  className={inputStyles}
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowSubscriberModal(false)} className="btn btn-sm btn-primary">
                  Cancel
                </button>
                <button onClick={handleAddSubscriber} disabled={addingSubscriber || !subscriberData.email} className="btn btn-sm btn-third">
                  {addingSubscriber ? <ImSpinner5 className="w-4 h-4 animate-spin" /> : "Add Subscriber"}
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
