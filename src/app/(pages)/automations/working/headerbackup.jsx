import { Dropdown } from "@/components/Dropdown";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import PropTypes from "prop-types";
import React, { useState } from "react";
import {
  FiArrowLeft,
  FiCheck,
  FiEdit2,
  FiMoreHorizontal,
  FiPause,
  FiPlay,
  FiSave,
  FiTrash2,
  FiX,
  FiXCircle,
  FiZap,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";

let inputStyles =
  "w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary  px-4 py-2 text-zinc-800 outline-none placeholder-zinc-500";

const FlowHeader = ({
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
  setCurrentList,
  handleChange,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(flow?.name || "");

  const [showStats, setShowStats] = useState(false);

  const handleNameSave = () => {
    editFlowName(tempName);
    setEditingName(false);
  };

  const handleNameCancel = () => {
    setTempName(flow?.name || "");
    setEditingName(false);
  };

  return (
    <div className="space-y-3 mb-8">
      <Link
        href="/automations"
        className="btn btn-md btn-primary w-fit"
        title="Back to Automations"
        aria-label="Back to Automations"
      >
        <FiArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        <span>Back to Automations</span>
      </Link>

      {/* Main Header Card */}
      <div className="bg-white border border-zinc-300 rounded-lg overflow-hidden">
        {loadingFetching ? (
          <div className="h-48 flex items-center justify-center gap-3">
            <ImSpinner5 className="animate-spin w-6 h-6 text-zinc-400" />
            <span className="text-zinc-500 font-medium">Loading flow...</span>
          </div>
        ) : (
          <div className="p-6">
            {/* Status & Title Section */}
            <div className="flex items-start gap-6 mb-6">
              {/* Status Indicator */}
              <div className="flex flex-col items-center pt-2">
                <div className="relative">
                  <div
                    className={`w-5 h-5 rounded-full transition-all duration-300 ${
                      flow?.isActive
                        ? "bg-third shadow-lg shadow-third/30"
                        : "bg-zinc-300"
                    }`}
                  >
                    {flow?.isActive && (
                      <div className="absolute inset-0 rounded-full bg-third animate-ping opacity-75" />
                    )}
                  </div>
                </div>
                <div
                  className={`w-px h-8 mt-1 transition-colors duration-300 ${
                    flow?.isActive ? "bg-third" : "bg-zinc-200"
                  }`}
                />
              </div>
              {/* Title & Meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  {editingName ? (
                    <div className="flex flex-col sm:flex-row items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className={`${inputStyles} max-w-xl`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleNameSave();
                          if (e.key === "Escape") handleNameCancel();
                        }}
                        autoFocus
                      />
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleNameSave}
                          className="btn btn-xxs btn-add"
                        >
                          <FiCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleNameCancel}
                          className="btn btn-xxs btn-second"
                        >
                          <FiX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <h1 className="text-2xl font-semibold text-zinc-700 truncate">
                      {flow?.name || "Untitled Flow"}
                    </h1>
                  )}

                  {(hasUnsavedChanges || hasUnsavedNameChanges) && (
                    <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded border border-third">
                      Unsaved
                    </span>
                  )}

                  {/* Menu Dropdown */}
                  <div className="relative">
                    {!editingName && (
                      <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="btn btn-xs btn-primary"
                      >
                        <FiMoreHorizontal className="w-4 h-4" />
                      </button>
                    )}

                    {showMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowMenu(false)}
                        />
                        <div className="absolute right-0 top-10 z-20 w-48 bg-white border border-zinc-300 rounded-md shadow-md py-1">
                          <button
                            onClick={() => {
                              setTempName(flow?.name || "");
                              setEditingName(true);
                              setShowMenu(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-300 flex items-center gap-2 group"
                          >
                            <div className="w-fit p-1 rounded bg-third group-hover:bg-white group-hover:text-third transition-colors duration-300 text-white">
                              <FiEdit2 className="w-3.5 h-3.5" />
                            </div>
                            Edit Flow Name
                          </button>
                          <div className="border-t border-zinc-200 my-1" />
                          <button
                            onClick={() => deleteFlow()}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 group"
                          >
                            <div className="w-fit p-1 rounded bg-red-600 group-hover:bg-red-500 group-hover:text-third transition-colors duration-300 text-white">
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </div>
                            Delete Flow
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Metadata Pills with Stats */}
                <div className="flex flex-wrap gap-2">
                  {!currentList ? (
                    // In your FlowHeader component, the dropdown should look like this:
                    <Dropdown
                      options={allLists.map((list) => ({
                        value: list._id,
                        label: list.name,
                      }))}
                      value={currentList?._id || null}
                      onChange={(selectedListId) => {
                        console.log(selectedListId)
                        handleChange("listId", selectedListId);
                      }}
                      placeholder="Automation Not Connected To A List"
                      className="w-full max-w-xs"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded border border-zinc-300">
                      <span className="text-xs text-zinc-500 font-medium">
                        List:
                      </span>
                      <span className="text-xs text-zinc-500 font-semibold">
                        {currentList.name}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded border border-zinc-300">
                    <span className="text-xs text-zinc-500 font-medium">
                      Subscribers:
                    </span>
                    <span className="text-xs text-zinc-500 font-semibold">
                      {currentList?.subscriberCount?.toLocaleString() || 0}
                    </span>
                  </div>

                  {website && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded border border-zinc-300">
                      <span className="text-xs text-zinc-500 font-medium">
                        Website:
                      </span>
                      <span className="text-xs text-zinc-500 font-semibold">
                        {website.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowStats(!showStats)}
                className="btn btn-sm btn-primary mb-3"
              >
                {showStats ? "Hide Stats" : "Show Automation Stats"}
              </button>
            </div>

            <div className="relative">
              <AnimatePresence>
                {showStats && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start flex-wrap gap-2 my-3"
                  >
                    {Object.entries(automationStats).map(([key, value]) => {
                      // Skip null values but keep 0 values
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
                        if (seconds < 60) {
                          return `${seconds.toFixed(1)}s`;
                        }
                        const minutes = Math.floor(seconds / 60);
                        const remainingSeconds = seconds % 60;
                        if (remainingSeconds === 0) {
                          return `${minutes}min`;
                        }
                        return `${minutes}min ${remainingSeconds.toFixed(0)}s`;
                      };

                      return (
                        <div
                          key={key}
                          className={`p-2 border flex items-center gap-2 ${
                            isGreen ? "border-emerald-300" : "border-third"
                          } rounded-md`}
                        >
                          <div
                            className={`w-fit p-1 rounded ${
                              isGreen ? "bg-emerald-300" : "bg-third"
                            } text-white`}
                          >
                            {isGreen ? (
                              <FiCheck className="w-3.5 h-3.5" />
                            ) : (
                              <FiZap className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <span
                            className={`text-xs ${
                              isGreen ? "text-emerald-600" : "text-zinc-700"
                            }`}
                          >
                            {isPercentage
                              ? `${value.toFixed(1)}% ${formattedKey}`
                              : isTime
                              ? `${formatTime(value)} ${formattedKey}`
                              : isLastRun
                              ? value
                                ? new Date(value).toLocaleString()
                                : "Automation never ran"
                              : `${value.toLocaleString()} ${formattedKey}`}
                          </span>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-third/50">
              <div
                className={`text-sm p-2 rounded-md ${
                  flow?.isActive
                    ? "text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300"
                    : "text-red-700 bg-red-50 hover:bg-red-100 border border-red-200"
                }`}
              >
                {flow?.isActive ? "Flow is currently active" : "Flow is paused"}
              </div>

              <div className="flex items-center gap-3">
                {hasUnsavedChanges && (
                  <button
                    onClick={discardAllChanges}
                    disabled={saving}
                    className="btn btn-md btn-primary disabled:opacity-50"
                  >
                    <FiXCircle className="w-4 h-4" />
                    Discard
                  </button>
                )}

                <button
                  onClick={() => toggleFlowStatus(!flow?.isActive)}
                  disabled={saving}
                  className={`btn btn-md rounded-md center-flex gap-2 disabled:opacity-50 ${
                    flow?.isActive
                      ? "text-red-700 bg-red-50 hover:bg-red-100 border border-red-200"
                      : "text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300"
                  }`}
                >
                  {hasUnsavedStatusChanges && (
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  {flow?.isActive ? (
                    <>
                      <FiPause className="w-4 h-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <FiPlay className="w-4 h-4" />
                      Activate
                    </>
                  )}
                </button>

                <button
                  onClick={saveFlow}
                  disabled={saving}
                  className={`btn btn-md ${
                    hasUnsavedChanges ? "btn-third" : "btn-primary-disabled"
                  }`}
                >
                  {saving ? (
                    <ImSpinner5 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FiSave className="w-4 h-4" />
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowHeader;
FlowHeader.propTypes = {
  flow: PropTypes.object.isRequired,
  saving: PropTypes.bool.isRequired,
  currentList: PropTypes.object,
  toggleFlowStatus: PropTypes.func.isRequired,
  saveFlow: PropTypes.func.isRequired,
  hasUnsavedChanges: PropTypes.bool.isRequired,
  hasUnsavedStatusChanges: PropTypes.bool.isRequired,
  website: PropTypes.object,
  loadingFetching: PropTypes.bool.isRequired,
  discardAllChanges: PropTypes.func.isRequired,
  editFlowName: PropTypes.func.isRequired,
  deleteFlow: PropTypes.func.isRequired,
  hasUnsavedNameChanges: PropTypes.bool.isRequired,
  allLists: PropTypes.array,
  onAddStep: PropTypes.func.isRequired,
};
