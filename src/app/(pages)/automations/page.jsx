"use client";
import { useState, useCallback, useLayoutEffect, useEffect } from "react";
import Header from "@/components/Header";
import SidebarWrapper from "@/components/SidebarWrapper";
import {
  Checkbox,
  EmptyState,
  GetUrlParams,
  inputStyles,
  LoadingSpinner,
  TabToggle,
} from "@/presets/styles";
import useAdminStore from "@/store/useAdminStore";
import useCustomerStore from "@/store/useCustomerStore";
import { useToastStore } from "@/store/useToastStore";
import {
  FiTrash2,
  FiSearch,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
  FiEdit,
  FiCopy,
  FiEye,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { Dropdown } from "@/components/Dropdown";
import ConfirmationModal from "@/components/ConfirmationModal";
import AutomationModal from "./AutomationModal";
import {
  fetchWithAuthAdmin,
  fetchWithAuthCustomer,
} from "@/helpers/front-end/request";

/** ---------------- Table primitives (same pattern used by Lists page) ---------------- */
const Table = ({ children, className = "" }) => (
  <div
    className={`w-full min-h-96 bg-white border border-zinc-200 rounded overflow-auto ${className}`}
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
    className={`border-b border-zinc-100 transition-all ${
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

/** ---------------- Page ---------------- */
const Automations = () => {
  const { showSuccess, showError } = useToastStore();
  const { admin, token: adminToken } = useAdminStore();
  const { customer, token: customerToken } = useCustomerStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit" | "view"

  const [automations, setAutomations] = useState([]);
  const [allAutomations, setAllAutomations] = useState([]);
  const [lists, setLists] = useState([]);

  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [editingMiniId, setEditingMiniId] = useState(null);
  const [urlParams, setUrlParams] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [automationToDelete, setAutomationToDelete] = useState(null);

  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });

  // Toolbar state
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedAutomations, setSelectedAutomations] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [searchMode, setSearchMode] = useState("local");
  const [query, setQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true,
    logo: "",
    listId: "",
  });

  // Get URL parameters on component mount
  useEffect(() => {
    const params = GetUrlParams();
    setUrlParams(params);
  }, []);

  // Computed
  const selectedList = lists?.find((l) => l._id === formData.listId);
  const isEditing = modalMode === "edit";
  const isViewing = modalMode === "view";

  /** ---------------- API ---------------- */
  const normalizeAutomationList = useCallback((res) => {
    // Accept both shapes:
    // 1) { success, data: { automations: [ { automation: {}, connectedList, customerData, stepsCount } ] } }
    // 2) { success, data: [ ...plain Automations... ] }
    const arr = res?.data?.automations ?? res?.data ?? [];
    return (arr || []).map((entry) => {
      const a = entry.automation || entry;
      return {
        _id: a._id,
        name: a.name,
        description: a.description,
        isActive: a.isActive,
        logo: a.logo,
        listId: a.listId || entry?.connectedList?._id || null,
        customerId: a.customerId || entry?.customerData?._id || null,
        stepsCount:
          typeof entry?.stepsCount === "number"
            ? entry.stepsCount
            : Array.isArray(a.steps)
            ? a.steps.length
            : 0,
        stats: a.stats,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
    });
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      // GET automations (admin or customer)
      let autoRes;
      if (customer && customer._id && customerToken) {
        autoRes = await fetchWithAuthCustomer({
          url: "/api/work-flow/flow",
          method: "GET",
          customer,
          token: customerToken,
        });
      } else if (admin && admin._id && adminToken) {
        autoRes = await fetchWithAuthAdmin({
          url: "/api/work-flow/flow",
          method: "GET",
          admin,
          token: adminToken,
        });
      } else {
        autoRes = await fetch("/api/work-flow/flow").then((r) => r.json());
      }

      if (!autoRes?.success) throw new Error("Failed to fetch automations.");

      const normalized = normalizeAutomationList(autoRes);
      setAllAutomations(normalized);

      // Filter by URL param ?customerId=...
      if (urlParams.customerId) {
        const filtered = normalized.filter(
          (a) => a.customerId === urlParams.customerId
        );
        setAutomations(filtered);
      } else {
        setAutomations(normalized);
      }

      // Fetch lists for association (admin/customer aware, keep slim)
      let listsRes;
      if (customer && customer._id && customerToken) {
        listsRes = await fetchWithAuthCustomer({
          url: "/api/list?notConnected=false",
          method: "GET",
          customer,
          token: customerToken,
        });
      } else if (admin && admin._id && adminToken) {
        listsRes = await fetchWithAuthAdmin({
          url: "/api/list?notConnected=false",
          method: "GET",
          admin,
          token: adminToken,
        });
      } else {
        listsRes = await fetch("/api/list?notConnected=false").then((r) =>
          r.json()
        );
      }

      if (listsRes?.success) {
        setLists(listsRes.data || []);
      } else {
        setLists([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      showError("Failed to fetch data. Please try again.");
      setAutomations([]);
      setAllAutomations([]);
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [
    admin,
    adminToken,
    customer,
    customerToken,
    urlParams.customerId,
    showError,
    normalizeAutomationList,
  ]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedAutomations.length === 0) return;
    setBulkDeleting(true);
    try {
      // This API doesn't expose a bulk delete; perform sequential deletes.
      const runDelete = async (id) => {
        if (customer && customer._id && customerToken) {
          return fetchWithAuthCustomer({
            url: `/api/work-flow/flow?automationId=${id}`,
            method: "DELETE",
            customer,
            token: customerToken,
          });
        } else if (admin && admin._id && adminToken) {
          return fetchWithAuthAdmin({
            url: `/api/work-flow/flow?automationId=${id}`,
            method: "DELETE",
            admin,
            token: adminToken,
          });
        } else {
          return fetch(`/api/work-flow/flow?automationId=${id}`, {
            method: "DELETE",
          }).then((r) => r.json());
        }
      };

      const results = await Promise.allSettled(
        selectedAutomations.map((id) => runDelete(id))
      );
      const okCount = results.filter(
        (r) => r.status === "fulfilled" && r.value?.success
      ).length;

      showSuccess(
        okCount === selectedAutomations.length
          ? `${okCount} automations deleted successfully!`
          : `${okCount}/${selectedAutomations.length} automations deleted.`
      );
      setSelectedAutomations([]);
      setSelectAll(false);
      setShowBulkDeleteConfirm(false);
      await fetchAllData();
    } catch (error) {
      console.error("Bulk delete error:", error);
      showError(
        error.message || "An error occurred while deleting automations"
      );
    } finally {
      setBulkDeleting(false);
    }
  }, [
    selectedAutomations,
    admin,
    adminToken,
    customer,
    customerToken,
    fetchAllData,
    showSuccess,
    showError,
  ]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setModalLoading(true);

      const method = isEditing ? "PUT" : "POST";
      const url = "/api/work-flow/flow";

      // Build payloads:
      const baseData = {
        name: formData.name,
        description: formData.description,
        isActive: formData.isActive,
        logo: formData.logo,
        listId: formData.listId || null,
      };

      const payload = isEditing
        ? {
            automationId: editingMiniId,
            status: "multi",
            updateData: {
              ...baseData,
              // Ownership change is admin-only; here we only set during create (below)
            },
          }
        : {
            ...baseData,
            // If customer is present, include owner automatically
            customerId: customer?._id || null,
          };

      try {
        const headers = {
          "Content-Type": "application/json",
          ...(customer &&
            customerToken && { "mailer-auth-token": customerToken }),
          ...(admin && adminToken && { "mailer-auth-token": adminToken }),
        };

        const response = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(payload),
        });

        const json = await response.json();
        if (!response.ok || !json?.success) {
          throw new Error(json?.message || "Failed to save automation.");
        }

        setFormData({
          name: "",
          description: "",
          isActive: true,
          logo: "",
          listId: "",
        });
        setIsModalOpen(false);
        setEditingMiniId(null);
        setModalMode("create");
        showSuccess(
          isEditing
            ? "Automation updated successfully!"
            : "Automation created successfully!"
        );
        await fetchAllData();
      } catch (error) {
        console.error("Submission error:", error);
        showError(
          error.message || "An error occurred while saving the automation"
        );
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
      admin,
      adminToken,
      customer,
      customerToken,
    ]
  );

  const handleDelete = useCallback(async () => {
    if (!automationToDelete) return;
    try {
      let response;
      if (customer && customer._id && customerToken) {
        response = await fetchWithAuthCustomer({
          url: `/api/work-flow/flow?automationId=${automationToDelete._id}`,
          method: "DELETE",
          customer,
          token: customerToken,
        });
      } else if (admin && admin._id && adminToken) {
        response = await fetchWithAuthAdmin({
          url: `/api/work-flow/flow?automationId=${automationToDelete._id}`,
          method: "DELETE",
          admin,
          token: adminToken,
        });
      } else {
        response = await fetch(
          `/api/work-flow/flow?automationId=${automationToDelete._id}`,
          { method: "DELETE" }
        ).then((r) => r.json());
      }

      if (!response?.success)
        throw new Error(response?.message || "Failed to delete automation.");

      showSuccess(response?.message || "Automation deleted successfully!");
      setShowDeleteConfirm(false);
      setAutomationToDelete(null);
      await fetchAllData();
    } catch (error) {
      console.error("Deletion error:", error);
      showError(error.message);
    }
  }, [
    automationToDelete,
    fetchAllData,
    showSuccess,
    showError,
    admin,
    adminToken,
    customer,
    customerToken,
  ]);

  /** ---------------- Handlers ---------------- */
  const handleOpenModal = useCallback(async () => {
    setIsModalOpen(true);
    setModalMode("create");
    setEditingMiniId(null);
    setFormData({
      name: "",
      description: "",
      isActive: true,
      logo: "",
      listId: "",
    });

    // Preload lists for selection
    setModalLoading(true);
    try {
      let res;
      if (customer && customer._id && customerToken) {
        res = await fetchWithAuthCustomer({
          url: "/api/list?notConnected=false",
          method: "GET",
          customer,
          token: customerToken,
        });
      } else if (admin && admin._id && adminToken) {
        res = await fetchWithAuthAdmin({
          url: "/api/list?notConnected=false",
          method: "GET",
          admin,
          token: adminToken,
        });
      } else {
        res = await fetch("/api/list?notConnected=false").then((r) => r.json());
      }
      if (res?.success) setLists(res.data || []);
    } catch (error) {
      console.error("Error fetching lists:", error);
      showError(error.message || "Failed to fetch lists");
    } finally {
      setModalLoading(false);
    }
  }, [customer, customerToken, admin, adminToken, showError]);

  const handleEdit = useCallback((automation) => {
    setEditingMiniId(automation._id);
    setModalMode("edit");
    setFormData({
      name: automation.name,
      description: automation.description || "",
      isActive: !!automation.isActive,
      logo: automation.logo || "",
      listId: automation.listId || "",
    });
    setIsModalOpen(true);
  }, []);

  const handleView = useCallback((automation) => {
    setEditingMiniId(automation._id);
    setModalMode("view");
    setFormData({
      name: automation.name,
      description: automation.description || "",
      isActive: !!automation.isActive,
      logo: automation.logo || "",
      listId: automation.listId || "",
    });
    setIsModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((automation) => {
    setAutomationToDelete(automation);
    setShowDeleteConfirm(true);
  }, []);

  const handleListConfirm = useCallback(
    (selection) => {
      setFormData((prev) => ({
        ...prev,
        listId: selection[0] || "",
      }));
    },
    [setFormData]
  );

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value.trim(),
    }));
  }, []);

  // Sort function for header clicks
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Filter and sort client-side (same pattern as Lists page)
  const getFilteredAndSortedAutomations = useCallback(() => {
    let filtered = [...automations];

    // status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((a) =>
        filterStatus === "active" ? a.isActive : !a.isActive
      );
    }

    // search
    if (query) {
      const term = query.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(term) ||
          (a.description && a.description.toLowerCase().includes(term))
      );
    }

    // sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      if (sortConfig.key === "stepsCount") {
        aValue = a.stepsCount || 0;
        bValue = b.stepsCount || 0;
      } else {
        aValue = a[sortConfig.key];
        bValue = b[sortConfig.key];
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [automations, filterStatus, sortConfig, query]);

  const handleSelectAutomation = (id) => {
    setSelectedAutomations((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const filtered = getFilteredAndSortedAutomations();
    if (selectAll) {
      setSelectedAutomations([]);
      setSelectAll(false);
    } else {
      setSelectedAutomations(filtered.map((a) => a._id));
      setSelectAll(true);
    }
  };

  useEffect(() => {
    const filtered = getFilteredAndSortedAutomations();
    if (filtered.length === 0) {
      setSelectAll(false);
    } else {
      const allSelected = filtered.every((a) =>
        selectedAutomations.includes(a._id)
      );
      setSelectAll(allSelected);
    }
  }, [selectedAutomations, getFilteredAndSortedAutomations]);

  // Effects
  useLayoutEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const clearSelection = () => {
    setSelectedAutomations([]);
    setSelectAll(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredAutomations = getFilteredAndSortedAutomations();
  // Find the full object for the automation currently opened in the modal
  const currentAutomation =
    allAutomations.find((a) => a._id === editingMiniId) || null;

  return (
    <SidebarWrapper>
      <Header
        title="Automations & Work Flows"
        buttonText="Create New Automation"
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
                aria-label="Search automations"
                className={`pl-9 ${inputStyles}`}
                placeholder="Search automations by name or description..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

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
                  value: "steps-asc",
                  label: (
                    <div className="flex items-center gap-2 w-full">
                      Steps ↑
                    </div>
                  ),
                },
                {
                  value: "steps-desc",
                  label: (
                    <div className="flex items-center gap-2 w-full">
                      Steps ↓
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
                  case "steps-asc":
                    setSortConfig({ key: "stepsCount", direction: "asc" });
                    break;
                  case "steps-desc":
                    setSortConfig({ key: "stepsCount", direction: "desc" });
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

      {/* Bulk actions bar */}
      {selectedAutomations.length > 0 && (
        <div
          className="sticky top-2 z-10 bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 mb-3 flex items-center gap-2"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="px-2 py-1 rounded-sm text-primary text-xs">
            {selectedAutomations.length} Selected
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
            onClick={clearSelection}
            className="btn btn-xs hover:bg-amber-200 ml-auto text-xs text-amber-900/70 hover:underline rounded-sm"
          >
            Clear
          </button>
        </div>
      )}

      {/* Automations Table */}
      {loading ? (
        <LoadingSpinner />
      ) : filteredAutomations.length > 0 ? (
        <Table>
          <TableHeader>
            <div className="grid grid-cols-[50px_1fr_120px_140px_120px_120px_140px] items-center">
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

              <TableCell className="p-3">List</TableCell>

              <TableCell
                className="p-3 cursor-pointer hover:text-primary"
                onClick={() => handleSort("stepsCount")}
              >
                <div className="flex items-center gap-1">
                  Steps
                  {sortConfig.key === "stepsCount" &&
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
            {filteredAutomations.map((automation) => {
              const isSelected = selectedAutomations.includes(automation._id);
              const hasList = !!automation.listId;

              return (
                <TableRow key={automation._id} isSelected={isSelected}>
                  <div className="grid grid-cols-[50px_1fr_120px_140px_120px_120px_140px] items-center">
                    <TableCell>
                      <Checkbox
                        selected={isSelected}
                        onChange={() => handleSelectAutomation(automation._id)}
                      />
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-20 bg-zinc-100 rounded border overflow-hidden">
                          {automation.logo ? (
                            <img
                              src={automation.logo}
                              alt={automation.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-100 center-flex">
                              <span className="text-xs text-zinc-400">
                                {automation.name?.charAt(0)?.toUpperCase() ||
                                  "A"}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <div
                            className="font-medium text-zinc-800 hover:underline cursor-pointer"
                            onClick={() => handleView(automation)}
                          >
                            {automation.name}
                          </div>
                          <a
                            href={`/automations/work-flow?automationId=${automation._id}`}
                            className="inline-flex items-center gap-2 px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 transition-colors"
                          >
                            <FiEdit className="w-3 h-3" />
                            Edit Work-Flow
                          </a>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          automation.isActive
                            ? "bg-green-100 text-green-800 border border-green-200"
                            : "bg-red-100 text-red-800 border border-red-200"
                        }`}
                      >
                        {automation.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span
                        className={`flex-nowrap px-2 py-1 rounded text-xs ${
                          hasList
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : "bg-gray-100 text-gray-800 border border-gray-200"
                        }`}
                      >
                        {hasList ? "Connected" : "Not Connected"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="font-medium">
                        {automation.stepsCount || 0}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm text-zinc-600">
                        {formatDate(automation.createdAt)}
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
                                <FiTrash2 />
                                Delete Automation
                              </div>
                            ),
                          },
                        ]}
                        placeholder="Automation Actions"
                        onChange={(val) => {
                          if (val === "view") handleView(automation);
                          if (val === "edit") handleEdit(automation);
                          if (val === "delete") handleDeleteClick(automation);
                          if (val === "copy")
                            navigator.clipboard.writeText(automation._id);
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
          title="0 Automations Found"
          description={`No Automation Found. Click "Create New Automation" to add one.`}
        />
      )}

      <AutomationModal
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
            listId: "",
          });
        }}
        isEditing={isEditing}
        isViewing={isViewing}
        formData={formData}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        modalLoading={modalLoading}
        lists={lists}
        selectedList={selectedList}
        handleListConfirm={handleListConfirm}
        isCustomer={!!customer}
        onStatusChange={(status) =>
          setFormData((prev) => ({ ...prev, isActive: status }))
        }
        // NEW: pass stats so the Performance section renders in View mode
        stats={currentAutomation?.stats}
      />

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setAutomationToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Automation"
        message={`Are you sure you want to delete the automation "${automationToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
      <ConfirmationModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Delete Multiple Automations"
        message={`Are you sure you want to delete ${selectedAutomations.length} automations? This action cannot be undone.`}
        confirmText={bulkDeleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        type="danger"
        disabled={bulkDeleting}
      />
    </SidebarWrapper>
  );
};

export default Automations;
