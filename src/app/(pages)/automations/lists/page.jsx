"use client";
import { useState, useCallback, useLayoutEffect, useEffect } from "react";
import Header from "@/components/Header";
import SidebarWrapper from "@/components/SidebarWrapper";
import {
  getUrlParams,
  inputStyles,
  TabToggle,
  ViewToggle,
} from "@/presets/styles";
import useAdminStore from "@/store/useAdminStore";
import useCustomerStore from "@/store/useCustomerStore";
import { useToastStore } from "@/store/useToastStore";
import { motion } from "framer-motion";
import { EthernetPortIcon } from "lucide-react";
import {
  FiEdit,
  FiTrash2,
  FiCopy,
  FiSearch,
  FiDownload,
  FiFilter,
  FiGrid,
  FiList,
  FiRefreshCw,
  FiGlobe,
  FiActivity,
  FiCpu,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import ListModal from "./ListModal";
import ListCard from "./ListCard"; // You'll need to extract ListCard to its own file too
import { Dropdown } from "@/components/Dropdown";

// Filter Results Box Component
const FilterResultsBox = ({
  websiteName,
  totalCount,
  filteredCount,
  filterType = "website",
  additionalInfo = {},
}) => {
  if (!websiteName && !additionalInfo.customerName) return null;

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  // Determine icon and title based on filter type
  const getFilterConfig = () => {
    switch (filterType) {
      case "customer":
        return {
          icon: <FiUsers className="w-full h-full" />,
          title: `Filtered Results for Customer: "${additionalInfo.customerName}"`,
          bgColor: "blue",
          details: [
            { label: "Customer Email", value: additionalInfo.customerEmail },
            { label: "Account Tier", value: additionalInfo.accountTier },
            { label: "Status", value: additionalInfo.status },
          ].filter((item) => item.value), // Only show if value exists
        };
      case "automation":
        return {
          icon: <FiCpu className="w-full h-full" />,
          title: `Filtered Results for Automation: "${websiteName}"`,
          bgColor: "purple",
          details: [
            { label: "Automation Type", value: additionalInfo.automationType },
            { label: "Trigger Count", value: additionalInfo.triggerCount },
            { label: "Last Triggered", value: additionalInfo.lastTriggered },
          ].filter((item) => item.value),
        };
      case "status":
        return {
          icon: <FiActivity className="w-full h-full" />,
          title: `Filtered by Status: "${websiteName}"`,
          bgColor: "green",
          details: [],
        };
      default: // website
        return {
          icon: <FiGlobe className="w-full h-full" />,
          title: `Filtered Results for Website: "${websiteName}"`,
          bgColor: "blue",
          details: [
            { label: "Domain", value: additionalInfo.domain },
            { label: "Platform", value: additionalInfo.platform },
            { label: "Status", value: additionalInfo.status },
          ].filter((item) => item.value),
        };
    }
  };

  const config = getFilterConfig();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`mb-4 p-3 bg-zinc-50 border border-b-2 border-zinc-200 rounded`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-10 h-10 lg:w-12 lg:h-12 rounded bg-white text-primary border border-b-2 p-2`}
        >
          {config.icon}
        </div>
        <div className="flex-1">
          <h3 className={`text-sm lg:text-base font-medium text-zinc-700`}>
            {config.title}
          </h3>
          <p className={`text-xs text-zinc-500 mb-2`}>
            Showing {formatNumber(filteredCount)} of {formatNumber(totalCount)}{" "}
            total lists
          </p>

          {/* Additional details */}
          {config.details.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {config.details.map((detail, index) => (
                  <div key={index} className="text-xs">
                    <span className={`font-medium text-zinc-800`}>
                      {detail.label}:
                    </span>
                    <span className={`ml-1 text-zinc-500`}>{detail.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const Lists = () => {
  const { showSuccess, showError } = useToastStore();
  const { admin } = useAdminStore();
  const { customer } = useCustomerStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [websites, setWebsites] = useState([]);
  const [lists, setLists] = useState([]);
  const [allLists, setAllLists] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingMiniId, setEditingMiniId] = useState(null);
  const [isWebsiteModalOpen, setIsWebsiteModalOpen] = useState(false);
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [urlParams, setUrlParams] = useState({});
  const [filteredWebsite, setFilteredWebsite] = useState(null);

  // Toolbar state
  const [viewMode, setViewMode] = useState("single");
  const [sortBy, setSortBy] = useState("newest");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedLists, setSelectedLists] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [searchMode, setSearchMode] = useState("local");
  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [sortKey, setSortKey] = useState("lastActiveAt");
  const [sortDir, setSortDir] = useState("desc");
  const [groupByHolder, setGroupByHolder] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true,
    logo: "",
    websiteId: "",
    listId: "",
    automationId: "",
  });

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
  }, [urlParams.websiteId, showError]);

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
          throw new Error(error.message || "Failed to save list.");
        }

        setFormData({
          name: "",
          description: "",
          isActive: true,
          logo: "",
          websiteId: "",
          listId: "",
          automationId: "",
        });
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
    [formData, editingMiniId, isEditing, fetchAllData, showSuccess, showError]
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
    [fetchAllData, showSuccess, showError]
  );

  // Event Handlers
  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
    setEditingMiniId(null);
    setFormData({
      name: "",
      description: "",
      isActive: true,
      logo: "",
      websiteId: "",
      listId: "",
      automationId: "",
    });
  }, []);

  const handleEdit = useCallback((list) => {
    setEditingMiniId(list._id);
    setFormData({
      name: list.name,
      description: list.description,
      isActive: list.isActive,
      logo: list.logo,
      websiteId: list.websiteId || "",
      listId: list.listId || "",
      automationId: list.automationId || "",
    });
    setIsModalOpen(true);
  }, []);

  const handleWebsiteConfirm = useCallback(
    (selection) => {
      setFormData((prev) => ({ ...prev, websiteId: selection[0] || "" }));
      setIsWebsiteModalOpen(false);
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
    },
    [setFormData]
  );

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }, []);

  // Filter and sorting functions
  const getFilteredAndSortedLists = useCallback(() => {
    let filtered = [...lists];

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((list) =>
        filterStatus === "active" ? list.isActive : !list.isActive
      );
    }

    // Apply search query
    if (query) {
      const searchTerm = query.toLowerCase();
      filtered = filtered.filter(
        (list) =>
          list.name.toLowerCase().includes(searchTerm) ||
          (list.description &&
            list.description.toLowerCase().includes(searchTerm))
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
  }, [lists, filterStatus, sortBy, query]);

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

  // Effects
  useLayoutEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Toolbar actions
  const exportCSV = () => {
    // Implement CSV export functionality
    showSuccess("Export functionality will be implemented soon");
  };

  const clearSelection = () => {
    setSelectedLists([]);
    setSelectAll(false);
  };

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

      {/* Primary actions + search/filters */}
      <div className="bg-white border border-zinc-200 rounded p-3 mb-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 flex gap-2">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-2.5 text-zinc-400" />
              <input
                aria-label="Search lists"
                className={`pl-9 ${inputStyles}`}
                placeholder="Search lists by name or description..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          {/* Search mode dropdown */}
          <Dropdown
            position="bottom"
            options={[
              {
                value: "local",
                label: (
                  <div className="flex items-center gap-2 w-full">
                    Local Search
                  </div>
                ),
              },
              {
                value: "live",
                label: (
                  <div className="flex items-center gap-2 w-full">
                    Live Search
                  </div>
                ),
              },
            ]}
            placeholder="Search Mode"
            onChange={(val) => setSearchMode(val)}
            value={searchMode}
            className="w-48"
          />{" "}
          <div className="flex gap-1">
            <button
              onClick={() => fetchAllData()}
              className="btn btn-sm btn-primary gap-2"
              title="Refresh"
            >
              <FiRefreshCw />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs & secondary controls */}
        <div className="between-flex flex-wrap gap-2 mt-3">
          <ViewToggle
            viewMode={viewMode}
            setViewMode={setViewMode}
            viewToggleOptions={[
              {
                icon: <FiList />,
                value: "single",
              },
              {
                icon: <FiGrid />,
                value: "double",
              },
            ]}
          />

          <div className="ml-auto flex items-center gap-2">
            <TabToggle
              currentTab={filterStatus}
              setCurrentTab={setFilterStatus}
              TabToggleOptions={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            <div className="flex items-center gap-2">
              <Dropdown
                position="bottom"
                options={[
                  {
                    value: "newest",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        Newest First
                      </div>
                    ),
                  },
                  {
                    value: "oldest",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        Oldest First
                      </div>
                    ),
                  },
                  {
                    value: "name-asc",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        Name A-Z
                      </div>
                    ),
                  },
                  {
                    value: "name-desc",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        Name Z-A
                      </div>
                    ),
                  },
                ]}
                placeholder="Sort By"
                onChange={(val) => setSortBy(val)}
                className="w-48"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedLists.length > 0 && (
        <div
          className="sticky top-2 z-10 bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 mb-3 flex items-center gap-2"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="px-2 py-1 rounded-sm text-primary text-xs">
            {selectedLists.length} Selected
          </span>
          <button
            onClick={() => {
              if (
                window.confirm(
                  `Are you sure you want to delete ${selectedLists.length} lists?`
                )
              ) {
                // Implement bulk delete
                showSuccess(
                  "Bulk delete functionality will be implemented soon"
                );
              }
            }}
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-red-500 hover:bg-red-600"
          >
            <FiTrash2 />
            Delete selected
          </button>
          <button
            onClick={exportCSV}
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-zinc-500 hover:bg-zinc-600"
          >
            <FiDownload />
            Export CSV
          </button>
          <button
            onClick={clearSelection}
            className="btn btn-xs hover:bg-amber-200 ml-auto text-xs text-amber-900/70 hover:underline rounded-sm"
          >
            Clear
          </button>
        </div>
      )}

      {/* Lists rendering */}
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

      {/* List Modal */}
      <ListModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMiniId(null);
          setFormData({
            name: "",
            description: "",
            isActive: true,
            logo: "",
            websiteId: "",
            listId: "",
            automationId: "",
          });
        }}
        isEditing={isEditing}
        formData={formData}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        modalLoading={modalLoading}
        websites={websites}
        automations={automations}
        selectedWebsite={selectedWebsite}
        selectedAutomation={selectedAutomation}
        handleWebsiteConfirm={handleWebsiteConfirm}
        handleAutomationConfirm={handleAutomationConfirm}
      />
    </SidebarWrapper>
  );
};

export default Lists;
