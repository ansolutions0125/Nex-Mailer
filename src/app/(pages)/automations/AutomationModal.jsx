"use client";
import { useState } from "react";
import {
  FiCheck,
  FiX,
  FiImage,
  FiCalendar,
  FiActivity,
  FiMail,
  FiUser,
  FiBarChart2,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import SelectModal from "@/components/SelectModal";
import {
  inputStyles,
  labelStyles,
  LoadingSpinner,
  ToggleLiver,
} from "@/presets/styles";

/**
 * AutomationModal
 * Props:
 *  - isOpen, onClose
 *  - isEditing, isViewing
 *  - formData: { name, description, isActive, logo, listId }
 *  - owner: { _id, firstName, lastName, email } | null
 *  - stats: Flow.stats object | null
 *  - handleInputChange(e), handleSubmit(e), modalLoading
 *  - lists, selectedList, handleListConfirm(selectionIds[])
 */
const AutomationModal = ({
  isOpen,
  onClose,
  isEditing,
  isViewing = false,
  formData,
  owner = null,
  stats = null,
  handleInputChange,
  handleSubmit,
  modalLoading,
  lists = [],
  selectedList,
  handleListConfirm,
}) => {
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  const stopPropagation = (e) => e.stopPropagation();
  const handleListSelect = (selection) => {
    handleListConfirm(selection);
    setIsListModalOpen(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const prettyKey = (k) =>
    k
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();

  const getModalTitle = () => {
    if (isViewing) return "Automation Details";
    if (isEditing) return "Edit Automation";
    return "Add New Automation";
  };
  const getModalSubtitle = () => {
    if (isViewing) return "View your automation configuration and statistics";
    if (isEditing) return "Update your automation configuration";
    return "Configure a new Automation";
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className={`bg-white p-6 rounded-lg shadow-lg w-full ${
          isViewing ? "max-w-5xl" : "max-w-4xl"
        } max-h-[90vh] overflow-y-auto`}
        onClick={stopPropagation}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold">{getModalTitle()}</h2>
            <p className="text-sm text-zinc-600 mb-6">{getModalSubtitle()}</p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-xxs btn-primary"
            aria-label="Close modal"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Loading */}
        {modalLoading ? (
          <LoadingSpinner />
        ) : isViewing ? (
          /* -------------------- VIEW MODE -------------------- */
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <FiActivity className="w-5 h-5" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-zinc-600">
                      Automation Name
                    </label>
                    <div className="mt-1 p-3 bg-white border border-zinc-200 rounded text-zinc-800">
                      {formData.name || "N/A"}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-zinc-600">
                      Description
                    </label>
                    <div className="mt-1 p-3 bg-white border border-zinc-200 rounded text-zinc-800 min-h-[80px] line-clamp-2">
                      {formData.description || "No description provided"}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-zinc-600">
                      Status
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`px-3 py-2 rounded-md text-sm font-medium ${
                          formData.isActive
                            ? "bg-green-100 text-green-800 border border-green-200"
                            : "bg-red-100 text-red-800 border border-red-200"
                        }`}
                      >
                        {formData.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-zinc-600">
                      Automation Image
                    </label>
                    <div className="mt-1 flex items-center gap-3">
                      <div className="w-16 h-16 bg-white border border-zinc-200 rounded-lg overflow-hidden center-flex">
                        {formData.logo ? (
                          <img
                            src={formData.logo}
                            alt="Automation logo"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src =
                                "https://placehold.co/64x64/E2E8F0/334155?text=Logo";
                            }}
                          />
                        ) : (
                          <FiImage className="text-zinc-400 w-6 h-6" />
                        )}
                      </div>
                      <div className="text-sm text-zinc-600">
                        {formData.logo ? (
                          <a
                            href={formData.logo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline break-all"
                          >
                            {formData.logo}
                          </a>
                        ) : (
                          "No image uploaded"
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* List Association */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <FiActivity className="w-5 h-5" />
                List Association
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-zinc-600">
                    Connected List
                  </label>
                  <div className="mt-1">
                    {selectedList ? (
                      <div className="bg-white border border-zinc-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-zinc-800">
                              {selectedList.name}
                            </h4>
                            <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                              <span className="flex items-center gap-1">
                                <FiCalendar className="w-3 h-3" />
                                Created: {formatDate(selectedList.createdAt)}
                              </span>
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  selectedList.isActive
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {selectedList.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-zinc-200 rounded-lg p-4 text-center">
                        <FiActivity className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                        <p className="text-sm text-zinc-600">
                          No list connected
                        </p>
                        <p className="text-xs text-zinc-500">
                          Connect a list to enable automated workflows
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            {!!stats && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                  <FiBarChart2 className="w-5 h-5" />
                  Performance
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(stats).map(([k, v]) => {
                    if (v === null || v === undefined) return null;
                    let val = k.includes("Rate")
                      ? `${Number(v).toFixed(1)}%`
                      : k === "averageProcessingTime"
                      ? `${Number(v).toFixed(1)}s`
                      : k === "lastProcessedAt"
                      ? v
                        ? formatDate(v)
                        : "Never"
                      : Number.isFinite(Number(v))
                      ? Number(v).toLocaleString()
                      : String(v);

                    return (
                      <div
                        key={k}
                        className="bg-white p-3 border border-zinc-200 rounded-md"
                      >
                        <div className="text-xs text-zinc-500">
                          {prettyKey(k)}
                        </div>
                        <div className="text-base font-semibold text-zinc-800">
                          {val}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* -------------------- EDIT / CREATE MODE -------------------- */
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column: Basic Info */}
              <div className="space-y-4">
                <div className="mb-4">
                  <label className={labelStyles("base")}>Automation Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={inputStyles}
                    required
                    placeholder="e.g., 'New User Onboarding Flow'"
                  />
                </div>

                <div className="mb-4">
                  <label className={labelStyles("base")}>Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                    className={inputStyles}
                    placeholder="Describe what this automation does..."
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="logoUrl" className={labelStyles("base")}>
                    Image URL
                  </label>
                  <div className="flex gap-3">
                    <input
                      id="logoUrl"
                      type="url"
                      name="logo"
                      value={formData.logo}
                      onChange={handleInputChange}
                      className={inputStyles + " flex-1"}
                      placeholder="https://example.com/logo.png"
                    />
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-zinc-100 border border-zinc-300 center-flex overflow-hidden rounded">
                        {formData.logo ? (
                          <img
                            src={formData.logo}
                            alt="Logo Preview"
                            className="w-full h-full object-contain p-1"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src =
                                "https://placehold.co/40x40/E2E8F0/334155?text=Logo";
                            }}
                          />
                        ) : (
                          <FiImage className="text-zinc-400 w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <ToggleLiver
                    key="isActiveToggle"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    name="isActive"
                  />
                  <div>
                    <p className="text-sm text-zinc-800">
                      {formData.isActive ? "Active" : "Inactive"}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {formData.isActive
                        ? "This automation is currently active"
                        : "This automation is disabled"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right column: List association (optional) */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <p className="text-primary text-xs mb-2 bg-zinc-100 border rounded-sm py-1.5 px-2.5">
                    Optionally connect a list to this automation.
                  </p>

                  <button
                    type="button"
                    onClick={() => setIsListModalOpen(true)}
                    className="btn btn-sm btn-primary center-flex gap-2 mb-4"
                  >
                    Select a List
                  </button>

                  {selectedList && (
                    <div className="mt-2 bg-white border border-zinc-200 rounded p-3">
                      <p className={labelStyles("base")}>Currently Selected:</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="bg-zinc-100 text-zinc-700 px-3 py-1.5 text-sm rounded-md border">
                          {selectedList.name}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-200">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-sm lg:btn-md hover:bg-zinc-200"
                disabled={modalLoading}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={modalLoading}
                className="btn btn-md btn-primary-third disabled:cursor-not-allowed"
              >
                {modalLoading ? (
                  <>
                    <ImSpinner5 className="animate-spin h-4 w-4" />
                    {isEditing ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <FiCheck />
                    {isEditing ? "Update Automation" : "Create Automation"}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* List Selection Modal */}
      {isListModalOpen && !isViewing && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center"
          onClick={() => setIsListModalOpen(false)}
        >
          <div onClick={stopPropagation}>
            <SelectModal
              thresholdLimit={1}
              onCancel={() => setIsListModalOpen(false)}
              onConfirm={handleListSelect}
              title="Select List"
              items={lists}
              selectedItems={formData.listId ? [formData.listId] : []}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationModal;
