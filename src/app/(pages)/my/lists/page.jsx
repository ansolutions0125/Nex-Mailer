"use client";

import { useState, useCallback, useLayoutEffect, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import SidebarWrapper from "@/components/SidebarWrapper";
import {
  Checkbox,
  EmptyState,
  GetUrlParams as getQueyrPrams, // <- alias name you asked for
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
  FiChevronDown,
  FiChevronUp,
  FiEye,
  FiEdit,
  FiCopy,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { Dropdown } from "@/components/Dropdown";
import ConfirmationModal from "@/components/ConfirmationModal";
import {
  fetchWithAuthAdmin,
  fetchWithAuthCustomer,
} from "@/helpers/front-end/request";

/* ----------------------------- Small table kit ---------------------------- */
const Table = ({ children, className = "" }) => (
  <div className={`w-full min-h-96 bg-white border border-zinc-200 rounded overflow-auto ${className}`}>
    {children}
  </div>
);
const TableHeader = ({ children, className = "" }) => (
  <div className={`w-full bg-zinc-50 border-b border-zinc-200 text-xs uppercase ${className}`}>{children}</div>
);
const TableRow = ({ children, className = "", isSelected = false, onClick }) => (
  <div className={`border-b border-zinc-100 transition-all ${isSelected ? "bg-blue-50" : ""} ${className}`} onClick={onClick}>
    {children}
  </div>
);
const TableCell = ({ children, className = "", colSpan = 1, onClick }) => (
  <div className={`p-3 ${className}`} style={{ gridColumn: `span ${colSpan}` }} onClick={onClick}>
    {children}
  </div>
);
const TableBody = ({ children, className = "" }) => <div className={className}>{children}</div>;

/* ---------------------------------- Page --------------------------------- */
const Lists = () => {
  /* 1) Standardized hooks + fetchData wrapper (use this pattern everywhere) */
  const { showSuccess, showError } = useToastStore();
  const { admin, token: adminToken } = useAdminStore();
  const { customer, token: customerToken } = useCustomerStore();
  const router = useRouter();

  const fetchData = useCallback(
    async (url, method = "GET", payload = null) => {
      if (customer && customer._id && customerToken) {
        return await fetchWithAuthCustomer({
          url,
          method,
          customer,
          token: customerToken,
          payload,
        });
      } else if (admin && admin._id && adminToken) {
        return await fetchWithAuthAdmin({
          url,
          method,
          admin,
          token: adminToken,
          payload,
        });
      }
      throw new Error("No valid authentication");
    },
    [customer, customerToken, admin, adminToken]
  );

  /* 2) State */
  const [lists, setLists] = useState([]);
  const [allLists, setAllLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [urlParams, setUrlParams] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [listToDelete, setListToDelete] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });

  // Toolbar
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedLists, setSelectedLists] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [searchMode, setSearchMode] = useState("local");
  const [query, setQuery] = useState("");

  /* 3) URL params (customerId filtering supported) */
  useEffect(() => {
    const params = getQueyrPrams();
    setUrlParams(params);
  }, []);

  /* 4) Data load */
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchData("/api/list", "GET");
      if (!res?.success) throw new Error(res?.message || "Failed to fetch lists.");

      const data = res.data || [];
      setAllLists(data);

      if (urlParams.customerId) {
        const filtered = data.filter((l) => l.customerId === urlParams.customerId);
        setLists(filtered);
      } else {
        setLists(data);
      }
    } catch (err) {
      console.error(err);
      showError(err.message || "Failed to fetch data. Please try again.");
      setAllLists([]);
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [fetchData, urlParams.customerId, showError]);

  useLayoutEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  /* 5) Bulk delete */
  const handleBulkDelete = useCallback(async () => {
    if (selectedLists.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetchData("/api/list", "DELETE", { listIds: selectedLists });
      if (!res?.success) throw new Error(res?.message || "Failed to delete lists.");

      showSuccess(res.message || `${selectedLists.length} lists deleted successfully!`);
      setSelectedLists([]);
      setSelectAll(false);
      setShowBulkDeleteConfirm(false);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showError(err.message || "An error occurred while deleting lists");
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedLists, fetchAllData, fetchData, showSuccess, showError]);

  /* 6) CSV export (kept as direct blob download) */
  const handleExportCSV = useCallback(async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/list?action=exportCSV", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to export lists.");

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
    } catch (err) {
      console.error(err);
      showError(err.message || "An error occurred while exporting lists");
    } finally {
      setExporting(false);
    }
  }, [showSuccess, showError]);

  /* 7) Single delete */
  const handleDelete = useCallback(async () => {
    if (!listToDelete) return;
    try {
      const res = await fetchData(`/api/list?id=${listToDelete._id}`, "DELETE");
      if (!res?.success) throw new Error(res?.message || "Failed to delete list.");

      showSuccess(res.message || "List deleted successfully!");
      setShowDeleteConfirm(false);
      setListToDelete(null);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showError(err.message || "Failed to delete list.");
    }
  }, [listToDelete, fetchAllData, fetchData, showSuccess, showError]);

  /* 8) Sorting/filtering/searching helpers */
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const getFilteredAndSortedLists = useCallback(() => {
    let filtered = [...lists];

    if (filterStatus !== "all") {
      filtered = filtered.filter((l) => (filterStatus === "active" ? l.isActive : !l.isActive));
    }

    if (query) {
      const term = query.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.name.toLowerCase().includes(term) ||
          (l.description && l.description.toLowerCase().includes(term))
      );
    }

    filtered.sort((a, b) => {
      let aVal, bVal;
      if (sortConfig.key === "stats.totalSubscribers") {
        aVal = a.stats?.totalSubscribers ?? 0;
        bVal = b.stats?.totalSubscribers ?? 0;
      } else {
        aVal = a[sortConfig.key];
        bVal = b[sortConfig.key];
      }
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [lists, filterStatus, sortConfig, query]);

  /* 9) Selection handling */
  const handleSelectList = (id) =>
    setSelectedLists((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSelectAll = () => {
    const filtered = getFilteredAndSortedLists();
    if (selectAll) {
      setSelectedLists([]);
      setSelectAll(false);
    } else {
      setSelectedLists(filtered.map((l) => l._id));
      setSelectAll(true);
    }
  };

  useEffect(() => {
    const filtered = getFilteredAndSortedLists();
    if (filtered.length === 0) {
      setSelectAll(false);
    } else {
      const allSelected = filtered.every((l) => selectedLists.includes(l._id));
      setSelectAll(allSelected);
    }
  }, [selectedLists, getFilteredAndSortedLists]);

  const clearSelection = () => {
    setSelectedLists([]);
    setSelectAll(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const filteredLists = getFilteredAndSortedLists();

  return (
    <SidebarWrapper>
      <Header
        title="Lists & Work Flows"
        buttonText="Create New List"
        onButtonClick={() => router.push("/my/lists/edit")}
        subtitle="Manage your automations and work flows"
      />

      {/* Toolbar */}
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

          <Dropdown
            position="bottom"
            options={[
              { value: "local", label: <div className="flex items-center gap-2 w-full">Local Search</div> },
              { value: "live", label: <div className="flex items-center gap-2 w-full">Live Search</div> },
            ]}
            placeholder="Search Mode"
            onChange={(val) => setSearchMode(val)}
            value={searchMode}
            className="w-48"
          />

          <div className="flex gap-1">
            <button onClick={() => fetchAllData()} className="btn btn-sm btn-primary gap-2" title="Refresh">
              <FiRefreshCw />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs & sorting */}
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
                { value: "newest", label: <div className="flex items-center gap-2 w-full">Newest First</div> },
                { value: "oldest", label: <div className="flex items-center gap-2 w-full">Oldest First</div> },
                { value: "name-asc", label: <div className="flex items-center gap-2 w-full">Name A-Z</div> },
                { value: "name-desc", label: <div className="flex items-center gap-2 w-full">Name Z-A</div> },
                { value: "subscribers-asc", label: <div className="flex items-center gap-2 w-full">Subscribers ↑</div> },
                { value: "subscribers-desc", label: <div className="flex items-center gap-2 w-full">Subscribers ↓</div> },
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
                    setSortConfig({ key: "stats.totalSubscribers", direction: "asc" });
                    break;
                  case "subscribers-desc":
                    setSortConfig({ key: "stats.totalSubscribers", direction: "desc" });
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

      {/* Bulk actions */}
      {selectedLists.length > 0 && (
        <div className="sticky top-2 z-10 bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 mb-3 flex items-center gap-2" role="region" aria-label="Bulk actions">
          <span className="px-2 py-1 rounded-sm text-primary text-xs">{selectedLists.length} Selected</span>
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            disabled={bulkDeleting}
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-red-500 hover:bg-red-600 disabled:bg-red-400 disabled:cursor-not-allowed"
          >
            {bulkDeleting ? <ImSpinner5 className="animate-spin h-3 w-3" /> : <FiTrash2 />}
            Delete selected
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-zinc-500 hover:bg-zinc-600 disabled:bg-zinc-400 disabled:cursor-not-allowed"
            title="Export all lists to CSV"
          >
            {exporting ? <ImSpinner5 className="animate-spin h-3 w-3" /> : <FiDownload />}
            Export All
          </button>
          <button onClick={clearSelection} className="btn btn-xs hover:bg-amber-200 ml-auto text-xs text-amber-900/70 hover:underline rounded-sm">
            Clear
          </button>
        </div>
      )}

      {/* Table / Empty / Loader */}
      {loading ? (
        <LoadingSpinner />
      ) : filteredLists.length > 0 ? (
        <Table>
          <TableHeader>
            <div className="grid grid-cols-[50px_1fr_120px_140px_120px_120px_140px] items-center">
              <TableCell className="p-3">
                <Checkbox selected={selectAll} onChange={handleSelectAll} />
              </TableCell>
              <TableCell className="p-3 cursor-pointer hover:text-primary" onClick={() => handleSort("name")}>
                <div className="flex items-center gap-1">
                  Name
                  {sortConfig.key === "name" && (sortConfig.direction === "asc" ? <FiChevronUp /> : <FiChevronDown />)}
                </div>
              </TableCell>
              <TableCell className="p-3">Status</TableCell>
              <TableCell className="p-3">Automation</TableCell>
              <TableCell className="p-3 cursor-pointer hover:text-primary" onClick={() => handleSort("stats.totalSubscribers")}>
                <div className="flex items-center gap-1">
                  Subscribers
                  {sortConfig.key === "stats.totalSubscribers" && (sortConfig.direction === "asc" ? <FiChevronUp /> : <FiChevronDown />)}
                </div>
              </TableCell>
              <TableCell className="p-3 cursor-pointer hover:text-primary" onClick={() => handleSort("createdAt")}>
                <div className="flex items-center gap-1">
                  Created
                  {sortConfig.key === "createdAt" && (sortConfig.direction === "asc" ? <FiChevronUp /> : <FiChevronDown />)}
                </div>
              </TableCell>
              <TableCell className="p-3">Actions</TableCell>
            </div>
          </TableHeader>

          <TableBody>
            {filteredLists.map((list) => {
              const isSelected = selectedLists.includes(list._id);
              const isConnected = Boolean(list.automationId);

              return (
                <TableRow key={list._id} isSelected={isSelected}>
                  <div className="grid grid-cols-[50px_1fr_120px_140px_120px_120px_140px] items-center">
                    <TableCell>
                      <Checkbox selected={isSelected} onChange={() => handleSelectList(list._id)} />
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-20 bg-zinc-100 rounded border overflow-hidden">
                          {list.logo ? (
                            <img src={list.logo} alt={list.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-zinc-100 center-flex">
                              <span className="text-xs text-zinc-400">{list.name?.charAt(0)?.toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <div
                            className="font-medium text-zinc-800 hover:underline cursor-pointer"
                            onClick={() => router.push(`/my/lists/edit?listId=${list._id}`)}
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
                        className={`flex-nowrap px-2 py-1 rounded text-xs ${
                          isConnected
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : "bg-gray-100 text-gray-800 border border-gray-200"
                        }`}
                      >
                        {isConnected ? "Connected" : "Not Connected"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="font-medium">{list.stats?.totalSubscribers || 0}</span>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm text-zinc-600">{formatDate(list.createdAt)}</span>
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
                          if (val === "view") router.push(`/my/lists/edit?listId=${list._id}&mode=view`);
                          if (val === "edit") router.push(`/my/lists/edit?listId=${list._id}`);
                          if (val === "delete") {
                            setListToDelete(list);
                            setShowDeleteConfirm(true);
                          }
                          if (val === "copy") navigator.clipboard.writeText(list._id);
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
          description={`No List Found. Click "Create New List" to add a List.`}
        />
      )}

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
