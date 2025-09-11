"use client";
import SidebarWrapper from "@/components/SidebarWrapper";
import React, { useCallback, useEffect, useState } from "react";
import { FiEdit, FiTrash2, FiX, FiCheck } from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { AnimatePresence, motion } from "framer-motion";
import Header from "@/components/Header";
import { EthernetPortIcon, FileCode2, Grid, List } from "lucide-react";
import { Dropdown } from "@/components/Dropdown";

const HtmlIframePreview = ({ html, height }) => {
  const iframeRef = React.useRef(null);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        // Use a simple, minimal HTML document structure for the preview
        doc.write(
          `<body style="margin: 0; padding: 10px; font-family: sans-serif; word-wrap: break-word; overflow-y: auto;">${html}</body>`
        );
        doc.close();
      }
    }
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className="border border-zinc-300 bg-white"
      style={{ width: "100%", height: `${height}px` }}
      title="HTML Preview"
      sandbox="allow-scripts allow-same-origin" // Restrict scripts for safety
    />
  );
};

const EmailTemplate = () => {
  // State for storing the list of templates
  const [templates, setTemplates] = useState([]);
  // State for the form data used in the Add/Edit modal
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    html: "",
    isActive: true,
  });
  // State to track if a template is being edited (using its _id)
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  // State for the main modal visibility
  const [isModalOpen, setIsModalOpen] = useState(false);
  // State for the delete confirmation modal visibility
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  // State to hold the template object for deletion
  const [templateToDelete, setTemplateToDelete] = useState(null);
  // State for overall page loading
  const [loading, setLoading] = useState(true);
  // State for modal-specific loading
  const [modalLoading, setModalLoading] = useState(false);
  // State to show a loading spinner on the card being deleted (using _id)
  const [deletingId, setDeletingId] = useState(null);
  // State for toast notifications
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "",
  });
  // State to manage the current step of the Add/Edit modal
  const [currentStep, setCurrentStep] = useState(1);

  // Filter and layout states
  const [viewMode, setViewMode] = useState("single"); // 'single' or 'double'
  const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'active', 'inactive'
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const showToast = useCallback((message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "" });
    }, 3000);
  }, []);

  // Function to fetch templates from the API
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/templates", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }

      const fetchedTemplates = await response.json();
      setTemplates(fetchedTemplates.data);
      showToast("Templates loaded successfully!", "success");
    } catch (error) {
      console.error("Error fetching templates:", error);
      showToast("Failed to load templates.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      subject: "",
      html: "",
      isActive: true,
    });
    setEditingTemplateId(null);
    setCurrentStep(1);
  }, []);

  const openAddEditModal = useCallback(
    (template = null) => {
      setIsModalOpen(true);
      if (template) {
        setFormData({ ...template });
        setEditingTemplateId(template._id); // Use _id for consistency with API calls
      } else {
        resetForm();
      }
    },
    [resetForm]
  );

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Function to handle form submission (POST for new, PUT for update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.subject?.trim()) {
      showToast("Name and Subject are required fields.", "error");
      return;
    }

    setModalLoading(true);
    try {
      const isEditing = !!editingTemplateId;
      const payload = {
        name: formData.name,
        subject: formData.subject,
        html: formData.html,
        isActive: formData.isActive,
      };

      const response = await fetch(
        isEditing
          ? `/api/templates?_id=${editingTemplateId}`
          : "/api/templates",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to ${isEditing ? "update" : "create"} template`
        );
      }

      // Removed the manual state update logic.
      // Instead, we will refetch all templates to ensure state is in sync with the backend.
      await fetchTemplates();

      showToast(
        `Template ${isEditing ? "updated" : "added"} successfully!`,
        "success"
      );

      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Failed to save template:", error);
      showToast("Failed to save template.", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const handleEdit = (template) => {
    openAddEditModal(template);
  };

  const handleDelete = (template) => {
    setTemplateToDelete(template);
    setIsConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    const _id = templateToDelete._id;
    setDeletingId(_id);
    setIsConfirmModalOpen(false);

    try {
      const response = await fetch(`/api/templates?_id=${_id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to delete template");
      }

      showToast("Template deleted successfully!", "success");
      // Filter out the deleted template using _id
      setTemplates((prev) => prev.filter((t) => t._id !== _id));
    } catch (error) {
      console.error("Failed to delete template:", error);
      showToast("Failed to delete template.", "error");
    } finally {
      setDeletingId(null);
      setTemplateToDelete(null);
    }
  };

  const cancelDelete = () => {
    setIsConfirmModalOpen(false);
    setTemplateToDelete(null);
  };

  const handleNextStep = async () => {
    if (currentStep === 1) {
      if (!formData.name?.trim() || !formData.subject?.trim()) {
        showToast("Name and Subject are required.", "error");
        return;
      }
    }

    if (currentStep === 2) {
      if (!formData.html?.trim()) {
        showToast("HTML content is required.", "error");
        return;
      }
    }

    setCurrentStep((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  // Filter and sorting functions
  const getFilteredAndSortedTemplates = useCallback(() => {
    let filtered = [...templates];

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((template) =>
        filterStatus === "active" ? template.isActive : !template.isActive
      );
    }

    return filtered;
  }, [templates, filterStatus]);

  // Selection handlers
  const handleSelectTemplate = (templateId) => {
    setSelectedTemplates((prev) => {
      if (prev.includes(templateId)) {
        return prev.filter((id) => id !== templateId);
      } else {
        return [...prev, templateId];
      }
    });
  };

  const handleSelectAll = () => {
    const filteredTemplates = getFilteredAndSortedTemplates();
    if (selectAll) {
      setSelectedTemplates([]);
      setSelectAll(false);
    } else {
      setSelectedTemplates(filteredTemplates.map((t) => t._id));
      setSelectAll(true);
    }
  };

  // Update selectAll state when templates change
  useEffect(() => {
    const filteredTemplates = getFilteredAndSortedTemplates();
    if (filteredTemplates.length === 0) {
      setSelectAll(false);
    } else {
      const allSelected = filteredTemplates.every((t) =>
        selectedTemplates.includes(t._id)
      );
      setSelectAll(allSelected);
    }
  }, [selectedTemplates, getFilteredAndSortedTemplates]);

  const handleBulkDelete = async () => {
    if (selectedTemplates.length === 0) return;

    if (
      confirm(
        `Are you sure you want to delete ${selectedTemplates.length} templates?`
      )
    ) {
      try {
        const response = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "bulkDelete",
            templateIds: selectedTemplates,
          }),
        });

        const result = await response.json();
        if (result.success) {
          setSelectedTemplates([]);
          setSelectAll(false);
          fetchTemplates();
          alert(`Successfully deleted ${result.deletedCount} templates`);
        }
      } catch (err) {
        alert("Error deleting templates: " + err.message);
      }
    }
  };

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

  // Template Card Component
  const TemplateCard = ({ template, isSelected, onSelect, isDeleting }) => {
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
              onClick={() => onSelect(template._id)}
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
            <div className="bg-zinc-100 border rounded-md overflow-hidden w-28 h-32 center-flex">
              <EthernetPortIcon className="text-zinc-400 w-10 h-10" />
            </div>
            <div className="flex flex-col xl:pl-4">
              <div
                className={`w-fit text-xxs px-2 py-0.5 rounded border ${
                  template.isActive
                    ? "bg-green-200 border-green-500 text-zinc-800"
                    : "bg-red-200 border-red-500 text-red-900"
                }`}
              >
                {template.isActive ? "Currently Active" : "Currently Inactive"}
              </div>
              <h2 className="text-lg text-zinc-700 font-medium mt-1 hover:underline text-left">
                {template.name}
              </h2>
              <p className="text-xs text-zinc-500 mb-2">ID: {template._id}</p>

              <Dropdown
                position="bottom"
                options={[
                  {
                    value: "edit",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        <FiEdit />
                        Edit Template
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
                        Delete Template
                      </div>
                    ),
                  },
                ]}
                placeholder="Actions Menu"
                onChange={(val) => {
                  if (val === "edit") handleEdit(template);
                  if (val === "delete") handleDelete(template);
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
              title="Subject"
              subLine={template.subject || "No subject provided"}
            />
            <MiniCard
              title="Status"
              subLine={template.isActive ? "Active" : "Inactive"}
            />

            <MiniCard
              title="Last Updated"
              subLine={new Date(
                template.updatedAt || template.createdAt
              ).toLocaleDateString()}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <SidebarWrapper>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`fixed top-4 right-4 p-4  shadow-lg z-50
              ${toast.type === "success" ? "bg-green-600/90" : "bg-red-600/90"}
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
        title=" Email Templates | Management"
        subtitle=" Manage your digital email templates"
        buttonText="Add Email Template"
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
                  <List size={16} />
                </button>
                <button
                  onClick={() => setViewMode("double")}
                  className={`p-2 text-sm transition-all rounded-full ${
                    viewMode === "double"
                      ? "bg-white text-primary"
                      : "text-zinc-600 hover:text-zinc-800"
                  }`}
                >
                  <Grid size={16} />
                </button>
              </div>
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
                    selectedTemplates.length > 0
                      ? "bg-primary border-primary"
                      : "border-zinc-300 hover:border-primary"
                  }`}
              >
                {selectedTemplates.length > 0 && (
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
              {selectedTemplates.length > 0 && (
                <div className="flex items-center gap-2 pl-3 border-l border-zinc-200">
                  <span className="text-xs text-zinc-500">Actions:</span>
                  <button
                    onClick={handleBulkDelete}
                    className="btn btn-sm hover:bg-red-500 rounded hover:text-white"
                  >
                    Delete ({selectedTemplates.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Spinner for main content */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <ImSpinner5 className="w-12 h-12 animate-spin text-blue-500" />
        </div>
      ) : (
        // Display templates in a grid
        <div
          className={`grid gap-5 ${
            viewMode === "double" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {getFilteredAndSortedTemplates().map((template) => {
            const isDeleting = deletingId === template._id;
            const isSelected = selectedTemplates.includes(template._id);

            return (
              <TemplateCard
                key={template._id}
                template={template}
                isSelected={isSelected}
                onSelect={handleSelectTemplate}
                isDeleting={isDeleting}
              />
            );
          })}
        </div>
      )}

      {/* Rest of your modal code remains the same */}
      {isModalOpen && (
        <div className="fixed inset-0 w-full h-screen bg-zinc-50/95 backdrop-blur-sm z-50 overflow-y-auto font-inter">
          {/* ... (modal content remains the same) */}
        </div>
      )}

      {/* Confirm Delete Template Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 w-full h-screen bg-black/50 backdrop-blur-sm center-flex z-[70] p-4">
          <div className="bg-white border border-zinc-200  w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-5 border-b border-zinc-200">
              <h2 className="text-xl font-medium text-zinc-900">
                Confirm Deletion
              </h2>
            </div>
            <div className="p-5 text-zinc-700">
              Are you sure you want to delete the template "
              <span className="font-medium text-zinc-900">
                {templateToDelete?.name}
              </span>
              "? This action cannot be undone.
            </div>
            <div className="p-5 border-t border-zinc-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                className="btn btn-md btn-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="btn btn-md btn-red-600 center-flex gap-2"
              >
                <FiTrash2 />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarWrapper>
  );
};

export default EmailTemplate;
