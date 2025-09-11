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
  FiList,
  FiGrid,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { EthernetPort, EthernetPortIcon, KeyRound } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { GATEWAY_PRESETS } from "@/presets/Presets";
import Header from "@/components/Header";
import SelectModal from "@/components/SelectModal";
import { Dropdown } from "@/components/Dropdown";

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

  const [showWebsitesSelectModal, setShowWebsitesSelectModal] = useState();

  // States for adding custom key-value pairs
  const [currentKey, setCurrentKey] = useState("");
  const [currentValue, setCurrentValue] = useState("");

  // Filter and layout states
  const [viewMode, setViewMode] = useState("single"); // 'single' or 'double'
  const [sortBy, setSortBy] = useState("newest"); // 'newest', 'oldest', 'name-asc', 'name-desc'
  const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'active', 'inactive'
  const [selectedGateways, setSelectedGateways] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Format date function
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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
        } else {
          // If adding a new gateway
          resetForm(); // Reset form to clear previous data
          setCurrentStep(1); // Start at step 1 for new gateways
          setEditingMiniId(null); // Reset editing state when adding new
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

  const handleConfirmWebsitesSelection = (selected) => {
    setFormData((prev) => ({ ...prev, associatedWebsites: selected }));
    setShowWebsitesSelectModal(false);
    handleNextStep(); // Move to next step after selection
  };

  const handleOpenWebsitesSelect = () => {
    setSelectedWebsiteIds(formData.associatedWebsites); // Initialize with current form data
    setShowWebsitesSelectModal(true);
  };

  // Confirms website selection in Step 4 and moves to next step
  const confirmWebsiteSelection = () => {
    setFormData((prev) => ({
      ...prev,
      associatedWebsites: selectedWebsiteIds,
    }));
    handleNextStep(); // Move to Step 5
  };

  const handleCancelSelectModal = (setter) => {
    setter(false);
  };

  const labelStyles = (type) => {
    const baseStyles = "font-semibold text-zinc-500 uppercase tracking-wider";
    return type === "mini"
      ? `text-[0.6rem] ${baseStyles}`
      : `text-xs ${baseStyles}`;
  };

  

  // Filter and sorting functions
  const getFilteredAndSortedGateways = useCallback(() => {
    let filtered = [...gateways];

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((gateway) =>
        filterStatus === "active" ? gateway.isActive : !gateway.isActive
      );
    }

    // Apply sorting
    switch (sortBy) {
      case "newest":
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case "oldest":
        filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case "name-asc":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        break;
    }

    return filtered;
  }, [gateways, filterStatus, sortBy]);

  // Selection handlers
  const handleSelectGateway = (gatewayId) => {
    setSelectedGateways((prev) => {
      if (prev.includes(gatewayId)) {
        return prev.filter((id) => id !== gatewayId);
      } else {
        return [...prev, gatewayId];
      }
    });
  };

  const handleSelectAll = () => {
    const filteredGateways = getFilteredAndSortedGateways();
    if (selectAll) {
      setSelectedGateways([]);
      setSelectAll(false);
    } else {
      setSelectedGateways(filteredGateways.map((g) => g.miniId));
      setSelectAll(true);
    }
  };

  // Update selectAll state when gateways change
  useEffect(() => {
    const filteredGateways = getFilteredAndSortedGateways();
    if (filteredGateways.length === 0) {
      setSelectAll(false);
    } else {
      const allSelected = filteredGateways.every((g) =>
        selectedGateways.includes(g.miniId)
      );
      setSelectAll(allSelected);
    }
  }, [selectedGateways, getFilteredAndSortedGateways]);

  // Mini card component
  const MiniCard = ({ title, subLine }) => {
    return (
      <div className="w-full flex items-center gap-2">
        <div className="w-[1px] h-full min-h-10 bg-zinc-400 rounded" />
        <div className="flex flex-col gap-1">
          <h2 className="text-sm text-primary">{title}</h2>
          <p className="text-xs text-zinc-500">{subLine}</p>
        </div>
      </div>
    );
  };

  // Gateway Card Component
  const GatewayCard = ({ gateway, isSelected, onSelect, isDeleting }) => {
    return (
      <div
         className={`rounded border transition-all duration-200 gap-6 p-6 relative ${
          isSelected  
            ? "bg-zinc-50 border-y-2 border-primary"
            : "bg-zinc-50 hover:border-zinc-300"
        }`}
      >
        {isSelected && (
          <div className="absolute -top-3 right-1 bg-primary text-white text-xs px-2 py-1 rounded uppercase tracking-wider transition-all">
            Selected
          </div>
        )}
        {/* Selection checkbox */}
        {onSelect && (
          <div className="absolute top-4 right-4 z-10">
            <div
              onClick={() => onSelect(gateway.miniId)}
              className={`w-6 h-6 rounded border cursor-pointer transition-all duration-200 flex items-center justify-center
                ${
                  isSelected
                    ? "bg-primary border-primary"
                    : "border-zinc-300 hover:border-primary"
                }`}
            >
              {isSelected && (
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
          </div>
        )}

        <div
          className={`${
            viewMode === "double"
              ? "flex flex-col items-start"
              : "flex items-start xl:items-center flex-col xl:flex-row xl:justify-between"
          } gap-6`}
        >
          <div className="flex flex-col xl:flex-row items-center gap-3 md:gap-5 xl:divide-x">
            <div className="bg-zinc-100 border rounded-md overflow-hidden w-full max-w-28 h-32">
              {gateway.logo ? (
                <img
                  src={gateway.logo}
                  alt={`${gateway.name} logo`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://placehold.co/80x80/efefef/999999?text=${gateway.name
                      .charAt(0)
                      .toUpperCase()}`;
                  }}
                />
              ) : (
                <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
                  <EthernetPortIcon className="text-zinc-400 w-8 h-8" />
                </div>
              )}
            </div>
            <div className="flex flex-col xl:pl-4">
              <div
                className={`w-fit text-xxs px-2 py-0.5 rounded border ${
                  gateway.isActive
                    ? "bg-green-200 border-green-500 text-zinc-800"
                    : "bg-red-200 border-red-500 text-red-900"
                }`}
              >
                {gateway.isActive ? "Currently Active" : "Currently Inactive"}
              </div>
              <h2 className="text-lg text-zinc-700 font-medium mt-1">
                {gateway.name}
              </h2>

              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded bg-zinc-50">
                  <div className="flex items-center gap-1">
                    <h2 className="text-xxs uppercase text-primary">
                      {gateway.associatedWebsites
                        ? "Associated Websites"
                        : "Not Connected"}{" "}
                      :
                    </h2>
                    <p className="text-xs text-zinc-600">{`${
                      gateway.associatedWebsites
                        ? gateway.associatedWebsites?.length || 0
                        : "None"
                    }`}</p>
                  </div>
                </div>
              </div>

              <Dropdown
                position="bottom"
                options={[
                  {
                    value: "edit",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        <FiEdit />
                        Edit Gateway
                      </div>
                    ),
                  },
                  {
                    value: "delete",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        {isDeleting ? (
                          <ImSpinner5 className="animate-spin" />
                        ) : (
                          <FiTrash2 />
                        )}
                        Delete Gateway
                      </div>
                    ),
                  },
                ]}
                placeholder="Actions Menu"
                onChange={(val) => {
                  if (val === "edit") handleEdit(gateway);
                  if (val === "delete") handleDelete(gateway);
                }}
                disabled={isDeleting}
                className="w-48"
              />
            </div>
          </div>

          <div
            className={`flex-1 w-full grid gap-3 ${
              viewMode === "double"
                ? "grid-cols-1 lg:grid-cols-3"
                : "grid-cols-4"
            }`}
          >
            <MiniCard
              title="Last Updated"
              subLine={formatDate(gateway.updatedAt)}
            />
            <MiniCard
              title="Added On"
              subLine={formatDate(gateway.createdAt)}
            />
          </div>
        </div>
      </div>
    );
  };

  let inputStyles =
    "w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary  px-4 py-2.5 text-zinc-800 outline-none placeholder-zinc-500";

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

        <Header
          title="Gateways Management"
          subtitle="  Manage your digital gateways and their configurations"
          buttonText="Add Payment Gateway"
          onButtonClick={openAddEditModal}
        />

        {/* Filter and Selection Controls */}
        <div className="w-full bg-zinc-50 border px-4 p-2 rounded mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left side - Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* View Mode Toggle */}
              <div className="center-flex gap-2">
                <div className="flex bg-zinc-200 rounded overflow-hidden p-1">
                  <button
                    onClick={() => setViewMode("single")}
                    className={`p-2 text-sm transition-all rounded-full ${
                      viewMode === "single"
                        ? "bg-white text-primary"
                        : "text-zinc-600 hover:text-zinc-800"
                    }`}
                  >
                    <FiList size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode("double")}
                    className={`p-2 text-sm transition-all rounded-full ${
                      viewMode === "double"
                        ? "bg-white text-primary"
                        : "text-zinc-600 hover:text-zinc-800"
                    }`}
                  >
                    <FiGrid size={16} />
                  </button>
                </div>
              </div>

              {/* Sort Dropdown */}
              <div className="relative">
                <Dropdown
                  options={[
                    { value: "newest", label: "Newest First" },
                    { value: "oldest", label: "Oldest First" },
                    { value: "name-asc", label: "Name A-Z" },
                    { value: "name-desc", label: "Name Z-A" },
                  ]}
                  value={sortBy}
                  onChange={setSortBy}
                  placeholder="Sort by"
                  className="w-40"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <Dropdown
                  options={[
                    { value: "all", label: "All Status" },
                    { value: "active", label: "Active Only" },
                    { value: "inactive", label: "Inactive Only" },
                  ]}
                  value={filterStatus}
                  onChange={setFilterStatus}
                  placeholder="Filter by status"
                  className="w-40"
                />
              </div>
            </div>

            {/* Right side - Selection and Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Selection Info */}
              <div className="flex items-center gap-3">
                <div
                  onClick={handleSelectAll}
                  className="text-sm text-primary cursor-pointer"
                >
                  Select All
                </div>
                <div
                  onClick={handleSelectAll}
                  className={`w-6 h-6 rounded border cursor-pointer transition-all duration-200 flex items-center justify-center
                    ${
                      selectedGateways.length > 0
                        ? "bg-primary border-primary"
                        : "border-zinc-300 hover:border-primary"
                    }`}
                >
                  {selectedGateways.length > 0 && (
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>

                {/* Bulk Actions */}
                {selectedGateways.length > 0 && (
                  <div className="flex items-center gap-2 pl-3 border-l border-zinc-200">
                    <span className="text-xs text-zinc-500">Actions:</span>
                    <button
                      onClick={() => {
                        console.log("Bulk delete:", selectedGateways);
                      }}
                      className="btn btn-sm hover:bg-red-500 rounded hover:text-white"
                    >
                      Delete ({selectedGateways.length})
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gateway List Display */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <ImSpinner5 className="w-12 h-12 animate-spin text-blue-500" />
          </div>
        ) : (
          <div
            className={`grid gap-5 ${
              viewMode === "double"
                ? "grid-cols-1 lg:grid-cols-2"
                : "grid-cols-1"
            }`}
          >
            {getFilteredAndSortedGateways().map((gateway) => {
              const isDeleting = deletingGatewayMiniId === gateway.miniId;
              const isSelected = selectedGateways.includes(gateway.miniId);

              return (
                <GatewayCard
                  key={gateway.miniId}
                  gateway={gateway}
                  isSelected={isSelected}
                  onSelect={handleSelectGateway}
                  isDeleting={isDeleting}
                />
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
                    resetForm(); // Use resetFormState
                  }}
                  className="text-zinc-500 hover:text-zinc-800 transition-colors p-2  hover:bg-zinc-300 border border-transparent hover:border-zinc-300"
                  aria-label="Close modal"
                >
                  <FiX size={20} className="stroke-current" />
                </button>
              </div>

              {/* Step Indicators */}
              <div className="px-5 py-3 bg-zinc-200 border-y border-zinc-300 center-flex">
                <div className="flex justify-center gap-">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <div
                      key={step}
                      className={`flex items-center transition-all duration-300 ${
                        currentStep === step ? "text-primary" : "text-zinc-500"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 flex items-center justify-center border rounded transition-all
                                              ${
                                                currentStep === step
                                                  ? "bg-primary border-transparent text-white"
                                                  : currentStep > step
                                                  ? "bg-green-600 border-transparent text-white"
                                                  : "  text-zinc-600 border-zinc-400 bg-zinc-100"
                                              }`}
                      >
                        {currentStep > step ? <FiCheck size={18} /> : step}
                      </div>
                      {step < 5 && (
                        <div
                          className={`h-1 w-16 transition-all duration-500 ${
                            currentStep > step
                              ? "bg-gradient-to-r from-green-600 to-primary"
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
                      <ImSpinner5 className="w-12 h-12 animate-spin text-primary mb-4" />
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
                          <div className="text-center space-y-2 mb-8">
                            <h3 className="text-2xl font-medium text-zinc-800">
                              Select Gateway Type
                            </h3>
                            <p className="text-zinc-500 max-w-lg mx-auto">
                              Choose from our pre-configured gateways to get
                              started quickly. Each option comes with
                              recommended settings.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                                      keys: { ...preset.fields },
                                    }));
                                  }}
                                  className={`
            flex flex-col items-center p-6 rounded border transition-all
            duration-200 group relative
            ${
              formData.preset === key
                ? "bg-white border-primary border-y-2"
                : "border-zinc-200 bg-white hover:border-zinc-300"
            }
          `}
                                >
                                  {/* Selected indicator */}
                                  {formData.preset === key && (
                                    <div className="absolute -top-3 right-1 bg-primary text-white text-xs px-2 py-1 rounded uppercase tracking-wider">
                                      Selected
                                    </div>
                                  )}

                                  {/* Logo container */}
                                  <div
                                    className={`
            w-20 h-20 mb-4 flex items-center justify-center border rounded p-3
            ${
              formData.preset === key
                ? "bg-zinc-100 border-zinc-300"
                : "bg-zinc-50 group-hover:bg-zinc-200"
            }
          `}
                                  >
                                    {preset.logo ? (
                                      <img
                                        src={preset.logo}
                                        alt={`${preset.name} logo`}
                                        className="max-h-full max-w-full object-contain"
                                        onError={(e) => {
                                          e.target.onerror = null;
                                          e.target.src = `https://placehold.co/64x64/zinc-200/white?text=${preset.name.charAt(
                                            0
                                          )}`;
                                        }}
                                      />
                                    ) : (
                                      <FiCreditCard
                                        size={28}
                                        className={`
                  ${
                    formData.preset === key
                      ? "text-zinc-600"
                      : "text-zinc-400 group-hover:text-zinc-500"
                  }
                `}
                                      />
                                    )}
                                  </div>

                                  <span
                                    className={`
            text-lg font-medium mb-2
            ${
              formData.preset === key
                ? "text-zinc-800"
                : "text-zinc-600 group-hover:text-zinc-600"
            }
          `}
                                  >
                                    {preset.name}
                                  </span>

                                  <span
                                    className={`
             px-3 py-1 border rounded-full
            ${
              formData.preset === key
                ? "bg-zinc-100 border-zinc-300 text-zinc-700 text-sm"
                : "bg-zinc-100 text-zinc-600 group-hover:bg-purple-100 group-hover:text-purple-700 text-xs"
            }
          `}
                                  >
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
                              className="text-center pt-6"
                            >
                              <p className="text-sm text-amber-600 inline-flex items-center gap-2 justify-center">
                                <FiAlertCircle className="flex-shrink-0" />
                                Please select a gateway type to continue
                              </p>
                            </motion.div>
                          )}
                        </motion.div>
                      )}

                      {/* Step 2: Basic Configuration */}
                      {currentStep === 2 && (
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
                            <div className="bg-zinc-200 border border-zinc-300 p-6 rounded">
                              <h3 className="text-lg tracking-wide  text-zinc-800 mb-4 flex items-center gap-2">
                                <div className="p-2 bg-primary text-white rounded">
                                  <FiSettings className="w-5 h-5" />
                                </div>
                                Basic Configuration
                              </h3>

                              <div className="space-y-4">
                                <div>
                                  <label
                                    htmlFor="gatewayName"
                                    className={labelStyles("base")}
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
                                    className={labelStyles("base")}
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
                            <div className="bg-zinc-200 border border-zinc-300 p-6 rounded">
                              <h3 className="text-lg tracking-wide  text-zinc-800 mb-4 flex items-center gap-2">
                                <div className="p-2 bg-primary text-white rounded">
                                  <FiImage className="w-5 h-5" />
                                </div>
                                Logo Configuration
                              </h3>

                              <div className="flex flex-col sm:flex-row gap-6 items-start">
                                <div className="flex-1 w-full">
                                  <label
                                    htmlFor="logoUrl"
                                    className={labelStyles("base")}
                                  >
                                    Image URL
                                  </label>

                                  <input
                                    id="logoUrl"
                                    type="url"
                                    placeholder="https://example.com/logo.png"
                                    value={formData.logo}
                                    onChange={handleImageURLChange}
                                    className={inputStyles}
                                  />
                                </div>

                                <div className="flex flex-col items-center">
                                  <label className={labelStyles("base")}>
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
                            <div className="bg-zinc-200 border border-zinc-300 p-6 rounded">
                              <h3 className="text-lg tracking-wide  text-zinc-800 mb-4 flex items-center gap-2">
                                <div className="p-2 bg-primary text-white rounded">
                                  <FiPower className="w-5 h-5" />
                                </div>
                                Gateway Status
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
                                  <div className="w-12 h-6 bg-zinc-300 peer-focus:outline-none  peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after: after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                                <div>
                                  <p className="text-sm  text-zinc-800">
                                    {formData.isActive ? "Active" : "Inactive"}
                                  </p>
                                  <p className="text-xs text-zinc-600">
                                    {formData.isActive
                                      ? "This website is currently active"
                                      : "This website is disabled"}
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
                          <div className="bg-zinc-200 border border-zinc-300 p-6 rounded">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="p-2 bg-primary text-white rounded ">
                                <FiKey className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="text-base font-medium text-zinc-800">
                                  API Configuration
                                </h3>
                                <p className="text-xs text-zinc-500">
                                  Enter your gateway credentials
                                </p>
                              </div>
                            </div>

                            <div className="flex-1 flex flex-col space-y-6">
                              {/* Preset Fields */}
                              {formData.preset &&
                                Object.keys(
                                  GATEWAY_PRESETS[formData.preset].fields
                                ).map((key) => (
                                  <div key={key}>
                                    <label
                                      htmlFor={key}
                                      className={labelStyles("base")}
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

                              {/* Custom Keys Section */}
                              <div className="pt-4 border-t border-zinc-100 space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="p-2 bg-primary text-white rounded">
                                    <FiPlus className="w-4 h-4" />
                                  </div>
                                  <h4 className="text-base font-medium text-zinc-800">
                                    Custom Keys
                                  </h4>
                                </div>
                                <p className="text-sm text-zinc-500 mb-5">
                                  Add any additional API keys or parameters
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                                  <div className="sm:col-span-2 space-y-1">
                                    <label
                                      htmlFor="currentKeyName"
                                      className={labelStyles("base")}
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
                                  <div className="sm:col-span-2 space-y-1">
                                    <label
                                      htmlFor="currentKeyValue"
                                      className={labelStyles("base")}
                                    >
                                      Key Value
                                    </label>
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
                                  <div className="sm:col-span-1 flex items-end">
                                    <button
                                      type="button"
                                      onClick={handleAddKey}
                                      className="btn btn-md border border-zinc-400 text-zinc-700 hover:bg-zinc-300 center-flex gap-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                      disabled={!currentKey || !currentValue}
                                    >
                                      <FiPlus size={16} />
                                      <span>Add</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Keys List */}
                                <div className="space-y-2">
                                  <label className={labelStyles("base")}>
                                    Configured Keys
                                  </label>
                                  {Object.keys(formData.keys || {}).length >
                                  0 ? (
                                    <div className="border border-zinc-200 rounded overflow-hidden">
                                      <div className="overflow-y-auto max-h-64">
                                        <table className="w-full text-sm">
                                          <thead className="bg-zinc-50 border-b border-zinc-200">
                                            <tr>
                                              <th className="text-left py-3 px-4 font-medium text-zinc-600">
                                                Key
                                              </th>
                                              <th className="text-left py-3 px-4 font-medium text-zinc-600">
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
                                                  className="border-b border-zinc-200 bg-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors"
                                                >
                                                  <td className="py-3 px-4 font-mono text-primary truncate max-w-xs">
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
                                                      className="text-zinc-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors"
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
                                    <div className="bg-zinc-50 border border-zinc-200 rounded-md p-6 text-center flex flex-col items-center justify-center">
                                      <FiKey className="text-zinc-400 w-8 h-8 mb-2" />
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
                          key="step2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="max-w-4xl mx-auto"
                        >
                          <div className="bg-zinc-200 border border-zinc-300 p-6 rounded">
                            <h3 className="text-lg tracking-wide  text-zinc-800 mb-4 flex items-center gap-2">
                              <div className="p-2 bg-primary text-white rounded">
                                <EthernetPort className="w-5 h-5" />
                              </div>
                              Select Associated Websites
                            </h3>
                            <p className="text-primary text-sm mb-4 bg-zinc-50 rounded py-1.5 px-2.5">
                              Choose which portals this website can access.
                            </p>
                            <button
                              type="button"
                              onClick={handleOpenWebsitesSelect}
                              className="w-full btn btn-sm xl:btn-md btn-primary center-flex gap-2"
                            >
                              Select Websites Avaliable:({allWebsites.length})
                            </button>
                            {formData.associatedWebsites.length > 0 && (
                              <div className="mt-4 bg-white border border-zinc-300 rounded p-3">
                                <p className="text-sm text-zinc-800 mb-4">
                                  Currently Selected :
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {formData.associatedWebsites.map(
                                    (portalId, idx) => {
                                      const website = allWebsites.find(
                                        (p) => p._id === portalId
                                      );
                                      return website ? (
                                        <span
                                          key={portalId}
                                          className="bg-white border border-y-2 border-zinc-200 text-zinc-700 px-3 py-2 text-sm relative"
                                        >
                                          <div className="absolute -top-2 right-1 bg-primary text-white text-xs w-4 h-4 center-flex">
                                            {idx + 1}
                                          </div>
                                          {website.name}
                                        </span>
                                      ) : null;
                                    }
                                  )}
                                </div>
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
                          <div className="bg-zinc-200 border border-zinc-300 p-6 rounded flex-1 overflow-y-auto custom-scroll">
                            <h3 className="text-xl  text-zinc-800 text-center">
                              Review Gateway Details
                            </h3>
                            <p className="text-zinc-600 mb-10 text-center">
                              Please review all the details before confirming.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* General Info */}
                              <div className="space-y-4">
                                <h4 className="text-lg  text-zinc-800 flex items-center gap-2 mb-3">
                                  <div className="w-8 h-8 center-flex bg-primary text-white rounded">
                                    <FiInfo />
                                  </div>
                                  General Information
                                </h4>
                                <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
                                  <p className="text-sm text-zinc-600">Name:</p>
                                  <p className="text-zinc-800 ">
                                    {formData.name || "N/A"}
                                  </p>
                                </div>
                                {editingMiniId && ( // Display miniId only when editing
                                  <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
                                    <p className="text-sm text-zinc-600">
                                      Mini ID:
                                    </p>
                                    <p className="text-zinc-800 ">
                                      {editingMiniId || "N/A"}
                                    </p>
                                  </div>
                                )}
                                <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
                                  <p className="text-sm text-zinc-600">
                                    Description:
                                  </p>
                                  <p className="text-zinc-800">
                                    {formData.description || "No description"}
                                  </p>
                                </div>
                                <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
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
                                <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
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
                                  <div className="w-8 h-8 center-flex bg-primary text-white rounded">
                                    <FiKey />
                                  </div>
                                  Associations & API Keys
                                </h4>
                                {Object.keys(formData.keys).length > 0 ? (
                                  <div className="bg-white border border-zinc-400 rounded overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-zinc-100 text-zinc-700">
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
                                              className="border-b border-zinc-200 last:border-0 text-xs"
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
                                  <div className="space-y-1 bg-zinc-50 border border-zinc-300 rounded p-4">
                                    <label className={labelStyles("base")}>
                                      Selected Websites
                                    </label>
                                    {formData.associatedWebsites.map(
                                      (websiteId) => {
                                        const website = allWebsites.find(
                                          (w) => w._id === websiteId
                                        );
                                        return website ? (
                                          <div
                                            key={website._id}
                                            className="flex items-center gap-3 p-2 bg-zinc-50 border border-y-2 border-zinc-200 rounded"
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
                                  <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
                                    No websites Selected as associatations.
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
                        className="btn btn-sm 2xl:btn-md btn-second"
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
                      className="btn btn-sm 2xl:btn-md btn-third"
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
                        className="btn btn-sm 2xl:btn-md btn-primary"
                        disabled={
                          modalLoading ||
                          (currentStep === 1 &&
                            !formData.preset &&
                            !editingMiniId)
                        }
                      >
                        Continue <FiChevronRight />
                      </button>
                    )}

                    {currentStep === 5 && (
                      <button
                        type="submit"
                        onClick={handleSubmit} // Call handleSubmit on click
                        className={`btn btn-sm 2xl:btn-md  ${
                          editingMiniId ? "btn-update" : "btn-add"
                        } `}
                        disabled={modalLoading}
                      >
                        {modalLoading ? (
                          <>
                            <ImSpinner5 className="animate-spin " />
                            Processing...
                          </>
                        ) : (
                          <>
                            <FiSave className="" />
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

        {showWebsitesSelectModal && (
          <SelectModal
            title="Select Associated Websites"
            items={allWebsites}
            selectedItems={selectedWebsiteIds}
            onConfirm={handleConfirmWebsitesSelection}
            onCancel={() => handleCancelSelectModal(setShowWebsitesSelectModal)}
            emptyMessage="No Websites available. Please add some first."
          />
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
