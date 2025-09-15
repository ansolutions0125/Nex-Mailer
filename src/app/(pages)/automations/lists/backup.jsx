"use client";
import { Dropdown } from "@/components/Dropdown";
import Header from "@/components/Header";
import SelectModal from "@/components/SelectModal";
import SidebarWrapper from "@/components/SidebarWrapper";
import { getUrlParams, inputStyles, labelStyles } from "@/presets/styles";
import useAdminStore from "@/store/useAdminStore";
import useCustomerStore from "@/store/useCustomerStore";
import { useToastStore } from "@/store/useToastStore";
import { AnimatePresence, motion } from "framer-motion";
import { EthernetPort, EthernetPortIcon, KeyRound } from "lucide-react";
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
  FiGrid,
  FiList,
  FiFilter,
  FiCopy,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";

// Constants
const STEPS = {
  BASIC_INFO: 1,
  SELECT_WEBSITE: 2,
  SELECT_AUTOMATION: 3,
  REVIEW: 4,
};

const INITIAL_FORM_DATA = {
  name: "",
  description: "",
  isActive: true,
  logo: "",
  websiteId: "",
  listId: "",
  automationId: "",
};

// Filter Results Box Component
const FilterResultsBox = ({ websiteName, totalCount, filteredCount }) => {
  if (!websiteName) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-full">
          <FiFilter className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-blue-800">
            Filtered Results for Website: "{websiteName}"
          </h3>
          <p className="text-xs text-blue-600">
            Showing {filteredCount} of {totalCount} total lists
          </p>
        </div>
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

const ListCard = ({
  list,
  websites,
  automations,
  onEdit,
  onDelete,
  isSelected,
  onSelect,
  isDeleting,
  viewMode,
}) => {
  const associatedWebsite = websites.find((w) => w._id === list.websiteId);
  const associatedAutomation = automations.find(
    (a) => a._id === list.automationId
  );

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
            onClick={() => onSelect(list._id)}
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
            {list.logo ? (
              <img
                src={list.logo}
                alt={`${list.name} logo`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://placehold.co/80x80/efefef/999999?text=${list.name
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
                list.isActive
                  ? "bg-green-200 border-green-500 text-zinc-800"
                  : "bg-red-200 border-red-500 text-red-900"
              }`}
            >
              {list.isActive ? "Currently Active" : "Currently Inactive"}
            </div>
            <h2 className="text-lg text-zinc-700 font-medium mt-1">
              {list.name}
            </h2>
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
                    {associatedAutomation.name ? "Autoamtion" : "Not Connected"}{" "}
                    :
                  </h2>
                  <p className="text-xs text-zinc-600">{`${
                    associatedAutomation ? "Connected" : "None"
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
                      Edit List
                    </div>
                  ),
                },
                {
                  value: "copy",
                  label: (
                    <div className="flex items-center gap-2 w-full">
                      <FiCopy />
                      Copy List Id
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
                      Delete List
                    </div>
                  ),
                },
              ]}
              placeholder="Actions Menu"
              onChange={(val) => {
                if (val === "edit") onEdit(list);
                if (val === "delete") onDelete(list);
                if (val === "copy") navigator.clipboard.writeText(list._id);
              }}
              disabled={isDeleting}
              className="w-48"
            />{" "}
          </div>
        </div>

        <div
          className={`flex-1 w-full grid gap-3 ${
            viewMode === "double" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-4"
          }`}
        >
          <MiniCard
            title="Total Subscribers"
            subLine={list?.stats?.totalSubscribers}
          />
          <MiniCard title="Added On" subLine={formatDate(list.createdAt)} />
          <MiniCard title="Last Updated" subLine={formatDate(list.updatedAt)} />
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

    {/* Status Toggle */}
    <div className="bg-white border border-zinc-300 p-6 rounded">
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

const ReviewStep = ({ formData, selectedWebsite }) => (
  <motion.div
    key="step4"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
    className="flex flex-col"
  >
    <div>
      <h3 className="text-xl font-semibold text-zinc-800 text-center">
        Review Portal Details
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
            Associations
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
        </div>
      </div>
    </div>
  </motion.div>
);

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

  const setFormDataFromList = useCallback((list) => {
    setFormData({
      name: list.name,
      description: list.description,
      isActive: list.isActive,
      logo: list.logo,
      websiteId: list.websiteId || "",
      listId: list.listId || "",
      automationId: list.automationId || "",
    });
  }, []);

  return {
    formData,
    setFormData,
    handleInputChange,
    resetForm,
    setFormDataFromList,
  };
};

