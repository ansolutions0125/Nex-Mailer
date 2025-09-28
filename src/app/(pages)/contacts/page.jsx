"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import SidebarWrapper from "@/components/SidebarWrapper";
import Header from "@/components/Header";
import {
  fetchWithAuthAdmin,
  fetchWithAuthCustomer,
} from "@/helpers/front-end/request";
import useAdminStore from "@/store/useAdminStore";
import { useToastStore } from "@/store/useToastStore";
import {
  Checkbox,
  EmptyState,
  inputStyles,
  LoadingSpinner,
  TabToggle,
} from "@/presets/styles";
import useCustomerStore from "@/store/useCustomerStore";
import { Dropdown } from "@/components/Dropdown";
import {
  FiSearch,
  FiTrash2,
  FiRefreshCw,
  FiCopy,
  FiX,
  FiChevronUp,
  FiChevronDown,
} from "react-icons/fi";
import TableFull from "@/components/TableFull";
import ConfirmationModal from "@/components/ConfirmationModal";
import { ImSpinner5 } from "react-icons/im";
import { AnimatePresence, motion } from "framer-motion";
import { FiPackage } from "react-icons/fi";

const formatDate = (d) => (d ? new Date(d).toLocaleString() : "—");

const statusChip = (isActive) => {
  const map = {
    true: "text-emerald-700 bg-emerald-50 border-emerald-200",
    false: "text-rose-700 bg-rose-50 border-rose-200",
  };
  return (
    <span
      className={`text-xs border px-2 py-0.5 rounded ${
        map[isActive] ?? "border-zinc-200 text-zinc-600"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
};

/* ------------------------------ main page ------------------------------ */
export default function ContactsManagementPage() {
  const { admin, token: adminToken } = useAdminStore();
  const { customer, token: customerToken } = useCustomerStore();
  const { showSuccess, showError } = useToastStore();

  const fetchData = useCallback(
    async (url, method = "GET", payload = null) => {
      if (customer?._id && customerToken)
        return fetchWithAuthCustomer({
          url,
          method,
          customer,
          token: customerToken,
          payload,
        });
      if (admin?._id && adminToken)
        return fetchWithAuthAdmin({
          url,
          method,
          admin,
          token: adminToken,
          payload,
        });
      throw new Error("No valid authentication");
    },
    [customer, customerToken, admin, adminToken]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState([]);
  const [allRows, setAllRows] = useState([]);

  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState("all"); // all|active|inactive
  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [details, setDetails] = useState(null);
  const [searchMode, setSearchMode] = useState("live");

  // Bulk actions state
  const [selected, setSelected] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showSoftDeleteConfirm, setShowSoftDeleteConfirm] = useState(false);
  const [showPermDeleteConfirm, setShowPermDeleteConfirm] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({
    fullName: "",
    email: "",
    listId: "",
  });
  const [lists, setLists] = useState([]);

  const hasMore = page < totalPages;

  // Filtered rows for local search and display
  const filteredRows = useMemo(() => {
    let data = searchMode === "local" ? allRows : rows;
    if (statusTab !== "all") {
      data = data.filter((c) =>
        statusTab === "active" ? c.isActive : !c.isActive
      );
    }
    if (searchMode === "local" && query) {
      const lowerQuery = query.toLowerCase();
      data = data.filter(
        (c) =>
          c.email.toLowerCase().includes(lowerQuery) ||
          c.fullName?.toLowerCase().includes(lowerQuery)
      );
    }
    // Sorting is always local on the currently displayed data
    return [...data].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, allRows, query, searchMode, statusTab, sortKey, sortDir]);

  const columns = [
    {
      header: (
        <Checkbox
          selected={selectAll}
          onChange={() => handleSelectAll(filteredRows)}
        />
      ),
      accessor: "_id",
      render: (_, row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            selected={selected.includes(row._id)}
            onChange={() => handleSelect(row._id)}
          />
        </div>
      ),
    },
    {
      header: "Email",
      accessor: "email",
      render: (val) => <span className="font-medium text-zinc-800">{val}</span>,
    },
    {
      header: "Name",
      accessor: "fullName",
      render: (val) => val || "N/A",
    },
    {
      header: "Status",
      accessor: "isActive",
      render: (val) => statusChip(val),
    },
    {
      header: "Connected Lists",
      accessor: "lists",
      render: (lists) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {lists?.map((l) => (
            <span
              key={l._id}
              className="text-xs bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded"
            >
              {l.listId?.name || l.listId}
            </span>
          ))}
          {(!lists || lists.length === 0) && (
            <span className="text-xs text-zinc-400">No lists</span>
          )}
        </div>
      ),
    },
    {
      header: "Updated",
      accessor: "updatedAt",
      render: (val) => formatDate(val),
    },
  ];

  const fetchLists = useCallback(async () => {
    try {
      let json;
      if (customer && customer._id && customerToken) {
        json = await fetchWithAuthCustomer({
          url: `/api/list`,
          method: "GET",
          customer,
          token: customerToken,
        });
      } else if (admin && admin._id && adminToken) {
        json = await fetchWithAuthAdmin({
          url: `/api/list`,
          method: "GET",
          admin,
          token: adminToken,
        });
      }
      if (json?.success) setLists(json.data || []);
    } catch (e) {
      console.error("Failed to fetch lists", e);
    }
  }, [admin, adminToken, customer, customerToken]);

  const fetchPage = useCallback(
    async (p = 1, replace = false) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: "20",
          sortBy: sortKey,
          sortDir,
        });
        if (statusTab !== "all") {
          params.set("isActive", statusTab === "active" ? "true" : "false");
        }
        if (query.trim()) {
          params.set("search", query.trim());
        }

        let json;
        if (customer && customer._id && customerToken) {
          json = await fetchWithAuthCustomer({
            url: `/api/contact/read?${params.toString()}`,
            method: "GET",
            customer,
            token: customerToken,
          });
        } else if (admin && admin._id && adminToken) {
          json = await fetchWithAuthAdmin({
            url: `/api/contact/read?${params.toString()}`,
            method: "GET",
            admin,
            token: adminToken,
          });
        }

        if (!json?.success)
          throw new Error(json?.message || "Failed to fetch contacts");

        const pagination = json?.pagination || { page: p, totalPages: 1 };
        const newRows = json.data || [];

        setRows((prev) => (replace ? newRows : [...prev, ...newRows]));
        setAllRows((prev) => (replace ? newRows : [...prev, ...newRows]));

        setPage(pagination.page || p);
        setTotalPages(pagination.totalPages || 1);
      } catch (e) {
        console.error(e);
        setError(e?.message || "Failed to fetch contacts");
      } finally {
        setLoading(false);
      }
    },
    [admin, customer, fetchData, searchMode, query]
  );

  const saveNewContact = async () => {
    try {
      let json;
      if (customer && customer._id && customerToken) {
        json = await fetchWithAuthCustomer({
          url: `/api/contact/register`,
          method: "POST",
          customer,
          token: customerToken,
          payload: newContact,
        });
      } else if (admin && admin._id && adminToken) {
        json = await fetchWithAuthAdmin({
          url: `/api/contact/register`,
          method: "POST",
          admin,
          token: adminToken,
          payload: newContact,
        });
      }
      if (json?.success) {
        showSuccess("Contact added successfully");
        setShowAddModal(false);
        setNewContact({ fullName: "", email: "", listId: "" });
        fetchPage(1, true);
      } else {
        throw new Error(json?.message || "Failed to add contact");
      }
    } catch (e) {
      showError(e?.message || "Failed to add contact");
    }
  };

  // --- Bulk Actions Logic ---
  const handleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (currentRows) => {
    if (selectAll) {
      setSelected([]);
    } else {
      setSelected(currentRows.map((r) => r._id));
    }
    setSelectAll(!selectAll);
  };

  useEffect(() => {
    if (selected.length === 0) {
      setSelectAll(false);
    } else if (selected.length === filteredRows.length) {
      setSelectAll(true);
    }
  }, [selected, filteredRows]);

  const handleBulkAction = async (action) => {
    if (selected.length === 0) return;
    setIsBulkProcessing(true);
    try {
      const apiAction = action === "soft-delete" ? "soft_delete" : "delete";

      const results = await Promise.allSettled(
        selected.map((contactId) =>
          fetchData("/api/contact/delete", "DELETE", {
            contactId,
            action: apiAction,
          })
        )
      );

      const successes = results.filter(
        (r) => r.status === "fulfilled" && r.value.success
      ).length;
      const failures = selected.length - successes;

      if (successes > 0)
        showSuccess(`${successes} contacts processed successfully.`);
      if (failures > 0) showError(`${failures} contacts failed to process.`);

      setSelected([]);
      await fetchPage(1, true); // Refresh data
    } catch (err) {
      showError(
        err.message || "An unexpected error occurred during the bulk action."
      );
    } finally {
      setIsBulkProcessing(false);
      setShowSoftDeleteConfirm(false);
      setShowPermDeleteConfirm(false);
    }
  };

  useEffect(() => {
    fetchPage(1, true);
  }, []);

  const handleSearch = () => {
    if (searchMode === "live") {
      fetchPage(1, true);
    }
    // Local search is handled by useMemo on `filteredRows`
  };

  const clearSelection = () => setSelected([]);

  return (
    <SidebarWrapper>
      <Header
        title="Contacts"
        subtitle="Manage all your contacts in one place."
        buttonText="Add Contact"
        onButtonClick={() => {
          fetchLists();
          setShowAddModal(true);
        }}
      />

      <div className="bg-white border-b border-zinc-200 p-3 mb-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              aria-label="Search contacts"
              className={`pl-9 ${inputStyles}`}
              placeholder="Search by name or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          <Dropdown
            position="bottom"
            options={[
              { value: "live", label: "Live Search" },
              { value: "local", label: "Local Search" },
            ]}
            placeholder="Search Mode"
            onChange={setSearchMode}
            value={searchMode}
            className="w-48"
          />

          <div className="flex gap-1">
            <button
              onClick={handleSearch}
              className="btn btn-sm btn-primary-two gap-2"
            >
              <FiSearch /> Search
            </button>
            <button
              onClick={() => fetchPage(1, true)}
              className="btn btn-sm btn-primary gap-2"
              title="Refresh"
            >
              <FiRefreshCw />
            </button>
          </div>
        </div>

        <div className="between-flex flex-wrap gap-2 mt-3">
          <TabToggle
            currentTab={statusTab}
            setCurrentTab={setStatusTab}
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
                { value: "updatedAt:desc", label: "Last updated ↓" },
                { value: "updatedAt:asc", label: "Last updated ↑" },
                { value: "createdAt:desc", label: "Created ↓" },
                { value: "createdAt:asc", label: "Created ↑" },
              ]}
              value={`${sortKey}:${sortDir}`}
              onChange={(val) => {
                const [k, d] = val.split(":");
                setSortKey(k);
                setSortDir(d);
              }}
              className="w-48"
              placeholder="Sort By"
            />
          </div>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="sticky top-2 z-10 bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 mb-3 flex items-center gap-2">
          <span className="px-2 py-1 rounded-sm text-primary text-xs">
            {selected.length} Selected
          </span>
          <button
            onClick={() => setShowSoftDeleteConfirm(true)}
            disabled={isBulkProcessing}
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-zinc-500 hover:bg-zinc-600 disabled:bg-zinc-400"
          >
            {isBulkProcessing ? (
              <ImSpinner5 className="animate-spin" />
            ) : (
              <FiTrash2 />
            )}
            Deactivate
          </button>
          <button
            onClick={() => setShowPermDeleteConfirm(true)}
            disabled={isBulkProcessing}
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-red-500 hover:bg-red-600 disabled:bg-red-400"
          >
            {isBulkProcessing ? (
              <ImSpinner5 className="animate-spin" />
            ) : (
              <FiTrash2 />
            )}
            Delete Permanently
          </button>
          <button
            onClick={clearSelection}
            className="btn btn-xs hover:bg-amber-200 ml-auto text-xs text-amber-900/70 hover:underline rounded-sm"
          >
            Clear
          </button>
        </div>
      )}

      {error && <div className="p-4 text-red-600">{error}</div>}

      {loading && filteredRows.length === 0 ? (
        <LoadingSpinner />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title="0 Contact Found"
          description='No contact Found. Click "Add Contact" to add a contact.'
        />
      ) : (
        <TableFull
          columns={columns}
          data={filteredRows}
          onRowClick={(row) => setDetails(row)}
        />
      )}

      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => fetchPage(page + 1)}
            className="text-sm px-4 py-2 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
          >
            Load more ({page}/{totalPages})
          </button>
        </div>
      )}

      {showAddModal && (
        <AddContactModal
          contact={newContact}
          setContact={setNewContact}
          lists={lists}
          onClose={() => setShowAddModal(false)}
          onSave={saveNewContact}
        />
      )}
      {details && (
        <DetailsContactModal
          contact={details}
          onClose={() => setDetails(false)}
          onViewLogs={saveNewContact}
        />
      )}

      <ConfirmationModal
        isOpen={showSoftDeleteConfirm}
        onCancel={() => setShowSoftDeleteConfirm(false)}
        onConfirm={() => handleBulkAction("soft-delete")}
        title="Deactivate Contacts"
        message={`Are you sure you want to deactivate ${selected.length} selected contacts? They can be reactivated later.`}
        confirmText={isBulkProcessing ? "Processing..." : "Deactivate"}
        type="warning"
        disabled={isBulkProcessing}
      />

      <ConfirmationModal
        isOpen={showPermDeleteConfirm}
        onCancel={() => setShowPermDeleteConfirm(false)}
        onConfirm={() => handleBulkAction("perm-delete")}
        title="Permanently Delete Contacts"
        message={`Are you sure you want to permanently delete ${selected.length} selected contacts? This action cannot be undone.`}
        confirmText={isBulkProcessing ? "Deleting..." : "Delete Permanently"}
        type="danger"
        disabled={isBulkProcessing}
      />
    </SidebarWrapper>
  );
}

/* ------------------ Add Contact Modal ------------------ */
function AddContactModal({ contact, setContact, lists, onClose, onSave }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-[90vw] max-w-md bg-white rounded-xl border border-zinc-200 shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Add Contact</h2>
        <div className="space-y-3">
          <input
            type="text"
            className={inputStyles + " w-full"}
            placeholder="Full name"
            value={contact.fullName}
            onChange={(e) =>
              setContact((c) => ({ ...c, fullName: e.target.value }))
            }
          />
          <input
            type="email"
            className={inputStyles + " w-full"}
            placeholder="Email"
            value={contact.email}
            onChange={(e) =>
              setContact((c) => ({ ...c, email: e.target.value }))
            }
          />

          <Dropdown
            options={lists.map((list) => ({
              value: list._id,
              label: list.name,
            }))}
            value={contact.listId}
            onChange={(val) => setContact((c) => ({ ...c, listId: val }))}
            placeholder="Select list (optional)"
            className="w-full"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1 text-sm border border-zinc-300 rounded bg-white hover:bg-zinc-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1 text-sm rounded bg-primary text-white hover:bg-primary-dark"
            onClick={onSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const Section = ({ title, children }) => (
  <div className="bg-white px-6">
    <h3 className="text-lg font-medium text-zinc-800 mb-3 flex items-center gap-2">
      <div className="w-1 h-6 bg-primary rounded-full" />
      {title}
    </h3>
    {children}
  </div>
);

function DetailsContactModal({ contact, onClose, onViewLogs }) {
  const [showRaw, setShowRaw] = useState(false);

  if (!contact) return null;

  /* ---------- derived ---------- */
  const hasLocation =
    contact.location &&
    Object.values(contact.location).some(
      (v) => v !== undefined && v !== null && v !== ""
    );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm center-flex p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
          className="bg-white rounded-lg w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col border border-zinc-200/50 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ------- Header ------- */}
          <div className="relative bg-zinc-50 border-b border-zinc-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-md bg-white border border-b-2 border-zinc-200">
                  <FiPackage className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">
                    {contact.fullName || contact.email}
                  </h2>
                  <p className="text-sm text-zinc-600 mt-1">{contact.email}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 center-flex bg-white border border-zinc-200 rounded hover:bg-zinc-200 transition-all"
              >
                <FiX className="h-5 w-5 text-zinc-600" />
              </button>
            </div>
          </div>

          {/* ------- Scrollable content ------- */}
          <div className="overflow-y-auto flex-1 bg-white">
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 divide-x divide-zinc-300">
              {/* ----- Left column ----- */}
              <div className="lg:col-span-5 space-y-3">
                <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <p className="text-sm font-medium text-zinc-800">
                    {statusChip(contact.isActive)}
                  </p>
                </div>

                <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                    Engagement Score
                  </p>
                  <p className="text-sm font-medium text-zinc-800">
                    {contact.engagement?.engagementScore ?? 0}
                  </p>
                </div>

                <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                    Contact ID
                  </p>
                  <p className="text-xs font-mono text-zinc-600 truncate">
                    {contact._id}
                  </p>
                </div>

                {/* ----- Location ----- */}
                {hasLocation && (
                  <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                      Location
                    </p>
                    <pre className="text-xs text-zinc-700 whitespace-pre-wrap">
                      {JSON.stringify(contact.location, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* ----- Right column ----- */}
              <div className="lg:col-span-7 space-y-6">
                {/* Lists */}
                <Section title="List Memberships">
                  <div className="flex flex-wrap gap-2">
                    {contact.lists?.map((l) => (
                      <span
                        key={l.listId?._id || l.listId}
                        className="text-xs bg-zinc-100 border border-zinc-200 px-2 py-1 rounded"
                      >
                        {l.listId?.name || "Unknown List"}
                      </span>
                    ))}
                    {(!contact.lists || contact.lists.length === 0) && (
                      <p className="text-sm text-zinc-500">Not in any lists.</p>
                    )}
                  </div>
                </Section>

                {/* Automations */}
                <Section title="Automations">
                  <div className="flex flex-wrap gap-2">
                    {contact.automations?.map((a) => (
                      <span
                        key={a._id || a}
                        className="text-xs bg-zinc-100 border border-zinc-200 px-2 py-1 rounded"
                      >
                        {a.name || a}
                      </span>
                    ))}
                    {(!contact.automations ||
                      contact.automations.length === 0) && (
                      <p className="text-sm text-zinc-500">
                        Not enrolled in any automations.
                      </p>
                    )}
                  </div>
                </Section>

                {/* Tags */}
                <Section title="Tags">
                  <div className="flex flex-wrap gap-2">
                    {contact.tags?.map((t) => (
                      <span
                        key={t._id || t}
                        className="text-xs bg-zinc-100 border border-zinc-200 px-2 py-1 rounded"
                      >
                        {t.name || t}
                      </span>
                    ))}
                    {(!contact.tags || contact.tags.length === 0) && (
                      <p className="text-sm text-zinc-500">No tags.</p>
                    )}
                  </div>
                </Section>

                {/* Dates */}
                <Section title="Dates">
                  <p className="text-sm text-zinc-700">
                    Created: {formatDate(contact.createdAt)}
                  </p>
                  <p className="text-sm text-zinc-700">
                    Last Updated: {formatDate(contact.updatedAt)}
                  </p>
                </Section>
              </div>
            </div>

            {/* ----- History timeline ----- */}
            <div className="px-6 pb-6">
              <Section title="History">
                {!contact.history || contact.history.length === 0 ? (
                  <p className="text-sm text-zinc-500">No history yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {contact.history.map((h, idx) => (
                      <li key={idx} className="flex gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                        <div className="flex-1">
                          <p className="text-sm text-zinc-800">{h.message}</p>
                          <p className="text-xs text-zinc-500">
                            {h.type} • {formatDate(h.createdAt)} • {h.createdBy}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            {/* ----- Raw JSON (collapsible) ----- */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowRaw((s) => !s)}
                className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 transition"
              >
                {showRaw ? <FiChevronUp /> : <FiChevronDown />}
                <span>{showRaw ? "Hide" : "Show"} raw JSON</span>
              </button>
              {showRaw && (
                <pre className="mt-3 p-3 bg-zinc-100 border border-zinc-200 rounded text-xs overflow-x-auto">
                  {JSON.stringify(contact, null, 2)}
                </pre>
              )}
            </div>
          </div>

          {/* ------- Footer ------- */}
          <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="btn btn-sm md:btn-md btn-second"
            >
              Close
            </button>
            {onViewLogs && (
              <button
                onClick={() => {
                  onClose();
                  onViewLogs(contact._id);
                }}
                className="btn btn-sm md:btn-md btn-primary-two"
              >
                View Logs
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
