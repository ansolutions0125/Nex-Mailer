"use client";
import { useState } from "react";
import { FiCheck, FiX, FiImage } from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import SelectModal from "@/components/SelectModal";
import { inputStyles, labelStyles, ToggleLiver } from "@/presets/styles";

const ListModal = ({
  isOpen,
  onClose,
  isEditing,
  formData,
  handleInputChange,
  handleSubmit,
  modalLoading,
  automations,
  selectedAutomation,
  handleAutomationConfirm,
  isCustomer = false,
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={stopPropagation} // Stop propagation here too
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold">
              {isEditing ? "Edit List" : "Add New List"}
            </h2>
            <p className="text-sm text-zinc-600 mb-6">
              {isEditing
                ? "Update your list configuration"
                : "Configure a new List to hold your contacts"}
            </p>
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
          <div className="flex justify-center items-center py-12">
            <ImSpinner5 className="animate-spin text-gray-500 text-3xl" />
          </div>
        ) : (
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
      </div>

      {/* Automation Selection Modal - Render outside the main modal content */}
      {isAutomationModalOpen && (
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
