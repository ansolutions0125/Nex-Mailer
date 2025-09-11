"use client";
import { Dropdown } from "@/components/Dropdown";
import Header from "@/components/Header";
import SelectModal from "@/components/SelectModal";
import SidebarWrapper from "@/components/SidebarWrapper";
import { AnimatePresence, motion } from "framer-motion";
import { EthernetPort, EthernetPortIcon, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import React, {
  useCallback,
  useState,
  useLayoutEffect,
  useEffect,
} from "react";
import {
  FiCheck,
  FiEdit,
  FiGlobe,
  FiTrash2,
  FiX,
  FiImage,
  FiChevronRight,
  FiChevronLeft,
  FiInfo,
  FiSettings,
  FiKey,
  FiList,
  FiGrid,
  FiFilter,
  FiCopy,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";

// Constants
const STEPS = {
  BASIC_INFO: 1,
  SELECT_WEBSITE: 2,
  SELECT_LIST: 3,
  REVIEW: 4,
};

const INITIAL_FORM_DATA = {
  name: "",
  description: "",
  isActive: true,
  logo: "",
  websiteId: "",
  listId: "",
  keys: {},
};

const labelStyles = (type) => {
  const baseStyles = "font-semibold text-zinc-500 uppercase tracking-wider";
  return type === "mini"
    ? `text-[0.6rem] ${baseStyles}`
    : `text-xs ${baseStyles}`;
};

let inputStyles =
  "w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary  px-4 py-2.5 text-zinc-800 outline-none placeholder-zinc-500";

// Toast Component
const Toast = ({ message, type, show }) => {
  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={`fixed top-4 right-4 p-4 shadow-lg z-50 backdrop-blur-sm border
                  ${
                    type === "success"
                      ? "bg-green-600/90 border-green-500/30"
                      : "bg-red-600/90 border-red-500/30"
                  }`}
    >
      <div className="flex items-center gap-2 text-white">
        {type === "success" ? (
          <FiCheck className="text-lg" />
        ) : (
          <FiX className="text-lg" />
        )}
        <span>{message}</span>
      </div>
    </motion.div>
  );
};

// Step Indicator Component
const StepIndicator = ({ currentStep }) => (
  <div className="px-5 py-3 bg-zinc-200 border-y border-zinc-300 center-flex">
    <div className="flex justify-center">
      {Object.values(STEPS).map((step) => (
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
          {step < Object.values(STEPS).length && (
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
);

const AutomationCard = ({
  automation,
  websites,
  lists,
  onEdit,
  onDelete,
  onSteps,
  isSelected,
  onSelect,
  isDeleting,
  viewMode,
}) => {
  const associatedWebsite = websites.find(
    (w) => w._id === automation.websiteId
  );
  const associatedList = lists.find((l) => l._id === automation.listId);

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
            onClick={() => onSelect(automation._id)}
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
            {automation.logo ? (
              <img
                src={automation.logo}
                alt={`${automation.name} logo`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://placehold.co/80x80/efefef/999999?text=${automation.name
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
                automation.isActive
                  ? "bg-green-200 border-green-500 text-zinc-800"
                  : "bg-red-200 border-red-500 text-red-900"
              }`}
            >
              {automation.isActive ? "Currently Active" : "Currently Inactive"}
            </div>
            <button
              onClick={() => onSteps(automation)}
              className="text-lg text-zinc-700 font-medium mt-1 hover:underline text-left"
            >
              {automation.name}
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded bg-zinc-50">
                <div className="flex items-center gap-1">
                  <h2 className="text-xxs uppercase text-primary">
                    {associatedWebsite ? "Website" : "Not Connected"} :
                  </h2>
                  <p className="text-xs text-zinc-600">{`${
                    associatedWebsite ? "Conneted" : "None"
                  }`}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded bg-zinc-50">
                <div className="flex items-center gap-1">
                  <h2 className="text-xxs uppercase text-primary">
                    {associatedList ? "List" : "Not Connected"} :
                  </h2>
                  <p className="text-xs text-zinc-600">{`List: ${
                    associatedList ? "Connected" : "None"
                  }`}</p>
                </div>
              </div>
            </div>

            <Dropdown
              position="bottom"
              options={[
                {
                  value: "steps",
                  label: (
                    <div className="flex items-center gap-2 w-full">
                      <FiSettings />
                      Manage Work-Flow
                    </div>
                  ),
                },
                {
                  value: "edit",
                  label: (
                    <div className="flex items-center gap-2 w-full">
                      <FiEdit />
                      Edit Automation
                    </div>
                  ),
                },
                {
                  value: "copy",
                  label: (
                    <div className="flex items-center gap-2 w-full">
                      <FiCopy />
                      Copy Automation Id
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
                      Delete Automation
                    </div>
                  ),
                },
              ]}
              placeholder="Actions Menu"
              onChange={(val) => {
                if (val === "steps") onSteps(automation);
                if (val === "edit") onEdit(automation);
                if (val === "delete") onDelete(automation);
                if (val === "copy")
                  navigator.clipboard.writeText(automation._id);
              }}
              disabled={isDeleting}
              className="w-48"
            />
          </div>
        </div>

        <div
          className={`flex-1 w-full grid gap-3 ${
            viewMode === "double" ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-4"
          }`}
        >
          <MiniCard
            title="Total Steps"
            subLine={`Count: ${automation?.steps?.length || 0}`}
          />
          <MiniCard
            title="Last Updated"
            subLine={formatDate(automation.updatedAt)}
          />
          <MiniCard
            title="Added On"
            subLine={formatDate(automation.createdAt)}
          />
        </div>
      </div>
    </div>
  );
};

// Form Steps Components
const BasicInfoStep = ({ formData, onChange }) => (
  <motion.div
    key="step1"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
    className="space-y-6"
  >
    <h3 className="text-lg tracking-wide  text-zinc-800 mb-4 flex items-center gap-2">
      <div className="p-2 bg-primary text-white rounded">
        <EthernetPort className="w-5 h-5" />
      </div>
      Basic Configuration
    </h3>

    <div>
      <label className={labelStyles("base")}>Name</label>
      <input
        type="text"
        name="name"
        value={formData.name}
        onChange={onChange}
        className={inputStyles}
        required
        placeholder="e.g., 'New User Onboarding Flow'"
      />
    </div>

    <div>
      <label className={labelStyles("base")}>Description</label>
      <textarea
        name="description"
        value={formData.description}
        onChange={onChange}
        rows="3"
        className={inputStyles}
        placeholder="Describe what this automation does..."
      />
    </div>

    <div className="flex flex-col sm:flex-row gap-6 items-start">
      <div className="flex-1 w-full">
        <label htmlFor="logoUrl" className={labelStyles("base")}>
          Image URL
        </label>
        <input
          id="logoUrl"
          type="url"
          name="logo"
          value={formData.logo}
          onChange={onChange}
          className={inputStyles}
          placeholder="https://example.com/logo.png"
        />
      </div>
      <div className="flex flex-col items-center">
        <label className="block text-sm font-medium text-zinc-700 mb-2">
          Preview
        </label>
        <div className="w-24 h-24 bg-zinc-100 border-2 border-dashed border-zinc-300 center-flex overflow-hidden">
          {formData.logo ? (
            <img
              src={formData.logo}
              alt="Logo Preview"
              className="w-full h-full object-contain p-2"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src =
                  "https://placehold.co/40x40/E2E8F0/334155?text=Logo";
              }}
            />
          ) : (
            <FiImage className="text-zinc-400 w-10 h-10" />
          )}
        </div>
      </div>
    </div>

    <div className="bg-white border border-zinc-300 p-6 rounded">
      <h3 className="tracking-wide  text-zinc-800 mb-4 flex items-center gap-2">
        <div className="p-2 bg-primary text-white rounded">
          <FiSettings className="w-5 h-5" />
        </div>
        Automation Status
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
            onChange={onChange}
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
  </motion.div>
);

const SelectionStep = ({
  stepKey,
  selectedItem,
  onSelectionChange,
  onOpenModal,
  title,
  icon: Icon,
  noSelectionText,
}) => (
  <motion.div
    key={stepKey}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
    className="space-y-4"
  >
    <h3 className="text-lg tracking-wide  text-zinc-800 mb-4 flex items-center gap-2">
      <div className="p-2 bg-primary text-white rounded">
        <Icon className="w-5 h-5" />
      </div>
      {title}
    </h3>

    <p className="text-primary text-sm mb-4 bg-zinc-50 rounded py-1.5 px-2.5">
      Choose which portals this website can access.
    </p>
    <button
      type="button"
      onClick={onOpenModal}
      className="w-full btn btn-sm xl:btn-md btn-primary center-flex gap-2"
    >
      {title}
    </button>

    {selectedItem && (
      <div className="mt-4 bg-white border border-zinc-300 rounded p-3">
        <p className="text-sm text-zinc-800 mb-4">Currently Selected :</p>
        <div className="flex flex-wrap gap-2">
          <span className="bg-white border border-y-2 border-zinc-200 text-zinc-700 px-3 py-2 text-sm relative">
            <div className="absolute -top-2 right-1 bg-primary text-white text-xs w-4 h-4 center-flex">
              1
            </div>
            {selectedItem.name}
          </span>
        </div>
      </div>
    )}
  </motion.div>
);

const ReviewStep = ({ formData, selectedWebsite, selectedList }) => (
  <motion.div
    key="step4"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
    className="flex flex-col"
  >
    <div>
      <h3 className="text-xl text-zinc-800 text-center">
        Review Automation Details
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
            <p className="text-zinc-800 font-medium">
              {formData.name || "N/A"}
            </p>
          </div>

          <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
            <p className="text-sm text-zinc-600">Description:</p>
            <p className="text-zinc-800 break-all">
              {formData.description || "N/A"}
            </p>
          </div>

          <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
            <p className="text-sm text-zinc-600">Logo:</p>
            {formData.logo ? (
              <img
                src={formData.logo}
                alt="Logo Preview"
                className="w-20 h-20 object-contain p-1 border border-zinc-300 bg-zinc-200"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src =
                    "https://placehold.co/40x40/E2E8F0/334155?text=Logo";
                }}
              />
            ) : (
              <p className="text-zinc-500">No logo set</p>
            )}
          </div>

          <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
            <p className="text-sm text-zinc-600">Status:</p>
            <span
              className={`px-3 py-1 text-xs font-medium ${
                formData.isActive
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {formData.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-lg  text-zinc-800 flex items-center gap-2 mb-3">
            <div className="w-8 h-8 center-flex bg-primary text-white rounded">
              <FiKey />
            </div>
            Associations Information
          </h4>

          <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
            <p className="text-sm text-zinc-600 mb-2">Associated Website:</p>
            {selectedWebsite ? (
              <span className="px-3 py-1 bg-purple-200 text-purple-800 text-xs">
                {selectedWebsite.name}
              </span>
            ) : (
              <p className="text-zinc-500">None</p>
            )}
          </div>

          <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
            <p className="text-sm text-zinc-600 mb-2">Associated List:</p>
            {selectedList ? (
              <span className="px-3 py-1 bg-purple-200 text-purple-800 text-xs">
                {selectedList.name}
              </span>
            ) : (
              <p className="text-zinc-500">None</p>
            )}
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

// Custom Hooks
const useToast = () => {
  const [toast, setToast] = useState({ show: false, message: "", type: "" });

  const showToast = useCallback((message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  }, []);

  return { toast, showToast };
};

const useFormData = () => {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_DATA);
  }, []);

  const setFormDataFromAutomation = useCallback((automation) => {
    setFormData({
      name: automation.name,
      description: automation.description,
      isActive: automation.isActive,
      logo: automation.logo,
      websiteId: automation.websiteId || "",
      listId: automation.listId || "",
      keys: automation.keys || {},
    });
  }, []);

  return {
    formData,
    setFormData,
    handleInputChange,
    resetForm,
    setFormDataFromAutomation,
  };
};

// Main Component
const Automations = () => {
  const router = useRouter();
  // State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [websites, setWebsites] = useState([]);
  const [lists, setLists] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(STEPS.BASIC_INFO);
  const [editingMiniId, setEditingMiniId] = useState(null);
  const [isWebsiteModalOpen, setIsWebsiteModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  // Filter and layout states
  const [viewMode, setViewMode] = useState("single"); // 'single' or 'double'
  const [sortBy, setSortBy] = useState("newest"); // 'newest', 'oldest', 'name-asc', 'name-desc'
  const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'active', 'inactive'
  const [selectedAutomations, setSelectedAutomations] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Custom hooks
  const { toast, showToast } = useToast();
  const {
    formData,
    setFormData,
    handleInputChange,
    resetForm,
    setFormDataFromAutomation,
  } = useFormData();

  // Computed values
  const selectedWebsite = websites?.find((w) => w._id === formData.websiteId);
  const selectedList = lists?.find((l) => l._id === formData.listId);
  const isEditing = editingMiniId;

  // Filter and sorting functions
  const getFilteredAndSortedAutomations = useCallback(() => {
    let filtered = [...automations];

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((automation) =>
        filterStatus === "active" ? automation.isActive : !automation.isActive
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
  }, [automations, filterStatus, sortBy]);

  // Selection handlers
  const handleSelectAutomation = (automationId) => {
    setSelectedAutomations((prev) => {
      if (prev.includes(automationId)) {
        return prev.filter((id) => id !== automationId);
      } else {
        return [...prev, automationId];
      }
    });
  };

  const handleSelectAll = () => {
    const filteredAutomations = getFilteredAndSortedAutomations();
    if (selectAll) {
      setSelectedAutomations([]);
      setSelectAll(false);
    } else {
      setSelectedAutomations(filteredAutomations.map((a) => a._id));
      setSelectAll(true);
    }
  };

  // Update selectAll state when automations change
  useEffect(() => {
    const filteredAutomations = getFilteredAndSortedAutomations();
    if (filteredAutomations.length === 0) {
      setSelectAll(false);
    } else {
      const allSelected = filteredAutomations.every((a) =>
        selectedAutomations.includes(a._id)
      );
      setSelectAll(allSelected);
    }
  }, [selectedAutomations, getFilteredAndSortedAutomations]);

  // API Functions
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [websitesRes, listsRes, automationsRes] = await Promise.all([
        fetch("/api/website"),
        fetch("/api/list?notConnected=false"),
        fetch("/api/automation"),
      ]);

      if (!websitesRes.ok || !listsRes.ok || !automationsRes.ok) {
        throw new Error("Failed to fetch data from one or more endpoints.");
      }

      const [websitesData, listsData, automationsData] = await Promise.all([
        websitesRes.json(),
        listsRes.json(),
        automationsRes.json(),
      ]);

      setWebsites(websitesData.data || []);
      setLists(listsData.data || []);
      setAutomations(automationsData.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      showToast("Failed to fetch data. Please try again.", "error");
      setWebsites([]);
      setLists([]);
      setAutomations([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setModalLoading(true);

      const method = isEditing ? "PUT" : "POST";
      let url = "/api/work-flow/flow";

      try {
        let reqPayload;
        if (isEditing) {
          reqPayload = {
            automationId: editingMiniId,
            updateData: formData,
            status: "multi",
          };
        } else {
          reqPayload = {
            automationId: editingMiniId,
            ...formData,
          };
        }
        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqPayload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to save automation.");
        }

        resetForm();
        setIsModalOpen(false);
        setEditingMiniId(null);
        showToast(
          isEditing
            ? "Automation updated successfully!"
            : "Automation created successfully!",
          "success"
        );
        await fetchAllData();
      } catch (error) {
        console.error("Submission error:", error);
        showToast(error.message || "Failed to save automation", "error");
      } finally {
        setModalLoading(false);
      }
    },
    [formData, editingMiniId, isEditing, showToast, resetForm, fetchAllData]
  );

  const handleDelete = useCallback(
    async (automation) => {
      if (
        !window.confirm(
          `Are you sure you want to delete the automation "${automation.name}"?`
        )
      ) {
        return;
      }

      try {
        const response = await fetch(
          `/api/work-flow/flow?automationId=${automation._id}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) throw new Error("Failed to delete automation.");

        showToast("Automation deleted successfully!", "success");
        await fetchAllData();
      } catch (error) {
        console.error("Deletion error:", error);
        showToast(error.message, "error");
      }
    },
    [showToast, fetchAllData]
  );

  // Event Handlers
  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
    setCurrentStep(STEPS.BASIC_INFO);
    setEditingMiniId(null);
    resetForm();
  }, [resetForm]);

  const handleEdit = useCallback(
    (automation) => {
      setEditingMiniId(automation._id);
      setFormDataFromAutomation(automation);
      setIsModalOpen(true);
      setCurrentStep(STEPS.BASIC_INFO);
    },
    [setFormDataFromAutomation]
  );

  const handleWebsiteConfirm = useCallback(
    (selection) => {
      setFormData((prev) => ({ ...prev, websiteId: selection[0] || "" }));
      setIsWebsiteModalOpen(false);
      setCurrentStep(STEPS.SELECT_LIST);
    },
    [setFormData]
  );

  const handleListConfirm = useCallback(
    (selection) => {
      setFormData((prev) => ({ ...prev, listId: selection[0] || "" }));
      setIsListModalOpen(false);
      setCurrentStep(STEPS.REVIEW);
    },
    [setFormData]
  );

  const handleStepValidation = useCallback(
    (step) => {
      switch (step) {
        case STEPS.BASIC_INFO:
          if (!formData.name) {
            showToast("Please enter a name for the automation.", "error");
            return false;
          }
          break;
        case STEPS.SELECT_WEBSITE:
          if (!formData.websiteId) {
            showToast("Please select a website.", "error");
            return false;
          }
          break;
        default:
          break;
      }
      return true;
    },
    [formData.name, formData.websiteId, formData.listId, showToast]
  );

  const handleNextStep = useCallback(() => {
    if (handleStepValidation(currentStep)) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, handleStepValidation]);

  const handlePrevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(STEPS.BASIC_INFO, prev - 1));
  }, []);

  // Effects
  useLayoutEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const onSteps = (automation) => {
    router.push(`/automations/working?automationId=${automation._id}`);
  };

  return (
    <SidebarWrapper>
      <AnimatePresence>
        <Toast {...toast} />
      </AnimatePresence>

      <Header
        title="Automations & Work Flows"
        buttonText="Create New Automation"
        onButtonClick={handleOpenModal}
        subtitle="Manage your automations and work flows"
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
                                  selectedAutomations.length > 0
                                    ? "bg-primary border-primary"
                                    : "border-zinc-300 hover:border-primary"
                                }`}
              >
                {selectedAutomations.length > 0 && (
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
              {selectedAutomations.length > 0 && (
                <div className="flex items-center gap-2 pl-3 border-l border-zinc-200">
                  <span className="text-xs text-zinc-500">Actions:</span>
                  <button
                    onClick={() => {
                      console.log("Bulk delete:", selectedAutomations);
                    }}
                    className="btn btn-sm hover:bg-red-500 rounded hover:text-white"
                  >
                    Delete ({selectedAutomations.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <ImSpinner5 className="w-12 h-12 animate-spin text-purple-500" />
        </div>
      ) : automations.length > 0 ? (
        <div
          className={`grid gap-5 ${
            viewMode === "double" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {getFilteredAndSortedAutomations().map((automation) => {
            const isSelected = selectedAutomations.includes(automation._id);
            const isDeleting = false; // Set this based on your deletion state

            return (
              <AutomationCard
                key={automation._id}
                automation={automation}
                websites={websites}
                lists={lists}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSteps={onSteps}
                isSelected={isSelected}
                onSelect={handleSelectAutomation}
                isDeleting={isDeleting}
                viewMode={viewMode}
              />
            );
          })}
        </div>
      ) : (
        ""
      )}

      {getFilteredAndSortedAutomations().length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full center-flex mb-4">
            <FiFilter className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="text-lg text-zinc-600 mb-2">No websites found</h3>
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 w-full h-screen bg-white  z-50 overflow-y-auto">
          <div className="min-h-screen flex flex-col">
            {/* Modal Header */}
            <div className="w-full px-6 py-3 between-flex">
              <div>
                <h2 className="text-xl 3xl:text-2xl  text-primary">
                  {isEditing ? "Edit Automation" : "Add New Automation"}
                </h2>
                <p className="text-sm text-zinc-600">
                  {isEditing
                    ? "Update your automation configuration"
                    : "Configure a new automation"}
                </p>
              </div>

              <button
                onClick={() => {
                  setIsModalOpen(false);
                }}
                className="text-zinc-500 hover:text-zinc-800 transition-colors p-2  hover:bg-zinc-300 border border-transparent hover:border-zinc-300"
                aria-label="Close modal"
              >
                <FiX size={20} className="stroke-current" />
              </button>
            </div>

            <StepIndicator currentStep={currentStep} />

            {/* Modal Content */}
            <div className="flex-1 p-6">
              {modalLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="flex flex-col items-center">
                    <ImSpinner5 className="w-12 h-12 animate-spin text-primary mb-4" />
                    <p className="text-zinc-600">
                      Loading Automation details...
                    </p>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="max-w-4xl mx-auto flex flex-col bg-zinc-200 border border-zinc-300 p-6 rounded"
                >
                  <AnimatePresence mode="wait">
                    {currentStep === STEPS.BASIC_INFO && (
                      <BasicInfoStep
                        formData={formData}
                        onChange={handleInputChange}
                      />
                    )}
                    {currentStep === STEPS.SELECT_WEBSITE && (
                      <SelectionStep
                        stepKey="step2"
                        selectedItem={selectedWebsite}
                        onSelectionChange={() => setIsWebsiteModalOpen(true)}
                        onOpenModal={() => setIsWebsiteModalOpen(true)}
                        title="Select a Website"
                        icon={FiGlobe}
                        noSelectionText="No website selected. Choose a website to associate with this automation."
                      />
                    )}
                    {currentStep === STEPS.SELECT_LIST && (
                      <SelectionStep
                        stepKey="step3"
                        selectedItem={selectedList}
                        onSelectionChange={() => setIsListModalOpen(true)}
                        onOpenModal={() => setIsListModalOpen(true)}
                        title="Select a List"
                        icon={KeyRound}
                        noSelectionText="No list selected. Choose a list to associate with this automation."
                      />
                    )}
                    {currentStep === STEPS.REVIEW && (
                      <ReviewStep
                        formData={formData}
                        selectedWebsite={selectedWebsite}
                        selectedList={selectedList}
                      />
                    )}
                  </AnimatePresence>
                </form>
              )}
            </div>
            <div className="px-6 py-3 bg-zinc-200 border-t border-zinc-300 sticky bottom-0">
              <div className="flex justify-between gap-4 max-w-4xl mx-auto">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={currentStep === STEPS.BASIC_INFO}
                  className="btn btn-sm 2xl:btn-md btn-second"
                >
                  <FiChevronLeft /> Back
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                    }}
                    className="btn btn-sm 2xl:btn-md btn-third"
                    disabled={modalLoading}
                  >
                    Cancel
                  </button>

                  {currentStep < STEPS.REVIEW ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="btn btn-sm 2xl:btn-md btn-primary"
                    >
                      Next
                      <FiChevronRight />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={modalLoading}
                      className={`btn btn-sm 2xl:btn-md  ${
                        isEditing ? "btn-update" : "btn-add"
                      } `}
                    >
                      {modalLoading ? (
                        <>
                          <ImSpinner5 className="w-4 h-4 animate-spin" />
                          {isEditing ? "Updating..." : "Creating..."}
                        </>
                      ) : (
                        <>
                          <FiCheck />
                          {isEditing
                            ? "Update Automation"
                            : "Create Automation"}
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

      {/* Website Selection Modal */}
      {isWebsiteModalOpen && (
        <SelectModal
          isOpen={isWebsiteModalOpen}
          onCancel={() => setIsWebsiteModalOpen(false)}
          onConfirm={handleWebsiteConfirm}
          title="Select Website"
          items={websites}
          selectedItems={formData.websiteId ? [formData.websiteId] : []}
        />
      )}

      {/* List Selection Modal */}
      {isListModalOpen && (
        <SelectModal
          isOpen={isListModalOpen}
          onCancel={() => setIsListModalOpen(false)}
          onConfirm={handleListConfirm}
          title="Select List"
          description="Choose a list to associate with this automation"
          items={lists}
          multiSelect={false}
          searchPlaceholder="Search lists..."
          emptyMessage="No lists available. Create a list first or all lists are connected to an automation"
          selectedItems={formData.listId ? [formData.listId] : []}
        />
      )}
    </SidebarWrapper>
  );
};

export default Automations;
