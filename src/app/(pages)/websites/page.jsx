"use client";
import SidebarWrapper from "@/components/SidebarWrapper";
import React, { useEffect, useState, useCallback } from "react";
import {
  FiEdit,
  FiTrash2,
  FiCheck,
  FiX,
  FiGlobe,
  FiChevronRight,
  FiChevronLeft,
  FiSave,
  FiInfo,
  FiImage,
  FiSettings,
  FiCreditCard,
  FiGrid,
  FiList,
  FiFilter,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import Link from "next/link";
import { FaRegRectangleList } from "react-icons/fa6";
import { EthernetPort, EthernetPortIcon } from "lucide-react";
import { MdAutoGraph } from "react-icons/md";
import { AnimatePresence, motion } from "framer-motion";
import Header from "@/components/Header";
import SelectModal from "@/components/SelectModal";
import { Dropdown } from "@/components/Dropdown";

const Websites = () => {
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    logo: "", // This will store the logo URL
    sendWebhookUrl: "",
    receiveWebhookUrl: "",
    isActive: true,
    accessableServer: "", // Changed to a single string
    accessableGateway: [], // Will store IDs of selected gateways
  });

  const [editing_id, setEditing_id] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false); // Controls main Add/Edit modal
  const [isConfirmWebsiteModalOpen, setIsConfirmWebsiteModalOpen] =
    useState(false);
  const [websiteToDelete, setWebsiteToDelete] = useState(null);
  const [deletingWebsite_id, setDeletingWebsite_id] = useState(null);

  // New states for fetching related data for the modal
  const [Server, setServer] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [modalLoading, setModalLoading] = useState(false); // For loading state inside the main modal

  // States for controlling the visibility of the new SelectModals
  const [showServerSelectModal, setShowServerSelectModal] = useState(false);
  const [showGatewaysSelectModal, setShowGatewaysSelectModal] = useState(false);

  // Temporary states to hold selections within the SelectModals before confirming
  const [tempSelectedServer, setTempSelectedServer] = useState(""); // Changed to a single string
  const [tempSelectedGateways, setTempSelectedGateways] = useState([]);

  // Manages the current step in the multi-step modal
  const [currentStep, setCurrentStep] = useState(1);

  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "",
  });

  // Filter and layout states
  const [viewMode, setViewMode] = useState("single"); // 'single' or 'double'
  const [sortBy, setSortBy] = useState("newest"); // 'newest', 'oldest', 'name-asc', 'name-desc'
  const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'active', 'inactive'
  const [selectedWebsites, setSelectedWebsites] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Filter and sorting functions
  const getFilteredAndSortedWebsites = useCallback(() => {
    let filtered = [...websites];

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((website) =>
        filterStatus === "active" ? website.isActive : !website.isActive
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
  }, [websites, filterStatus, sortBy]);

  // Selection handlers
  const handleSelectWebsite = (websiteId) => {
    setSelectedWebsites((prev) => {
      if (prev.includes(websiteId)) {
        return prev.filter((id) => id !== websiteId);
      } else {
        return [...prev, websiteId];
      }
    });
  };

  const handleSelectAll = () => {
    const filteredWebsites = getFilteredAndSortedWebsites();
    if (selectAll) {
      setSelectedWebsites([]);
      setSelectAll(false);
    } else {
      setSelectedWebsites(filteredWebsites.map((w) => w._id));
      setSelectAll(true);
    }
  };

  // Update selectAll state when websites change
  useEffect(() => {
    const filteredWebsites = getFilteredAndSortedWebsites();
    if (filteredWebsites.length === 0) {
      setSelectAll(false);
    } else {
      const allSelected = filteredWebsites.every((w) =>
        selectedWebsites.includes(w._id)
      );
      setSelectAll(allSelected);
    }
  }, [selectedWebsites, getFilteredAndSortedWebsites]);

  const showToast = useCallback((message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "" });
    }, 3000);
  }, []);

  // Function to fetch websites from the API
  const fetchWebsites = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/website");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        setWebsites(result.data);
      } else {
        showToast(result.message || "Failed to load websites.", "error");
      }
    } catch (error) {
      console.error("Error fetching websites:", error);
      showToast("Failed to load websites.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Functions to fetch related data (Server, Gateways)
  const fetchServer = useCallback(async () => {
    try {
      const response = await fetch("/api/servers"); // Assuming this endpoint exists
      if (!response.ok) throw new Error("Failed to fetch Server.");
      const result = await response.json();
      if (result.success) {
        setServer(result.data);
      } else {
        showToast(result.message || "Failed to load Server.", "error");
      }
    } catch (error) {
      console.error("Error fetching Server:", error);
      showToast("Failed to load Server.", "error");
    }
  }, [showToast]);

  const fetchGateways = useCallback(async () => {
    try {
      const response = await fetch("/api/gateways"); // Assuming this endpoint exists
      if (!response.ok) throw new Error("Failed to fetch gateways.");
      const result = await response.json();
      if (result.success) {
        setGateways(result.data);
      } else {
        showToast(result.message || "Failed to load gateways.", "error");
      }
    } catch (error) {
      console.error("Error fetching gateways:", error);
      showToast("Failed to load gateways.", "error");
    }
  }, [showToast]);

  // Combined function to open the modal and fetch related data
  const openAddEditModal = useCallback(
    async (website = null) => {
      resetFormState(); // Use the new reset function
      setIsModalOpen(true);
      setModalLoading(true); // Set modal loading state

      try {
        await Promise.all([fetchServer(), fetchGateways()]);

        if (website) {
          // If editing, populate form data with existing website data
          setFormData({
            name: website.name,
            logo: website.logo,
            sendWebhookUrl: website.sendWebhookUrl,
            receiveWebhookUrl: website.receiveWebhookUrl,
            isActive: website.isActive,
            accessableServer: website.accessableServer || "", // Changed to single ID
            accessableGateway: website.accessableGateway || [],
          });
          setEditing_id(website._id);
          setCurrentStep(1); // Start at step 1 for editing
        } else {
          setCurrentStep(1); // Always start at step 1 for new additions
        }
      } catch (error) {
        console.error("Error preparing modal:", error);
        showToast("Failed to load necessary data for the form.", "error");
        setIsModalOpen(false); // Close modal if data fetching fails
      } finally {
        setModalLoading(false); // Unset modal loading state
      }
    },
    [fetchGateways, showToast]
  );

  useEffect(() => {
    fetchWebsites();
  }, [fetchWebsites]);

  // Handles changes to form input fields (excluding the multi-selects now handled by SelectModal)
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleOpenGatewaysSelect = () => {
    setTempSelectedGateways(formData.accessableGateway); // Initialize with current form data
    setShowGatewaysSelectModal(true);
  };

  const handleOpenServerSelect = () => {
    // Pass the currently selected single server ID in an array for the SelectModal
    setTempSelectedServer(
      formData.accessableServer ? [formData.accessableServer] : []
    );
    setShowServerSelectModal(true);
  };

  // Handlers for confirming selections from SelectModals
  const handleConfirmServerSelection = (selected) => {
    setFormData((prev) => ({ ...prev, accessableServer: selected[0] || "" }));
    setShowServerSelectModal(false);
    handleNextStep(); // Move to next step after selection
  };

  const handleConfirmGatewaysSelection = (selected) => {
    setFormData((prev) => ({ ...prev, accessableGateway: selected }));
    setShowGatewaysSelectModal(false);
    handleNextStep(); // Move to next step after selection
  };

  // Handlers for canceling selections from SelectModals
  const handleCancelSelectModal = (setter) => {
    setter(false);
  };

  // Handles navigation to the next step in the modal
  const handleNextStep = () => {
    let isValid = true;
    let errorMessage = "";

    switch (currentStep) {
      case 1: // Step 1: Basic Configuration
        if (!formData.name?.trim()) {
          isValid = false;
          errorMessage = "Website name is required.";
        }
        break;
      case 2: // Step 2: Server Association
        // Optional: Add validation if a server is required
        break;
      case 3: // Step 3: Gateway Association
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

  // Handles form submission for both adding and editing websites
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission
    setModalLoading(true); // Show loading during submission

    // Final validation before submission
    if (currentStep === 4) {
      if (!formData.name?.trim()) {
        showToast("Website name is required.", "error");
        setModalLoading(false);
        return;
      }
    }

    try {
      let response;
      if (editing_id) {
        // Update existing website
        response = await fetch("/api/website", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ _id: editing_id, ...formData }),
        });
      } else {
        // Create new website
        response = await fetch("/api/website", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "An unexpected error occurred.");
      }

      if (result.success) {
        showToast(
          editing_id
            ? "Website updated successfully!"
            : "New website added successfully!",
          "success"
        );
        setIsModalOpen(false); // Close modal on success
        resetFormState(); // Reset form
        fetchWebsites(); // Re-fetch websites to update the list
      } else {
        showToast(result.message || "Failed to save website.", "error");
      }
    } catch (error) {
      console.error("Error saving website: ", error);
      showToast(
        error.message || "Failed to save website. Please try again.",
        "error"
      );
    } finally {
      setModalLoading(false); // Unset modal loading state
    }
  };

  // Modified handleEdit to use the new openAddEditModal
  const handleEdit = (website) => {
    openAddEditModal(website);
  };

  const handleDelete = (website) => {
    setWebsiteToDelete(website);
    setIsConfirmWebsiteModalOpen(true);
  };

  const confirmDeleteWebsite = async () => {
    if (!websiteToDelete) return;
    const { _id } = websiteToDelete;
    setDeletingWebsite_id(_id);
    setIsConfirmWebsiteModalOpen(false);

    try {
      const response = await fetch(`/api/website?_id=${_id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "An unexpected error occurred during deletion."
        );
      }

      if (result.success) {
        showToast(
          "Website and all associated data deleted successfully!",
          "success"
        );
        fetchWebsites();
      } else {
        showToast(result.message || "Failed to delete website.", "error");
      }
    } catch (error) {
      console.error("Error deleting website:", error);
      showToast(`Failed to delete website: ${error.message}`, "error");
    } finally {
      setDeletingWebsite_id(null);
      setWebsiteToDelete(null);
    }
  };

  const cancelDeleteWebsite = () => {
    setIsConfirmWebsiteModalOpen(false);
    setWebsiteToDelete(null);
  };

  // Renamed from resetForm to avoid conflict with openAddEditModal's use
  const resetFormState = () => {
    setFormData({
      name: "",
      logo: "",
      sendWebhookUrl: "",
      receiveWebhookUrl: "",
      isActive: true,
      accessableServer: "", // Changed to single string
      accessableGateway: [],
    });
    setEditing_id(null);
    setTempSelectedServer(""); // Reset single server temp state
    setTempSelectedGateways([]);
    setCurrentStep(1);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const labelStyles = (type) => {
    const baseStyles = "font-semibold text-zinc-500 uppercase tracking-wider";
    return type === "mini"
      ? `text-[0.6rem] ${baseStyles}`
      : `text-xs ${baseStyles}`;
  };

  let inputStyles =
    "w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary  px-4 py-2.5 text-zinc-800 outline-none placeholder-zinc-500";

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
          title="Websites Management"
          subtitle=" Manage your connected websites and their configurations"
          hideButton={true}
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
                          selectedWebsites.length > 0
                            ? "bg-primary border-primary"
                            : "border-zinc-300 hover:border-primary"
                        }`}
                >
                  {selectedWebsites.length > 0 && (
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
                {selectedWebsites.length > 0 && (
                  <div className="flex items-center gap-2 pl-3 border-l border-zinc-200">
                    <span className="text-xs text-zinc-500">Actions:</span>
                    <button
                      onClick={() => {
                        console.log("Bulk delete:", selectedWebsites);
                      }}
                      className="btn btn-sm hover:bg-red-500 rounded hover:text-white"
                    >
                      Delete ({selectedWebsites.length})
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <ImSpinner5 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : (
          <div
            className={`grid gap-5 ${
              viewMode === "double"
                ? "grid-cols-1 lg:grid-cols-2"
                : "grid-cols-1"
            }`}
          >
            {getFilteredAndSortedWebsites().map((website) => {
              const isDeleting = deletingWebsite_id === website._id;
              const isSelected = selectedWebsites.includes(website._id);

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
                  <div className="absolute top-4 right-4 z-10">
                    <div
                      onClick={() => handleSelectWebsite(website._id)}
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

                  <div
                    className={`${
                      viewMode === "double"
                        ? "flex flex-col items-start"
                        : "flex items-start xl:items-center flex-col xl:flex-row xl:justify-between"
                    } gap-6`}
                  >
                    <div className="flex flex-col xl:flex-row items-center gap-3 md:gap-5 xl:divide-x">
                      <div className="bg-zinc-100 border rounded-md overflow-hidden w-full max-w-28 h-32">
                        {website.logo ? (
                          <img
                            src={website.logo}
                            alt={`${website.name} logo`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://placehold.co/80x80/efefef/999999?text=${website.name
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
                            website.isActive
                              ? "bg-green-200 border-green-500 text-zinc-800"
                              : "bg-red-200 border-red-500 text-red-900"
                          }`}
                        >
                          {website.isActive
                            ? "Currently Active"
                            : "Currently Inactive"}
                        </div>
                        <h2 className="text-lg text-zinc-700 font-medium mt-1">
                          {website.name}
                        </h2>

                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded bg-zinc-50">
                            <div className="flex items-center gap-1">
                              <h2 className="text-xxs uppercase text-primary">
                                {website.accessableServer
                                  ? "Server"
                                  : "Not Connected"}{" "}
                                :
                              </h2>
                              <p className="text-xs text-zinc-600">{`${
                                website.accessableServer ? "Conneted" : "None"
                              }`}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded bg-zinc-50">
                            <div className="flex items-center gap-1">
                              <h2 className="text-xxs uppercase text-primary">
                                {website.stats.totalLists
                                  ? "List"
                                  : "Not Connected"}{" "}
                                :
                              </h2>
                              <p className="text-xs text-zinc-600">{`${
                                website.stats.totalLists ? "Conneted" : "None"
                              }`}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded bg-zinc-50">
                            <div className="flex items-center gap-1">
                              <h2 className="text-xxs uppercase text-primary">
                                {website.stats.totalAutomations
                                  ? "List"
                                  : "Not Connected"}{" "}
                                :
                              </h2>
                              <p className="text-xs text-zinc-600">{`${
                                website.stats.totalAutomations
                                  ? "Conneted"
                                  : "None"
                              }`}</p>
                            </div>
                          </div>
                        </div>

                        <Dropdown
                          position="bottom"
                          options={[
                            {
                              value: "lists",
                              label: (
                                <Link
                                  href={`/automations/lists?websiteId=${website._id}`}
                                  className="flex items-center gap-2 w-full"
                                >
                                  <FaRegRectangleList />
                                  View All Lists
                                </Link>
                              ),
                            },
                            {
                              value: "automations",
                              label: (
                                <Link
                                  href={`/automations?websiteId=${website._id}`}
                                  className="flex items-center gap-2 w-full"
                                >
                                  <MdAutoGraph />
                                  View All Automations
                                </Link>
                              ),
                            },
                            {
                              value: "edit",
                              label: (
                                <div className="flex items-center gap-2 w-full">
                                  <FiEdit />
                                  Edit Website
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
                                  Delete Website
                                </div>
                              ),
                            },
                          ]}
                          placeholder="Actions Menu"
                          onChange={(val) => {
                            if (val === "edit") handleEdit(website);
                            if (val === "delete") handleDelete(website);
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
                      <MiniWebsiteCard
                        title={"Last Updated"}
                        subLine={formatDate(
                          website.stats.lastActivity || website.updatedAt
                        )}
                      />
                      <MiniWebsiteCard
                        title={"Added On"}
                        subLine={formatDate(website.createdAt)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {getFilteredAndSortedWebsites().length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-zinc-100 rounded-full center-flex mb-4">
                  <FiFilter className="w-8 h-8 text-zinc-400" />
                </div>
                <h3 className="text-lg text-zinc-600 mb-2">
                  No websites found
                </h3>
                <p className="text-sm text-zinc-500 mb-4">
                  {websites.length === 0
                    ? "No websites have been created yet."
                    : "No websites match your current filters."}
                </p>
                {websites.length === 0 ? (
                  <button
                    onClick={() => openAddEditModal()}
                    className="btn btn-sm btn-primary"
                  >
                    Create Your First Website
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSortBy("newest");
                      setFilterStatus("all");
                    }}
                    className="btn btn-sm btn-second"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {isModalOpen && (
          <div className="fixed inset-0 w-full h-screen bg-white  z-50 overflow-y-auto">
            <div className="min-h-screen flex flex-col">
              <div className="w-full px-6 py-3 between-flex">
                <div>
                  <h2 className="text-xl 3xl:text-2xl  text-primary">
                    {editing_id ? "Edit Website" : "Add New Website"}{" "}
                  </h2>
                  <p className="text-sm text-zinc-600">
                    {editing_id
                      ? "Update your website configuration"
                      : "Configure a new website"}{" "}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    resetFormState(); // Use resetFormState
                  }}
                  className="text-zinc-500 hover:text-zinc-800 transition-colors p-2  hover:bg-zinc-300 border border-transparent hover:border-zinc-300"
                  aria-label="Close modal"
                >
                  <FiX size={20} className="stroke-current" />
                </button>
              </div>

              <div className="px-5 py-3 bg-zinc-200 border-y border-zinc-300 center-flex">
                <div className="flex justify-center">
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
                                                  ? "bg-primary  border-transparent text-white"
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
                {modalLoading && !editing_id ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="flex flex-col items-center">
                      <ImSpinner5 className="w-12 h-12 animate-spin text-primary mb-4" />
                      <p className="text-zinc-600">
                        Loading website details...
                      </p>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    className="max-w-4xl mx-auto h-full"
                  >
                    <AnimatePresence mode="wait">
                      {/* Step 1: Basic Configuration */}
                      {currentStep === 1 && (
                        <motion.div
                          key="step1"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="max-w-4xl mx-auto"
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
                                    htmlFor="websiteName"
                                    className={labelStyles("base")}
                                  >
                                    Website Name *
                                  </label>
                                  <input
                                    id="websiteName"
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className={inputStyles}
                                    placeholder="e.g. My Awesome Store"
                                    required
                                  />
                                </div>

                                <div>
                                  <label
                                    htmlFor="sendWebhookUrl"
                                    className={labelStyles("base")}
                                  >
                                    Send Webhook URL
                                  </label>
                                  <input
                                    id="sendWebhookUrl"
                                    type="url"
                                    name="sendWebhookUrl"
                                    value={formData.sendWebhookUrl}
                                    onChange={handleInputChange}
                                    className={inputStyles}
                                    placeholder="[https://your-app.com/send-webhook](https://your-app.com/send-webhook)"
                                  />
                                </div>

                                <div>
                                  <label
                                    htmlFor="receiveWebhookUrl"
                                    className={labelStyles("base")}
                                  >
                                    Receive Webhook URL
                                  </label>
                                  <input
                                    id="receiveWebhookUrl"
                                    type="url"
                                    name="receiveWebhookUrl"
                                    value={formData.receiveWebhookUrl}
                                    onChange={handleInputChange}
                                    className={inputStyles}
                                    placeholder="[https://your-app.com/receive-webhook](https://your-app.com/receive-webhook)"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Logo Configuration Card */}
                            <div className="bg-zinc-200 border border-zinc-300 p-6 rounded">
                              <h3 className="tracking-wide  text-zinc-800 mb-4 flex items-center gap-2">
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
                                  <div className="relative">
                                    <input
                                      id="logoUrl"
                                      type="url"
                                      name="logo"
                                      value={formData.logo}
                                      onChange={handleInputChange}
                                      className={inputStyles}
                                      placeholder="[https://example.com/logo.png](https://example.com/logo.png)"
                                    />
                                  </div>
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
                                            "data:image/svg+xml,%3Csvg xmlns='[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)' viewBox='0 0 100 100' fill='%23a1a1aa'%3E%3Crect width='100' height='100'/%3E%3Ctext x='50%' y='50%' font-family='sans-serif' font-size='12' fill='%23e4e4e7' text-anchor='middle' dominant-baseline='middle'%3EImage%3C/text%3E%3C/svg%3E";
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
                              <h3 className="tracking-wide  text-zinc-800 mb-4 flex items-center gap-2">
                                <div className="p-2 bg-primary text-white rounded">
                                  <FiSettings className="w-5 h-5" />
                                </div>
                                Website Status
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

                      {/* Step 2: Server Association */}
                      {currentStep === 2 && (
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
                              Select Accessible Server
                            </h3>
                            <p className="text-primary text-sm mb-4 bg-zinc-50 rounded py-1.5 px-2.5">
                              Choose which server this website can access.
                            </p>
                            <button
                              type="button"
                              onClick={handleOpenServerSelect}
                              className="w-full btn btn-sm xl:btn-md btn-primary center-flex gap-2"
                            >
                              Select Server ({Server?.length || 0})
                            </button>

                            {formData.accessableServer && (
                              <div className="mt-4 bg-white border border-zinc-300 rounded p-3">
                                <p className="text-sm text-zinc-800 mb-4">
                                  Currently Selected :
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <span
                                    key={formData.accessableServer}
                                    className="bg-white border border-y-2 border-zinc-200 text-zinc-700 px-3 py-2 text-sm relative"
                                  >
                                    <div className="absolute -top-2 right-1 bg-primary text-white text-xs w-4 h-4 center-flex">
                                      1
                                    </div>
                                    {Server.find(
                                      (s) => s._id === formData.accessableServer
                                    )?.name || "Unknown"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* Step 3: Gateway Association */}
                      {currentStep === 3 && (
                        <motion.div
                          key="step3"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="max-w-4xl mx-auto"
                        >
                          <div className="bg-zinc-200 border border-zinc-300 p-6 rounded">
                            <h3 className="text-lg tracking-wide  text-zinc-800 mb-4 flex items-center gap-2">
                              <div className="p-2 bg-primary text-white rounded">
                                <FiCreditCard className="w-5 h-5" />
                              </div>
                              Select Accessible Gateways
                            </h3>
                            <p className="text-primary text-sm mb-4 bg-zinc-50 rounded py-1.5 px-2.5">
                              Choose which payment gateways this website can
                              use.
                            </p>

                            <button
                              type="button"
                              onClick={handleOpenGatewaysSelect}
                              className="w-full btn btn-sm xl:btn-md btn-primary center-flex gap-2"
                            >
                              Select Gateways ({gateways?.length || 0})
                            </button>

                            {formData.accessableGateway.length > 0 && (
                              <div className="mt-4 bg-white border border-zinc-300 rounded p-3">
                                <p className="text-sm text-zinc-800 mb-4">
                                  Currently Selected :
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {formData.accessableGateway.map(
                                    (portalId, idx) => {
                                      const website = gateways.find(
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

                      {/* Step 4: Review and Confirm */}
                      {currentStep === 4 && (
                        <motion.div
                          key="step4"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="h-full max-w-4xl mx-auto flex flex-col"
                        >
                          <div className="bg-zinc-200 border border-zinc-300 p-6 rounded">
                            <h3 className="text-xl  text-zinc-800 text-center">
                              Review Website Details
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
                                {editing_id && ( // Display _id only when editing
                                  <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
                                    <p className="text-sm text-zinc-600">
                                      Mini ID:
                                    </p>
                                    <p className="text-zinc-800 ">
                                      {editing_id || "N/A"}
                                    </p>
                                  </div>
                                )}
                                <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
                                  <p className="text-sm text-zinc-600">
                                    Send Webhook URL:
                                  </p>
                                  <p className="text-zinc-800 break-all">
                                    {formData.sendWebhookUrl || "N/A"}
                                  </p>
                                </div>
                                <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
                                  <p className="text-sm text-zinc-600">
                                    Receive Webhook URL:
                                  </p>
                                  <p className="text-zinc-800 break-all">
                                    {formData.receiveWebhookUrl || "N/A"}
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
                              {/* Associations */}
                              <div className="space-y-4">
                                <h4 className="text-lg  text-zinc-800 flex items-center gap-2 mb-3">
                                  <div className="w-8 h-8 center-flex bg-primary text-white rounded">
                                    <FiGlobe />
                                  </div>
                                  Associations
                                </h4>
                                <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
                                  <p className="text-sm text-zinc-600 mb-2">
                                    Associated Server:
                                  </p>
                                  {formData.accessableServer ? (
                                    <div className="flex flex-wrap gap-2">
                                      <span className="px-3 py-1 bg-purple-200 text-purple-800 text-xs ">
                                        {Server.find(
                                          (s) =>
                                            s._id === formData.accessableServer
                                        )?.name || "Unknown"}
                                      </span>
                                    </div>
                                  ) : (
                                    <p className="text-zinc-500">None</p>
                                  )}
                                </div>
                                <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
                                  <p className="text-sm text-zinc-600 mb-2">
                                    Associated Gateways:
                                  </p>
                                  {formData.accessableGateway.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {formData.accessableGateway.map(
                                        (gatewayId) => {
                                          const gateway = gateways.find(
                                            (g) => g._id === gatewayId
                                          );
                                          return gateway ? (
                                            <span
                                              key={gatewayId}
                                              className="px-3 py-1 bg-purple-200 text-purple-800 text-xs "
                                            >
                                              {gateway.name}
                                            </span>
                                          ) : null;
                                        }
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-zinc-500">None</p>
                                  )}
                                </div>
                              </div>{" "}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </form>
                )}
              </div>

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
                        resetFormState(); // Use resetFormState
                      }}
                      className="btn btn-sm 2xl:btn-md btn-third"
                      disabled={modalLoading}
                    >
                      Cancel
                    </button>

                    {currentStep < 4 && (
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="btn btn-sm 2xl:btn-md btn-primary"
                        disabled={
                          modalLoading ||
                          (currentStep === 1 && !formData.name?.trim()) // Ensure name is not empty for step 1
                        }
                      >
                        Continue <FiChevronRight />
                      </button>
                    )}

                    {currentStep === 4 && (
                      <button
                        onClick={handleSubmit}
                        className={`btn btn-sm 2xl:btn-md  ${
                          editing_id ? "btn-update" : "btn-add"
                        } `}
                        disabled={modalLoading}
                      >
                        {modalLoading ? (
                          <>
                            <ImSpinner5 className="animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <FiSave />
                            {editing_id ? "Update Website" : "Create Website"}
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
        {/* Select Server Modal */}
        {showServerSelectModal && (
          <SelectModal
            title="Select Accessible Server"
            thresholdLimit={1}
            items={Server}
            // Pass an array with the single selected ID to the multi-select modal
            selectedItems={
              formData.accessableServer ? [formData.accessableServer] : []
            }
            // Modify onConfirm to handle single selection from a multi-select modal
            onConfirm={(selected) => {
              // Take the first item or an empty array if nothing is selected
              const singleSelection =
                selected.length > 0 ? selected.slice(0, 1) : [];
              setFormData((prev) => ({
                ...prev,
                accessableServer: singleSelection[0] || "",
              }));
              setShowServerSelectModal(false);
              handleNextStep();
            }}
            onCancel={() => handleCancelSelectModal(setShowServerSelectModal)}
            emptyMessage="No Server available. Please add some first."
          />
        )}
        {/* Select Gateways Modal */}
        {showGatewaysSelectModal && (
          <SelectModal
            title="Select Accessible Gateways"
            items={gateways}
            selectedItems={tempSelectedGateways}
            onConfirm={handleConfirmGatewaysSelection}
            onCancel={() => handleCancelSelectModal(setShowGatewaysSelectModal)}
            emptyMessage="No gateways available. Please add some first."
          />
        )}
        {/* Delete Confirmation Modal */}
        {isConfirmWebsiteModalOpen && websiteToDelete && (
          <div className="fixed inset-0 w-full h-screen bg-black/50 backdrop-blur-sm center-flex z-50 p-4">
            <div className="bg-white border border-zinc-200 w-full max-w-md shadow-xl">
              <div className="p-5 border-b border-zinc-200">
                <h2 className="text-xl  text-primary">Confirm Deletion</h2>
              </div>
              <div className="p-5 text-zinc-700 text-sm">
                <p className="mb-2">
                  Are you sure you want to delete the Website{" "}
                  <span className="">"{websiteToDelete.name}"</span>?
                </p>

                <p className="border-y border-zinc-300 py-2">
                  This Action Will Delete All Automations / Lists Connected to
                  this Website
                  <span className="">"{websiteToDelete.name}"</span>?
                </p>

                {websiteToDelete.associatedLists?.length > 0 && (
                  <div className="mt-4 bg-red-100 border border-red-300 p-4">
                    <p className="text-sm text-red-700  mb-2">
                      This will also permanently delete:
                    </p>
                    <ul className="text-sm text-red-700 space-y-1">
                      <li className="flex items-center gap-2">
                        <span>•</span>
                        <span>
                          {websiteToDelete.associatedLists.length} list(s)
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>•</span>
                        <span>
                          {websiteToDelete.associatedLists.reduce(
                            (acc, list) => acc + (list.subscriberCount || 0),
                            0
                          )}{" "}
                          subscriber(s)
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>•</span>
                        <span>All connected automations</span>
                      </li>
                    </ul>
                  </div>
                )}
                <p className="mt-4 text-sm text-zinc-600">
                  This action cannot be undone.
                </p>
              </div>
              <div className="p-5 border-t border-zinc-200 flex justify-end gap-3">
                <button
                  onClick={cancelDeleteWebsite}
                  className="btn btn-sm btn-primary center-flex gap-2"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteWebsite}
                  className="btn btn-sm btn-red-600 center-flex gap-2"
                >
                  <FiTrash2 />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}{" "}
      </div>
    </SidebarWrapper>
  );
};

export default Websites;
