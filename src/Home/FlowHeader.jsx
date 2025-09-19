import { Dropdown } from "@/components/Dropdown";
import { useToastStore } from "@/store/useToastStore";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import PropTypes from "prop-types";
import React, { useState, useCallback, useMemo, useEffect } from "react";
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
  FiZap,
  FiChevronDown,
  FiBarChart2,
  FiUserPlus,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";

let inputStyles =
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

const FlowNavbar = ({
  flow,
  saving,
  currentList,
  toggleFlowStatus,
  saveFlow,
  hasUnsavedChanges,
  hasUnsavedStatusChanges,
  website,
  loadingFetching,
  discardAllChanges,
  editFlowName,
  deleteFlow,
  hasUnsavedNameChanges,
  automationStats,
  allLists,
  allWebsites,
  handleChange,
  errors = {},
}) => {
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(flow?.name || "");
  const [showStats, setShowStats] = useState(false);
  const [openMeta, setOpenMeta] = useState(false);
  const [showSubscriberModal, setShowSubscriberModal] = useState(false);
  const [subscriberData, setSubscriberData] = useState({
    email: "",
    fullName: "",
    source: "",
    listId: currentList?._id || "",
  });
  const [addingSubscriber, setAddingSubscriber] = useState(false);

  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    setTempName(flow?.name || "");
  }, [flow?.name]);

  const hasNameChanges = useMemo(
    () => tempName !== (flow?.name || ""),
    [tempName, flow?.name]
  );

  const statusIndicatorColor = useMemo(
    () =>
      flow?.isActive ? "bg-second shadow-lg shadow-second/30" : "bg-zinc-300",
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
    if (tempName.trim() && tempName !== flow?.name) {
      editFlowName(tempName.trim());
    }
    setEditingName(false);
  }, [tempName, flow?.name, editFlowName]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") handleNameSave();
      if (e.key === "Escape") setEditingName(false);
    },
    [handleNameSave]
  );

  const labelStyles = (type) => {
    const base = "font-semibold text-zinc-500 uppercase tracking-wider";
    return type === "mini" ? `text-[0.6rem] ${base}` : `text-xs ${base}`;
  };

  const handleListChange = useCallback(
    (selectedListId) => {
      if (selectedListId && selectedListId !== currentList?._id) {
        const selectedList = allLists?.find((l) => l._id === selectedListId);
        if (selectedList) handleChange("listId", selectedList);
      }
    },
    [currentList?._id, allLists, handleChange]
  );

  const handleWebsiteChange = useCallback(
    (selectedWebsiteId) => {
      if (selectedWebsiteId && selectedWebsiteId !== website?._id) {
        const selectedWebsite = allWebsites?.find(
          (w) => w._id === selectedWebsiteId
        );
        if (selectedWebsite) handleChange("websiteId", selectedWebsiteId);
      }
    },
    [website?._id, allWebsites, handleChange]
  );

  // Add subscriber handler
  const handleAddSubscriber = async () => {
    try {
      setAddingSubscriber(true);
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscriberData),
      });
      if (!response.ok) throw new Error("Failed to add subscriber");
      setShowSubscriberModal(false);
      setSubscriberData({
        email: "",
        fullName: "",
        source: "",
        listId: currentList?._id || "",
      });
      addToast("Subscriber added successfully!", "success");
    } catch (err) {
      addToast(err.message || "Failed to add subscriber.", "error");
      console.error("Error adding subscriber:", err);
    } finally {
      setAddingSubscriber(false);
    }
  };

  const renderStatsItems = useCallback(() => {
    if (!automationStats) return null;

    return Object.entries(automationStats).map(([key, value]) => {
      if (value === null || value === undefined) return null;

      const formattedKey = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();

      const isGreen = [
        "totalWebhooksSent",
        "averageOpenRate",
        "totalUsersProcessed",
      ].includes(key);
      const isPercentage = key.includes("Rate");
      const isTime = key === "averageProcessingTime";
      const isLastRun = key === "lastProcessedAt";

      const formatTime = (seconds) => {
        if (seconds < 60) return `${seconds.toFixed(1)}s`;
        const minutes = Math.floor(seconds / 60);
        const remaining = seconds % 60;
        return remaining === 0
          ? `${minutes}min`
          : `${minutes}min ${remaining.toFixed(0)}s`;
      };

      const formatValue = () => {
        if (isPercentage) return `${value.toFixed(1)}% ${formattedKey}`;
        if (isTime) return `${formatTime(value)} ${formattedKey}`;
        if (isLastRun)
          return value
            ? new Date(value).toLocaleString()
            : "Automation never ran";
        return `${Number(value).toLocaleString()} ${formattedKey}`;
      };

      return (
        <div
          key={key}
          className={`p-1.5 border flex items-center gap-2 rounded-md ${
            isGreen ? "border-emerald-300" : "border-third"
          }`}
        >
          <div
            className={`w-[2px] h-4 rounded text-white ${
              isGreen ? "bg-emerald-300" : "bg-third"
            }`}
          ></div>
          <span
            className={`text-xs ${
              isGreen ? "text-emerald-600" : "text-zinc-700"
            }`}
          >
            {formatValue()}
          </span>
        </div>
      );
    });
  }, [automationStats]);

  const renderFieldError = useCallback(
    (fieldName) => {
      const fieldError = errors[fieldName];
      if (!fieldError) return null;
      const errorMessage = Array.isArray(fieldError)
        ? fieldError[0]
        : fieldError;
      return (
        <div className="text-xs text-red-600 mt-1 px-1">{errorMessage}</div>
      );
    },
    [errors]
  );

  if (loadingFetching) {
    return (
      <div className="h-48 flex items-center justify-center gap-3 bg-white rounded-lg border border-zinc-300">
        <ImSpinner5 className="animate-spin w-6 h-6 text-zinc-400" />
        <span className="text-zinc-500 font-medium">Loading flow...</span>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-30 w-full bg-zinc-100 p-2 rounded-md border border-zinc-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 mb-2">
        {/* Left: Back + Status dot */}
        <div className="flex items-center gap-3">
          <Link
            href="/automations"
            className="btn btn-sm btn-primary"
            title="Back to Automations"
            aria-label="Back to Automations"
          >
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

        {/* Center: Title / Edit */}
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
                placeholder="Enter flow name"
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
                title="Cancel editing"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="truncate text-base sm:text-lg md:text-xl font-semibold text-zinc-700 max-w-[60vw] md:max-w-[50vw]">
                {flow?.name || "Untitled Flow"}
              </h1>
              {(hasUnsavedChanges ||
                hasUnsavedNameChanges ||
                hasNameChanges) && (
                <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-sm border border-third">
                  Unsaved
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
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
              <div
                className="w-2 h-2 rounded-full bg-primary animate-pulse"
                title="Status change pending"
              />
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
            className={`btn btn-xs sm:btn-sm ${
              hasUnsavedChanges ? "btn-third" : "btn-primary-disabled"
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
                    Edit Work-Flow Name
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
                    Delete Work-Flow
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

      {/* Secondary Bar: meta & selectors */}
      <div className="bg-white border border-zinc-200 rounded p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 divide-x  divide-zinc-300">
            {currentList ? (
              <MiniPill label="List" value={currentList.name} />
            ) : (
              <div className="min-w-[220px]">
                <Dropdown
                  options={
                    allLists?.map((list) => ({
                      value: list._id,
                      label: list.name,
                    })) || []
                  }
                  value={currentList?._id || null}
                  onChange={handleListChange}
                  placeholder="Automation Not Connected To A List"
                  className="w-full"
                  isHighLighted={true}
                />
                {renderFieldError("listId")}
              </div>
            )}

            <MiniPill
              label="Subscribers"
              value={currentList?.subscriberCount?.toLocaleString() || 0}
            />

            {website ? (
              <MiniPill label="Website" value={website.name} />
            ) : (
              <div className="min-w-[220px]">
                <Dropdown
                  options={
                    allWebsites?.map((w) => ({
                      value: w._id,
                      label: w.name,
                    })) || []
                  }
                  value={website?._id || null}
                  onChange={handleWebsiteChange}
                  placeholder="Automation Not Connected To Website"
                  className="w-full"
                  isHighLighted={true}
                />
                {renderFieldError("websiteId")}
              </div>
            )}
          </div>

          {/* Collapse/expand meta on small screens */}
          <button
            onClick={() => setOpenMeta((o) => !o)}
            className="btn btn-xxs btn-primary sm:hidden"
            aria-expanded={openMeta}
            aria-controls="flow-meta"
          >
            <FiChevronDown
              className={`w-4 h-4 transition-transform ${
                openMeta ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Stats panel */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white p-3 rounded border border-zinc-200 mt-2"
          >
            <div className="flex items-start flex-wrap gap-2">
              {renderStatsItems()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    setSubscriberData((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
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
                    setSubscriberData((prev) => ({
                      ...prev,
                      fullName: e.target.value,
                    }))
                  }
                  className={inputStyles}
                />
              </div>
              <div>
                <label htmlFor="source" className={labelStyles("base")}>
                  Add a Source
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
                  placeholder="Select Source"
                  className={inputStyles}
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
};

export default FlowNavbar;

FlowNavbar.propTypes = {
  flow: PropTypes.object,
  saving: PropTypes.bool.isRequired,
  currentList: PropTypes.object,
  toggleFlowStatus: PropTypes.func.isRequired,
  saveFlow: PropTypes.func.isRequired,
  hasUnsavedChanges: PropTypes.bool.isRequired,
  hasUnsavedStatusChanges: PropTypes.bool,
  website: PropTypes.object,
  loadingFetching: PropTypes.bool.isRequired,
  discardAllChanges: PropTypes.func.isRequired,
  editFlowName: PropTypes.func.isRequired,
  deleteFlow: PropTypes.func.isRequired,
  hasUnsavedNameChanges: PropTypes.bool,
  automationStats: PropTypes.object,
  allLists: PropTypes.array,
  setCurrentList: PropTypes.func,
  handleChange: PropTypes.func.isRequired,
  errors: PropTypes.object,
};
