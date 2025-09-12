"use client";

import React, { useState, useEffect, useLayoutEffect } from "react";
import {
  Search,
  Filter,
  Mail,
  MailOpen,
  AlertCircle,
  Clock,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import SidebarWrapper from "@/components/SidebarWrapper";
import { Dropdown } from "@/components/Dropdown";
import { FiGrid, FiList, FiTrash } from "react-icons/fi";

const EmailLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState({});
  const [pagination, setPagination] = useState({});
  const [selectedLogs, setSelectedLogs] = useState([]);

  // State for filter context information
  const [filterContext, setFilterContext] = useState({});

  // Read URL params on initial load
  const [contactIdFromUrl, setContactIdFromUrl] = useState();
  const [flowIdFromUrl, setFlowIdFromUrl] = useState();
  const [listIdFromUrl, setListIdFromUrl] = useState();
  const [websiteIdFromUrl, setWebsiteIdFromUrl] = useState();

  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }

  useLayoutEffect(() => {
    const contactId = getQueryParam("contactId");
    const flowId = getQueryParam("flowId");
    const listId = getQueryParam("listId");
    const websiteId = getQueryParam("websiteId");

    setContactIdFromUrl(contactId)
    setFlowIdFromUrl(flowId)
    setListIdFromUrl(listId)
    setWebsiteIdFromUrl(websiteId)
  }, [getQueryParam]);
  // Usage

  // Filter and search states
  const [filters, setFilters] = useState({
    page: 1,
    limit: 30,
    status: "",
    search: "",
    dateFrom: "",
    dateTo: "",
    sortBy: "sentAt",
    sortOrder: "desc",
    contactId: contactIdFromUrl || "",
    flowId: flowIdFromUrl || "",
    listId: listIdFromUrl || "",
    websiteId: websiteIdFromUrl || "",
  });

  const [showFilters, setShowFilters] = useState(false);

  // Filter and layout states
  const [viewMode, setViewMode] = useState("single"); // 'single' or 'double'
  const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'active', 'inactive'
  const [selectAll, setSelectAll] = useState(false);

  // Check if any URL parameters are present
  const hasUrlFilters =
    contactIdFromUrl || flowIdFromUrl || listIdFromUrl || websiteIdFromUrl;

  // Menu options for each log card
  const getLogMenuOptions = (log) => [
    { value: "view", label: "👁️ View Details" },
    { value: "resend", label: "🔄 Resend Email" },
    { value: "delete", label: "🗑️ Delete Log" },
  ];

  // Handle individual log actions
  const handleLogAction = (logId, action) => {
    switch (action) {
      case "delete":
        if (confirm("Are you sure you want to delete this log?")) {
          // Add delete logic here
          console.log("Delete log:", logId);
        }
        break;
      case "resend":
        console.log("Resend email:", logId);
        break;
      case "view":
        console.log("View log details:", logId);
        break;
      default:
        break;
    }
  };

  // Fetch logs from API
  const fetchLogs = async (newFilters = filters) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      Object.entries(newFilters).forEach(([key, value]) => {
        if (value && value !== "") {
          queryParams.append(key, value);
        }
      });

      const response = await fetch(`/api/logs?${queryParams.toString()}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data.logs);
        setStatistics(data.data.statistics);
        setPagination(data.data.pagination);
        setFilterContext(data.data.filterContext || {});
        setError(null);
      } else {
        throw new Error(data.error || "Failed to fetch logs");
      }
    } catch (err) {
      setError(err.message);
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(filters);
  }, []);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value, page: 1 };
    setFilters(newFilters);
    fetchLogs(newFilters);
  };

  const handlePageChange = (newPage) => {
    const newFilters = { ...filters, page: newPage };
    setFilters(newFilters);
    fetchLogs(newFilters);
  };

  const handleRowSelect = (logId) => {
    setSelectedLogs((prev) =>
      prev.includes(logId)
        ? prev.filter((id) => id !== logId)
        : [...prev, logId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLogs.length === logs.length) {
      setSelectedLogs([]);
      setSelectAll(false);
    } else {
      setSelectedLogs(logs.map((log) => log._id));
      setSelectAll(true);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLogs.length === 0) return;

    if (
      confirm(`Are you sure you want to delete ${selectedLogs.length} logs?`)
    ) {
      try {
        const response = await fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "bulkDelete",
            logIds: selectedLogs,
          }),
        });

        const result = await response.json();
        if (result.success) {
          setSelectedLogs([]);
          setSelectAll(false);
          fetchLogs();
          alert(`Successfully deleted ${result.deletedCount} logs`);
        }
      } catch (err) {
        alert("Error deleting logs: " + err.message);
      }
    }
  };

  // Simple Filter Display Component - shows when URL params are present
  const FilterDisplay = () => {
    if (
      !contactIdFromUrl &&
      !flowIdFromUrl &&
      !listIdFromUrl &&
      !websiteIdFromUrl
    ) {
      return null;
    }

    let filterText = "";

    if (contactIdFromUrl) {
      const contactName =
        filterContext.contactName || `Contact ID: ${contactIdFromUrl}`;
      const contactEmail = filterContext.contactEmail
        ? ` (${filterContext.contactEmail})`
        : "";
      filterText = `Showing logs for ${contactName}${contactEmail}`;
    } else if (flowIdFromUrl) {
      const flowName = filterContext.flowName || `Flow ID: ${flowIdFromUrl}`;
      filterText = `Showing logs for ${flowName}`;
    } else if (listIdFromUrl) {
      const listName = filterContext.listName || `List ID: ${listIdFromUrl}`;
      filterText = `Showing logs for ${listName}`;
    } else if (websiteIdFromUrl) {
      const websiteName =
        filterContext.websiteName || `Website ID: ${websiteIdFromUrl}`;
      filterText = `Showing logs for ${websiteName}`;
    }

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Filter className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-blue-900">Filtered View</h3>
            <p className="text-sm text-blue-700">{filterText}</p>
          </div>
        </div>
      </div>
    );
  };

  // Status badge component
  const StatusBadge = ({ status, openCount = 0 }) => {
    const getStatusColor = () => {
      switch (status) {
        case "sent":
          return "bg-blue-100 text-blue-800 border-blue-200";
        case "opened":
          return "bg-green-100 text-green-800 border-green-200";
        case "failed":
          return "bg-red-100 text-red-800 border-red-200";
        case "processing":
          return "bg-yellow-100 text-yellow-800 border-yellow-200";
        default:
          return "bg-gray-100 text-gray-800 border-gray-200";
      }
    };

    const getStatusIcon = () => {
      switch (status) {
        case "sent":
          return <Mail size={12} />;
        case "opened":
          return <MailOpen size={12} />;
        case "failed":
          return <AlertCircle size={12} />;
        case "processing":
          return <Clock size={12} />;
        default:
          return null;
      }
    };

    return (
      <div className="flex items-center gap-1">
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border ${getStatusColor()}`}
        >
          {getStatusIcon()}
          {status}
        </span>
        {openCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-purple-100 text-purple-800 border border-purple-200">
            <Eye size={12} />
            {openCount}
          </span>
        )}
      </div>
    );
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

  // Email Log Card Component
  const EmailLogCard = ({ log, isSelected, onSelect }) => (
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
            onClick={() => onSelect(log._id)}
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
            ? "flex flex-col"
            : "between-flex flex-col lg:flex-row"
        } gap-6`}
      >
        <div className="flex items-center gap-3 md:gap-5">
          <div className="border border-zinc-200 p-1 rounded-lg overflow-hidden w-12 h-20">
            <div className="w-full h-full bg-zinc-100 border flex items-center justify-center p-2">
              <Mail className="text-zinc-400 w-full h-full" />
            </div>
          </div>
          <div className="flex flex-col">
            <StatusBadge status={log.status} openCount={log.openCount} />
            <h2 className="text-lg text-zinc-700 font-medium mt-1">
              {log.contactName || "Unknown"}
            </h2>
            <p className="text-xs text-zinc-500 mb-2">{log.contactEmail}</p>

            <Dropdown
              position="bottom"
              options={getLogMenuOptions(log)}
              value=""
              onChange={(action) => handleLogAction(log._id, action)}
              placeholder="Actions Menu"
              className="w-48"
            />
          </div>
        </div>

        <div
          className={`flex-1 grid gap-3 ${
            viewMode === "double" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-4"
          }`}
        >
          <MiniCard title="Subject" subLine={log.subject || "No subject"} />
          <MiniCard title="Server" subLine={log.serverName || "Unknown"} />
          <MiniCard title="Flow" subLine={log.flowName || "Unknown"} />
          <MiniCard
            title="Sent"
            subLine={new Date(log.sentAt).toLocaleDateString()}
          />
        </div>
      </div>
    </div>
  );

  const MetricCard = ({ title, value, special }) => {
    const getIconColor = (title) => {
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes("total")) return "bg-blue-500/70";
      if (lowerTitle.includes("new")) return "bg-green-500/70";
      if (lowerTitle.includes("email")) return "bg-purple-500/70";
      return "";
    };

    return (
      <div
        className={`flex items-start gap-3   ${
          special ? "border border-zinc-200 rounded" : "bg-white"
        } p-3`}
      >
        {getIconColor(title) && (
          <div className={`w-0.5 h-full rounded-full ${getIconColor(title)}`} />
        )}
        <div>
          <div className="flex items-center gap-2">
            <h3
              className={`text-xs ${
                special ? "text-zinc-800" : "text-zinc-500"
              } uppercase`}
            >
              {title}
            </h3>
          </div>
          <div
            className={`text-lg md:text-xl font-medium ${
              special ? "text-zinc-800" : "text-zinc-700"
            }  mb-1`}
          >
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
            ) : (
              value?.toLocaleString() || "0"
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <SidebarWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Logs</h1>
          <p className="text-gray-600">
            Monitor and analyze your email delivery performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs()}
            className="btn btn-sm md:btn-md btn-primary"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          {selectedLogs.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="btn btn-md gap-2 border border-zinc-300 hover:bg-red-500 rounded hover:text-white"
            >
              <FiTrash size={16} />
              Delete ({selectedLogs.length})
            </button>
          )}
        </div>
      </div>

      {/* Filter Display Box */}
      <FilterDisplay />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 border-b">
        <MetricCard title="Total Users" value={statistics.totalEmails || "0"} />
        <MetricCard
          title="Emails Opened"
          value={statistics.openedEmails || "0"}
        />
      </div>

      {/* Filter and Selection Controls */}
      <div className="w-full bg-zinc-50 border px-4 p-2 rounded mb-4">
        <div className="flex flex-col">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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
              {/* Search */}
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Search emails, subjects..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="pl-9 px-4 py-2 text-sm outline-none border border-zinc-300 rounded "
                />
              </div>
              <Dropdown
                options={[
                  { value: "", label: "All Status" },
                  { value: "sent", label: "Sent" },
                  { value: "opened", label: "Opened" },
                  { value: "failed", label: "Failed" },
                  { value: "processing", label: "Processing" },
                ]}
                value={filters.status}
                onChange={(value) => handleFilterChange("status", value)}
                placeholder="Select Status"
              />
              <Dropdown
                options={[
                  { value: "sentAt-desc", label: "Newest First" },
                  { value: "sentAt-asc", label: "Oldest First" },
                  { value: "email-asc", label: "Email A-Z" },
                  { value: "status-asc", label: "Status" },
                ]}
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onChange={(value) => {
                  const [sortBy, sortOrder] = value.split("-");
                  setFilters((prev) => ({ ...prev, sortBy, sortOrder }));
                  fetchLogs({ ...filters, sortBy, sortOrder });
                }}
                placeholder="Sort By"
                className="w-full"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn btn-sm btn-second"
              >
                <Filter size={16} />
                {showFilters ? "Hide Filters" : "More Filters"}
              </button>
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
                    selectedLogs.length > 0
                      ? "bg-primary border-primary"
                      : "border-zinc-300 hover:border-primary"
                  }`}
                >
                  {selectedLogs.length > 0 && (
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
                {selectedLogs.length > 0 && (
                  <div className="flex items-center gap-2 pl-3 border-l border-zinc-200">
                    <span className="text-xs text-zinc-500">Actions:</span>
                    <button
                      onClick={handleBulkDelete}
                      className="btn btn-sm hover:bg-red-500 rounded hover:text-white"
                    >
                      Delete ({selectedLogs.length})
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="px-4 pt-3 mt-3 pb-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1 uppercase">
                  Date From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    handleFilterChange("dateFrom", e.target.value)
                  }
                  className="w-full px-3 py-1.5 text-sm rounded outline-none border border-zinc-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1 uppercase">
                  Date To
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded outline-none border border-zinc-300"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin" size={24} />
          <span className="ml-2 text-gray-600">Loading logs...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle size={20} />
            <span className="font-medium">Error loading logs</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
          <button
            onClick={() => fetchLogs()}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Email Cards Grid */}
      {!loading && !error && (
        <div>
          {logs.length > 0 ? (
            <div
              className={`grid gap-5 ${
                viewMode === "double"
                  ? "grid-cols-1 lg:grid-cols-2"
                  : "grid-cols-1"
              }`}
            >
              {logs.map((log) => {
                const isSelected = selectedLogs.includes(log._id);
                return (
                  <EmailLogCard
                    key={log._id}
                    log={log}
                    isSelected={isSelected}
                    onSelect={handleRowSelect}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Mail className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No email logs found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                No emails match your current filters.
              </p>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="relative ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{logs.length}</span>{" "}
                    of{" "}
                    <span className="font-medium">
                      {pagination.totalItems || 0}
                    </span>{" "}
                    results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() =>
                        handlePageChange(pagination.currentPage - 1)
                      }
                      disabled={!pagination.hasPrevPage}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {/* Page numbers */}
                    {Array.from(
                      { length: Math.min(5, pagination.totalPages) },
                      (_, i) => {
                        const pageNum = pagination.currentPage - 2 + i;
                        if (pageNum < 1 || pageNum > pagination.totalPages)
                          return null;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              pageNum === pagination.currentPage
                                ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                                : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      }
                    )}

                    <button
                      onClick={() =>
                        handlePageChange(pagination.currentPage + 1)
                      }
                      disabled={!pagination.hasNextPage}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </SidebarWrapper>
  );
};

export default EmailLogs;
