"use client";
import { useState, useCallback, useLayoutEffect, useEffect } from "react";
import Header from "@/components/Header";
import SidebarWrapper from "@/components/SidebarWrapper";
import {
  Checkbox,
  EmptyState,
  getUrlParams,
  inputStyles,
  LoadingSpinner,
  TabToggle,
} from "@/presets/styles";
import useAdminStore from "@/store/useAdminStore";
import useCustomerStore from "@/store/useCustomerStore";
import { useToastStore } from "@/store/useToastStore";
import { motion } from "framer-motion";
import {
  FiTrash2,
  FiSearch,
  FiDownload,
  FiRefreshCw,
  FiActivity,
  FiCpu,
  FiUsers,
  FiChevronDown,
  FiChevronUp,
  FiEdit,
  FiCopy,
  FiEye,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import ListModal from "./ListModal";
import { Dropdown } from "@/components/Dropdown";
import ConfirmationModal from "@/components/ConfirmationModal";
import {
  fetchWithAuthAdmin,
  fetchWithAuthCustomer,
} from "@/helpers/front-end/request";

// Custom Table Components
const Table = ({ children, className = "" }) => (
  <div
    className={`w-full min-h-96 bg-white border border-zinc-200 rounded overflow-x-hidden overflow-y-scroll ${className}`}
  >
    {children}
  </div>
);

const TableHeader = ({ children, className = "" }) => (
  <div
    className={`w-full bg-zinc-50 border-b border-zinc-200 text-xs uppercase ${className}`}
  >
    {children}
  </div>
);

const TableRow = ({
  children,
  className = "",
  isSelected = false,
  onClick,
}) => (
  <div
    className={`border-b border-zinc-100 hover:bg-zinc-50 transition-colors ${
      isSelected ? "bg-blue-50" : ""
    } ${className}`}
    onClick={onClick}
  >
    {children}
  </div>
);

const TableCell = ({ children, className = "", colSpan = 1, onClick }) => (
  <div
    className={`p-3 ${className}`}
    style={{ gridColumn: `span ${colSpan}` }}
    onClick={onClick}
  >
    {children}
  </div>
);

const TableBody = ({ children, className = "" }) => (
  <div className={className}>{children}</div>
);

// Filter Results Box Component
const FilterResultsBox = ({
  totalCount,
  filteredCount,
  filterType = "customer",
  additionalInfo = {},
}) => {
  if (!additionalInfo.customerName) return null;

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

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
          ].filter((item) => item.value),
        };
      case "automation":
        return {
          icon: <FiCpu className="w-full h-full" />,
          title: `Filtered Results for Automation: "${additionalInfo.automationName}"`,
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
          title: `Filtered by Status: "${additionalInfo.status}"`,
          bgColor: "green",
          details: [],
        };
      default:
        return {
          icon: <FiUsers className="w-full h-full" />,
          title: `Filtered Results`,
          bgColor: "blue",
          details: [],
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
  const { admin, token: adminToken } = useAdminStore();
  const { customer, token: customerToken } = useCustomerStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create", "edit", "view"
  const [lists, setLists] = useState([]);
  const [allLists, setAllLists] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingMiniId, setEditingMiniId] = useState(null);
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [urlParams, setUrlParams] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [listToDelete, setListToDelete] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });

  // Toolbar state
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedLists, setSelectedLists] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [searchMode, setSearchMode] = useState("local");
  const [query, setQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true,
    logo: "",
    automationId: "",
  });

  // Get URL parameters on component mount
  useEffect(() => {
    const params = getUrlParams();
    setUrlParams(params);
  }, []);

  // Computed values
  const selectedAutomation = automations?.find(
    (l) => l._id === formData.automationId
  );
  const isEditing = modalMode === "edit";
  const isViewing = modalMode === "view";

  // API Functions
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      let listsRes;
      let automationsRes;
      if (customer && customer._id && customerToken) {
        [listsRes, automationsRes] = await Promise.all([
          fetchWithAuthCustomer({
            url: "/api/list",
            method: "GET",
            customer: customer,
            token: customerToken,
          }),
          fetchWithAuthCustomer({
            url: "/api/automation",
            method: "GET",
            customer: customer,
            token: customerToken,
          }),
        ]);
      } else if (admin && admin._id && adminToken) {
        [listsRes, automationsRes] = await Promise.all([
          fetchWithAuthAdmin({
            url: "/api/list",
            method: "GET",
            admin: admin,
            token: adminToken,
          }),
          fetchWithAuthAdmin({
            url: "/api/automation",
            method: "GET",
            admin: admin,
            token: adminToken,
          }),
        ]);
      }
      if (!listsRes.success || !automationsRes.success) {
        throw new Error("Failed to fetch data from one or more endpoints.");
      }

      const [listsData, automationsData] = await Promise.all([
        listsRes,
        automationsRes,
      ]);

      const allListsData = listsData.data || [];
      const allAutomationsData = automationsData.data || [];

      // Store all lists
      setAllLists(allListsData);
      setAutomations(allAutomationsData);

      // Check if we have a customerId parameter
      if (urlParams.customerId) {
        // Filter lists to only show those associated with this customer
        const filteredLists = allListsData.filter(
          (list) => list.customerId === urlParams.customerId
        );
        setLists(filteredLists);
      } else {
        // No customerId parameter, show all data
        setLists(allListsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      showError("Failed to fetch data. Please try again.");
      setLists([]);
      setAllLists([]);
      setAutomations([]);
    } finally {
      setLoading(false);
    }
  }, [urlParams.customerId, showError]);

  // Bulk delete function
  const handleBulkDelete = useCallback(async () => {
    if (selectedLists.length === 0) return;

    setBulkDeleting(true);
    try {
      const response = await fetch("/api/list", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ listIds: selectedLists }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to delete lists.");
      }

      showSuccess(
        result.message || `${selectedLists.length} lists deleted successfully!`
      );
      setSelectedLists([]);
      setSelectAll(false);
      setShowBulkDeleteConfirm(false);
      await fetchAllData();
    } catch (error) {
      console.error("Bulk delete error:", error);
      showError(error.message || "An error occurred while deleting lists");
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedLists, fetchAllData, showSuccess, showError]);

  // Export CSV function
  const handleExportCSV = useCallback(async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/list?action=exportCSV", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to export lists.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lists_export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showSuccess("Lists exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      showError(error.message || "An error occurred while exporting lists");
    } finally {
      setExporting(false);
    }
  }, [showSuccess, showError]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setModalLoading(true);

      const method = isEditing ? "PUT" : "POST";
      const url = `/api/list${isEditing ? `?id=${editingMiniId}` : ""}`;

      const payloadData = {
        ...formData,
        customerId: customer?._id || null,
      };

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
          automationId: "",
        });
        setIsModalOpen(false);
        setEditingMiniId(null);
        setModalMode("create");
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
    [
      formData,
      editingMiniId,
      isEditing,
      fetchAllData,
      showSuccess,
      showError,
      customer,
    ]
  );

  const handleDelete = useCallback(async () => {
    if (!listToDelete) return;

    try {
      const response = await fetch(`/api/list?id=${listToDelete._id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete list.");

      showSuccess("List deleted successfully!");
      setShowDeleteConfirm(false);
      setListToDelete(null);
      await fetchAllData();
    } catch (error) {
      console.error("Deletion error:", error);
      showError(error.message);
    }
  }, [listToDelete, fetchAllData, showSuccess, showError]);

  // Event Handlers
  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
    setModalMode("create");
    setEditingMiniId(null);
    setFormData({
      name: "",
      description: "",
      isActive: true,
      logo: "",
      automationId: "",
    });
  }, []);

  const handleEdit = useCallback((list) => {
    setEditingMiniId(list._id);
    setModalMode("edit");
    setFormData({
      name: list.name,
      description: list.description,
      isActive: list.isActive,
      logo: list.logo,
      automationId: list.automationId || "",
    });
    setIsModalOpen(true);
  }, []);

  const handleView = useCallback((list) => {
    setEditingMiniId(list._id);
    setModalMode("view");
    setFormData({
      name: list.name,
      description: list.description,
      isActive: list.isActive,
      logo: list.logo,
      automationId: list.automationId || "",
    });
    setIsModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((list) => {
    setListToDelete(list);
    setShowDeleteConfirm(true);
  }, []);

  const handleAutomationConfirm = useCallback(
    (selection) => {
      setFormData((prev) => ({
        ...prev,
        automationId: selection[0] || "",
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

  // Sort function
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

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
    filtered.sort((a, b) => {
      let aValue, bValue;

      // Handle nested properties
      if (sortConfig.key === "stats.totalSubscribers") {
        aValue = a.stats?.totalSubscribers || 0;
        bValue = b.stats?.totalSubscribers || 0;
      } else {
        aValue = a[sortConfig.key];
        bValue = b[sortConfig.key];
      }

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });

    return filtered;
  }, [lists, filterStatus, sortConfig, query]);

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

  const clearSelection = () => {
    setSelectedLists([]);
    setSelectAll(false);
  };

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

  const filteredLists = getFilteredAndSortedLists();

  return (
    <SidebarWrapper>
      <Header
        title="Lists & Work Flows"
        buttonText="Create New List"
        onButtonClick={handleOpenModal}
        subtitle="Manage your automations and work flows"
      />
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
          />
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
          <TabToggle
            currentTab={filterStatus}
            setCurrentTab={setFilterStatus}
            TabToggleOptions={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
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
                  {
                    value: "subscribers-asc",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        Subscribers ↑
                      </div>
                    ),
                  },
                  {
                    value: "subscribers-desc",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        Subscribers ↓
                      </div>
                    ),
                  },
                ]}
                placeholder="Sort By"
                onChange={(val) => {
                  switch (val) {
                    case "newest":
                      setSortConfig({ key: "createdAt", direction: "desc" });
                      break;
                    case "oldest":
                      setSortConfig({ key: "createdAt", direction: "asc" });
                      break;
                    case "name-asc":
                      setSortConfig({ key: "name", direction: "asc" });
                      break;
                    case "name-desc":
                      setSortConfig({ key: "name", direction: "desc" });
                      break;
                    case "subscribers-asc":
                      setSortConfig({
                        key: "stats.totalSubscribers",
                        direction: "asc",
                      });
                      break;
                    case "subscribers-desc":
                      setSortConfig({
                        key: "stats.totalSubscribers",
                        direction: "desc",
                      });
                      break;
                    default:
                      setSortConfig({ key: "createdAt", direction: "desc" });
                  }
                }}
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
            onClick={() => setShowBulkDeleteConfirm(true)}
            disabled={bulkDeleting}
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-red-500 hover:bg-red-600 disabled:bg-red-400 disabled:cursor-not-allowed"
          >
            {bulkDeleting ? (
              <ImSpinner5 className="animate-spin h-3 w-3" />
            ) : (
              <FiTrash2 />
            )}
            Delete selected
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-zinc-500 hover:bg-zinc-600 disabled:bg-zinc-400 disabled:cursor-not-allowed"
            title="Export all lists to CSV"
          >
            {exporting ? (
              <ImSpinner5 className="animate-spin h-3 w-3" />
            ) : (
              <FiDownload />
            )}
            Export All
          </button>
          <button
            onClick={clearSelection}
            className="btn btn-xs hover:bg-amber-200 ml-auto text-xs text-amber-900/70 hover:underline rounded-sm"
          >
            Clear
          </button>
        </div>
      )}
      {/* Lists Table */}
      {loading ? (
        <LoadingSpinner />
      ) : filteredLists.length > 0 ? (
        <Table>
          <TableHeader>
            <div className="grid grid-cols-[50px_3fr_120px_120px_120px_120px_120px] items-center">
              <TableCell className="p-3">
                <Checkbox selected={selectAll} onChange={handleSelectAll} />
              </TableCell>
              <TableCell
                className="p-3 cursor-pointer hover:text-primary"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  Name
                  {sortConfig.key === "name" &&
                    (sortConfig.direction === "asc" ? (
                      <FiChevronUp />
                    ) : (
                      <FiChevronDown />
                    ))}
                </div>
              </TableCell>
              <TableCell className="p-3">Status</TableCell>
              <TableCell className="p-3">Automation</TableCell>
              <TableCell
                className="p-3 cursor-pointer hover:text-primary"
                onClick={() => handleSort("stats.totalSubscribers")}
              >
                <div className="flex items-center gap-1">
                  Subscribers
                  {sortConfig.key === "stats.totalSubscribers" &&
                    (sortConfig.direction === "asc" ? (
                      <FiChevronUp />
                    ) : (
                      <FiChevronDown />
                    ))}
                </div>
              </TableCell>
              <TableCell
                className="p-3 cursor-pointer hover:text-primary"
                onClick={() => handleSort("createdAt")}
              >
                <div className="flex items-center gap-1">
                  Created
                  {sortConfig.key === "createdAt" &&
                    (sortConfig.direction === "asc" ? (
                      <FiChevronUp />
                    ) : (
                      <FiChevronDown />
                    ))}
                </div>
              </TableCell>
              <TableCell className="p-3">Actions</TableCell>
            </div>
          </TableHeader>

          <TableBody>
            {filteredLists.map((list) => {
              const associatedAutomation = automations.find(
                (a) => a._id === list.automationId
              );
              const isSelected = selectedLists.includes(list._id);

              return (
                <TableRow key={list._id} isSelected={isSelected}>
                  <div className="grid grid-cols-[50px_1fr_100px_120px_100px_120px_140px] items-center">
                    <TableCell>
                      <Checkbox
                        selected={isSelected}
                        onChange={() => handleSelectList(list._id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-100 rounded border overflow-hidden">
                          {list.logo ? (
                            <img
                              src={list.logo}
                              alt={list.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
                              <span className="text-xs text-zinc-400">
                                {list.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <div
                            className="font-medium text-zinc-800 hover:underline cursor-pointer"
                            onClick={() => handleView(list)}
                          >
                            {list.name}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          list.isActive
                            ? "bg-green-100 text-green-800 border border-green-200"
                            : "bg-red-100 text-red-800 border border-red-200"
                        }`}
                      >
                        {list.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          associatedAutomation
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : "bg-gray-100 text-gray-800 border border-gray-200"
                        }`}
                      >
                        {associatedAutomation ? "Connected" : "Not Connected"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {list.stats?.totalSubscribers || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-zinc-600">
                        {formatDate(list.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Dropdown
                        position="left"
                        options={[
                          {
                            value: "view",
                            label: (
                              <div className="flex items-center gap-2 w-full">
                                <FiEye />
                                View Details
                              </div>
                            ),
                          },
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
                                <FiTrash2 />
                                Delete List
                              </div>
                            ),
                          },
                        ]}
                        placeholder="List Actions"
                        onChange={(val) => {
                          if (val === "view") handleView(list);
                          if (val === "edit") handleEdit(list);
                          if (val === "delete") handleDeleteClick(list);
                          if (val === "copy")
                            navigator.clipboard.writeText(list._id);
                        }}
                      />
                    </TableCell>
                  </div>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          title="0 Lists Found"
          description={`No List Found. Kindly get started by Clicking "Create List Button" to add an List`}
        />
      )}
      {/* List Modal */}
      <ListModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMiniId(null);
          setModalMode("create");
          setFormData({
            name: "",
            description: "",
            isActive: true,
            logo: "",
            automationId: "",
          });
        }}
        isEditing={isEditing}
        isViewing={isViewing}
        formData={formData}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        modalLoading={modalLoading}
        automations={automations}
        selectedAutomation={selectedAutomation}
        handleAutomationConfirm={handleAutomationConfirm}
        isCustomer={!!customer}
      />
      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setListToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete List"
        message={`Are you sure you want to delete the list "${listToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
      <ConfirmationModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Delete Multiple Lists"
        message={`Are you sure you want to delete ${selectedLists.length} lists? This action cannot be undone.`}
        confirmText={bulkDeleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        type="danger"
        disabled={bulkDeleting}
      />
    </SidebarWrapper>
  );
};

export default Lists;
