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
  FiExternalLink,
  FiChevronRight,
  FiChevronLeft,
  FiSave,
  FiInfo,
  FiImage,
  FiSettings,
  FiCreditCard,
  FiLink,
  FiBook,
  FiBookOpen,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import Link from "next/link";
import { FaRegRectangleList } from "react-icons/fa6";
import { AlignLeft, EthernetPort, Podcast, Radio } from "lucide-react";
import { MdAutoGraph } from "react-icons/md";
import { AnimatePresence, motion } from "framer-motion";
import Header from "@/components/Header";

// New SelectModal component for card-based selection
const SelectModal = ({
  title,
  items,
  selectedItems, // Array of IDs of currently selected items
  onConfirm, // Callback when user confirms selection (receives new selectedItems array)
  onCancel, // Callback when user cancels
  emptyMessage = "No items available",
}) => {
  const [currentSelection, setCurrentSelection] = useState(selectedItems);

  // Update internal selection when external selectedItems prop changes (e.g., when editing a website)
  useEffect(() => {
    setCurrentSelection(selectedItems);
  }, [selectedItems]);

  // Handles clicking on an item card to toggle its selection state
  const handleItemClick = (itemId) => {
    setCurrentSelection((prevSelected) => {
      if (prevSelected.includes(itemId)) {
        // If already selected, remove it
        return prevSelected.filter((id) => id !== itemId);
      } else {
        // If not selected, add it
        return [...prevSelected, itemId];
      }
    });
  };

  return (
    <div className="fixed inset-0 w-full h-screen bg-zinc-50/95 pattern backdrop-blur-sm center-flex z-[60] p-4 font-inter">
      <div className="bg-white border border-x-4 border-zinc-300 w-full max-w-3xl h-full overflow-y-auto flex flex-col">
        <div className="px-6 py-3 flex justify-between items-center">
          <h2 className="text-xl  text-primary">{title}</h2>
          <button
            onClick={onCancel}
            className="text-zinc-500 border border-transparent hover:bg-second hover:border-zinc-300 p-2"
          >
            <FiX size={20} />
          </button>
        </div>
        <div className="p-5 flex-1 overflow-y-auto border-y-2 border-zinc-300">
          {items.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {items.map((item) => {
                const isSelected = currentSelection.includes(item._id);
                return (
                  <div
                    key={item._id}
                    className={`p-4 border border-x-4 cursor-pointer transition-all duration-200 relative
                      ${
                        isSelected
                          ? "bg-purple-50 border-primary text-purple-800"
                          : "bg-zinc-100 border-zinc-300 text-zinc-700 hover:bg-purple-50 hover:border-purple-500"
                      }`}
                    onClick={() => handleItemClick(item._id)}
                  >
                    {isSelected && (
                      <div className="absolute top-0 right-0 bg-primary text-white p-1">
                        <FiCheck size={14} />
                      </div>
                    )}
                    <h3 className=" text-lg">{item.name}</h3>
                    {item.description !== undefined && (
                      <p className="text-sm text-zinc-600 mt-1">
                        {item.description === ""
                          ? "Description Not Added"
                          : item.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-zinc-600 py-10">{emptyMessage}</p>
          )}
        </div>
        <div className="px-6 py-3 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-sm 2xl:btn-md btn-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(currentSelection)}
            className="btn btn-sm 2xl:btn-md btn-green-600 center-flex gap-2"
          >
            <FiCheck />
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
};

const Websites = () => {
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    logo: "", // This will store the logo URL
    sendWebhookUrl: "",
    receiveWebhookUrl: "",
    isActive: true,
    accessablePortal: [], // Will store IDs of selected portals
    accessableGateway: [], // Will store IDs of selected gateways
    templates: [], // Will store IDs of selected templates
    courses: [],
  });

  const steps = [
    "Basic Configuration",
    "Portal Association",
    "Gateway Association",
    "Template Association",
    "Course Association",
    "Review and Confirm",
  ];

  const [editingMiniId, setEditingMiniId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false); // Controls main Add/Edit modal
  const [isConfirmWebsiteModalOpen, setIsConfirmWebsiteModalOpen] =
    useState(false);
  const [websiteToDelete, setWebsiteToDelete] = useState(null);
  const [deletingWebsiteMiniId, setDeletingWebsiteMiniId] = useState(null);

  // New states for fetching related data for the modal
  const [portals, setPortals] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [modalLoading, setModalLoading] = useState(false); // For loading state inside the main modal

  // States for controlling the visibility of the new SelectModals
  const [showPortalsSelectModal, setShowPortalsSelectModal] = useState(false);
  const [showGatewaysSelectModal, setShowGatewaysSelectModal] = useState(false);
  const [showTemplatesSelectModal, setShowTemplatesSelectModal] =
    useState(false);

  // Temporary states to hold selections within the SelectModals before confirming
  const [tempSelectedPortals, setTempSelectedPortals] = useState([]);
  const [tempSelectedGateways, setTempSelectedGateways] = useState([]);
  const [tempSelectedTemplates, setTempSelectedTemplates] = useState([]);

  // Manages the current step in the multi-step modal
  const [currentStep, setCurrentStep] = useState(1);

  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "",
  });

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

  // Functions to fetch related data (Portals, Gateways, Templates)
  const fetchPortals = useCallback(async () => {
    try {
      const response = await fetch("/api/portals"); // Assuming this endpoint exists
      if (!response.ok) throw new Error("Failed to fetch portals.");
      const result = await response.json();
      if (result.success) {
        setPortals(result.data);
      } else {
        showToast(result.message || "Failed to load portals.", "error");
      }
    } catch (error) {
      console.error("Error fetching portals:", error);
      showToast("Failed to load portals.", "error");
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

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/templates"); // Assuming this endpoint exists
      if (!response.ok) throw new Error("Failed to fetch templates.");
      const result = await response.json();
      if (result.success) {
        setTemplates(result.data);
      } else {
        showToast(result.message || "Failed to load templates.", "error");
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      showToast("Failed to load templates.", "error");
    }
  }, [showToast]);

  // Combined function to open the modal and fetch related data
  const openAddEditModal = useCallback(
    async (website = null) => {
      resetFormState(); // Use the new reset function
      setIsModalOpen(true);
      setModalLoading(true); // Set modal loading state

      try {
        await Promise.all([fetchPortals(), fetchGateways(), fetchTemplates()]);

        if (website) {
          // If editing, populate form data with existing website data
          setFormData({
            name: website.name,
            logo: website.logo,
            sendWebhookUrl: website.sendWebhookUrl,
            receiveWebhookUrl: website.receiveWebhookUrl,
            isActive: website.isActive,
            // Extract only the IDs for multi-select fields
            accessablePortal: website.accessablePortal || [],
            accessableGateway: website.accessableGateway || [],
            templates: website.templates || [],
            courses: website.templates || [],
          });
          setEditingMiniId(website.miniId);
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
    [fetchPortals, fetchGateways, fetchTemplates, showToast]
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

  // Handlers for opening the specific SelectModals
  const handleOpenPortalsSelect = () => {
    setTempSelectedPortals(formData.accessablePortal); // Initialize with current form data
    setShowPortalsSelectModal(true);
  };

  const handleOpenGatewaysSelect = () => {
    setTempSelectedGateways(formData.accessableGateway); // Initialize with current form data
    setShowGatewaysSelectModal(true);
  };

  const handleOpenTemplatesSelect = () => {
    setTempSelectedTemplates(formData.templates); // Initialize with current form data
    setShowTemplatesSelectModal(true);
  };

  // Handlers for confirming selections from SelectModals
  const handleConfirmPortalsSelection = (selected) => {
    setFormData((prev) => ({ ...prev, accessablePortal: selected }));
    setShowPortalsSelectModal(false);
    handleNextStep(); // Move to next step after selection
  };

  const handleConfirmGatewaysSelection = (selected) => {
    setFormData((prev) => ({ ...prev, accessableGateway: selected }));
    setShowGatewaysSelectModal(false);
    handleNextStep(); // Move to next step after selection
  };

  const handleConfirmTemplatesSelection = (selected) => {
    setFormData((prev) => ({ ...prev, templates: selected }));
    setShowTemplatesSelectModal(false);
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
      case 2: // Step 2: Portal Association (no specific validation needed here, can proceed with empty selection)
        break;
      case 3: // Step 3: Gateway Association (no specific validation needed here, can proceed with empty selection)
        break;
      case 4: // Step 4: Template Association (no specific validation needed here, can proceed with empty selection)
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

    // Final validation before submission (especially for Step 5)
    if (currentStep === 5) {
      let isValid = true;
      let errorMessage = "";

      if (!formData.name?.trim()) {
        isValid = false;
        errorMessage = "Website name is required.";
      }

      if (!isValid) {
        showToast(errorMessage, "error");
        setModalLoading(false);
        return;
      }
    }

    try {
      let response;
      if (editingMiniId) {
        // Update existing website
        response = await fetch("/api/website", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ miniId: editingMiniId, ...formData }),
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
          editingMiniId
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
    const { miniId } = websiteToDelete;
    setDeletingWebsiteMiniId(miniId);
    setIsConfirmWebsiteModalOpen(false);

    try {
      const response = await fetch(`/api/website?miniId=${miniId}`, {
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
      setDeletingWebsiteMiniId(null);
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
      accessablePortal: [],
      accessableGateway: [],
      templates: [],
    });
    setEditingMiniId(null);
    setTempSelectedPortals([]);
    setTempSelectedGateways([]);
    setTempSelectedTemplates([]);
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

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
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
        <Header
          title="Websites Management"
          subtitle=" Manage your connected websites and their configurations"
          buttonText="Add Website"
          onButtonClick={openAddEditModal}
        />
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <ImSpinner5 className="w-12 h-12 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-5">
            {websites.map((website) => {
              const isDeleting = deletingWebsiteMiniId === website.miniId;
              const totalSubscribers =
                website.stats?.totalSubscribers !== undefined
                  ? website.stats.totalSubscribers
                  : website.lists?.reduce(
                      (acc, list) => acc + (list.subscriberCount || 0),
                      0
                    ) || 0;

              const totalAutomations =
                website.stats?.totalAutomations !== undefined
                  ? website.stats.totalAutomations
                  : website.automations?.length || 0;

              const totalLists =
                website.stats?.totalLists !== undefined
                  ? website.stats.totalLists
                  : website.lists?.length || 0;

              return (
                <div
                  key={website.miniId}
                  className="bg-zinc-100 border border-x-4 border-zinc-300 hover:border-zinc-400 transition-all hover:shadow-md overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-3 border-b border-zinc-300 flex items-center gap-3">
                    <div className="h-12 min-w-12 max-w-32 overflow-hidden bg-zinc-700/50 border border-zinc-600/50 flex items-center justify-center">
                      {website.logo ? (
                        <img
                          src={website.logo}
                          alt={website.name}
                          className="h-full w-full object-conver"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `[https://placehold.co/48x48/334155/E2E8F0?text=$](https://placehold.co/48x48/334155/E2E8F0?text=$){website.name
                              .charAt(0)
                              .toUpperCase()}`;
                          }}
                        />
                      ) : (
                        <div className="h-12 w-12 bg-zinc-700/50 border border-zinc-600/50 flex items-center justify-center">
                          <FiGlobe className="text-zinc-400 text-xl" />
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-zinc-700  truncate">
                        {website.name}
                      </h3>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        ID: {website.miniId}
                      </p>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3 space-y-2">
                    <div className=" space-y-1 border border-y-2 border-zinc-300 p-2">
                      <p className="text-xs text-zinc-600 uppercase">
                        Send Webhook :
                      </p>
                      {website.sendWebhookUrl ? (
                        <a
                          href={website.sendWebhookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-500 underline truncate flex items-center gap-1"
                        >
                          {website.sendWebhookUrl}
                          <FiExternalLink className="text-xs" />
                        </a>
                      ) : (
                        <p className="text-xs text-zinc-500">Not configured</p>
                      )}
                    </div>
                    <div className="space-y-1 border border-y-2 border-zinc-300 p-2">
                      <p className="text-xs text-zinc-600 uppercase">
                        Receive Webhook :
                      </p>
                      {website.receiveWebhookUrl ? (
                        <a
                          href={website.receiveWebhookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-500 underline truncate flex items-center gap-1"
                        >
                          {website.receiveWebhookUrl}
                          <FiExternalLink className="text-xs" />
                        </a>
                      ) : (
                        <p className="text-xs text-zinc-500">Not configured</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2 style-second-xs border border-zinc-400 flex items-start gap-2">
                        <div className="p-1.5 bg-zinc-400 ">
                          <AlignLeft className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-600">Lists</p>
                          <p className="text-sm  text-zinc-700">
                            {formatNumber(totalLists)}
                          </p>
                        </div>
                      </div>

                      <div className="p-2 style-primary-xs border border-zinc-400 flex items-start gap-2">
                        <div className="p-1.5 bg-zinc-400 ">
                          <MdAutoGraph className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-600">Gateways</p>
                          <p className="text-sm  text-zinc-700">
                            {website.accessableGateway?.length || 0}
                          </p>
                        </div>
                      </div>
                      <div className="p-2 style-primary-xs border border-zinc-400 flex items-start gap-2">
                        <div className="p-1.5 bg-zinc-400 ">
                          <MdAutoGraph className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-600">Automations</p>
                          <p className="text-sm  text-zinc-700">
                            {formatNumber(totalAutomations)}
                          </p>
                        </div>
                      </div>
                      <div className="p-2 style-second-xs border border-zinc-400 flex items-start gap-2">
                        <div className="p-1.5 bg-zinc-400 ">
                          <EthernetPort className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-600">Portals</p>
                          <p className="text-xs  text-zinc-700">
                            {website.accessablePortal?.length || 0}
                          </p>
                        </div>
                      </div>
                      <div className="p-2 style-primary-xs border border-zinc-400 flex items-start gap-2">
                        <div className="p-1.5 bg-zinc-400 ">
                          <Podcast className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-600">Subscribers</p>
                          <p className="text-sm  text-zinc-700">
                            {formatNumber(totalSubscribers)}
                          </p>
                        </div>
                      </div>
                      <div className="p-2 style-second-xs border border-zinc-400 flex items-start gap-2">
                        <div className="p-1.5 bg-zinc-400 ">
                          <FiBook className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-600">Templates</p>
                          <p className="text-xs  text-zinc-700">
                            {website.templates?.length || 0}
                          </p>
                        </div>
                      </div>
                      <div className="p-2 style-second-xs border border-zinc-400 flex items-start gap-2">
                        <div className="p-1.5 bg-zinc-400 ">
                          <FiBookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-600">Courses</p>
                          <p className="text-xs  text-zinc-700">
                            {website.courses?.length || 0}
                          </p>
                        </div>
                      </div>
                      <div className="p-2 style-second-xs border border-zinc-400 flex items-center gap-2">
                        <div className="p-1.5 bg-zinc-400 ">
                          <Radio className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-600">Last Activity</p>
                          <p className="text-xs  text-zinc-700">
                            {formatDate(
                              website.stats?.lastActivity || website.createdAt
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="between-flex">
                      <span className="text-xs text-zinc-500">Status:</span>
                      <span
                        className={`px-2 py-1 text-xs  style-second-xs ${
                          website.isActive
                            ? "bg-green-800/50 text-white border border-green-700/50"
                            : "bg-red-800/50 text-white border border-red-700/50"
                        }`}
                      >
                        {website.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-3 bg-zinc-750/50 border-t border-zinc-700/50 flex justify-between gap-2">
                    <div className="flex gap-1">
                      <Link
                        href={`/lists?websiteId=${website._id}`}
                        className="btn btn-xs btn-purple-600"
                        title="View All Lists"
                      >
                        <FaRegRectangleList />
                      </Link>
                      <Link
                        href={`/automations?websiteId=${website._id}`}
                        className="btn btn-xs btn-zinc-600"
                        title="View All Automations"
                      >
                        <MdAutoGraph />
                      </Link>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(website)}
                        className="btn btn-xs btn-green-600"
                        title="Edit Website"
                        disabled={isDeleting}
                      >
                        <FiEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(website)}
                        className="btn btn-xs btn-red-600"
                        title="Delete Website"
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
                </div>
              );
            })}
          </div>
        )}
        {isModalOpen && (
          <div className="fixed inset-0 w-full h-screen bg-zinc-50/95 pattern backdrop-blur-sm z-50 overflow-y-auto font-inter">
            <div className="min-h-screen flex flex-col">
              <div className="w-full px-6 py-3 between-flex">
                <div>
                  <h2 className="text-xl 3xl:text-2xl  text-primary">
                    {editingMiniId ? "Edit Website" : "Add New Website"}{" "}
                    {/* Changed text from Gateway to Website */}
                  </h2>
                  <p className="text-sm text-zinc-600">
                    {editingMiniId
                      ? "Update your website configuration"
                      : "Configure a new website"}{" "}
                    {/* Changed text from Gateway to Website */}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    resetFormState(); // Use resetFormState
                  }}
                  className="text-zinc-500 hover:text-zinc-800 transition-colors p-2  hover:bg-second border border-transparent hover:border-zinc-300"
                  aria-label="Close modal"
                >
                  <FiX size={20} className="stroke-current" />
                </button>
              </div>

              <div className="px-5 py-3 bg-second/80 border-y border-zinc-300 center-flex">
                <div className="flex justify-center gap-">
                  {[1, 2, 3, 4, 5, 6].map((step) => (
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
                      {step < 6 && (
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
                            <div className="bg-white border border-x-4 border-zinc-300 p-6">
                              <h3 className="text-lg  text-zinc-800 mb-4 flex items-center gap-2">
                                <div className="p-2 bg-primary text-white">
                                  <FiSettings className="w-5 h-5" />
                                </div>
                                Basic Configuration
                              </h3>

                              <div className="space-y-4">
                                <div>
                                  <label
                                    htmlFor="websiteName"
                                    className="block text-sm  text-zinc-700 mb-2"
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

                                {editingMiniId && ( // Display miniId only when editing
                                  <div>
                                    <label
                                      htmlFor="miniIdDisplay"
                                      className="block text-sm  text-zinc-700 mb-2"
                                    >
                                      Website Access ID
                                    </label>
                                    <input
                                      id="miniIdDisplay"
                                      type="text"
                                      value={editingMiniId}
                                      className="w-full bg-zinc-200 border border-zinc-300  px-4 py-3 text-zinc-600 outline-none cursor-not-allowed"
                                      disabled
                                    />
                                    <p className="text-zinc-500 text-xs mt-1">
                                      This ID is auto-generated and cannot be
                                      changed.
                                    </p>
                                  </div>
                                )}

                                <div>
                                  <label
                                    htmlFor="sendWebhookUrl"
                                    className="block text-sm  text-zinc-700 mb-2"
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
                                    className="block text-sm  text-zinc-700 mb-2"
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
                            <div className="bg-white border border-x-4 border-zinc-300 p-6">
                              <h3 className="text-lg  text-zinc-800 mb-4 flex items-center gap-2">
                                <FiSettings className="text-purple-600" />{" "}
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
                                  <div className="w-12 h-6 bg-zinc-300 peer-focus:outline-none  peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after: after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
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

                      {/* Step 2: Portal Association */}
                      {currentStep === 2 && (
                        <motion.div
                          key="step2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="max-w-4xl mx-auto"
                        >
                          <div className="bg-white border border-x-4 border-zinc-300 p-6">
                            <h3 className="text-lg  text-zinc-800 mb-4 flex items-center gap-2">
                              <div className="p-2 bg-primary text-white">
                                <EthernetPort className="w-5 h-5" />
                              </div>
                              Select Accessible Portals
                            </h3>
                            <p className="text-primary text-sm mb-4 bg-gradient-to-r from-second via-second/60 py-1 px-2">
                              Choose which portals this website can access.
                            </p>
                            <button
                              type="button"
                              onClick={handleOpenPortalsSelect}
                              className="w-full btn btn-sm 2xl:btn-md btn-primary center-flex gap-2"
                            >
                              Select Portals ({portals.length})
                            </button>
                            {formData.accessablePortal.length > 0 && (
                              <div className="mt-4 border border-t-4 border-zinc-200 p-3">
                                <p className="text-sm xl:text-base text-zinc-700 mb-4">
                                  Currently Selected :
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {formData.accessablePortal.map(
                                    (portalId, idx) => {
                                      console.log(formData);
                                      const portal = portals.find(
                                        (p) => p._id === portalId
                                      );
                                      return portal ? (
                                        <span
                                          key={portalId}
                                          className="border border-x-4 border-zinc-200 px-3 py-2 text-sm relative"
                                        >
                                          <div className="absolute -top-2 -right-2 bg-primary text-white text-xs w-4 h-4 center-flex">
                                            {idx + 1}
                                          </div>
                                          {portal.name}
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
                          <div className="bg-white border border-x-4 border-zinc-300 p-6">
                            <h3 className="text-lg  text-zinc-800 mb-4 flex items-center gap-2">
                              <div className="p-2 bg-primary text-white">
                                <FiCreditCard className="w-5 h-5" />
                              </div>
                              Select Accessible Gateways
                            </h3>
                            <p className="text-primary text-sm mb-4 bg-gradient-to-r from-second via-second/60 py-1 px-2">
                              Choose which payment gateways this website can
                              use.
                            </p>

                            <button
                              type="button"
                              onClick={handleOpenGatewaysSelect}
                              className="w-full btn btn-sm 2xl:btn-md btn-primary center-flex gap-2"
                            >
                              Select Gateways ({gateways.length})
                            </button>
                            {formData.accessableGateway.length > 0 && (
                              <div className="mt-4 border border-t-4 border-zinc-200 p-3">
                                <p className="text-sm xl:text-base text-zinc-700 mb-4">
                                  Currently Selected :
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {formData.accessableGateway.map(
                                    (gatewayId, idx) => {
                                      const gateway = gateways.find(
                                        (g) => g._id === gatewayId
                                      );
                                      return gateway ? (
                                        <span
                                          key={gatewayId}
                                          className="border border-x-4 border-zinc-200 px-3 py-2 text-sm relative"
                                        >
                                          <div className="absolute -top-2 -right-2 bg-primary text-white text-xs w-4 h-4 center-flex">
                                            {idx + 1}
                                          </div>
                                          {gateway.name}
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

                      {/* Step 4: Template Association */}
                      {currentStep === 4 && (
                        <motion.div
                          key="step4"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="max-w-4xl mx-auto"
                        >
                          <div className="bg-white border border-x-4 border-zinc-300 p-6">
                            <h3 className="text-lg  text-zinc-800 mb-4 flex items-center gap-2">
                              <div className="p-2 bg-primary text-white">
                                <FaRegRectangleList className="w-5 h-5" />
                              </div>
                              Select Associated Templates
                            </h3>
                            <p className="text-primary text-sm mb-4 bg-gradient-to-r from-second via-second/60 py-1 px-2">
                              Choose which templates are available for this
                              website.
                            </p>

                            <button
                              type="button"
                              onClick={handleOpenTemplatesSelect}
                              className="w-full btn btn-sm 2xl:btn-md btn-primary center-flex gap-2"
                            >
                              Select Templates ({templates.length})
                            </button>
                            {formData.templates.length > 0 && (
                              <div className="mt-4 border border-t-4 border-zinc-200 p-3">
                                <p className="text-sm xl:text-base text-zinc-700 mb-4">
                                  Currently Selected :
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {formData.templates.map((templateId, idx) => {
                                    const template = templates.find(
                                      (t) => t._id === templateId
                                    );
                                    return template ? (
                                      <span
                                        key={idx}
                                        className="border border-x-4 border-zinc-200 px-3 py-2 text-sm relative"
                                      >
                                        <div className="absolute -top-2 -right-2 bg-primary text-white text-xs w-4 h-4 center-flex">
                                          {idx + 1}
                                        </div>
                                        {template.name}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {currentStep === 5 && (
                        <div className="bg-white border border-x-4 border-zinc-300 p-6">
                          <h3 className="text-lg text-zinc-800 mb-4 flex items-center gap-2">
                            <div className="p-2 bg-primary text-white">
                              <FiSettings className="w-5 h-5" />
                            </div>
                            Course Configuration
                          </h3>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3 border border-y-4 border-zinc-200 p-3 h-fit">
                              <div>
                                <label
                                  htmlFor="lms_id"
                                  className="block text-sm text-zinc-700 mb-2"
                                >
                                  LMS ID *
                                </label>
                                <input
                                  id="lms_id"
                                  type="text"
                                  name="lms_id"
                                  value={formData.lms_id || ""}
                                  onChange={handleInputChange}
                                  className={inputStyles}
                                  placeholder="Enter LMS ID"
                                  required
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor="courseName"
                                  className="block text-sm text-zinc-700 mb-2"
                                >
                                  Course Name *
                                </label>
                                <input
                                  id="courseName"
                                  type="text"
                                  name="courseName"
                                  value={formData.courseName || ""}
                                  onChange={handleInputChange}
                                  className={inputStyles}
                                  placeholder="Enter Course Name"
                                  required
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (formData.lms_id && formData.courseName) {
                                    const newCourse = {
                                      lms_id: formData.lms_id,
                                      courseName: formData.courseName,
                                    };

                                    setFormData((prev) => ({
                                      ...prev,
                                      courses: [
                                        ...(prev.courses || []),
                                        newCourse,
                                      ],
                                      lms_id: "",
                                      courseName: "",
                                    }));
                                  }
                                }}
                                className="btn btn-sm 2xl:btn-md btn-primary center-flex gap-2"
                              >
                                <FiPlus /> Add Course
                              </button>
                            </div>

                            <div className="">
                              {formData.courses &&
                                formData.courses.length > 0 && (
                                  <div className="border border-l-4 border-zinc-200 p-3">
                                    <p className="text-sm xl:text-base text-zinc-700 mb-4">
                                      Added Courses:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {formData.courses.map((course, idx) => (
                                        <span
                                          key={idx}
                                          className="w-full border border-x-4 border-zinc-200 px-3 py-2 text-sm relative group flex flex-col"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFormData((prev) => ({
                                                ...prev,
                                                courses: prev.courses.filter(
                                                  (_, i) => i !== idx
                                                ),
                                              }));
                                            }}
                                            className="absolute -top-2 -left-4 bg-red-500 text-white text-xs w-4 h-4 center-flex opacity-0 group-hover:opacity-100 transition-opacity"
                                          >
                                            ×
                                          </button>
                                          <div className="absolute -top-2 -right-2 bg-primary text-white text-xs w-5 h-5 center-flex">
                                            {idx + 1}
                                          </div>
                                          <span className="text-primary">
                                            {course.courseName}
                                          </span>{" "}
                                          <span className="text-primary">
                                            {" "}
                                            {course.lms_id}
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 5: Review and Confirm */}
                      {currentStep === 6 && (
                        <motion.div
                          key="step5"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="h-full max-w-4xl mx-auto flex flex-col"
                        >
                          <div className="bg-white border border-x-4 border-zinc-300 p-6 flex-1 overflow-y-auto custom-scroll">
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
                                  <div className="w-8 h-8 center-flex bg-primary text-white">
                                    <FiInfo />
                                  </div>
                                  General Information
                                </h4>
                                <div className="bg-zinc-50 border border-y-2 border-zinc-300 p-4">
                                  <p className="text-sm text-zinc-600">Name:</p>
                                  <p className="text-zinc-800 ">
                                    {formData.name || "N/A"}
                                  </p>
                                </div>
                                {editingMiniId && ( // Display miniId only when editing
                                  <div className="bg-zinc-50 border border-y-2 border-zinc-300 p-4">
                                    <p className="text-sm text-zinc-600">
                                      Mini ID:
                                    </p>
                                    <p className="text-zinc-800 ">
                                      {editingMiniId || "N/A"}
                                    </p>
                                  </div>
                                )}
                                <div className="bg-zinc-50 border border-y-2 border-zinc-300 p-4">
                                  <p className="text-sm text-zinc-600">
                                    Send Webhook URL:
                                  </p>
                                  <p className="text-zinc-800 break-all">
                                    {formData.sendWebhookUrl || "N/A"}
                                  </p>
                                </div>
                                <div className="bg-zinc-50 border border-y-2 border-zinc-300 p-4">
                                  <p className="text-sm text-zinc-600">
                                    Receive Webhook URL:
                                  </p>
                                  <p className="text-zinc-800 break-all">
                                    {formData.receiveWebhookUrl || "N/A"}
                                  </p>
                                </div>
                                <div className="bg-zinc-50 border border-y-2 border-zinc-300 p-4">
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
                                <div className="bg-zinc-50 border border-y-2 border-zinc-300 p-4">
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
                                  <div className="w-8 h-8 center-flex bg-primary text-white">
                                    <FiGlobe />
                                  </div>
                                  Associations
                                </h4>
                                <div className="bg-zinc-50 border border-y-2 border-zinc-300 p-4">
                                  <p className="text-sm text-zinc-600 mb-2">
                                    Associated Portals:
                                  </p>
                                  {formData.accessablePortal.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {formData.accessablePortal.map(
                                        (portalId) => {
                                          const portal = portals.find(
                                            (p) => p._id === portalId
                                          );
                                          return portal ? (
                                            <span
                                              key={portalId}
                                              className="px-3 py-1 bg-purple-200 text-purple-800 text-xs "
                                            >
                                              {portal.name}
                                            </span>
                                          ) : null;
                                        }
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-zinc-500">None</p>
                                  )}
                                </div>
                                <div className="bg-zinc-50 border border-y-2 border-zinc-300 p-4">
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
                                <div className="bg-zinc-50 border border-y-2 border-zinc-300 p-4">
                                  <p className="text-sm text-zinc-600 mb-2">
                                    Associated Templates:
                                  </p>
                                  {formData.templates.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {formData.templates.map((templateId) => {
                                        const template = templates.find(
                                          (t) => t._id === templateId
                                        );
                                        return template ? (
                                          <span
                                            key={templateId}
                                            className="px-3 py-1 bg-purple-200 text-purple-800 text-xs "
                                          >
                                            {template.name}
                                          </span>
                                        ) : null;
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-zinc-500">None</p>
                                  )}
                                </div>
                                <div className="bg-zinc-50 border border-y-2 border-zinc-300 p-4">
                                  <p className="text-sm text-zinc-600 mb-2">
                                    Associated Courses:
                                  </p>
                                  {formData.courses &&
                                  formData.courses.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {formData.courses.map((course, idx) => (
                                        <span
                                          key={idx}
                                          className="px-3 py-1 bg-purple-200 text-purple-800 text-xs"
                                        >
                                          {course.courseName}
                                        </span>
                                      ))}
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
                        resetFormState(); // Use resetFormState
                      }}
                      className="btn btn-sm 2xl:btn-md btn-primary"
                      disabled={modalLoading}
                    >
                      Cancel
                    </button>

                    {currentStep < 6 && (
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="btn btn-sm 2xl:btn-md btn-green-600 center-flex gap-2"
                        disabled={
                          modalLoading ||
                          (currentStep === 1 && !formData.name?.trim()) // Ensure name is not empty for step 1
                        }
                      >
                        Continue <FiChevronRight />
                      </button>
                    )}

                    {currentStep === 6 && (
                      <button
                        onClick={handleSubmit}
                        className="btn btn-sm 2xl:btn-md btn-green-600 center-flex gap-2"
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
                            {editingMiniId
                              ? "Update Website"
                              : "Create Website"}
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
        {/* Select Portals Modal */}
        {showPortalsSelectModal && (
          <SelectModal
            title="Select Accessible Portals"
            items={portals}
            selectedItems={tempSelectedPortals}
            onConfirm={handleConfirmPortalsSelection}
            onCancel={() => handleCancelSelectModal(setShowPortalsSelectModal)}
            emptyMessage="No portals available. Please add some first."
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
        {/* Select Templates Modal */}
        {showTemplatesSelectModal && (
          <SelectModal
            title="Select Associated Templates"
            items={templates}
            selectedItems={tempSelectedTemplates}
            onConfirm={handleConfirmTemplatesSelection}
            onCancel={() =>
              handleCancelSelectModal(setShowTemplatesSelectModal)
            }
            emptyMessage="No templates available. Please add some first."
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
