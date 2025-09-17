"use client";
import { useState } from "react";
import {
  FiCheck,
  FiX,
  FiImage,
  FiCalendar,
  FiUsers,
  FiActivity,
  FiEdit,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import SelectModal from "@/components/SelectModal";
import {
  inputStyles,
  labelStyles,
  LoadingSpinner,
  ToggleLiver,
} from "@/presets/styles";

const ListModal = ({
  isOpen,
  onClose,
  isEditing,
  isViewing = false,
  formData,
  handleInputChange,
  handleSubmit,
  modalLoading,
  automations,
  selectedAutomation,
  handleAutomationConfirm,
}) => {
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);

  // Handle automation selection with proper event handling
  const handleAutomationSelect = (selection) => {
    handleAutomationConfirm(selection);
    setIsAutomationModalOpen(false);
  };

  // Stop propagation for modal content to prevent closing parent modal
  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  // Format date for display
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

  if (!isOpen) return null;

  // Get modal title and subtitle based on mode
  const getModalTitle = () => {
    if (isViewing) return "List Details";
    if (isEditing) return "Edit List";
    return "Add New List";
  };

  const getModalSubtitle = () => {
    if (isViewing) return "View your list configuration and statistics";
    if (isEditing) return "Update your list configuration";
    return "Configure a new List to hold your contacts";
  };

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

        {modalLoading ? (
          <LoadingSpinner />
        ) : isViewing ? (
          // View Mode - Details Display
          <div className="space-y-6">
            {/* Basic Information Section */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <FiActivity className="w-5 h-5" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-zinc-600">
                      List Name
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
                      List Image
                    </label>
                    <div className="mt-1 flex items-center gap-3">
                      <div className="w-16 h-16 bg-white border border-zinc-200 rounded-lg overflow-hidden flex items-center justify-center">
                        {formData.logo ? (
                          <img
                            src={formData.logo}
                            alt="List logo"
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

            {/* Automation Section */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                <FiActivity className="w-5 h-5" />
                Automation Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-zinc-600">
                    Connected Automation
                  </label>
                  <div className="mt-1">
                    {selectedAutomation ? (
                      <div className="bg-white border border-zinc-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-zinc-800">
                              {selectedAutomation.name}
                            </h4>
                            <p className="text-sm text-zinc-600 mt-1">
                              {selectedAutomation.description ||
                                "No description available"}
                            </p>
                            <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                              <span className="flex items-center gap-1">
                                <FiCalendar className="w-3 h-3" />
                                Created:{" "}
                                {formatDate(selectedAutomation.createdAt)}
                              </span>
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  selectedAutomation.isActive
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {selectedAutomation.isActive
                                  ? "Active"
                                  : "Inactive"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-zinc-200 rounded-lg p-4 text-center">
                        <FiActivity className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                        <p className="text-sm text-zinc-600">
                          No automation connected
                        </p>
                        <p className="text-xs text-zinc-500">
                          Connect an automation to enable automated workflows
                        </p>
                      </div>
                    )}
                  </div>
                </div>
 
              </div>
            </div>
          </div>
        ) : (
          // Edit/Create Mode - Form
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Basic Information */}
              <div className="space-y-4">
                <div>
                  <div className="mb-4">
                    <label className={labelStyles("base")}>List Name</label>
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
                    />
                    <div>
                      <p className="text-sm text-zinc-800">
                        {formData.isActive ? "Active" : "Inactive"}
                      </p>
                      <p className="text-xs text-zinc-600">
                        {formData.isActive
                          ? "This list is currently active"
                          : "This list is disabled"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <p className="text-primary text-xs mb-2 bg-zinc-100 border rounded-sm py-1.5 px-2.5">
                    Choose an automation for this list.
                  </p>

                  <button
                    type="button"
                    onClick={() => setIsAutomationModalOpen(true)}
                    className="btn btn-sm btn-primary center-flex gap-2 mb-4"
                  >
                    Select an Automation
                  </button>

                  {selectedAutomation && (
                    <div className="mt-2 bg-white border border-zinc-200 rounded p-3">
                      <p className="text-sm text-zinc-800 mb-2">
                        Currently Selected:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="bg-zinc-100 text-zinc-700 px-3 py-1.5 text-sm rounded-md border">
                          {selectedAutomation.name}
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
                    {isEditing ? "Update List" : "Create List"}
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* View Mode Action Buttons */}
        {isViewing && (
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm lg:btn-md hover:bg-zinc-200"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                // Switch to edit mode - you'll need to handle this in the parent component
                // For now, we'll just close the modal
                onClose();
              }}
              className="btn btn-sm lg:btn-md btn-primary gap-2"
            >
              <FiEdit />
              Edit List
            </button>
          </div>
        )}
      </div>

      {/* Automation Selection Modal - Render outside the main modal content */}
      {isAutomationModalOpen && !isViewing && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center"
          onClick={() => setIsAutomationModalOpen(false)}
        >
          <div onClick={stopPropagation}>
            <SelectModal
              thresholdLimit={1}
              onCancel={() => setIsAutomationModalOpen(false)}
              onConfirm={handleAutomationSelect}
              title="Select Automation"
              items={automations}
              selectedItems={
                formData.automationId ? [formData.automationId] : []
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ListModal;
