// pages/page.jsx (Server Component)
"use client";
import SidebarWrapper from "@/components/SidebarWrapper";
import React, { useEffect, useState, useCallback } from "react";
import {
  FiEdit,
  FiTrash2,
  FiPlus,
  FiCheck,
  FiX,
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
  FiCopy,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { EthernetPort, EthernetPortIcon, KeyRound } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SERVER_PRESETS } from "@/presets/Presets";
import Header from "@/components/Header";
import { Dropdown } from "@/components/Dropdown";
import { inputStyles, labelStyles } from "@/presets/styles";

const Server = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true,
    keys: {},
    logo: "",
    presetId: null,
    miniId: "",
  });

  // Stores the miniId of the server being edited
  const [editingMiniId, setEditingMiniId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmServerModalOpen, setIsConfirmServerModalOpen] =
    useState(false);
  const [serverToDelete, setServerToDelete] = useState(null);
  const [deletingServerMiniId, setDeletingServerMiniId] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // States for adding custom key-value pairs
  const [currentKey, setCurrentKey] = useState("");
  const [currentValue, setCurrentValue] = useState("");

  // Filter and layout states
  const [viewMode, setViewMode] = useState("single"); // 'single' or 'double'
  const [sortBy, setSortBy] = useState("newest"); // 'newest', 'oldest', 'name-asc', 'name-desc'
  const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'active', 'inactive'
  const [selectedServers, setSelectedServers] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

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

  // Fetches all Servers from the API
  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/servers");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        setServers(result.data);
      } else {
        showToast(result.message || "Failed to load Servers.", "error");
      }
    } catch (error) {
      console.error("Error fetching Servers:", error);
      showToast("Failed to load Servers.", "error");
    } finally {
      setLoading(false);
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
      presetId: null,
      miniId: "",
    });
    setEditingMiniId(null);
    setCurrentKey("");
    setCurrentValue("");
    setCurrentStep(1); // Always reset to step 1 for new additions
  }, []);

  useEffect(() => {
    // Only initialize preset keys when:
    // 1. A preset is selected
    // 2. We're not currently editing a server (to avoid overwriting loaded data)
    // 3. The keys object is empty or doesn't have all preset fields

    if (formData.presetId && !editingMiniId) {
      const preset = SERVER_PRESETS[formData.presetId];

      if (preset && preset.fields) {
        const newKeys = {};

        // Initialize all fields from the preset with default values
        Object.entries(preset.fields).forEach(([key, field]) => {
          if (field.type === "boolean") {
            // Use preset default value or false
            newKeys[key] =
              field.value !== undefined && field.value !== ""
                ? field.value
                : false;
          } else {
            // Use preset default value or empty string
            newKeys[key] = field.value || "";
          }
        });

        // Merge with any existing custom keys (preserve custom keys when switching presets)
        const existingCustomKeys = {};
        if (formData.keys) {
          Object.keys(formData.keys).forEach((key) => {
            if (!preset.fields.hasOwnProperty(key)) {
              existingCustomKeys[key] = formData.keys[key];
            }
          });
        }

        setFormData((prev) => ({
          ...prev,
          keys: { ...newKeys, ...existingCustomKeys },
        }));
      }
    }
  }, [formData.presetId, editingMiniId]);

  // Fixed openAddEditModal function - replace the existing one in your component

  const openAddEditModal = useCallback(
    async (server = null) => {
      setIsModalOpen(true);
      setModalLoading(true);

      try {
        if (server) {
          // Get the presetId from the server
          const presetId = server.presetId;

          // Get preset fields if preset exists
          const presetFields = presetId
            ? SERVER_PRESETS[presetId]?.fields || {}
            : {};

          // Initialize keys object
          const newKeys = {};

          // First, populate all preset fields with their default values or server values
          if (presetId && presetFields) {
            Object.entries(presetFields).forEach(([key, field]) => {
              if (server.keys && server.keys.hasOwnProperty(key)) {
                // Use the existing server value
                newKeys[key] = server.keys[key];
              } else {
                // Use default value based on field type
                if (field.type === "boolean") {
                  // Use the preset's default value or false
                  newKeys[key] =
                    field.value !== undefined && field.value !== ""
                      ? field.value
                      : false;
                } else {
                  // Use preset default value or empty string
                  newKeys[key] = field.value || "";
                }
              }
            });
          }

          // Then, add any custom keys that are not part of the preset
          if (server.keys) {
            Object.keys(server.keys).forEach((key) => {
              if (!presetFields.hasOwnProperty(key)) {
                // This is a custom key not in the preset
                newKeys[key] = server.keys[key];
              }
            });
          }

          // Set the form data
          setFormData({
            name: server.name || "",
            description: server.description || "",
            isActive: server.isActive !== undefined ? server.isActive : true,
            keys: newKeys,
            logo: server.logo || "",
            presetId: presetId || null,
            miniId: server._id,
          });

          setEditingMiniId(server._id);
          setCurrentStep(2); // Start at step 2 for editing (skip preset selection)
        } else {
          resetForm();
          setCurrentStep(1); // Start at step 1 for new servers
          setEditingMiniId(null);
        }

        // Clear custom key inputs
        setCurrentKey("");
        setCurrentValue("");
      } catch (error) {
        console.error("Error preparing modal:", error);
        showToast("Failed to load server data for editing.", "error");
        setIsModalOpen(false);
      } finally {
        setModalLoading(false);
      }
    },
    [showToast, resetForm]
  );

  // Effect to fetch Servers on component mount
  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

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
      case 1: // Step 1: Server Type Selection
        if (!formData.presetId && !editingMiniId) {
          isValid = false;
          errorMessage = "Please select a server type to proceed.";
        }
        break;
      case 2: // Step 2: Basic Configuration
        if (!formData.name.trim()) {
          isValid = false;
          errorMessage = "Server name is required.";
        }
        break;
      case 3: // Step 3: API Configuration
        if (formData.presetId) {
          const presetFields = SERVER_PRESETS[formData.presetId].fields;
          // Updated validation for the new structure
          for (const key in presetFields) {
            // Check if the key is present in formData.keys and has a non-empty value
            // Handle booleans specifically.
            const value = formData.keys[key];
            if (
              (presetFields[key].type === "boolean" &&
                (value === null || value === undefined)) ||
              (presetFields[key].type !== "boolean" && !value?.trim())
            ) {
              isValid = false;
              errorMessage = `${key.replace(/_/g, " ")} is required.`;
              break;
            }
          }
        }
        if (Object.keys(formData.keys).length === 0 && !formData.presetId) {
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

  // Submits the server form (add or edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);

    // Final validation before submission (especially for Step 4)
    if (currentStep === 4) {
      let isValid = true;
      let errorMessage = "";

      if (!formData.name.trim()) {
        isValid = false;
        errorMessage = "Server name is required.";
      } else if (formData.presetId) {
        const presetFields = SERVER_PRESETS[formData.presetId].fields;
        for (const key in presetFields) {
          const value = formData.keys[key];
          if (
            (presetFields[key].type === "boolean" &&
              (value === null || value === undefined)) ||
            (presetFields[key].type !== "boolean" && !value?.trim())
          ) {
            isValid = false;
            errorMessage = `${key.replace(/_/g, " ")} is required.`;
            break;
          }
        }
      }
      if (Object.keys(formData.keys).length === 0 && !formData.presetId) {
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
      };

      let response;
      if (editingMiniId) {
        // If editing, send PUT request with miniId in the URL
        response = await fetch(`/api/servers?id=${editingMiniId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(submitData),
        });
      } else {
        // If adding, send POST request
        response = await fetch("/api/servers", {
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
            ? "Server updated successfully!"
            : "New server added successfully!",
          "success"
        );
        setIsModalOpen(false); // Close modal
        resetForm(); // Reset form data
        fetchServers(); // Refresh server list
      } else {
        showToast(result.message || "Failed to save server.", "error");
      }
    } catch (error) {
      console.error("Error saving server: ", error);
      showToast(
        error.message || "Failed to save server. Please try again.",
        "error"
      );
    } finally {
      setModalLoading(false);
    }
  };

  // Handler for editing a server (opens modal and populates data)
  const handleEdit = (server) => {
    openAddEditModal(server);
  };

  // Handler for initiating server deletion (opens confirmation modal)
  const handleDelete = (server) => {
    setServerToDelete(server);
    setIsConfirmServerModalOpen(true);
  };

  // Confirms and executes server deletion
  const confirmDeleteServer = async () => {
    if (!serverToDelete) return;
    const { _id } = serverToDelete;
    setDeletingServerMiniId(_id);
    setIsConfirmServerModalOpen(false);

    try {
      const response = await fetch(`/api/servers?id=${_id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "An unexpected error occurred during deletion."
        );
      }

      if (result.success) {
        showToast("Server deleted successfully!", "success");
        fetchServers(); // Refresh server list
      } else {
        showToast(result.message || "Failed to delete server.", "error");
      }
    } catch (error) {
      console.error("Error deleting server:", error);
      showToast(`Failed to delete server: ${error.message}`, "error");
    } finally {
      setDeletingServerMiniId(null);
      setServerToDelete(null);
    }
  };

  // Cancels server deletion
  const cancelDeleteServer = () => {
    setIsConfirmServerModalOpen(false);
    setServerToDelete(null);
  };
  // Confirms website selection in Step 4 and moves to next step
  const confirmWebsiteSelection = () => {
    setFormData((prev) => ({
      ...prev,
    }));
    handleNextStep(); // Move to Step 5
  };

  // Filter and sorting functions
  const getFilteredAndSortedServers = useCallback(() => {
    let filtered = [...servers];

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((server) =>
        filterStatus === "active" ? server.isActive : !server.isActive
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
  }, [servers, filterStatus, sortBy]);

  // Selection handlers
  const handleSelectServer = (serverId) => {
    setSelectedServers((prev) => {
      if (prev.includes(serverId)) {
        return prev.filter((id) => id !== serverId);
      } else {
        return [...prev, serverId];
      }
    });
  };

  const handleSelectAll = () => {
    const filteredServers = getFilteredAndSortedServers();
    if (selectAll) {
      setSelectedServers([]);
      setSelectAll(false);
    } else {
      setSelectedServers(filteredServers.map((s) => s._id));
      setSelectAll(true);
    }
  };

  // Update selectAll state when servers change
  useEffect(() => {
    const filteredServers = getFilteredAndSortedServers();
    if (filteredServers.length === 0) {
      setSelectAll(false);
    } else {
      const allSelected = filteredServers.every((s) =>
        selectedServers.includes(s._id)
      );
      setSelectAll(allSelected);
    }
  }, [selectedServers, getFilteredAndSortedServers]);
 

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const MiniWebsiteCard = ({ title, subLine }) => {
    return (
      <div className="w-full flex items-center gap-2" key={title}>
        <div className="w-[1px] h-full min-h-10 bg-zinc-400 rounded" />
        <div className="flex flex-col gap-1">
          <h2 className="text-sm text-primary">{title}</h2>
          <p className="text-xs text-zinc-500">{subLine}</p>
        </div>
      </div>
    );
  };

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
          title="Server Management"
          subtitle="  Manage your digital Servers and their configurations"
          buttonText="Add Mail Server"
          onButtonClick={() => openAddEditModal(null)}
        />

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
                                  selectedServers.length > 0
                                    ? "bg-primary border-primary"
                                    : "border-zinc-300 hover:border-primary"
                                }`}
                >
                  {selectedServers.length > 0 && (
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
                {selectedServers.length > 0 && (
                  <div className="flex items-center gap-2 pl-3 border-l border-zinc-200">
                    <span className="text-xs text-zinc-500">Actions:</span>
                    <button
                      onClick={() => {
                        console.log("Bulk delete:", selectedServers);
                      }}
                      className="btn btn-sm hover:bg-red-500 rounded hover:text-white"
                    >
                      Delete ({selectedServers.length})
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Server List Display */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <ImSpinner5 className="w-12 h-12 animate-spin text-blue-500" />
          </div>
        ) : (
          <div
            className={`grid gap-2 ${
              viewMode === "double"
                ? "grid-cols-1 lg:grid-cols-2"
                : "grid-cols-1"
            }`}
          >
            {getFilteredAndSortedServers().map((server, idx) => {
              const isDeleting = deletingServerMiniId === server._id;
              const isSelected = selectedServers.includes(server._id);
              return (
                <div
                key={idx}
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
                  <div className="absolute top-4 right-4 z-10">
                    <div
                      onClick={() => handleSelectServer(server._id)}
                      className={`w-6 h-6 rounded border cursor-pointer transition-all duration-200 flex items-center justify-center ${
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

                  <div
                    className={`${
                      viewMode === "double"
                        ? "flex flex-col items-start"
                        : "flex items-start xl:items-center flex-col xl:flex-row xl:justify-between"
                    } gap-6`}
                  >
                    <div className="flex flex-col xl:flex-row items-center gap-3 md:gap-5 xl:divide-x">
                      <div className="bg-zinc-100 border rounded-md overflow-hidden w-full max-w-28 h-32">
                        {server.logo ? (
                          <img
                            src={server.logo}
                            alt={`${server.name} logo`}
                            className="w-full h-full object-contain p-1"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://placehold.co/80x80/efefef/999999?text=${server.name
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
                            server.isActive
                              ? "bg-green-200 border-green-500 text-zinc-800"
                              : "bg-red-200 border-red-500 text-red-900"
                          }`}
                        >
                          {server.isActive
                            ? "Currently Active"
                            : "Currently Inactive"}
                        </div>
                        <h2 className="text-lg text-zinc-700 font-medium mt-1">
                          {server.name}
                        </h2>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded bg-zinc-50">
                            <div className="flex items-center gap-1">
                              <h2 className="text-xxs uppercase text-primary">
                                {server.presetId
                                  ? "Server Type"
                                  : "Not Connected"}{" "}
                                :
                              </h2>
                              <p className="text-xs text-zinc-600">{`${
                                server.presetId ? server.presetId : "None"
                              }`}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded bg-zinc-50">
                            <div className="flex items-center gap-1">
                              <h2 className="text-xxs uppercase text-primary">
                                {server.keys ? "Server Keys" : "Not Connected"}{" "}
                                :
                              </h2>
                              <p className="text-xs text-zinc-600">{
                                server.keys
                                  ? server.keys
                                    ? Object.keys(server.keys).length
                                    : 0
                                  : "None"
                              }</p>
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
                                  Edit Server
                                </div>
                              ),
                            },
                            {
                              value: "copy",
                              label: (
                                <div className="flex items-center gap-2 w-full">
                                  <FiCopy />
                                  Copy Server Id
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
                                  Delete Server
                                </div>
                              ),
                            },
                          ]}
                          placeholder="Actions Menu"
                          onChange={(val) => {
                            if (val === "edit") handleEdit(server);
                            if (val === "delete") handleDelete(server);
                            if (val === "copy")
                              navigator.clipboard.writeText(server._id);
                          }}
                          disabled={isDeleting}
                          className="w-48"
                        />
                      </div>
                    </div>

                    <div
                      className={`flex-1 w-full grid gap-2 ${
                        viewMode === "double"
                          ? "grid-cols-1 lg:grid-cols-3"
                          : "grid-cols-4"
                      }`}
                    >
                      <MiniWebsiteCard
                        title="Status"
                        subLine={server.isActive ? "Active" : "Inactive"}
                      />
                      <MiniWebsiteCard
                        title="Last Updated"
                        subLine={formatDate(server.updatedAt)}
                      />
                      <MiniWebsiteCard
                        title="Added On"
                        subLine={formatDate(server.createdAt)}
                      />
                    </div>
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
                    {editingMiniId ? "Edit Server" : "Add New Server"}
                  </h2>
                  <p className="text-sm text-zinc-600">
                    {editingMiniId
                      ? "Update your Server Configuration"
                      : "Configure a New Mailing Server"}
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
                  {[1, 2, 3, 4].map((step) => (
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
                      {step < 4 && (
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
                      <p className="text-zinc-600">Loading server details...</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="h-full">
                    <AnimatePresence mode="wait">
                      {/* Step 1: Choose Server Type */}
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
                              Select Server Type
                            </h3>
                            <p className="text-zinc-500 max-w-lg mx-auto">
                              Choose from our pre-configured Servers to get
                              started quickly. Each option comes with
                              recommended settings.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {Object.entries(SERVER_PRESETS).map(
                              ([key, preset]) => (
                                <button
                                  type="button"
                                  key={key}
                                  onClick={() => {
                                    // Map over the fields and create an initial keys object with empty strings
                                    const initialKeys = {};
                                    Object.keys(preset.fields).forEach(
                                      (fieldKey) => {
                                        // Set the initial value based on type
                                        const fieldType =
                                          preset.fields[fieldKey].type;
                                        initialKeys[fieldKey] =
                                          fieldType === "boolean" ? false : "";
                                      }
                                    );
                                    setFormData((prev) => ({
                                      ...prev,
                                      presetId: key,
                                      name: preset.name,
                                      logo: preset.logo || "",
                                      keys: initialKeys, // Use the new empty keys object
                                    }));
                                    setCurrentStep(2);
                                  }}
                                  className={`
            flex flex-col items-center p-6 rounded border transition-all
            duration-200 group relative
            ${
              formData.presetId === key
                ? "bg-white border-primary border-y-2"
                : "border-zinc-200 bg-white hover:border-zinc-300"
            }
          `}
                                >
                                  {/* Selected indicator */}
                                  {formData.presetId === key && (
                                    <div className="absolute -top-3 right-1 bg-primary text-white text-xs px-2 py-1 rounded uppercase tracking-wider">
                                      Selected
                                    </div>
                                  )}

                                  {/* Logo container */}
                                  <div
                                    className={`
            w-20 h-20 mb-4 flex items-center justify-center border rounded p-3
            ${
              formData.presetId === key
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
                    formData.presetId === key
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
              formData.presetId === key
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
              formData.presetId === key
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

                          {!formData.presetId && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-center pt-6"
                            >
                              <p className="text-sm text-amber-600 inline-flex items-center gap-2 justify-center">
                                <FiAlertCircle className="flex-shrink-0" />
                                Please select a server type to continue
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
                                    htmlFor="ServerName"
                                    className={labelStyles("base")}
                                  >
                                    Server Name *
                                  </label>
                                  <input
                                    id="ServerName"
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className={inputStyles}
                                    placeholder="e.g. mailGrid, mailGun"
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
                                    placeholder="Optional description for this server"
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
                                Server Status
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
                                      ? "This server is currently active"
                                      : "This server is disabled"}
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
                                  Enter your server credentials
                                </p>
                              </div>
                            </div>

                            <div className="flex-1 flex flex-col space-y-6">
                              {formData.presetId &&
                                SERVER_PRESETS[formData.presetId] && (
                                  <>
                                    {Object.entries(
                                      SERVER_PRESETS[formData.presetId].fields
                                    ).map(([key, field]) => {
                                      // Get the current value, ensuring proper type handling
                                      const currentValue =
                                        formData.keys &&
                                        formData.keys.hasOwnProperty(key)
                                          ? formData.keys[key]
                                          : field.type === "boolean"
                                          ? false
                                          : "";

                                      // Conditional rendering based on field type
                                      if (field.type === "boolean") {
                                        return (
                                          <div key={key}>
                                            <label
                                              className={labelStyles("base")}
                                            >
                                              {field.label}
                                            </label>
                                            <div className="flex items-center gap-4">
                                              <label
                                                htmlFor={key}
                                                className="relative inline-flex items-center cursor-pointer"
                                              >
                                                <input
                                                  id={key}
                                                  type="checkbox"
                                                  checked={Boolean(
                                                    currentValue
                                                  )} // Ensure it's always a boolean
                                                  onChange={(e) =>
                                                    setFormData((prev) => ({
                                                      ...prev,
                                                      keys: {
                                                        ...prev.keys,
                                                        [key]: e.target.checked,
                                                      },
                                                    }))
                                                  }
                                                  className="sr-only peer"
                                                />
                                                <div className="w-12 h-6 bg-zinc-300 peer-focus:outline-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                              </label>
                                              <div>
                                                <p className="text-sm text-zinc-800">
                                                  {Boolean(currentValue)
                                                    ? "Enabled"
                                                    : "Disabled"}
                                                </p>
                                                <p className="text-xs text-zinc-600">
                                                  {field.label} is currently{" "}
                                                  {Boolean(currentValue)
                                                    ? "enabled"
                                                    : "disabled"}
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      } else {
                                        return (
                                          <div key={key}>
                                            <label
                                              htmlFor={key}
                                              className={labelStyles("base")}
                                            >
                                              {field.label} *
                                            </label>
                                            <input
                                              id={key}
                                              type={field.type}
                                              name={key}
                                              value={currentValue || ""} // Ensure it's never undefined
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
                                              placeholder={field.label}
                                              required
                                            />
                                          </div>
                                        );
                                      }
                                    })}
                                  </>
                                )}

                              {/* Show message if no preset selected */}
                              {!formData.presetId && (
                                <div className="bg-amber-50 border border-amber-200 rounded p-4">
                                  <div className="flex items-center gap-2 text-amber-800">
                                    <FiAlertCircle className="flex-shrink-0" />
                                    <p className="text-sm">
                                      No server type selected. You can add
                                      custom API keys below.
                                    </p>
                                  </div>
                                </div>
                              )}

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
                                                    {value}
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
                                        Add your server credentials above
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 5: Review and Confirm */}
                      {currentStep === 4 && (
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
                              Review Server Details
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
                                                {typeof value === "boolean"
                                                  ? value
                                                    ? "true"
                                                    : "false"
                                                  : value}
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

                    {currentStep < 4 && (
                      <button
                        type="button"
                        onClick={
                          currentStep === 3
                            ? confirmWebsiteSelection
                            : handleNextStep
                        }
                        className="btn btn-sm 2xl:btn-md btn-primary"
                        disabled={
                          modalLoading ||
                          (currentStep === 1 &&
                            !formData.presetId &&
                            !editingMiniId)
                        }
                      >
                        Continue <FiChevronRight />
                      </button>
                    )}

                    {currentStep === 4 && (
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
                            {editingMiniId ? "Update Server" : "Create Server"}
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

        {/* Confirm Delete Server Modal */}
        {isConfirmServerModalOpen && serverToDelete && (
          <div className="fixed inset-0 w-full h-screen bg-black/50 backdrop-blur-sm center-flex z-50 p-4">
            <div className="bg-white  border border-zinc-200 w-full max-w-md shadow-xl">
              <div className="p-5 border-b border-zinc-200">
                <h2 className="text-xl  text-primary">Confirm Deletion</h2>
              </div>
              <div className="p-5 text-zinc-700">
                Are you sure you want to delete the server "
                <span className=" text-zinc-900">{serverToDelete?.name}</span>
                "? This action cannot be undone.
              </div>
              <div className="p-5 border-t border-zinc-200 flex justify-end gap-3">
                <button
                  onClick={cancelDeleteServer}
                  className="btn btn-sm btn-primary center-flex gap-2"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteServer}
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

export default Server;
