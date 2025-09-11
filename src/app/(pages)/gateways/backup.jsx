// pages/page.jsx (Gateways Component)
"use client";
import SidebarWrapper from "@/components/SidebarWrapper";
import React, { useEffect, useState, useCallback } from "react";
import {
  FiEdit,
  FiTrash2,
  FiPlus,
  FiCheck,
  FiX,
  FiGlobe,
  FiLink,
  FiChevronRight,
  FiChevronLeft,
  FiSave,
  FiCreditCard,
  FiAlertCircle,
  FiInfo,
  FiImage,
  FiKey,
  FiPower,
  FiSettings,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { EthernetPort, KeyRound } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { GATEWAY_PRESETS } from "@/presets/Presets";

 
const Gateways = () => {
  // State for storing fetched gateways
  const [gateways, setGateways] = useState([]);
  // Loading state for initial gateway fetch
  const [loading, setLoading] = useState(true);
  // Form data for adding/editing a gateway
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true,
    associatedWebsites: [],
    keys: {},
    logo: "",
    preset: null, // Stores the selected preset key (e.g., 'paypro', 'stripe')
    miniId: "", // Unique 3-digit ID for the gateway
  });
  // Stores the miniId of the gateway being edited
  const [editingMiniId, setEditingMiniId] = useState(null);
  // Controls the visibility of the main add/edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Controls the visibility of the delete confirmation modal
  const [isConfirmGatewayModalOpen, setIsConfirmGatewayModalOpen] =
    useState(false);
  // Stores the gateway object to be deleted
  const [gatewayToDelete, setGatewayToDelete] = useState(null);
  // Stores the miniId of the gateway currently being deleted (for loading indicator)
  const [deletingGatewayMiniId, setDeletingGatewayMiniId] = useState(null);

  // State for modal-specific loading (e.g., fetching websites)
  const [modalLoading, setModalLoading] = useState(false);
  // Stores all available websites for association
  const [allWebsites, setAllWebsites] = useState([]);

  // Manages the current step in the multi-step modal
  const [currentStep, setCurrentStep] = useState(1);
  // Stores selected website IDs temporarily during step 4
  const [selectedWebsiteIds, setSelectedWebsiteIds] = useState([]);

  // States for adding custom key-value pairs
  const [currentKey, setCurrentKey] = useState("");
  const [currentValue, setCurrentValue] = useState("");

  // Toast notification state
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "",
  });

  // Function to display toast notifications
  const showToast = useCallback((message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "" });
    }, 3000);
  }, []);

  // Fetches all gateways from the API
  const fetchGateways = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/gateways");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        setGateways(result.data);
      } else {
        showToast(result.message || "Failed to load gateways.", "error");
      }
    } catch (error) {
      console.error("Error fetching gateways:", error);
      showToast("Failed to load gateways.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Fetches all websites from the API (used for association)
  const fetchAllWebsites = useCallback(async () => {
    try {
      const response = await fetch("/api/website");
      if (!response.ok) throw new Error("Failed to fetch websites.");
      const result = await response.json();
      if (result.success) {
        setAllWebsites(result.data);
      } else {
        showToast(
          result.message || "Failed to load websites for association.",
          "error"
        );
      }
    } catch (error) {
      console.error("Error fetching websites for association:", error);
      showToast("Failed to load websites for association.", "error");
    }
  }, [showToast]);

  // Resets the form data to its initial empty state
  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      description: "",
      isActive: true,
      associatedWebsites: [],
      keys: {},
      logo: "",
      preset: null,
      miniId: "",
    });
    setEditingMiniId(null);
    setCurrentKey("");
    setCurrentValue("");
    setSelectedWebsiteIds([]);
    setCurrentStep(1); // Always reset to step 1 for new additions
  }, []);

  // Opens the add/edit gateway modal
  const openAddEditModal = useCallback(
    async (gateway = null) => {
      setIsModalOpen(true);
      setModalLoading(true); // Start loading for modal content

      try {
        await fetchAllWebsites(); // Fetch all websites needed for Step 4

        if (gateway) {
          // If editing an existing gateway
          const getWebsiteIds = (websites) => {
            if (!websites) return [];
            return websites.map((w) => {
              return typeof w === "object" && w !== null && w._id ? w._id : w;
            });
          };

          // Determine the preset based on the gateway's name
          const inferredPreset = Object.keys(GATEWAY_PRESETS).find(
            (key) => GATEWAY_PRESETS[key].name === gateway.name
          );

          setFormData({
            name: gateway.name,
            description: gateway.description || "",
            isActive: gateway.isActive,
            associatedWebsites: getWebsiteIds(gateway.associatedWebsites),
            keys:
              gateway.keys && typeof gateway.keys === "object"
                ? { ...gateway.keys }
                : {},
            logo: gateway.logo || "",
            preset: inferredPreset || null, // Set the inferred preset
            miniId: gateway.miniId,
          });
          setSelectedWebsiteIds(getWebsiteIds(gateway.associatedWebsites));
          setEditingMiniId(gateway.miniId);
          setCurrentKey("");
          setCurrentValue("");
          setCurrentStep(2); // Start at step 2 for editing existing gateways
        } else {
          // If adding a new gateway
          resetForm(); // Reset form to clear previous data
          setCurrentStep(1); // Start at step 1 for new gateways
        }
      } catch (error) {
        console.error("Error preparing modal:", error);
        showToast("Failed to load necessary data for the form.", "error");
        setIsModalOpen(false); // Close modal on error
      } finally {
        setModalLoading(false); // End loading for modal content
      }
    },
    [fetchAllWebsites, showToast, resetForm]
  );

  // Effect to fetch gateways on component mount
  useEffect(() => {
    fetchGateways();
  }, [fetchGateways]);

  // Handles changes in form input fields (name, description, isActive, miniId)
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // Handles changes specifically for the logo image URL
  const handleImageURLChange = (e) => {
    setFormData({
      ...formData,
      logo: e.target.value,
    });
  };

  // Adds a new custom key-value pair to formData.keys
  const handleAddKey = () => {
    if (!currentKey.trim()) {
      showToast("Key name cannot be empty.", "error");
      return;
    }
    if (!currentValue.trim()) {
      showToast("Key value cannot be empty.", "error");
      return;
    }

    const trimmedKey = currentKey.trim();
    const trimmedValue = currentValue.trim();

    if (formData.keys && formData.keys.hasOwnProperty(trimmedKey)) {
      showToast(
        "Key already exists. Please use a different key name.",
        "error"
      );
      return;
    }

    setFormData((prev) => ({
      ...prev,
      keys: {
        ...prev.keys,
        [trimmedKey]: trimmedValue,
      },
    }));

    setCurrentKey("");
    setCurrentValue("");
    showToast("Key added successfully.", "success");
  };

  // Removes a custom key-value pair from formData.keys
  const handleRemoveKey = (keyToRemove) => {
    setFormData((prev) => {
      const newKeys = { ...prev.keys };
      delete newKeys[keyToRemove];
      return {
        ...prev,
        keys: newKeys,
      };
    });
    showToast("Key removed successfully.", "success");
  };

  // Allows adding keys by pressing Enter in the input fields
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddKey();
    }
  };

  // Handles navigation to the next step in the modal
  const handleNextStep = () => {
    let isValid = true;
    let errorMessage = "";

    switch (currentStep) {
      case 1: // Step 1: Gateway Type Selection
        if (!formData.preset && !editingMiniId) {
          isValid = false;
          errorMessage = "Please select a gateway type to proceed.";
        }
        break;
      case 2: // Step 2: Basic Configuration
        if (!formData.name.trim()) {
          isValid = false;
          errorMessage = "Gateway name is required.";
        }
        break;
      case 3: // Step 3: API Configuration
        if (formData.preset) {
          const presetFields = GATEWAY_PRESETS[formData.preset].fields;
          for (const key in presetFields) {
            // Check if the key is present in formData.keys and has a non-empty value
            if (!formData.keys[key]?.trim()) {
              isValid = false;
              errorMessage = `${key.replace(/_/g, " ")} is required.`;
              break;
            }
          }
        }
        if (Object.keys(formData.keys).length === 0 && !formData.preset) {
          // If no preset and no custom keys, then it's invalid
          isValid = false;
          errorMessage = "Please add at least one API key or select a preset.";
        }
        break;
      case 4: // Step 4: Website Association (no specific validation needed here, can proceed with empty selection)
        break;
      default:
        break;
    }

    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    } else {
      showToast(errorMessage, "error");
    }
  };

  // Handles navigation to the previous step in the modal
  const handlePreviousStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  // Submits the gateway form (add or edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);

    // Final validation before submission (especially for Step 5)
    if (currentStep === 5) {
      let isValid = true;
      let errorMessage = "";

      if (!formData.name.trim()) {
        isValid = false;
        errorMessage = "Gateway name is required.";
      } else if (!formData.miniId.trim() || !/^\d{3}$/.test(formData.miniId)) {
        isValid = false;
        errorMessage = "Gateway Access ID must be exactly 3 numbers.";
      } else if (formData.preset) {
        const presetFields = GATEWAY_PRESETS[formData.preset].fields;
        for (const key in presetFields) {
          if (!formData.keys[key]?.trim()) {
            isValid = false;
            errorMessage = `${key.replace(/_/g, " ")} is required.`;
            break;
          }
        }
      }
      if (Object.keys(formData.keys).length === 0 && !formData.preset) {
        isValid = false;
        errorMessage = "Please add at least one API key or select a preset.";
      }

      if (!isValid) {
        showToast(errorMessage, "error");
        setModalLoading(false);
        return;
      }
    }

    try {
      const submitData = {
        ...formData,
        // Ensure associatedWebsites is sent, even if empty
        associatedWebsites: formData.associatedWebsites || [],
      };

      let response;
      if (editingMiniId) {
        // If editing, send PUT request
        response = await fetch("/api/gateways", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ miniId: editingMiniId, ...submitData }),
        });
      } else {
        // If adding, send POST request
        response = await fetch("/api/gateways", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(submitData),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "An unexpected error occurred.");
      }

      if (result.success) {
        showToast(
          editingMiniId
            ? "Gateway updated successfully!"
            : "New gateway added successfully!",
          "success"
        );
        setIsModalOpen(false); // Close modal
        resetForm(); // Reset form data
        fetchGateways(); // Refresh gateway list
      } else {
        showToast(result.message || "Failed to save gateway.", "error");
      }
    } catch (error) {
      console.error("Error saving gateway: ", error);
      showToast(
        error.message || "Failed to save gateway. Please try again.",
        "error"
      );
    } finally {
      setModalLoading(false);
    }
  };

  // Handler for editing a gateway (opens modal and populates data)
  const handleEdit = (gateway) => {
    openAddEditModal(gateway);
  };

  // Handler for initiating gateway deletion (opens confirmation modal)
  const handleDelete = (gateway) => {
    setGatewayToDelete(gateway);
    setIsConfirmGatewayModalOpen(true);
  };

  // Confirms and executes gateway deletion
  const confirmDeleteGateway = async () => {
    if (!gatewayToDelete) return;
    const { miniId } = gatewayToDelete;
    setDeletingGatewayMiniId(miniId);
    setIsConfirmGatewayModalOpen(false);

    try {
      const response = await fetch(`/api/gateways?miniId=${miniId}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "An unexpected error occurred during deletion."
        );
      }

      if (result.success) {
        showToast("Gateway deleted successfully!", "success");
        fetchGateways(); // Refresh gateway list
      } else {
        showToast(result.message || "Failed to delete gateway.", "error");
      }
    } catch (error) {
      console.error("Error deleting gateway:", error);
      showToast(`Failed to delete gateway: ${error.message}`, "error");
    } finally {
      setDeletingGatewayMiniId(null);
      setGatewayToDelete(null);
    }
  };

  // Cancels gateway deletion
  const cancelDeleteGateway = () => {
    setIsConfirmGatewayModalOpen(false);
    setGatewayToDelete(null);
  };

  // Toggles selection of a website in Step 4
  const toggleWebsiteSelection = (websiteId) => {
    setSelectedWebsiteIds((prevSelected) => {
      if (prevSelected.includes(websiteId)) {
        return prevSelected.filter((id) => id !== websiteId);
      } else {
        return [...prevSelected, websiteId];
      }
    });
  };

  // Confirms website selection in Step 4 and moves to next step
  const confirmWebsiteSelection = () => {
    setFormData((prev) => ({
      ...prev,
      associatedWebsites: selectedWebsiteIds,
    }));
    handleNextStep(); // Move to Step 5
  };

  let inputStyles =
    "w-full bg-zinc-50 border border-b-2 border-zinc-300 focus:border-purple-500  px-4 py-2.5 text-zinc-800 outline-none placeholder-zinc-500";

  return (
    <SidebarWrapper>
      <div className="w-full">
        <AnimatePresence>
          {toast.show && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`fixed top-4 right-4 p-4  shadow-lg z-50
                              ${
                                toast.type === "success"
                                  ? "bg-green-600/90"
                                  : "bg-red-600/90"
                              }
                              backdrop-blur-sm border ${
                                toast.type === "success"
                                  ? "border-green-500/30"
                                  : "border-red-500/30"
                              }
                            `}
            >
              <div className="flex items-center gap-2 text-white">
                {toast.type === "success" ? (
                  <FiCheck className="text-lg" />
                ) : (
                  <FiX className="text-lg" />
                )}
                <span>{toast.message}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl  text-zinc-700 flex items-center gap-2">
              <div className="center-flex relative">
                <span className="w-4 h-4  bg-green-500 animate-pulse"></span>
                <span className="w-4 h-4  bg-green-500 absolute top-0 left-0 animate-ping"></span>
              </div>
              Gateways Management
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Manage your digital gateways and their configurations
            </p>
          </div>
          <button
            onClick={() => openAddEditModal()}
            className="btn btn-md btn-primary center-flex gap-2"
          >
            <FiPlus className="text-base" />
            Add Gateway
          </button>
        </div>

        {/* Gateway List Display */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <ImSpinner5 className="w-12 h-12 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {gateways.map((gateway) => {
              const isDeleting = deletingGatewayMiniId === gateway.miniId;
              return (
                <div
                  key={gateway.miniId}
                  className="bg-zinc-100 border border-x-4 border-zinc-300 hover:border-zinc-400 transition-all hover:shadow-md overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-3 border-b border-zinc-300 flex items-center gap-3">
                    <div className="h-12 w-auto flex-1  overflow-hidden bg-zinc-700/50 border border-zinc-600/50 flex items-center justify-center">
                      {gateway.logo ? (
                        <img
                          src={gateway.logo}
                          alt={`${gateway.name} logo`}
                          className="h-full w-auto object-contain"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://placehold.co/48x48/334155/E2E8F0?text=${gateway.name
                              .charAt(0)
                              .toUpperCase()}`;
                          }}
                        />
                      ) : (
                        <div className="h-12 w-12  bg-zinc-700/50 border border-zinc-600 flex items-center justify-center">
                          <EthernetPort className="text-zinc-400 text-xl" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-zinc-700  truncate">
                        {gateway.name}
                      </h3>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        ID: {gateway.miniId}
                      </p>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3 space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs text-zinc-600">Description:</p>
                      <p className="text-sm text-zinc-700 break-words">
                        {gateway.description || "No description provided."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2  border border-zinc-400 flex items-start gap-2 col-span-2 ">
                        <div className="p-1.5 bg-zinc-400 ">
                          <FiGlobe className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-600">
                            Associated Websites
                          </p>
                          <p className="text-sm  text-zinc-700">
                            {gateway.associatedWebsites?.length || 0}
                          </p>
                        </div>
                      </div>

                      <div className="p-2  border border-zinc-400 flex items-start gap-2 col-span-2 ">
                        <div className="p-1.5 bg-zinc-400 ">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-600">Custom Keys</p>
                          <p className="text-sm  text-zinc-700">
                            {gateway.keys && typeof gateway.keys === "object"
                              ? Object.keys(gateway.keys).length
                              : 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="between-flex">
                      <span className="text-xs text-zinc-500">Status:</span>
                      <span
                        className={`px-2 py-1 text-xs    ${
                          gateway.isActive
                            ? "bg-green-800/50 text-white border border-green-700/50"
                            : "bg-red-800/50 text-white border border-red-700/50"
                        }`}
                      >
                        {gateway.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-3 border-t border-zinc-300 flex justify-end gap-2 rounded-b-lg">
                    <button
                      onClick={() => handleEdit(gateway)}
                      className="btn btn-xs btn-green-600 "
                      title="Edit Gateway"
                      disabled={isDeleting}
                    >
                      <FiEdit />
                    </button>
                    <button
                      onClick={() => handleDelete(gateway)}
                      className="btn btn-xs btn-red-600 "
                      title="Delete Gateway"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <ImSpinner5 className="animate-spin" />
                      ) : (
                        <FiTrash2 />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 w-full h-screen bg-zinc-50/95 pattern backdrop-blur-sm z-50 overflow-y-auto font-inter">
            <div className="min-h-screen flex flex-col">
              {/* Header */}
              <div className="w-full px-6 py-3 between-flex">
                <div>
                  <h2 className="text-xl 3xl:text-2xl  text-primary">
                    {editingMiniId ? "Edit Gateway" : "Add New Gateway"}
                  </h2>
                  <p className="text-sm text-zinc-600">
                    {editingMiniId
                      ? "Update your gateway configuration"
                      : "Configure a new payment gateway"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="text-zinc-500 hover:text-zinc-800 transition-colors p-2  hover:bg-second border border-transparent hover:border-zinc-300"
                  aria-label="Close modal"
                >
                  <FiX size={20} className="stroke-current" />
                </button>
              </div>

              {/* Step Indicators */}
              <div className="px-5 py-3 bg-second/80 border-y border-zinc-300 center-flex">
                <div className="flex justify-center gap-">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <div
                      key={step}
                      className={`flex items-center transition-all duration-300 ${
                        currentStep === step
                          ? "text-purple-600"
                          : "text-zinc-500"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 flex items-center justify-center border-2 transition-all
                                ${
                                  currentStep === step
                                    ? "bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-200/50"
                                    : currentStep > step
                                    ? "bg-green-600 border-green-600 text-white"
                                    : "border-zinc-300 text-zinc-600 bg-zinc-100"
                                }`}
                      >
                        {currentStep > step ? <FiCheck size={18} /> : step}
                      </div>
                      {step < 5 && (
                        <div
                          className={`h-1 w-16 transition-all duration-500 ${
                            currentStep > step
                              ? "bg-gradient-to-r from-green-600 to-purple-600"
                              : "bg-zinc-300"
                          }`}
                        ></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 p-6">
                {modalLoading && !editingMiniId ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="flex flex-col items-center">
                      <ImSpinner5 className="w-12 h-12 animate-spin text-purple-600 mb-4" />
                      <p className="text-zinc-600">
                        Loading gateway details...
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="h-full">
                    <AnimatePresence mode="wait">
                      {/* Step 1: Choose Gateway Type */}
                      {currentStep === 1 && !editingMiniId && (
                        <motion.div
                          key="step1"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="max-w-4xl mx-auto"
                        >
                          <div className="text-center">
                            <h3 className="text-xl  text-zinc-800 mb-2">
                              Select Gateway Type
                            </h3>
                            <p className="text-zinc-600 max-w-lg mx-auto">
                              Choose from our pre-configured gateways to get
                              started quickly. Each option comes with
                              recommended settings.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                            {Object.entries(GATEWAY_PRESETS).map(
                              ([key, preset]) => (
                                <button
                                  type="button"
                                  key={key}
                                  onClick={() => {
                                    setFormData((prev) => ({
                                      ...prev,
                                      preset: key,
                                      name: preset.name,
                                      logo: preset.logo || "",
                                      keys: { ...preset.fields }, // Initialize keys with preset fields
                                    }));
                                  }}
                                  className={`flex flex-col items-center p-5  border border-x-4 transition-all duration-200 group
                                        ${
                                          formData.preset === key
                                            ? "border-primary bg-purple-100 shadow-lg shadow-purple-200/50"
                                            : "border-zinc-300 bg-zinc-50 hover:border-primary hover:bg-purple-50"
                                        }`}
                                >
                                  {preset.logo ? (
                                    <div className="h-16 mb-4 center-flex bg-white  p-2">
                                      <img
                                        src={preset.logo}
                                        alt={`${preset.name} logo`}
                                        className="max-h-full max-w-full object-contain"
                                        onError={(e) => {
                                          e.target.onerror = null;
                                          e.target.src = `https://placehold.co/64x64/a78bfa/ffffff?text=${preset.name.charAt(
                                            0
                                          )}`;
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-16 h-16 mb-4 center-flex bg-zinc-200  text-zinc-500">
                                      <FiCreditCard size={24} />
                                    </div>
                                  )}
                                  <span
                                    className={` text-lg mb-1 ${
                                      formData.preset === key
                                        ? "text-purple-600"
                                        : "text-zinc-700 group-hover:text-purple-600"
                                    }`}
                                  >
                                    {preset.name}
                                  </span>
                                  <span className="text-xs text-zinc-500 px-3 py-1 bg-zinc-200 ">
                                    {Object.keys(preset.fields).length} config
                                    fields
                                  </span>
                                </button>
                              )
                            )}
                          </div>

                          {!formData.preset && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-center pt-4"
                            >
                              <p className="text-sm text-amber-600 inline-flex items-center gap-1">
                                <FiAlertCircle /> Please select a gateway type
                                to continue
                              </p>
                            </motion.div>
                          )}
                        </motion.div>
                      )}

                      {/* Step 2: Basic Configuration */}
                      {(currentStep === 2 || editingMiniId) && (
                        <motion.div
                          key="step2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="h-full max-w-4xl mx-auto"
                        >
                          <div className="space-y-6">
                            {/* Basic Details Card */}
                            <div className="bg-white border border-x-4 border-zinc-300 p-6">
                              <h3 className="text-lg  text-zinc-800 mb-4 flex items-center gap-2">
                                <FiSettings className="text-purple-600" /> Basic
                                Configuration
                              </h3>

                              <div className="space-y-4">
                                <div>
                                  <label
                                    htmlFor="gatewayName"
                                    className="block text-sm  text-zinc-700 mb-2"
                                  >
                                    Gateway Name *
                                  </label>
                                  <input
                                    id="gatewayName"
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className={inputStyles}
                                    placeholder="e.g. Stripe Payments"
                                    required
                                  />
                                </div>

                                <div>
                                  <label
                                    htmlFor="description"
                                    className="block text-sm  text-zinc-700 mb-2"
                                  >
                                    Description
                                  </label>
                                  <textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows="3"
                                    className={inputStyles}
                                    placeholder="Optional description for this gateway"
                                  ></textarea>
                                </div>
                              </div>
                            </div>

                            {/* Logo Configuration Card */}
                            <div className="bg-white border border-x-4 border-zinc-300 p-6">
                              <h3 className="text-lg  text-zinc-800 mb-4 flex items-center gap-2">
                                <FiImage className="text-purple-600" /> Logo
                                Configuration
                              </h3>

                              <div className="flex flex-col sm:flex-row gap-6 items-start">
                                <div className="flex-1 w-full">
                                  <label
                                    htmlFor="logoUrl"
                                    className="block text-sm  text-zinc-700 mb-2"
                                  >
                                    Image URL
                                  </label>
                                  <div className="relative">
                                    <div className="absolute left-3 top-3 text-zinc-500">
                                      <FiLink />
                                    </div>
                                    <input
                                      id="logoUrl"
                                      type="url"
                                      placeholder="https://example.com/logo.png"
                                      value={formData.logo}
                                      onChange={handleImageURLChange}
                                      className={inputStyles}
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-col items-center">
                                  <label className="block text-sm  text-zinc-700 mb-2">
                                    Preview
                                  </label>
                                  <div className="w-24 h-24 bg-zinc-100 border-2 border-dashed border-zinc-300  center-flex overflow-hidden">
                                    {formData.logo ? (
                                      <img
                                        src={formData.logo}
                                        alt="Logo Preview"
                                        className="w-full h-full object-contain p-2"
                                        onError={(e) => {
                                          e.target.onerror = null;
                                          e.target.src =
                                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%23a1a1aa'%3E%3Crect width='100' height='100'/%3E%3Ctext x='50%' y='50%' font-family='sans-serif' font-size='12' fill='%23e4e4e7' text-anchor='middle' dominant-baseline='middle'%3EImage%3C/text%3E%3C/svg%3E";
                                        }}
                                      />
                                    ) : (
                                      <FiImage className="text-zinc-400 w-10 h-10" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Status Toggle */}
                            <div className="bg-white border border-x-4 border-zinc-300 p-6">
                              <h3 className="text-lg  text-zinc-800 mb-4 flex items-center gap-2">
                                <FiPower className="text-purple-600" /> Gateway
                                Status
                              </h3>

                              <div className="flex items-center gap-4">
                                <label
                                  htmlFor="isActiveToggle"
                                  className="relative inline-flex items-center cursor-pointer"
                                >
                                  <input
                                    id="isActiveToggle"
                                    type="checkbox"
                                    name="isActive"
                                    checked={formData.isActive}
                                    onChange={handleInputChange}
                                    className="sr-only peer"
                                  />
                                  <div className="w-12 h-6 bg-zinc-300 peer-focus:outline-none  peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after: after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                </label>
                                <div>
                                  <p className="text-sm  text-zinc-800">
                                    {formData.isActive ? "Active" : "Inactive"}
                                  </p>
                                  <p className="text-xs text-zinc-600">
                                    {formData.isActive
                                      ? "This gateway is currently active"
                                      : "This gateway is disabled"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 3: API Configuration (Dynamic Fields) */}
                      {currentStep === 3 && (
                        <motion.div
                          key="step3"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="h-full max-w-4xl mx-auto flex flex-col"
                        >
                          <div className="bg-white border border-x-4 border-zinc-300 p-6 h-full flex flex-col">
                            <h3 className="text-lg  text-zinc-800 mb-4 flex items-center gap-2">
                              <FiKey className="text-purple-600" /> API
                              Configuration
                            </h3>

                            <div className="flex-1 flex flex-col">
                              {/* Render preset fields */}
                              {formData.preset &&
                                Object.keys(
                                  GATEWAY_PRESETS[formData.preset].fields
                                ).map((key) => (
                                  <div key={key} className="mb-4">
                                    <label
                                      htmlFor={key}
                                      className="block text-sm  text-zinc-700 mb-2"
                                    >
                                      {key.replace(/_/g, " ")} *
                                    </label>
                                    <input
                                      id={key}
                                      type="text"
                                      name={key}
                                      value={formData.keys[key] || ""}
                                      onChange={(e) =>
                                        setFormData((prev) => ({
                                          ...prev,
                                          keys: {
                                            ...prev.keys,
                                            [key]: e.target.value,
                                          },
                                        }))
                                      }
                                      className={inputStyles}
                                      placeholder={`Enter ${key.replace(
                                        /_/g,
                                        " "
                                      )}`}
                                      required
                                    />
                                  </div>
                                ))}

                              {/* Section for adding custom keys */}
                              <div className="mt-6 border-t border-zinc-200 pt-6">
                                <h4 className="text-md  text-zinc-800 mb-3 flex items-center gap-2">
                                  <FiPlus className="text-purple-600" /> Custom
                                  Keys (Optional)
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                                  <div className="sm:col-span-2">
                                    <label
                                      htmlFor="currentKeyName"
                                      className="block text-sm  text-zinc-700 mb-2"
                                    >
                                      Key Name
                                    </label>
                                    <input
                                      id="currentKeyName"
                                      type="text"
                                      placeholder="e.g. api_key"
                                      value={currentKey}
                                      onChange={(e) =>
                                        setCurrentKey(e.target.value)
                                      }
                                      onKeyPress={handleKeyPress}
                                      className={inputStyles}
                                    />
                                  </div>
                                  <div className="sm:col-span-2">
                                    <label
                                      htmlFor="currentKeyValue"
                                      className="block text-sm  text-zinc-700 mb-2"
                                    >
                                      Key Value
                                    </label>
                                    <div className="relative">
                                      <input
                                        id="currentKeyValue"
                                        type="text"
                                        placeholder="e.g. sk_test_123..."
                                        value={currentValue}
                                        onChange={(e) =>
                                          setCurrentValue(e.target.value)
                                        }
                                        onKeyPress={handleKeyPress}
                                        className={inputStyles}
                                      />
                                    </div>
                                  </div>
                                  <div className="sm:col-span-1 flex items-end">
                                    <button
                                      type="button"
                                      onClick={handleAddKey}
                                      className="btn bg-purple-500 hover:bg-purple-600 text-white w-full h-[42px] center-flex gap-1 "
                                      disabled={!currentKey || !currentValue}
                                    >
                                      <FiPlus size={16} /> Add
                                    </button>
                                  </div>
                                </div>

                                {/* Keys List */}
                                <div className="flex-1 overflow-hidden flex flex-col mt-4">
                                  <label className="block text-sm  text-zinc-700 mb-2">
                                    Configured Keys
                                  </label>
                                  {Object.keys(formData.keys || {}).length >
                                  0 ? (
                                    <div className="border border-x-4 border-zinc-300 overflow-hidden flex-1 flex flex-col">
                                      <div className="overflow-y-auto custom-scroll flex-1">
                                        <table className="w-full text-sm">
                                          <thead className="bg-zinc-200 text-zinc-600 border-b border-zinc-300 sticky top-0">
                                            <tr>
                                              <th className="text-left py-3 px-4 ">
                                                Key
                                              </th>
                                              <th className="text-left py-3 px-4 ">
                                                Value
                                              </th>
                                              <th className="w-12"></th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {Object.entries(formData.keys).map(
                                              ([key, value]) => (
                                                <tr
                                                  key={key}
                                                  className="border-b border-zinc-200 last:border-0 hover:bg-zinc-100"
                                                >
                                                  <td className="py-3 px-4 font-mono text-purple-600 truncate max-w-xs">
                                                    {key}
                                                  </td>
                                                  <td className="py-3 px-4 font-mono text-zinc-700 truncate max-w-xs">
                                                    {value.length > 30
                                                      ? `${value.substring(
                                                          0,
                                                          15
                                                        )}...${value.substring(
                                                          value.length - 10
                                                        )}`
                                                      : value}
                                                  </td>
                                                  <td className="py-3 px-2 text-center">
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handleRemoveKey(key)
                                                      }
                                                      className="text-zinc-500 hover:text-red-600 p-1  hover:bg-red-100 transition-colors"
                                                      title="Remove key"
                                                    >
                                                      <FiTrash2 size={14} />
                                                    </button>
                                                  </td>
                                                </tr>
                                              )
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="bg-zinc-100 border border-zinc-300  p-8 text-center flex-1 center-flex flex-col">
                                      <FiKey className="mx-auto text-zinc-400 w-8 h-8 mb-2" />
                                      <p className="text-zinc-600">
                                        No API keys configured yet
                                      </p>
                                      <p className="text-zinc-500 text-sm mt-1">
                                        Add your gateway credentials above
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 4: Website Association */}
                      {currentStep === 4 && (
                        <motion.div
                          key="step4"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="h-full max-w-4xl mx-auto flex flex-col"
                        >
                          <div className="p-5">
                            <h3 className="text-xl  text-zinc-800 mb-4 text-center">
                              Select Associated Websites
                            </h3>
                            <p className="text-zinc-600 mb-6 text-center">
                              Choose which websites this gateway will be
                              associated with.
                            </p>
                            {allWebsites.length === 0 ? (
                              <div className="text-center text-zinc-600 py-10">
                                No websites available.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto custom-scroll p-2">
                                {allWebsites.map((website) => (
                                  <div
                                    key={website._id}
                                    className={`bg-zinc-100 border border-x-4 p-4 cursor-pointer transition-all relative
                                      ${
                                        selectedWebsiteIds.includes(website._id)
                                          ? "border-purple-600 bg-purple-100 shadow-lg shadow-purple-200/50"
                                          : "border-zinc-300 hover:border-purple-500 hover:bg-purple-50"
                                      }`}
                                    onClick={() =>
                                      toggleWebsiteSelection(website._id)
                                    }
                                  >
                                    {selectedWebsiteIds.includes(
                                      website._id
                                    ) && (
                                      <div className="absolute -top-2 -right-2 bg-purple-600 text-white p-1">
                                        <FiCheck size={14} />
                                      </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                      {website.logo ? (
                                        <img
                                          src={website.logo}
                                          alt={website.name}
                                          className="h-10 w-10  object-cover bg-zinc-200 border border-zinc-300"
                                          onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = `https://placehold.co/40x40/d4d4d8/27272a?text=${website.name
                                              .charAt(0)
                                              .toUpperCase()}`;
                                          }}
                                        />
                                      ) : (
                                        <div className="h-10 w-10  bg-zinc-200 border border-zinc-300 flex items-center justify-center">
                                          <FiGlobe className="text-zinc-500 text-lg" />
                                        </div>
                                      )}
                                      <div className="flex-1">
                                        <h4 className="text-zinc-800  truncate">
                                          {website.name}
                                        </h4>
                                        <p className="text-xs text-zinc-600">
                                          ID: {website.miniId}
                                        </p>
                                      </div>
                                    </div>
                                    <p className="text-xs text-zinc-600 mt-2">
                                      Lists: {website.lists?.length || 0} |
                                      Subscribers:{" "}
                                      {website.stats?.totalSubscribers || 0}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* Step 5: Review and Confirm */}
                      {currentStep === 5 && (
                        <motion.div
                          key="step5"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="h-full max-w-4xl mx-auto flex flex-col"
                        >
                          <div className="bg-white border border-x-4 border-zinc-300 p-6 flex-1 overflow-y-auto custom-scroll">
                            <h3 className="text-xl  text-zinc-800 mb-4 text-center">
                              Review Gateway Details
                            </h3>
                            <p className="text-zinc-600 mb-6 text-center">
                              Please review all the details before confirming.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* General Info */}
                              <div className="space-y-4">
                                <h4 className="text-lg  text-zinc-800 flex items-center gap-2 mb-3">
                                  <FiInfo className="text-purple-600" /> General
                                  Information
                                </h4>
                                <div className="bg-zinc-100 border border-x-4 border-zinc-200 p-4">
                                  <p className="text-sm text-zinc-600">Name:</p>
                                  <p className="text-zinc-800 ">
                                    {formData.name || "N/A"}
                                  </p>
                                </div>
                                {editingMiniId && ( // Display miniId only when editing
                                  <div className="bg-zinc-100 border border-x-4 border-zinc-200 p-4">
                                    <p className="text-sm text-zinc-600">
                                      Mini ID:
                                    </p>
                                    <p className="text-zinc-800 ">
                                      {editingMiniId || "N/A"}
                                    </p>
                                  </div>
                                )}
                                <div className="bg-zinc-100 border border-x-4 border-zinc-200 p-4">
                                  <p className="text-sm text-zinc-600">
                                    Description:
                                  </p>
                                  <p className="text-zinc-800">
                                    {formData.description || "No description"}
                                  </p>
                                </div>
                                <div className="bg-zinc-100 border border-x-4 border-zinc-200 p-4">
                                  <p className="text-sm text-zinc-600">Logo:</p>
                                  {formData.logo ? (
                                    <img
                                      src={formData.logo}
                                      alt="Logo Preview"
                                      className="w-20 h-20 object-contain p-1 border border-zinc-300  bg-zinc-200"
                                    />
                                  ) : (
                                    <p className="text-zinc-500">No logo set</p>
                                  )}
                                </div>
                                <div className="bg-zinc-100 border border-x-4 border-zinc-200 p-4">
                                  <p className="text-sm text-zinc-600">
                                    Status:
                                  </p>
                                  <span
                                    className={`px-3 py-1 text-xs   ${
                                      formData.isActive
                                        ? "bg-green-600 text-white"
                                        : "bg-red-600 text-white"
                                    }`}
                                  >
                                    {formData.isActive ? "Active" : "Inactive"}
                                  </span>
                                </div>
                              </div>

                              {/* API Keys */}
                              <div className="space-y-4">
                                <h4 className="text-lg  text-zinc-800 flex items-center gap-2 mb-3">
                                  <FiKey className="text-purple-600" /> API Keys
                                </h4>
                                {Object.keys(formData.keys).length > 0 ? (
                                  <div className="border border-x-4 border-zinc-200 overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-zinc-200 text-zinc-700">
                                        <tr>
                                          <th className="text-left py-2 px-4 ">
                                            Key
                                          </th>
                                          <th className="text-left py-2 px-4 ">
                                            Value
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {Object.entries(formData.keys).map(
                                          ([key, value]) => (
                                            <tr
                                              key={key}
                                              className="border-b border-zinc-200 last:border-0"
                                            >
                                              <td className="py-2 px-4 font-mono text-purple-600">
                                                {key}
                                              </td>
                                              <td className="py-2 px-4 font-mono text-zinc-700 break-all">
                                                {value}
                                              </td>
                                            </tr>
                                          )
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="bg-zinc-100  p-4 text-zinc-500">
                                    No API keys configured.
                                  </div>
                                )}

                                {/* Associated Websites */}
                                <h4 className="text-lg  text-zinc-800 flex items-center gap-2 mb-3 mt-6">
                                  <FiGlobe className="text-purple-600" />{" "}
                                  Associated Websites
                                </h4>
                                {formData.associatedWebsites.length > 0 ? (
                                  <div className="space-y-2">
                                    {formData.associatedWebsites.map(
                                      (websiteId) => {
                                        const website = allWebsites.find(
                                          (w) => w._id === websiteId
                                        );
                                        return website ? (
                                          <div
                                            key={website._id}
                                            className="flex items-center gap-3 p-2 border border-x-4 border-zinc-200"
                                          >
                                            {website.logo ? (
                                              <img
                                                src={website.logo}
                                                alt={website.name}
                                                className="w-8 h-8 object-cover"
                                              />
                                            ) : (
                                              <div className="w-6 h-6  bg-zinc-200 center-flex text-xs text-zinc-500">
                                                {website.name
                                                  .charAt(0)
                                                  .toUpperCase()}
                                              </div>
                                            )}
                                            <p className="text-sm text-zinc-800 ">
                                              {website.name}
                                            </p>
                                          </div>
                                        ) : null;
                                      }
                                    )}
                                  </div>
                                ) : (
                                  <div className="bg-zinc-100  p-4 text-zinc-500">
                                    No websites associated.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </form>
                )}
              </div>

              {/* Footer with action buttons */}
              <div className="px-6 py-3 bg-zinc-200 border-t border-zinc-300 sticky bottom-0">
                <div className="flex justify-between gap-4 max-w-4xl mx-auto">
                  <div>
                    {currentStep > 1 && (
                      <button
                        type="button"
                        onClick={handlePreviousStep}
                        className="btn btn-sm 2xl:btn-md btn-zinc-600 center-flex gap-2"
                        disabled={modalLoading}
                      >
                        <FiChevronLeft /> Back
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        resetForm();
                      }}
                      className="btn btn-sm 2xl:btn-md btn-primary"
                      disabled={modalLoading}
                    >
                      Cancel
                    </button>

                    {currentStep < 5 && (
                      <button
                        type="button"
                        onClick={
                          currentStep === 4
                            ? confirmWebsiteSelection
                            : handleNextStep
                        }
                        className="btn btn-sm 2xl:btn-md btn-green-600 center-flex gap-2"
                        disabled={
                          modalLoading ||
                          (currentStep === 1 && !formData.preset)
                        }
                      >
                        Continue <FiChevronRight />
                      </button>
                    )}

                    {currentStep === 5 && (
                      <button
                        type="submit"
                        onClick={handleSubmit} // Call handleSubmit on click
                        className="btn bg-purple-600 hover:bg-purple-700 text-white min-w-32 "
                        disabled={modalLoading}
                      >
                        {modalLoading ? (
                          <>
                            <ImSpinner5 className="animate-spin mr-2" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <FiSave className="mr-2" />
                            {editingMiniId
                              ? "Update Gateway"
                              : "Create Gateway"}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Delete Gateway Modal */}
        {isConfirmGatewayModalOpen && gatewayToDelete && (
          <div className="fixed inset-0 w-full h-screen bg-black/50 backdrop-blur-sm center-flex z-50 p-4">
            <div className="bg-white  border border-zinc-200 w-full max-w-md shadow-xl">
              <div className="p-5 border-b border-zinc-200">
                <h2 className="text-xl  text-primary">Confirm Deletion</h2>
              </div>
              <div className="p-5 text-zinc-700">
                Are you sure you want to delete the gateway "
                <span className=" text-zinc-900">{gatewayToDelete?.name}</span>
                "? This action cannot be undone.
              </div>
              <div className="p-5 border-t border-zinc-200 flex justify-end gap-3">
                <button
                  onClick={cancelDeleteGateway}
                  className="btn btn-sm btn-primary center-flex gap-2"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteGateway}
                  className="btn btn-sm btn-red-600 center-flex gap-2"
                >
                  <FiTrash2 />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarWrapper>
  );
};

export default Gateways;