// Main Component
const Lists = () => {
  const { showSuccess, showError, showWarning } = useToastStore();
  const { admin } = useAdminStore();
  const { customer } = useCustomerStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [websites, setWebsites] = useState([]);
  const [lists, setLists] = useState([]);
  const [allLists, setAllLists] = useState([]); // Store all lists for filtering
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(STEPS.BASIC_INFO);
  const [editingMiniId, setEditingMiniId] = useState(null);
  const [isWebsiteModalOpen, setIsWebsiteModalOpen] = useState(false);
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [urlParams, setUrlParams] = useState({});
  const [filteredWebsite, setFilteredWebsite] = useState(null);

  const {
    formData,
    setFormData,
    handleInputChange,
    resetForm,
    setFormDataFromList,
  } = useFormData();

  // Get URL parameters on component mount
  useEffect(() => {
    const params = getUrlParams();
    setUrlParams(params);
  }, []);

  // Computed values
  const selectedWebsite = websites?.find((w) => w._id === formData.websiteId);
  const selectedAutomation = automations?.find(
    (l) => l._id === formData.automationId
  );
  const isEditing = !!editingMiniId;

  // API Functions
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [websitesRes, listsRes, automationsRes] = await Promise.all([
        fetch("/api/website"),
        fetch("/api/list"),
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

      const allWebsites = websitesData.data || [];
      const allListsData = listsData.data || [];
      const allAutomationsData = automationsData.data || [];

      // Store all lists
      setAllLists(allListsData);
      setAutomations(allAutomationsData);

      // Check if we have a websiteId parameter
      if (urlParams.websiteId) {
        // Filter websites to only include the specified one
        const targetWebsite = allWebsites.find(
          (w) => w._id === urlParams.websiteId
        );
        if (targetWebsite) {
          setWebsites([targetWebsite]);
          setFilteredWebsite(targetWebsite);
          // Filter lists to only show those associated with this website
          const filteredLists = allListsData.filter(
            (list) => list.websiteId === urlParams.websiteId
          );
          setLists(filteredLists);
        } else {
          // Website ID not found, show empty results
          setWebsites([]);
          setLists([]);
          setFilteredWebsite(null);
          showError("Website not found with the provided ID");
        }
      } else {
        // No websiteId parameter, show all data
        setWebsites(allWebsites);
        setLists(allListsData);
        setFilteredWebsite(null);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      showError("Failed to fetch data. Please try again.");
      setWebsites([]);
      setLists([]);
      setAllLists([]);
      setAutomations([]);
    } finally {
      setLoading(false);
    }
  }, [urlParams.websiteId]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setModalLoading(true);

      const method = isEditing ? "PUT" : "POST";
      const url = `/api/list${isEditing ? `?id=${editingMiniId}` : ""}`;

      const payloadData = { ...formData };
      delete payloadData.listId;

      try {
        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadData),
        });

        if (!response.ok) {
          const error = await response.json();
          console.log(error);
          throw new Error(error.message || "Failed to save list.");
        }

        resetForm();
        setIsModalOpen(false);
        setEditingMiniId(null);
        showSuccess(
          isEditing
            ? "List updated successfully!"
            : "List created successfully!"
        );
        await fetchAllData();
      } catch (error) {
        console.error("Submission error:", error);
        showError(error.message || "An error occurred while saving the list");
      } finally {
        setModalLoading(false);
      }
    },
    [formData, editingMiniId, isEditing, resetForm, fetchAllData]
  );

  const handleDelete = useCallback(
    async (list) => {
      if (
        !window.confirm(
          `Are you sure you want to delete the list "${list.name}"?`
        )
      ) {
        return;
      }

      try {
        const response = await fetch(`/api/list?id=${list._id}`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Failed to delete list.");

        showSuccess("List deleted successfully!");
        await fetchAllData();
      } catch (error) {
        console.error("Deletion error:", error);
        showError(error.message);
      }
    },
    [fetchAllData]
  );

  // Event Handlers
  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
    setCurrentStep(STEPS.BASIC_INFO);
    setEditingMiniId(null);
    resetForm();
  }, [resetForm]);

  const handleEdit = useCallback(
    (list) => {
      setEditingMiniId(list._id);
      setFormDataFromList(list);
      setIsModalOpen(true);
      setCurrentStep(STEPS.BASIC_INFO);
    },
    [setFormDataFromList]
  );

  const handleWebsiteConfirm = useCallback(
    (selection) => {
      setFormData((prev) => ({ ...prev, websiteId: selection[0] || "" }));
      setIsWebsiteModalOpen(false);
      setCurrentStep(STEPS.SELECT_AUTOMATION);
    },
    [setFormData]
  );

  const handleAutomationConfirm = useCallback(
    (selection) => {
      setFormData((prev) => ({
        ...prev,
        automationId: selection[0] || "",
        listId: selection[0] || "",
      }));
      setIsAutomationModalOpen(false);
      setCurrentStep(STEPS.REVIEW);
    },
    [setFormData]
  );

  const handleStepValidation = useCallback(
    (step) => {
      switch (step) {
        case STEPS.BASIC_INFO:
          if (!formData.name) {
            showError("Please enter a name for the list.");
            return false;
          }
          break;

        default:
          break;
      }
      return true;
    },
    [formData.name]
  );

  const handleNextStep = useCallback(() => {
    if (handleStepValidation(currentStep)) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, handleStepValidation]);

  const handlePrevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(STEPS.BASIC_INFO, prev - 1));
  }, []);

  // Reset form state function
  const resetFormState = useCallback(() => {
    resetForm();
    setCurrentStep(STEPS.BASIC_INFO);
    setEditingMiniId(null);
  }, [resetForm]);

  // Effects
  useLayoutEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Add these state variables at the top of your Lists component
  const [viewMode, setViewMode] = useState("single"); // 'single' or 'double'
  const [sortBy, setSortBy] = useState("newest"); // 'newest', 'oldest', 'name-asc', 'name-desc'
  const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'active', 'inactive'
  const [selectedLists, setSelectedLists] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Filter and sorting functions
  const getFilteredAndSortedLists = useCallback(() => {
    let filtered = [...lists];

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((list) =>
        filterStatus === "active" ? list.isActive : !list.isActive
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
  }, [lists, filterStatus, sortBy]);

  // Selection handlers
  const handleSelectList = (listId) => {
    setSelectedLists((prev) => {
      if (prev.includes(listId)) {
        return prev.filter((id) => id !== listId);
      } else {
        return [...prev, listId];
      }
    });
  };

  const handleSelectAll = () => {
    const filteredLists = getFilteredAndSortedLists();
    if (selectAll) {
      setSelectedLists([]);
      setSelectAll(false);
    } else {
      setSelectedLists(filteredLists.map((l) => l._id));
      setSelectAll(true);
    }
  };

  // Update selectAll state when lists change
  useEffect(() => {
    const filteredLists = getFilteredAndSortedLists();
    if (filteredLists.length === 0) {
      setSelectAll(false);
    } else {
      const allSelected = filteredLists.every((l) =>
        selectedLists.includes(l._id)
      );
      setSelectAll(allSelected);
    }
  }, [selectedLists, getFilteredAndSortedLists]);

  return (
    <SidebarWrapper>
      <Header
        title="Lists & Work Flows"
        buttonText="Create New List"
        onButtonClick={handleOpenModal}
        subtitle="Manage your automations and work flows"
      />

      {/* Filter Results Box */}
      {filteredWebsite && (
        <FilterResultsBox
          websiteName={filteredWebsite.name}
          totalCount={allLists.length}
          filteredCount={lists.length}
        />
      )}

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
              selectedLists.length > 0
                ? "bg-primary border-primary"
                : "border-zinc-300 hover:border-primary"
            }`}
              >
                {selectedLists.length > 0 && (
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
              {selectedLists.length > 0 && (
                <div className="flex items-center gap-2 pl-3 border-l border-zinc-200">
                  <span className="text-xs text-zinc-500">Actions:</span>
                  <button
                    onClick={() => {
                      console.log("Bulk delete:", selectedLists);
                    }}
                    className="btn btn-sm hover:bg-red-500 rounded hover:text-white"
                  >
                    Delete ({selectedLists.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Update the list rendering */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <ImSpinner5 className="w-12 h-12 animate-spin text-purple-500" />
        </div>
      ) : lists.length > 0 ? (
        <div
          className={`grid gap-5 ${
            viewMode === "double" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {getFilteredAndSortedLists().map((list) => {
            const isSelected = selectedLists.includes(list._id);
            const isDeleting = false; // Set this based on your deletion state

            return (
              <ListCard
                key={list._id}
                list={list}
                websites={websites}
                automations={automations}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isSelected={isSelected}
                onSelect={handleSelectList}
                isDeleting={isDeleting}
                viewMode={viewMode}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center p-10 text-zinc-500">
          <h3 className="text-2xl font-semibold">
            {filteredWebsite
              ? `No Lists Found for "${filteredWebsite.name}"`
              : "No Lists Found"}
          </h3>
          <p className="mt-2">
            {filteredWebsite
              ? `No lists are currently associated with the website "${filteredWebsite.name}".`
              : 'Click "Create New List" to get started.'}
          </p>
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
                  {isEditing ? "Edit List" : "Add New List"}
                </h2>
                <p className="text-sm text-zinc-600">
                  {isEditing
                    ? "Update your list configuration"
                    : "Configure a new list"}
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
                <div className="flex justify-center items-center flex-grow">
                  <ImSpinner5 className="w-12 h-12 animate-spin text-purple-500" />
                </div>
              ) : (
                <form className="max-w-4xl mx-auto flex flex-col bg-zinc-200 border border-zinc-300 p-6 rounded">
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
                        noSelectionText="No website selected. Please choose a website to associate with this list."
                      />
                    )}

                    {currentStep === STEPS.SELECT_AUTOMATION && (
                      <SelectionStep
                        stepKey="step3"
                        selectedItem={selectedAutomation}
                        onSelectionChange={() => setIsAutomationModalOpen(true)}
                        onOpenModal={() => setIsAutomationModalOpen(true)}
                        title="Select an Automation"
                        icon={KeyRound}
                        noSelectionText="No automation selected. Please choose an automation to associate with this list."
                      />
                    )}

                    {currentStep === STEPS.REVIEW && (
                      <ReviewStep
                        formData={formData}
                        selectedWebsite={selectedWebsite}
                        selectedAutomation={selectedAutomation}
                      />
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
                      onClick={handlePrevStep}
                      disabled={currentStep === STEPS.BASIC_INFO}
                      className="btn btn-sm 2xl:btn-md btn-second"
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
                      resetFormState();
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
                      Continue <FiChevronRight />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={modalLoading}
                      className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {modalLoading ? (
                        <>
                          <ImSpinner5 className="animate-spin" />
                          {isEditing ? "Updating..." : "Creating..."}
                        </>
                      ) : (
                        <>
                          <FiCheck />
                          {isEditing ? "Update List" : "Create List"}
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
          onCancel={() => setIsWebsiteModalOpen(false)}
          onConfirm={handleWebsiteConfirm}
          title="Select Website"
          items={websites}
          selectedItems={formData.websiteId ? [formData.websiteId] : []}
        />
      )}

      {/* Automation Selection Modal */}
      {isAutomationModalOpen && (
        <SelectModal
          onCancel={() => setIsAutomationModalOpen(false)}
          onConfirm={handleAutomationConfirm}
          title="Select Automation"
          items={automations}
          selectedItems={formData.automationId ? [formData.automationId] : []}
        />
      )}
    </SidebarWrapper>
  );
};

export default Lists;
