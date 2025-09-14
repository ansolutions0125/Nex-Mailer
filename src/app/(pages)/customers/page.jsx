// app/customers/page.jsx
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
  FiCreditCard,
  FiMail,
  FiInfo,
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

const planLabel = (customer) => {
  if (!customer.planSnapshot && !customer.planId) return "No Plan";
  return customer.planSnapshot?.name || "Active Plan";
};

const formatCurrency = (amount, currency = "USD") => {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

/* ------------------------------- page ---------------------------------- */

export default function CustomersPage() {
  const { admin, setAdmin, token } = useAdminStore();
  const { showSuccess, showError, showInfo } = useToastStore();

  // data
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [customerGroups, setCustomerGroups] = useState([]);

  // ui state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all"); // all | active | inactive | suspended
  const [planFilter, setPlanFilter] = useState("all");

  // Add to your state declarations
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsCustomer, setDetailsCustomer] = useState(null);

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
  const [modalLoading, setModalLoading] = useState(false);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  // form data
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    name: "",
    phoneNo: "",
    address: "",
    country: "",
    status: "active",
    sessionType: "password",
    planId: "",
  });

  // avoid StrictMode double fire
  const didRun = useRef(false);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  /* ---------------------------- data fetching --------------------------- */

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        page: String(pagination.currentPage),
        limit: String(pagination.limit),
      });

      const json = await fetchWithAuthAdmin({
        url: `/api/customers?${query.toString()}`,
        admin,
        token,
        method: "GET",
      });

      if (!json?.success)
        throw new Error(json?.message || "Failed to fetch customers");

      // Handle grouped response structure
      if (json.data?.groups) {
        setCustomerGroups(json.data.groups);
        // Flatten all customers for filtering
        const allCustomers = json.data.groups.reduce((acc, group) => {
          return [...acc, ...group.customers];
        }, []);
        setCustomers(allCustomers);
      } else {
        const data = Array.isArray(json.data) ? json.data : [];
        setCustomers(data);
        setCustomerGroups([]);
      }

      const pag = json.pagination || {};
      setPagination((p) => ({
        ...p,
        currentPage: pag.currentPage ?? p.currentPage,
        totalPages:
          pag.totalPages ?? Math.max(1, Math.ceil(pag.totalItems / p.limit)),
        total: pag.totalItems ?? customers.length,
        limit: pag.itemsPerPage ?? p.limit,
      }));

      if (json.message && json.message !== "Customers fetched successfully") {
        showInfo(json.message);
      }
    } catch (e) {
      const msg = handleApiError(e, "Failed to load customers");
      setError(msg);
      setCustomers([]);
      setCustomerGroups([]);
      setPagination((p) => ({ ...p, total: 0, totalPages: 1 }));
    } finally {
      setLoading(false);
    }
  }, [admin, token, pagination.currentPage, pagination.limit, showInfo]);

  const fetchPlans = useCallback(async () => {
    try {
      const json = await fetchWithAuthAdmin({
        url: `/api/plans`,
        admin,
        token,
        method: "GET",
      });
      if (!json?.success)
        throw new Error(json?.message || "Failed to fetch plans");
      setPlans(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      showError(handleApiError(e, "Failed to load plans"));
      setPlans([]);
    }
  }, [admin, token, showError]);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    fetchCustomers();
    fetchPlans();
  }, [fetchCustomers, fetchPlans]);

  // refetch on search/paging
  useEffect(() => {
    const t = setTimeout(() => fetchCustomers(), 250);
    return () => clearTimeout(t);
  }, [
    debouncedSearch,
    pagination.currentPage,
    pagination.limit,
    fetchCustomers,
  ]);

  /* ------------------------------- filters ------------------------------ */

  const filtered = useMemo(() => {
    let list = customers;

    if (statusTab !== "all") {
      list = list.filter((c) => {
        switch (statusTab) {
          case "active":
            return c.status === "active" && c.planId;
          case "inactive":
            return !c.planId || c.status === "inactive";
          case "suspended":
            return c.status === "suspended";
          default:
            return true;
        }
      });
    }

    if (planFilter !== "all") {
      list = list.filter((c) => {
        if (planFilter === "no-plan") return !c.planId;
        return (
          c.planId?.toString() === planFilter ||
          c.planSnapshot?.name?.toLowerCase().includes(planFilter.toLowerCase())
        );
      });
    }

    const s = (debouncedSearch || "").toLowerCase();
    if (s) {
      list = list.filter((c) => {
        const buckets = [
          c?.email,
          c?.firstName,
          c?.lastName,
          c?.name,
          c?.planSnapshot?.name,
          c?.country,
        ];
        return buckets.some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(s)
        );
      });
    }
    return list;
  }, [customers, statusTab, planFilter, debouncedSearch]);

  /* ------------------------------ selection ---------------------------- */

  const visibleIds = useMemo(() => filtered.map((c) => c._id), [filtered]);
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
        name: row.name || "",
        phoneNo: row.phoneNo || "",
        address: row.address || "",
        country: row.country || "",
        status: row.status || "active",
        sessionType: row.sessionType || "password",
        planId: row.planId?.toString() || "",
      });
      setEditingId(row._id);
      setEditingOriginal(row);
    } else {
      setFormData({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        name: "",
        phoneNo: "",
        address: "",
        country: "",
        status: "active",
        sessionType: "password",
        planId: "",
      });
      setEditingId(null);
      setEditingOriginal(null);
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
      showError("Email and password are required for new customer");
      return;
    }
    setModalLoading(true);
    try {
      if (editingId) {
        // Update customer profile
        const updateResponse = await fetchWithAuthAdmin({
          url: `/api/customers`,
          admin,
          token,
          method: "PUT",
          payload: {
            action: "updateProfile",
            customerId: editingId,
            firstName: formData.firstName?.trim(),
            lastName: formData.lastName?.trim(),
            phoneNo: formData.phoneNo?.trim(),
            address: formData.address?.trim(),
            country: formData.country?.trim(),
          },
          setAdmin,
        });
        if (!updateResponse?.success)
          throw new Error(updateResponse?.message || "Update failed");

        // Update plan if changed
        if (
          formData.planId &&
          formData.planId !== editingOriginal?.planId?.toString()
        ) {
          const planResponse = await fetchWithAuthAdmin({
            url: `/api/customers`,
            admin,
            token,
            method: "PUT",
            payload: {
              action: "assignPlan",
              customerId: editingId,
              planId: formData.planId,
              resetLimits: true,
            },
          });
          if (!planResponse?.success)
            throw new Error(planResponse?.message || "Plan assignment failed");
        } else if (!formData.planId && editingOriginal?.planId) {
          // Remove plan
          const removeResponse = await fetchWithAuthAdmin({
            url: `/api/customers`,
            admin,
            token,
            method: "PUT",
            payload: {
              action: "removePlan",
              customerId: editingId,
            },
          });
          if (!removeResponse?.success)
            throw new Error(removeResponse?.message || "Plan removal failed");
        }

        // Update general info
        const generalUpdateResponse = await fetchWithAuthAdmin({
          url: `/api/customers`,
          admin,
          token,
          method: "PUT",
          payload: {
            action: "multi",
            customerId: editingId,
            updateData: {
              status: formData.status,
              sessionType: formData.sessionType,
              name: formData.name?.trim(),
            },
          },
        });
        if (!generalUpdateResponse?.success)
          throw new Error(
            generalUpdateResponse?.message || "General update failed"
          );

        showSuccess(
          getSuccessMessage(updateResponse, "Customer updated successfully")
        );
      } else {
        // Create customer
        const createResponse = await fetchWithAuthAdmin({
          url: `/api/customers`,
          admin,
          token,
          method: "POST",
          payload: {
            action: "signup",
            email: formData.email?.trim(),
            password: formData.password,
            firstName: formData.firstName?.trim(),
            lastName: formData.lastName?.trim(),
            name: formData.name?.trim(),
            phoneNo: formData.phoneNo?.trim(),
            address: formData.address?.trim(),
            country: formData.country?.trim(),
            sessionType: formData.sessionType,
          },
        });
        if (!createResponse?.success)
          throw new Error(
            createResponse?.message || "Customer creation failed"
          );

        // Assign plan if selected
        if (formData.planId && createResponse?.data?.customer?._id) {
          try {
            await fetchWithAuthAdmin({
              url: `/api/customers`,
              admin,
              token,
              method: "PUT",
              payload: {
                action: "assignPlan",
                customerId: createResponse.data.customer._id,
                planId: formData.planId,
                resetLimits: true,
              },
            });
          } catch (planError) {
            console.warn("Failed to assign plan to new customer:", planError);
          }
        }

        showSuccess(
          getSuccessMessage(createResponse, "Customer created successfully")
        );
      }

      setIsModalOpen(false);
      await fetchCustomers();
    } catch (e) {
      showError(handleApiError(e, "Failed to save customer"));
    } finally {
      setModalLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete?._id) return;
    setIsConfirmModalOpen(false);
    try {
      const response = await fetchWithAuthAdmin({
        url: `/api/customers?_id=${toDelete._id}`,
        admin,
        token,
        method: "DELETE",
      });
      if (!response?.success)
        throw new Error(response?.message || "Delete failed");
      showSuccess(getSuccessMessage(response, "Customer deleted successfully"));
      setCustomers((prev) => prev.filter((x) => x._id !== toDelete._id));
      clearSelection();
    } catch (e) {
      showError(handleApiError(e, "Failed to delete customer"));
    } finally {
      setToDelete(null);
    }
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} customer(s)? This cannot be undone.`))
      return;
    try {
      const promises = Array.from(selected).map((id) =>
        fetchWithAuthAdmin({
          url: `/api/customers?_id=${id}`,
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
          "Selected customers deleted successfully"
        )
      );
      clearSelection();
      await fetchCustomers();
    } catch (e) {
      showError(handleApiError(e, "Failed bulk delete"));
    }
  };

  /* ------------------------------ KPI tiles ----------------------------- */

  const kpis = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(
      (c) => c.planId && c.status === "active"
    ).length;
    const noPlan = customers.filter((c) => !c.planId).length;
    const suspended = customers.filter((c) => c.status === "suspended").length;
    return { total, active, noPlan, suspended };
  }, [customers]);

  /* ------------------------------- render ------------------------------- */

  const handleViewDetails = (customer) => {
    setDetailsCustomer(customer);
    setIsDetailsModalOpen(true);
  };

  return (
    <SidebarWrapper>
      <Header
        title="Customer Management"
        subtitle="View, filter, and manage customer accounts, plans, and subscriptions."
        hideButton
      />

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 mb-6">
        <MiniCard
          title="Total Customers"
          subLine={kpis.total}
          size="lg"
          style="medium"
        />
        <MiniCard
          title="Active Paid"
          subLine={kpis.active}
          size="lg"
          style="medium"
        />
        <MiniCard
          title="No Plan"
          subLine={kpis.noPlan}
          size="lg"
          style="medium"
        />
        <MiniCard
          title="Suspended"
          subLine={kpis.suspended}
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
              aria-label="Search customers"
              className={`pl-9 ${inputStyles}`}
              placeholder="Search by name, email, plan…"
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
                { value: "active", label: "Active Paid" },
                { value: "inactive", label: "No Plan" },
                { value: "suspended", label: "Suspended" },
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
                { value: "all", label: "All plans" },
                { value: "no-plan", label: "No Plan" },
                ...plans.map((p) => ({
                  value: p._id,
                  label: p.name || p._id,
                })),
              ]}
              value={planFilter}
              onChange={(v) => {
                setPlanFilter(v);
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
              onClick={() => fetchCustomers()}
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
              New Customer
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
          onRefresh={() => fetchCustomers()}
          onCreate={() => openAddEditModal()}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <CustomersTable
              rows={filtered}
              groups={customerGroups}
              selected={selected}
              onToggleOne={toggleOne}
              onToggleAllVisible={toggleSelectAllVisible}
              allVisibleSelected={allVisibleSelected}
              onEdit={(row) => openAddEditModal(row)}
              onDelete={(row) => handleDeleteClick(row)}
              onDetails={(row) => handleViewDetails(row)}
            />
          </div>

          {/* Mobile cards */}
          <div className="md:hidden">
            <CustomerCards
              rows={filtered}
              selected={selected}
              onToggleOne={toggleOne}
              onEdit={(row) => openAddEditModal(row)}
              onDelete={(row) => handleDeleteClick(row)}
              onDetails={(row) => handleViewDetails(row)}
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
            className="bg-white p-6 rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">
              {editingId ? "Edit Customer" : "Add New Customer"}
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
                      placeholder="customer@domain.com"
                      className={inputStyles}
                      disabled={!!editingId}
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className={labelStyles("base")}>
                      Password{" "}
                      {editingId ? "(leave blank to keep current)" : ""}
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
                          ? "Leave blank to keep current password"
                          : "Set a password"
                      }
                      className={inputStyles}
                      required={!editingId}
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
                    <label className={labelStyles("base")}>Display Name</label>
                    <input
                      name="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, name: e.target.value }))
                      }
                      className={inputStyles}
                      placeholder="Optional display name"
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
                          phoneNo: e.target.value.slice(0, 15),
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
                  <div>
                    <label className={labelStyles("base")}>Plan</label>
                    <DropdownSearch
                      name="planId"
                      value={formData.planId}
                      onChange={(val) =>
                        setFormData((p) => ({ ...p, planId: val }))
                      }
                      options={[
                        { value: "", label: "No Plan" },
                        ...plans.map((plan) => ({
                          label: `${plan.name} - ${formatCurrency(
                            plan.price,
                            plan.currency
                          )}`,
                          value: plan._id,
                        })),
                      ]}
                      placeholder="Select a plan"
                      searchPlaceholder="Search plans..."
                    />
                    <p className="text-xxs text-zinc-500 mt-1">
                      Leave empty for no plan. Existing limits will be reset
                      when assigning a new plan.
                    </p>
                  </div>
                  <div>
                    <label className={labelStyles("base")}>Status</label>
                    <Dropdown
                      options={[
                        { value: "active", label: "Active" },
                        { value: "inactive", label: "Inactive" },
                        { value: "suspended", label: "Suspended" },
                      ]}
                      value={formData.status}
                      onChange={(val) =>
                        setFormData((p) => ({ ...p, status: val }))
                      }
                      size="md"
                      position="bottom"
                    />
                  </div>
                  <div>
                    <label className={labelStyles("base")}>Session Type</label>
                    <Dropdown
                      options={[
                        { value: "password", label: "Password" },
                        { value: "magic", label: "Magic Link" },
                      ]}
                      value={formData.sessionType}
                      onChange={(val) =>
                        setFormData((p) => ({ ...p, sessionType: val }))
                      }
                      size="md"
                      position="bottom"
                    />
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
                    {editingId ? "Update Customer" : "Create Customer"}
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
              Delete Customer
            </h3>
            <p className="text-sm text-zinc-600 text-center mb-6">
              Are you sure you want to delete <strong>{toDelete.email}</strong>?
              This action cannot be undone and will remove all associated data.
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

      {isDetailsModalOpen && (
        <CustomerDetailsModal
          customer={detailsCustomer}
          onClose={() => setIsDetailsModalOpen(false)}
        />
      )}
    </SidebarWrapper>
  );
}

/* ------------------------------ components ------------------------------ */

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

function CustomerDetailsModal({ customer, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!customer) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-[92vw] max-w-2xl bg-white rounded-xl border border-zinc-200 shadow-xl p-4 md:p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Customer Details
            </h2>
            <p className="text-sm text-zinc-600">{customer.email}</p>
          </div>
          <button
            className="p-2 rounded hover:bg-zinc-100"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Detail
            label="Full Name"
            value={`${customer.firstName || ""} ${customer.lastName || ""}`}
          />
          <Detail label="Display Name" value={customer.name} />
          <Detail label="Email" value={customer.email} copyable />
          <Detail label="Phone Number" value={customer.phoneNo} />
          <Detail label="Address" value={customer.address} />
          <Detail label="Country" value={customer.country} />
          <Detail
            label="Plan"
            value={customer.planSnapshot?.name || "No Plan"}
          />
          <Detail label="Session Type" value={customer.sessionType} />
          <Detail label="Status" value={customer.status || "inactive"} />
          <Detail label="Customer ID" value={customer._id} copyable mono />
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-zinc-800 mb-2">
            Usage Statistics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Detail
              label="Emails Sent"
              value={customer.stats?.totalEmailSent || 0}
            />
            <Detail
              label="Automations"
              value={customer.stats?.totalAutomations || 0}
            />
            <Detail label="Lists" value={customer.stats?.totalLists || 0} />
            <Detail
              label="Contacts"
              value={customer.stats?.totalContacts || 0}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="btn btn-sm hover:bg-zinc-200" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
CustomerDetailsModal.propTypes = {
  customer: PropTypes.object,
  onClose: PropTypes.func.isRequired,
};

function Detail({ label, value, copyable = false, mono = false }) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded p-3">
      <p className="text-[10px] font-semibold text-zinc-500 uppercase">
        {label}
      </p>
      <div className={`text-sm text-zinc-800 ${mono ? "font-mono" : ""}`}>
        {value ?? "—"}
      </div>
      {copyable && value ? (
        <button
          onClick={() =>
            navigator.clipboard.writeText(String(value)).catch(() => {})
          }
          className="mt-2 text-xs px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
        >
          <FiCopy className="inline mr-1" />
          Copy
        </button>
      ) : null}
    </div>
  );
}

function Empty({ onRefresh, onCreate }) {
  return (
    <div className="text-center py-20 border border-zinc-200 rounded bg-white">
      <p className="text-zinc-800 font-medium">No customers found</p>
      <p className="text-sm text-zinc-600 mt-1">
        Try clearing the search or create a new customer.
      </p>
      <div className="mt-4 flex gap-2 justify-center">
        <button onClick={onRefresh} className="btn btn-xs btn-second">
          <FiRefreshCw className="inline mr-1" />
          Refresh
        </button>
        <button onClick={onCreate} className="btn btn-xs btn-primary">
          <FiPlus className="inline mr-1" />
          New Customer
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- TABLE --------------------------------- */

function CustomersTable({
  rows,
  groups,
  selected,
  onToggleOne,
  onToggleAllVisible,
  allVisibleSelected,
  onEdit,
  onDelete,
  onDetails,  
}) {
  // If we have groups from the API, use them; otherwise create a simple grouping
  const displayGroups =
    groups.length > 0 ? groups : [{ label: "All Customers", customers: rows }];

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
              Customer
            </th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">
              Plan
            </th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">
              Status
            </th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">
              Usage
            </th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">
              Joined
            </th>
            <th className="px-3 py-2 w-40" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {displayGroups.map((group) => (
            <React.Fragment key={group.label}>
              {group.customers.length > 0 && groups.length > 1 && (
                <tr className="bg-zinc-100">
                  <td colSpan={7} className="px-3 py-2 text-sm text-zinc-700">
                    <span className="inline-flex items-center gap-1 mr-2">
                      <FiChevronDown />
                      <span className="font-medium">{group.label}</span>
                      <span className="text-zinc-500">
                        · {group.customers.length} customer(s)
                      </span>
                    </span>
                  </td>
                </tr>
              )}
              {group.customers.map((c) => (
                <tr key={c._id} className="w-full hover:bg-zinc-50">
                  <td className="px-3 py-2 align-center">
                    <Checkbox
                      selected={selected.has(c._id)}
                      onChange={() => onToggleOne(c._id, !selected.has(c._id))}
                    />
                  </td>
                  <td className="px-3 py-2 align-center">
                    <div className="flex items-start gap-3">
                      <div className="bg-zinc-100 rounded-md w-10 h-10 p-2 text-zinc-700 flex items-center justify-center">
                        <FiUser />
                      </div>
                      <div>
                        <div className="text-sm text-zinc-900">
                          {c.name ||
                            `${c.firstName || ""} ${c.lastName || ""}`.trim() ||
                            c.email}
                        </div>
                        <div className="text-xs text-zinc-500">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-center text-sm">
                    <div className="flex items-center gap-1">
                      {c.planId ? (
                        <FiCreditCard className="h-3 w-3 text-emerald-600" />
                      ) : null}
                      {planLabel(c)}
                    </div>
                    {c.planSnapshot?.price && (
                      <div className="text-xs text-zinc-500">
                        {formatCurrency(
                          c.planSnapshot.price,
                          c.planSnapshot.currency
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-center">
                    <span
                      className={`text-xs border px-2 py-0.5 rounded ${
                        c.status === "active"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : c.status === "suspended"
                          ? "text-red-700 bg-red-50 border-red-200"
                          : "text-zinc-700 bg-zinc-50 border-zinc-200"
                      }`}
                    >
                      {c.status || "inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-center text-sm">
                    <div className="flex items-center gap-1">
                      <FiMail className="h-3 w-3 text-zinc-400" />
                      {c.emailLimits?.totalSent || c.stats?.totalEmailSent || 0}
                    </div>
                    {c.emailLimits?.remaining !== undefined && (
                      <div className="text-xs text-zinc-500">
                        {c.emailLimits.remaining} left
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-center text-sm">
                    {formatDate(c.createdAt)}
                  </td>
                  <td className="px-3 py-2 align-center">
                    <RowActions
                      row={c}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onDetails={onDetails}
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

function RowActions({ row, onEdit, onDelete, onDetails }) {
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
      value: "details",
      label: (
        <span className="flex items-center gap-2">
          <FiInfo className="text-zinc-500" />
          View Details
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
    else if (value === "delete") onDelete(row);
    else if (value === "details") onDetails(row);
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

function CustomerCards({
  rows,
  selected,
  onToggleOne,
  onEdit,
  onDelete,
  onDetails,
}) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {rows.map((c) => (
        <article
          key={c._id}
          className="border border-zinc-200 rounded-lg p-3 bg-white flex items-center"
        >
          <div className="flex items-start justify-between gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(c._id)}
                onChange={(e) => onToggleOne(c._id, e.target.checked)}
              />
              <div>
                <div className="text-sm text-zinc-900">
                  {c.name ||
                    `${c.firstName || ""} ${c.lastName || ""}`.trim() ||
                    c.email}
                </div>
                <div className="text-xs text-zinc-500">{c.email}</div>
              </div>
            </label>
            <span
              className={`text-xs border px-2 py-0.5 rounded ${
                c.status === "active"
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                  : c.status === "suspended"
                  ? "text-red-700 bg-red-50 border-red-200"
                  : "text-zinc-700 bg-zinc-50 border-zinc-200"
              }`}
            >
              {c.status || "inactive"}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mt-3">
            <Cell label="Plan" value={planLabel(c)} />
            <Cell
              label="Usage"
              value={`${
                c.emailLimits?.totalSent || c.stats?.totalEmailSent || 0
              } sent`}
            />
            <Cell label="Country" value={c.country || "—"} />
            <Cell label="Joined" value={formatDate(c.createdAt)} />
          </div>

          <div className="flex items-center gap-2 mt-3 justify-end">
            <button
              onClick={() =>
                navigator.clipboard.writeText(c.email).catch(() => {})
              }
              className="text-xs px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
            >
              <FiCopy className="inline mr-1" />
              Copy email
            </button>

            <button
              onClick={() => onEdit(c)}
              className="text-xs px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
            >
              <FiEdit2 className="inline mr-1" />
              Edit
            </button>
            <button
              onClick={() => onDelete(c)}
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
