// app/admins/page.jsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import SidebarWrapper from "@/components/SidebarWrapper";
import Header from "@/components/Header";
import { Dropdown } from "@/components/Dropdown";
import {
  FiChevronDown,
  FiChevronRight,
  FiCopy,
  FiEdit,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiToggleLeft,
  FiToggleRight,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import useAdminStore from "@/store/useAdminStore";
import {
  inputStyles,
  labelStyles,
  MiniCard,
  Checkbox,
  ToggleLiver,
  KeyValue,
} from "@/presets/styles";
import { fetchWithAuthAdmin } from "@/helpers/front-end/request";
import { DropdownSearch } from "@/components/DropdownSearch";
import { useToastStore } from "@/store/useToastStore";

/* ------------------------------ utilities ------------------------------ */

const formatDate = (dateString) => {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const handleApiError = (error, defaultMessage = "An error occurred") => {
  console.error("API Error:", error);
  if (error.response && error.response.data) {
    const data = error.response.data;
    const status = error.response.status;
    switch (status) {
      case 401:
        return data.message || "Authentication failed. Please log in again.";
      case 403:
        return (
          data.message || "You don't have permission to perform this action."
        );
      case 404:
        return data.message || "Resource not found.";
      case 429:
        return data.message || "Too many requests. Please try again later.";
      case 400:
        return data.message || "Invalid request data.";
      case 500:
        return data.message || "Server error. Please try again.";
      default:
        return data.message || defaultMessage;
    }
  }
  if (error.message) return error.message;
  if (error.name === "NetworkError" || error.code === "NETWORK_ERROR") {
    return "Network error. Please check your connection.";
  }
  return defaultMessage;
};

const getSuccessMessage = (response, defaultMessage) => {
  if (response?.message) return response.message;
  if (response?.data?.message) return response.data.message;
  return defaultMessage;
};

const roleLabel = (a) => {
  const key = a?.roleKey || a?.roleId?.key;
  const name = a?.roleId?.name;
  if (name && key) return `${name} (${key})`;
  return key || name || "—";
};

/* ------------------------------- page ---------------------------------- */

export default function AdminsPage() {
  const { admin, setAdmin, token } = useAdminStore();
  const { showSuccess, showError, showInfo } = useToastStore();

  // data
  const [admins, setAdmins] = useState([]);
  const [roles, setRoles] = useState([]);

  // ui state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all"); // all | active | disabled
  const [roleFilter, setRoleFilter] = useState("all");

  // pagination
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0,
    limit: 10,
  });

  // selection
  const [selected, setSelected] = useState(new Set());

  // modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingOriginal, setEditingOriginal] = useState(null);
  const [editingRoleKeyInitial, setEditingRoleKeyInitial] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  // form data
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phoneNo: "",
    address: "",
    country: "",
    isActive: true,
    sessionType: "password",
    roleKey: "admin",
  });

  // avoid StrictMode double fire
  const didRun = useRef(false);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  /* ---------------------------- data fetching --------------------------- */

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        page: String(pagination.currentPage),
        limit: String(pagination.limit),
      });
      if (debouncedSearch) query.set("search", debouncedSearch);

      const json = await fetchWithAuthAdmin({
        url: `/api/admin?${query.toString()}`,
        admin,
        token,
        method: "GET",
      });

      if (!json?.success)
        throw new Error(json?.message || "Failed to fetch admins");

      const data = Array.isArray(json.data) ? json.data : [];
      const pag = json.pagination || {};

      setAdmins(data);
      setPagination((p) => ({
        ...p,
        currentPage: pag.currentPage ?? p.currentPage,
        totalPages:
          pag.totalPages ?? Math.max(1, Math.ceil(data.length / p.limit)),
        total: pag.totalItems ?? data.length,
        limit: pag.itemsPerPage ?? p.limit,
      }));

      if (json.message && json.message !== "Admins fetched successfully") {
        showInfo(json.message);
      }
    } catch (e) {
      const msg = handleApiError(e, "Failed to load admins");
      setError(msg);
      setAdmins([]);
      setPagination((p) => ({ ...p, total: 0, totalPages: 1 }));
    } finally {
      setLoading(false);
    }
  }, [
    admin,
    token,
    debouncedSearch,
    pagination.currentPage,
    pagination.limit,
    showInfo,
  ]);

  const fetchRoles = useCallback(async () => {
    try {
      const json = await fetchWithAuthAdmin({
        url: `/api/admin/roles?includeSystem=true`,
        admin,
        token,
        method: "GET",
      });
      if (!json?.success)
        throw new Error(json?.message || "Failed to fetch roles");
      setRoles(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      showError(handleApiError(e, "Failed to load roles"));
      setRoles([]);
    }
  }, [admin, token, showError]);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    fetchAdmins();
    fetchRoles();
  }, [fetchAdmins, fetchRoles]);

  // refetch on search/paging
  useEffect(() => {
    const t = setTimeout(() => fetchAdmins(), 250);
    return () => clearTimeout(t);
  }, [debouncedSearch, pagination.currentPage, pagination.limit, fetchAdmins]);

  /* ------------------------------- filters ------------------------------ */

  const filtered = useMemo(() => {
    let list = admins;

    if (statusTab !== "all") {
      list = list.filter((a) =>
        statusTab === "active" ? a.isActive : !a.isActive
      );
    }

    if (roleFilter !== "all") {
      list = list.filter(
        (a) => (a.roleKey || a.roleId?.key || "").toLowerCase() === roleFilter
      );
    }

    const s = (debouncedSearch || "").toLowerCase();
    if (s) {
      list = list.filter((a) => {
        const buckets = [
          a?.email,
          a?.firstName,
          a?.lastName,
          a?.roleKey,
          a?.roleId?.name,
          a?.roleId?.key,
        ];
        return buckets.some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(s)
        );
      });
    }
    return list;
  }, [admins, statusTab, roleFilter, debouncedSearch]);

  /* ------------------------------ selection ---------------------------- */

  const visibleIds = useMemo(() => filtered.map((a) => a._id), [filtered]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleOne = (id, on) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  /* ------------------------------- actions ------------------------------ */

  const openAddEditModal = useCallback((row = null) => {
    if (row) {
      setFormData({
        email: row.email || "",
        password: "",
        firstName: row.firstName || "",
        lastName: row.lastName || "",
        phoneNo: row.phoneNo || "",
        address: row.address || "",
        country: row.country || "",
        isActive: !!row.isActive,
        sessionType: row.sessionType || "password",
        roleKey: row.roleKey || row.roleId?.key || "admin",
      });
      setEditingId(row._id);
      setEditingOriginal(row);
      setEditingRoleKeyInitial(row.roleKey || row.roleId?.key || "admin");
    } else {
      setFormData({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        phoneNo: "",
        address: "",
        country: "",
        isActive: true,
        sessionType: "password",
        roleKey: "admin",
      });
      setEditingId(null);
      setEditingOriginal(null);
      setEditingRoleKeyInitial(null);
    }
    setIsModalOpen(true);
  }, []);

  const handleDeleteClick = (row) => {
    setToDelete(row);
    setIsConfirmModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email?.trim() || (!editingId && !formData.password?.trim())) {
      showError("Email and password are required for new admin");
      return;
    }
    setModalLoading(true);
    try {
      if (editingId) {
        // update
        const updateResponse = await fetchWithAuthAdmin({
          url: `/api/admin`,
          admin,
          token,
          method: "PUT",
          payload: {
            action: "update",
            adminId: editingId,
            updateData: {
              firstName: formData.firstName?.trim(),
              lastName: formData.lastName?.trim(),
              phoneNo: formData.phoneNo?.trim(),
              address: formData.address?.trim(),
              country: formData.country?.trim(),
              sessionType: formData.sessionType,
            },
          },
          setAdmin,
        });
        if (!updateResponse?.success)
          throw new Error(updateResponse?.message || "Update failed");

        // role change
        const nextRoleKey = (formData.roleKey || "").trim();
        if (nextRoleKey && nextRoleKey !== editingRoleKeyInitial) {
          const roleResponse = await fetchWithAuthAdmin({
            url: `/api/admin`,
            admin,
            token,
            method: "PUT",
            payload: {
              action: "assignRole",
              adminId: editingId,
              roleKey: nextRoleKey,
            },
          });
          if (!roleResponse?.success)
            throw new Error(roleResponse?.message || "Role assignment failed");
        }

        // active toggle
        if (editingOriginal && editingOriginal.isActive !== formData.isActive) {
          const statusResponse = await fetchWithAuthAdmin({
            url: `/api/admin`,
            admin,
            token,
            method: "PUT",
            payload: {
              action: "toggleActive",
              adminId: editingId,
              isActive: !!formData.isActive,
            },
          });
          if (!statusResponse?.success)
            throw new Error(statusResponse?.message || "Status update failed");
        }

        showSuccess(
          getSuccessMessage(updateResponse, "Admin updated successfully")
        );
      } else {
        // create
        const createResponse = await fetchWithAuthAdmin({
          url: `/api/admin`,
          admin,
          token,
          method: "POST",
          payload: {
            action: "signup",
            email: formData.email?.trim(),
            password: formData.password,
            firstName: formData.firstName?.trim(),
            lastName: formData.lastName?.trim(),
            phoneNo: formData.phoneNo?.trim(),
            address: formData.address?.trim(),
            country: formData.country?.trim(),
            roleKey: (formData.roleKey || "").trim() || "admin",
          },
        });
        if (!createResponse?.success)
          throw new Error(createResponse?.message || "Admin creation failed");

        // if created inactive, reflect
        if (formData.isActive === false && createResponse?.data?._id) {
          try {
            await fetchWithAuthAdmin({
              url: `/api/admin`,
              admin,
              token,
              method: "PUT",
              payload: {
                action: "toggleActive",
                adminId: createResponse.data._id,
                isActive: false,
              },
            });
          } catch {}
        }

        showSuccess(
          getSuccessMessage(createResponse, "Admin created successfully")
        );
      }

      setIsModalOpen(false);
      await fetchAdmins();
    } catch (e) {
      showError(handleApiError(e, "Failed to save admin"));
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleActive = async (adminId, isActive) => {
    try {
      const response = await fetchWithAuthAdmin({
        url: `/api/admin`,
        admin,
        token,
        method: "PUT",
        payload: { action: "toggleActive", adminId, isActive },
      });
      if (!response?.success)
        throw new Error(response?.message || "Failed to update status");
      showSuccess(
        getSuccessMessage(
          response,
          isActive
            ? "Admin enabled successfully"
            : "Admin disabled successfully"
        )
      );
      await fetchAdmins();
    } catch (e) {
      showError(handleApiError(e, "Failed to update admin status"));
    }
  };

  const confirmDelete = async () => {
    if (!toDelete?._id) return;
    setIsConfirmModalOpen(false);
    try {
      const response = await fetchWithAuthAdmin({
        url: `/api/admin?_id=${toDelete._id}`,
        admin,
        token,
        method: "DELETE",
      });
      if (!response?.success)
        throw new Error(response?.message || "Delete failed");
      showSuccess(getSuccessMessage(response, "Admin deleted successfully"));
      setAdmins((prev) => prev.filter((x) => x._id !== toDelete._id));
      clearSelection();
    } catch (e) {
      showError(handleApiError(e, "Failed to delete admin"));
    } finally {
      setToDelete(null);
    }
  };

  const bulkToggle = async (flag) => {
    if (selected.size === 0) return;
    try {
      const promises = Array.from(selected).map((id) =>
        fetchWithAuthAdmin({
          url: `/api/admin`,
          admin,
          token,
          method: "PUT",
          payload: { action: "toggleActive", adminId: id, isActive: flag },
        })
      );
      const results = await Promise.allSettled(promises);
      const failures = results.filter(
        (r) => r.status === "rejected" || !r.value?.success
      );
      if (failures.length) {
        const msgs = failures.map(
          (f) =>
            (f.status === "rejected" ? f.reason?.message : f.value?.message) ||
            "Error"
        );
        throw new Error(`Some operations failed: ${msgs.join(", ")}`);
      }
      const firstSuccess = results.find(
        (r) => r.status === "fulfilled" && r.value?.success
      );
      showSuccess(
        getSuccessMessage(
          firstSuccess?.value,
          flag
            ? "Selected admins enabled successfully"
            : "Selected admins disabled successfully"
        )
      );
      clearSelection();
      await fetchAdmins();
    } catch (e) {
      showError(handleApiError(e, "Failed bulk operation"));
    }
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} admin(s)? This cannot be undone.`))
      return;
    try {
      const promises = Array.from(selected).map((id) =>
        fetchWithAuthAdmin({
          url: `/api/admin?_id=${id}`,
          admin,
          token,
          method: "DELETE",
        })
      );
      const results = await Promise.allSettled(promises);
      const failures = results.filter(
        (r) => r.status === "rejected" || !r.value?.success
      );
      if (failures.length) {
        const msgs = failures.map(
          (f) =>
            (f.status === "rejected" ? f.reason?.message : f.value?.message) ||
            "Error"
        );
        throw new Error(`Some deletions failed: ${msgs.join(", ")}`);
      }
      const firstSuccess = results.find(
        (r) => r.status === "fulfilled" && r.value?.success
      );
      showSuccess(
        getSuccessMessage(
          firstSuccess?.value,
          "Selected admins deleted successfully"
        )
      );
      clearSelection();
      await fetchAdmins();
    } catch (e) {
      showError(handleApiError(e, "Failed bulk delete"));
    }
  };

  /* ------------------------------ KPI tiles ----------------------------- */

  const kpis = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((a) => a.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [filtered]);

  /* ------------------------------- render ------------------------------- */

  return (
    <SidebarWrapper>
      <Header
        title="Admin Management"
        subtitle="View, filter, and manage admin users, roles, and permissions."
        hideButton
      />

      {/* KPI tiles (mirrors sessions page style) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-6">
        <MiniCard
          title="Total admins"
          subLine={kpis.total}
          size="lg"
          style="medium"
        />
        <MiniCard
          title="Active Admins"
          subLine={kpis.active}
          size="lg"
          style="medium"
        />
        <MiniCard
          title="Disabled Admins"
          subLine={kpis.inactive}
          size="lg"
          style="medium"
        />
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-zinc-200 rounded p-3 mb-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              aria-label="Search admins"
              className={`pl-9 ${inputStyles}`}
              placeholder="Search by name, email, role…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, currentPage: 1 }));
              }}
            />
          </div>

          <div className="flex gap-2">
            <Dropdown
              options={[
                { value: "all", label: "All status" },
                { value: "active", label: "Active" },
                { value: "disabled", label: "Disabled" },
              ]}
              value={statusTab}
              onChange={(v) => {
                setStatusTab(v);
                setPagination((p) => ({ ...p, currentPage: 1 }));
              }}
              size="md"
              position="bottom"
            />
            <Dropdown
              options={[
                { value: "all", label: "All roles" },
                ...roles.map((r) => ({
                  value: (r.key || r.slug || "").toLowerCase(),
                  label: r.name || r.key,
                })),
              ]}
              value={roleFilter}
              onChange={(v) => {
                setRoleFilter(v);
                setPagination((p) => ({ ...p, currentPage: 1 }));
              }}
              size="md"
              position="bottom"
            />
            <Dropdown
              options={[10, 20, 50].map((n) => ({
                value: String(n),
                label: `${n} / page`,
              }))}
              value={String(pagination.limit)}
              onChange={(v) =>
                setPagination((p) => ({
                  ...p,
                  limit: Number(v),
                  currentPage: 1,
                }))
              }
              size="md"
              position="bottom"
            />
            <button
              onClick={() => fetchAdmins()}
              className="btn btn-sm btn-primary gap-2"
            >
              <FiRefreshCw />
              Refresh
            </button>
            <button
              onClick={() => openAddEditModal()}
              className="btn btn-xs btn-primary-third"
            >
              <FiPlus />
              New Admin
            </button>
          </div>
        </div>
      </div>

      {/* Bulk bar (visible when selection not empty) */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 mb-3 flex items-center gap-2">
          <span className="px-2 py-1 rounded-sm text-primary text-xs">
            {selected.size} Selected
          </span>
          <button
            onClick={() => bulkToggle(false)}
            className="btn px-2 py-1 rounded-sm text-xs center-flex gap-2 border border-zinc-300 bg-white hover:bg-zinc-50"
          >
            <FiToggleLeft />
            Disable
          </button>
          <button
            onClick={() => bulkToggle(true)}
            className="btn px-2 py-1 rounded-sm text-xs center-flex gap-2 border border-zinc-300 bg-white hover:bg-zinc-50"
          >
            <FiToggleRight />
            Enable
          </button>
          <button
            onClick={bulkDelete}
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-red-500 hover:bg-red-600"
          >
            <FiTrash2 />
            Delete
          </button>
          <button
            onClick={clearSelection}
            className="btn btn-xs hover:bg-amber-200 ml-auto text-xs text-amber-900/70 hover:underline rounded-sm"
          >
            Clear
          </button>
        </div>
      )}

      {/* Content */}
      {error ? (
        <div className="border border-rose-200 bg-rose-50 text-rose-800 rounded p-4">
          {error}
        </div>
      ) : loading && filtered.length === 0 ? (
        <Skeleton />
      ) : filtered.length === 0 ? (
        <Empty
          onRefresh={() => fetchAdmins()}
          onCreate={() => openAddEditModal()}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <AdminsTable
              rows={filtered}
              selected={selected}
              onToggleOne={toggleOne}
              onToggleAllVisible={toggleSelectAllVisible}
              allVisibleSelected={allVisibleSelected}
              onEdit={(row) => openAddEditModal(row)}
              onToggleActive={(row) =>
                handleToggleActive(row._id, !row.isActive)
              }
              onDelete={(row) => handleDeleteClick(row)}
            />
          </div>

          {/* Mobile cards */}
          <div className="md:hidden">
            <AdminCards
              rows={filtered}
              selected={selected}
              onToggleOne={toggleOne}
              onEdit={(row) => openAddEditModal(row)}
              onToggleActive={(row) =>
                handleToggleActive(row._id, !row.isActive)
              }
              onDelete={(row) => handleDeleteClick(row)}
            />
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-xs text-zinc-500">
                Page {pagination.currentPage} of {pagination.totalPages} · Total{" "}
                {pagination.total}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={pagination.currentPage <= 1}
                  onClick={() =>
                    setPagination((p) => ({
                      ...p,
                      currentPage: Math.max(1, p.currentPage - 1),
                    }))
                  }
                  className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-zinc-50"
                >
                  Prev
                </button>
                <button
                  disabled={pagination.currentPage >= pagination.totalPages}
                  onClick={() =>
                    setPagination((p) => ({
                      ...p,
                      currentPage: Math.min(p.totalPages, p.currentPage + 1),
                    }))
                  }
                  className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-zinc-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white p-6 rounded-xl shadow-lg w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">
              {editingId ? "Edit Admin" : "Add New Admin"}
            </h2>

            {modalLoading ? (
              <div className="flex justify-center items-center py-12">
                <ImSpinner5 className="animate-spin text-gray-500 text-3xl" />
              </div>
            ) : (
              <form onSubmit={handleFormSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex-1">
                    <label className={labelStyles("base")}>Email</label>
                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, email: e.target.value }))
                      }
                      placeholder="admin@domain.com"
                      className={inputStyles}
                      disabled={!!editingId}
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className={labelStyles("base")}>
                      Password {editingId ? "(not changeable here)" : ""}
                    </label>
                    <input
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, password: e.target.value }))
                      }
                      placeholder={
                        editingId
                          ? "Password reset not supported in this form"
                          : "Set a strong password"
                      }
                      className={inputStyles}
                      required={!editingId}
                      disabled={!!editingId}
                    />
                  </div>
                  <div>
                    <label className={labelStyles("base")}>First Name</label>
                    <input
                      name="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          firstName: e.target.value,
                        }))
                      }
                      className={inputStyles}
                    />
                  </div>
                  <div>
                    <label className={labelStyles("base")}>Last Name</label>
                    <input
                      name="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, lastName: e.target.value }))
                      }
                      className={inputStyles}
                    />
                  </div>
                  <div>
                    <label className={labelStyles("base")}>Phone</label>
                    <input
                      name="phoneNo"
                      value={formData.phoneNo}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          phoneNo: e.target.value.slice(0, 11),
                        }))
                      }
                      maxLength={11}
                      className={inputStyles}
                    />
                  </div>
                  <div>
                    <label className={labelStyles("base")}>Address</label>
                    <input
                      name="address"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, address: e.target.value }))
                      }
                      className={inputStyles}
                    />
                  </div>
                  <div>
                    <label className={labelStyles("base")}>Role</label>
                    <DropdownSearch
                      name="roleKey"
                      value={formData.roleKey}
                      onChange={(val) =>
                        setFormData((p) => ({ ...p, roleKey: val }))
                      }
                      options={roles.map((role) => ({
                        label: role.name,
                        value: role.key,
                      }))}
                      placeholder="Select a role"
                      searchPlaceholder="Search roles..."
                    />
                    <p className="text-xxs text-zinc-500 mt-1">
                      Must match an existing role <code>key</code> in your DB.
                    </p>
                  </div>
                  <div>
                    <label className={labelStyles("base")}>Country</label>
                    <DropdownSearch
                      name="country"
                      value={formData.country}
                      onChange={(val) =>
                        setFormData((p) => ({ ...p, country: val }))
                      }
                      options={[
                        { value: "PK", label: "Pakistan" },
                        { value: "US", label: "United States" },
                        { value: "GB", label: "United Kingdom" },
                        { value: "CA", label: "Canada" },
                        { value: "AU", label: "Australia" },
                        { value: "DE", label: "Germany" },
                        { value: "FR", label: "France" },
                        { value: "IT", label: "Italy" },
                        { value: "ES", label: "Spain" },
                        { value: "BR", label: "Brazil" },
                        { value: "IN", label: "India" },
                        { value: "CN", label: "China" },
                        { value: "JP", label: "Japan" },
                        { value: "KR", label: "South Korea" },
                        { value: "RU", label: "Russia" },
                        { value: "ZA", label: "South Africa" },
                      ]}
                      placeholder="Select a country"
                      searchPlaceholder="Search countries..."
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <ToggleLiver
                      key={formData.firstName}
                      checked={formData.isActive}
                      onChange={(checked) =>
                        setFormData((p) => ({ ...p, isActive: checked }))
                      }
                    />{" "}
                    <div>
                      <p className="text-sm text-zinc-800">
                        {formData.isActive ? "Active" : "Inactive"}
                      </p>
                      <p className="text-xs text-zinc-600">
                        {formData.isActive
                          ? "This admin can sign in"
                          : "This admin is disabled"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn btn-sm lg:btn-md hover:bg-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="btn btn-sm lg:btn-md btn-primary-third disabled:opacity-50"
                  >
                    {modalLoading && (
                      <ImSpinner5 className="animate-spin h-4 w-4" />
                    )}
                    {editingId ? "Update Admin" : "Create Admin"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {isConfirmModalOpen && toDelete && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/80 flex justify-center items-center p-4"
          onClick={() => setIsConfirmModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <FiTrash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 text-center mb-2">
              Delete Admin
            </h3>
            <p className="text-sm text-zinc-600 text-center mb-6">
              Are you sure you want to delete <strong>{toDelete.email}</strong>?
              This action cannot be undone.
            </p>
            <div className="space-y-3">
              <button
                onClick={confirmDelete}
                className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="w-full flex justify-center items-center px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md text-zinc-700 bg-white hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarWrapper>
  );
}

/* ------------------------------ components ------------------------------ */

function Kpi({ label, value }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3">
      <p className="text-xs uppercase text-zinc-500 font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-20 bg-zinc-100 animate-pulse rounded border border-zinc-200"
        />
      ))}
    </div>
  );
}

function Empty({ onRefresh, onCreate }) {
  return (
    <div className="text-center py-20 border border-zinc-200 rounded bg-white">
      <p className="text-zinc-800 font-medium">No admins found</p>
      <p className="text-sm text-zinc-600 mt-1">
        Try clearing the search or create a new admin.
      </p>
      <div className="mt-4 flex gap-2 justify-center">
        <button onClick={onRefresh} className="btn btn-xs btn-second">
          <FiRefreshCw className="inline mr-1" />
          Refresh
        </button>
        <button onClick={onCreate} className="btn btn-xs btn-primary">
          <FiPlus className="inline mr-1" />
          New Admin
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- TABLE --------------------------------- */

function AdminsTable({
  rows,
  selected,
  onToggleOne,
  onToggleAllVisible,
  allVisibleSelected,
  onEdit,
  onToggleActive,
  onDelete,
}) {
  const grouped = useMemo(() => {
    // Group by role to add a little structure (optional)
    return rows.reduce((acc, r) => {
      const key = (r.roleId?.name || r.roleKey || "Other").toString();
      (acc[key] = acc[key] || []).push(r);
      return acc;
    }, {});
  }, [rows]);

  return (
    <div className="border border-zinc-200 rounded overflow-hidden">
      <table className="w-full border-collapse">
        <thead className="bg-zinc-50 sticky top-0 z-[1] border-b border-zinc-200">
          <tr>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2 w-10">
              <Checkbox
                selected={allVisibleSelected}
                onChange={onToggleAllVisible}
              />
            </th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">
              Admin
            </th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">
              Role
            </th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">
              Status
            </th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">
              Created
            </th>
            <th className="px-3 py-2 w-40" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {Object.entries(grouped).map(([group, items]) => (
            <React.Fragment key={group}>
              <tr className="bg-zinc-100">
                <td colSpan={6} className="px-3 py-2 text-sm text-zinc-700">
                  <span className="inline-flex items-center gap-1 mr-2">
                    <FiChevronDown />
                    <span className="font-medium">{group}</span>
                    <span className="text-zinc-500">
                      · {items.length} admin(s)
                    </span>
                  </span>
                </td>
              </tr>
              {items.map((a) => (
                <tr key={a._id} className="w-full hover:bg-zinc-50">
                  <td className="px-3 py-2 align-top">
                    <Checkbox
                      selected={selected.has(a._id)}
                      onChange={() => onToggleOne(a._id, !selected.has(a._id))}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-start gap-3">
                      <div className="bg-zinc-100 rounded-md w-10 h-10 p-2 text-zinc-700 flex items-center justify-center">
                        <FiUser />
                      </div>
                      <div>
                        <div className="text-sm text-zinc-900">
                          {a.name ||
                            `${a.firstName || ""} ${a.lastName || ""}`.trim() ||
                            a.email}
                        </div>
                        <div className="text-xs text-zinc-500">{a.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-sm">
                    {roleLabel(a)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`text-xs border px-2 py-0.5 rounded ${
                        a.isActive
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : "text-rose-700 bg-rose-50 border-rose-200"
                      }`}
                    >
                      {a.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-sm">
                    {formatDate(a.createdAt)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <RowActions
                      row={a}
                      onEdit={onEdit}
                      onToggleActive={onToggleActive}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({ row, onEdit, onToggleActive, onDelete }) {
  const options = [
    {
      value: "edit",
      label: (
        <span className="flex items-center gap-2">
          <FiEdit className="text-zinc-500" />
          Edit
        </span>
      ),
    },
    {
      value: "toggle",
      label: (
        <span className="flex items-center gap-2">
          {row.isActive ? (
            <FiToggleLeft className="text-zinc-500" />
          ) : (
            <FiToggleRight className="text-zinc-500" />
          )}
          {row.isActive ? "Disable" : "Enable"}
        </span>
      ),
    },
    {
      value: "delete",
      label: (
        <span className="flex items-center gap-2">
          <FiTrash2 className="text-rose-500" />
          Delete
        </span>
      ),
    },
  ];

  const handleChange = (value) => {
    if (value === "edit") onEdit(row);
    else if (value === "toggle") onToggleActive(row);
    else if (value === "delete") onDelete(row);
  };

  return (
    <Dropdown
      options={options}
      value={null}
      onChange={handleChange}
      position="top-right"
      size="sm"
      placeholder="Actions"
    />
  );
}

/* ------------------------------- CARDS --------------------------------- */

function AdminCards({
  rows,
  selected,
  onToggleOne,
  onEdit,
  onToggleActive,
  onDelete,
}) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {rows.map((a) => (
        <article
          key={a._id}
          className="border border-zinc-200 rounded-lg p-3 bg-white"
        >
          <div className="flex items-start justify-between gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(a._id)}
                onChange={(e) => onToggleOne(a._id, e.target.checked)}
              />
              <div>
                <div className="text-sm text-zinc-900">
                  {a.name ||
                    `${a.firstName || ""} ${a.lastName || ""}`.trim() ||
                    a.email}
                </div>
                <div className="text-xs text-zinc-500">{a.email}</div>
              </div>
            </label>
            <span
              className={`text-xs border px-2 py-0.5 rounded ${
                a.isActive
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                  : "text-rose-700 bg-rose-50 border-rose-200"
              }`}
            >
              {a.isActive ? "Active" : "Disabled"}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mt-3">
            <Cell label="Role" value={roleLabel(a)} />
            <Cell label="Session Type" value={a.sessionType || "—"} />
            <Cell label="Added" value={formatDate(a.createdAt)} />
            <Cell label="Updated" value={formatDate(a.updatedAt)} />
          </div>

          <div className="flex items-center gap-2 mt-3 justify-end">
            <button
              onClick={() =>
                navigator.clipboard.writeText(a.email).catch(() => {})
              }
              className="text-xs px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
            >
              <FiCopy className="inline mr-1" />
              Copy email
            </button>
            <button
              onClick={() => onEdit(a)}
              className="text-xs px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
            >
              <FiEdit2 className="inline mr-1" />
              Edit
            </button>
            <button
              onClick={() => onToggleActive(a)}
              className="text-xs px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
            >
              {a.isActive ? (
                <FiToggleLeft className="inline mr-1" />
              ) : (
                <FiToggleRight className="inline mr-1" />
              )}
              {a.isActive ? "Disable" : "Enable"}
            </button>
            <button
              onClick={() => onDelete(a)}
              className="text-xs px-2 py-1 rounded border border-rose-300 text-rose-700 bg-white hover:bg-rose-50"
            >
              <FiTrash2 className="inline mr-1" />
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Cell({ label, value }) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded p-2">
      <p className="text-[10px] font-semibold text-zinc-500 uppercase">
        {label}
      </p>
      <p className="text-xs text-zinc-800 break-all">{value ?? "—"}</p>
    </div>
  );
}
