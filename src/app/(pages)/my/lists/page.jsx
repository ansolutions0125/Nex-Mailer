"use client";

import { useState, useCallback, useLayoutEffect, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import SidebarWrapper from "@/components/SidebarWrapper";
import {
  Checkbox,
  EmptyState,
  GetUrlParams as getQueyrPrams,
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
  FiDownload,
  FiRefreshCw,
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
import TableFull from "@/components/TableFull";
import { FaListCheck } from "react-icons/fa6";
import ListDetailsModal from "./ListDetailsModal";

/* ---------------------------------- Page --------------------------------- */
const Lists = () => {
  /* 1) Hooks & fetch wrapper */
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
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });

  /* 3) Detail modal state */
  const [detailsList, setDetailsList] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  /* 4) Toolbar state */
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedLists, setSelectedLists] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [searchMode, setSearchMode] = useState("local");
  const [query, setQuery] = useState("");

  /* 5) URL params */
  useEffect(() => {
    const params = getQueyrPrams();
    setUrlParams(params);
  }, []);

  /* 6) Data load */
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchData("/api/list", "GET");
      if (!res?.success)
        throw new Error(res?.message || "Failed to fetch lists.");
      const data = res.data || [];
      setAllLists(data);
      if (urlParams.customerId) {
        setLists(data.filter((l) => l.customerId === urlParams.customerId));
      } else {
        setLists(data);
      }
    } catch (err) {
      console.error(err);
      showError(err.message || "Failed to fetch data.");
      setAllLists([]);
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [fetchData, urlParams.customerId, showError]);

  useLayoutEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  /* 7) Bulk delete */
  const handleBulkDelete = useCallback(async () => {
    if (selectedLists.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetchData("/api/list", "DELETE", {
        listIds: selectedLists,
      });
      if (!res?.success)
        throw new Error(res?.message || "Failed to delete lists.");
      showSuccess(
        res.message || `${selectedLists.length} lists deleted successfully!`
      );
      setSelectedLists([]);
      setSelectAll(false);
      setShowBulkDeleteConfirm(false);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showError(err.message || "Error deleting lists.");
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedLists, fetchAllData, fetchData, showSuccess, showError]);

  /* 8) Export CSV */
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
      showError(err.message || "Error exporting lists.");
    } finally {
      setExporting(false);
    }
  }, [showSuccess, showError]);

  /* 9) Single delete */
  const handleDelete = useCallback(async () => {
    if (!listToDelete) return;
    try {
      const res = await fetchData(`/api/list?id=${listToDelete._id}`, "DELETE");
      if (!res?.success)
        throw new Error(res?.message || "Failed to delete list.");
      showSuccess(res.message || "List deleted successfully!");
      setShowDeleteConfirm(false);
      setListToDelete(null);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      showError(err.message || "Failed to delete list.");
    }
  }, [listToDelete, fetchAllData, fetchData, showSuccess, showError]);

  /* 10) Filter + Sort */
  const getFilteredAndSortedLists = useCallback(() => {
    let filtered = [...lists];
    if (filterStatus !== "all") {
      filtered = filtered.filter((l) =>
        filterStatus === "active" ? l.isActive : !l.isActive
      );
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

  /* 11) Selection helpers */
  const handleSelectList = (id) =>
    setSelectedLists((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

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

  /* 12) Row actions */
  const handleAction = useCallback(
    (action, list) => {
      if (action === "view") {
        console.log("its working");
        setDetailsList(list);
        setShowDetails(true);
      } else if (action === "edit") {
        router.push(`/my/lists/edit?listId=${list._id}`);
      } else if (action === "copy") {
        navigator.clipboard.writeText(list._id);
        showSuccess("List ID copied to clipboard!");
      } else if (action === "delete") {
        setListToDelete(list);
        setShowDeleteConfirm(true);
      }
    },
    [router, showSuccess]
  );

  const filteredLists = getFilteredAndSortedLists();

  /* 13) Columns for TableFull */
  const columns = [
    {
      header: (
        <Checkbox
          selected={
            filteredLists.length > 0 &&
            filteredLists.every((l) => selectedLists.includes(l._id))
          }
          onChange={handleSelectAll}
        />
      ),
      accessor: "_id",
      render: (_, row) => (
        <Checkbox
          selected={selectedLists.includes(row._id)}
          onChange={() => handleSelectList(row._id)}
        />
      ),
      headerClassName: "w-10",
    },
    {
      header: "Name",
      accessor: "name",
      render: (_, row) => (
        <div
          className="flex items-center gap-3"
          onClick={() => handleAction("view", row)}
        >
          <div className="w-10 h-10 p-2.5 center-flex rounded bg-zinc-50 border border-zinc-200">
            <FaListCheck className="w-full h-full" />
          </div>
          <div className="text-sm text-zinc-800 hover:underline cursor-pointer">
            {row.name}
          </div>
        </div>
      ),
    },
    {
      header: "Status",
      accessor: "isActive",
      render: (v) => (
        <span
          className={`px-2 py-1 rounded text-xs ${
            v
              ? "bg-green-100 text-green-800 border border-green-200"
              : "bg-red-100 text-red-800 border border-red-200"
          }`}
        >
          {v ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      header: "Automation",
      accessor: "automationId",
      render: (v) => (
        <span
          className={`flex-nowrap px-2 py-1 rounded text-xs ${
            v
              ? "bg-blue-100 text-blue-800 border border-blue-200"
              : "bg-gray-100 text-gray-800 border border-gray-200"
          }`}
        >
          {v ? "Connected" : "Not Connected"}
        </span>
      ),
    },
    {
      header: "Subscribers",
      accessor: "stats.totalSubscribers",
      render: (_, row) => (
        <span className="font-medium">{row.stats?.totalSubscribers || 0}</span>
      ),
    },
    {
      header: "Created",
      accessor: "createdAt",
      render: (v) => (
        <span className="text-zinc-600">
          {new Date(v).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
          })}
        </span>
      ),
    },
    {
      header: "Actions",
      accessor: "actions",
      render: (_, row) => (
        <div className="flex justify-end">
          <Dropdown
            position="left"
            placeholder="Actions"
            options={[
              {
                value: "view",
                label: (
                  <div className="flex items-center gap-2">
                    <FiEye /> View Details
                  </div>
                ),
              },
              {
                value: "edit",
                label: (
                  <div className="flex items-center gap-2">
                    <FiEdit /> Edit List
                  </div>
                ),
              },
              {
                value: "copy",
                label: (
                  <div className="flex items-center gap-2">
                    <FiCopy /> Copy List Id
                  </div>
                ),
              },
              {
                value: "delete",
                label: (
                  <div className="flex items-center gap-2">
                    <FiTrash2 /> Delete List
                  </div>
                ),
              },
            ]}
            onChange={(val) => handleAction(val, row)}
            className="w-32"
          />
        </div>
      ),
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
  ];

  /* 14) Render */
  return (
    <SidebarWrapper>
      <Header
        title="Lists & Work Flows"
        buttonText="Create New List"
        onButtonClick={() => router.push("/my/lists/edit")}
        subtitle="Manage your automations and work flows"
      />

      {/* Toolbar */}
      <div className="bg-white border-b border-zinc-200 p-3 mb-3">
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
                { value: "newest", label: "Newest First" },
                { value: "oldest", label: "Oldest First" },
                { value: "name-asc", label: "Name A-Z" },
                { value: "name-desc", label: "Name Z-A" },
                { value: "subscribers-asc", label: "Subscribers ↑" },
                { value: "subscribers-desc", label: "Subscribers ↓" },
              ]}
              value={
                sortConfig.key === "createdAt" &&
                sortConfig.direction === "desc"
                  ? "newest"
                  : sortConfig.key === "createdAt" &&
                    sortConfig.direction === "asc"
                  ? "oldest"
                  : sortConfig.key === "name" && sortConfig.direction === "asc"
                  ? "name-asc"
                  : sortConfig.key === "name" && sortConfig.direction === "desc"
                  ? "name-desc"
                  : sortConfig.key === "stats.totalSubscribers" &&
                    sortConfig.direction === "asc"
                  ? "subscribers-asc"
                  : sortConfig.key === "stats.totalSubscribers" &&
                    sortConfig.direction === "desc"
                  ? "subscribers-desc"
                  : "newest"
              }
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

      {/* Bulk actions bar */}
      {selectedLists.length > 0 && (
        <div className="sticky top-2 z-10 bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 mb-3 flex items-center gap-2">
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

      {/* Table or empty */}
      {loading ? (
        <LoadingSpinner />
      ) : filteredLists.length > 0 ? (
        <TableFull
          columns={columns}
          data={filteredLists}
          loading={loading}
          emptyPlaceholder={
            <EmptyState
              title="0 Lists Found"
              description='No List Found. Click "Create New List" to add a List.'
            />
          }
          rowKey={(row) => row._id}
        />
      ) : (
        <EmptyState
          title="0 Lists Found"
          description='No List Found. Click "Create New List" to add a List.'
        />
      )}

      {showDetails && (
        <ListDetailsModal
          list={detailsList}
          onClose={() => setShowDetails(false)}
        />
      )}

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
