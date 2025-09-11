"use client";

import SidebarWrapper from "@/components/SidebarWrapper";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiGrid,
  FiList,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { AnimatePresence, motion } from "framer-motion";
import Header from "@/components/Header";
import { Dropdown } from "@/components/Dropdown";
import { Users } from "lucide-react";
import { MiniCard } from "@/presets/styles";

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* ------------------------------- Page ------------------------------------ */
const CustomersPage = () => {
  /* Core state */
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  /* Filters / layout */
  const [viewMode, setViewMode] = useState("single"); // 'single' | 'double'
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'inactive'

  /* Pagination */
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0,
    limit: 10,
  });

  /* Selection (future bulk actions) */
  const [selected, setSelected] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // NEW — bulk actions state
  const [isBulkRunning, setIsBulkRunning] = useState(false);

  /* Toasts */
  const [toast, setToast] = useState({ show: false, message: "", type: "" });

  /* Modals */
  const [isModalOpen, setIsModalOpen] = useState(false); // Add/Edit
  const [editingId, setEditingId] = useState(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState(null);

  /* Form state (incl. profile/auth) */
  const [formData, setFormData] = useState({
    slug: "",
    isActive: true,
    planId: "",

    email: "",
    firstName: "",
    lastName: "",
    password: "",
    sessionType: "password",
    phoneNo: "",
    address: "",
    country: "",
  });

  /* Debounce search */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 450);
    return () => clearTimeout(t);
  }, [search]);

  /* Reset to page 1 on filter/search changes */
  useEffect(() => {
    if (pagination.currentPage !== 1) {
      setPagination((p) => ({ ...p, currentPage: 1 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter]);

  const showToast = useCallback((message, type) => {
    setToast({ show: true, message, type });
    const t = setTimeout(
      () => setToast({ show: false, message: "", type: "" }),
      3000
    );
    return () => clearTimeout(t);
  }, []);

  /* ----------------------------- Fetchers -------------------------------- */

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch(`/api/plans?active=true&page=1&limit=100`);
      const json = await res.json();
      if (json?.success) {
        setPlans(Array.isArray(json.data) ? json.data : []);
      } else {
        setPlans([]);
      }
    } catch (e) {
      console.error("fetchPlans error", e);
      setPlans([]);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(pagination.currentPage),
        limit: String(pagination.limit),
      });
      const res = await fetch(`/api/customers/auth?${query.toString()}`);
      const json = await res.json();

      if (json?.success) {
        const data = Array.isArray(json.data) ? json.data : [];
        setCustomers(data);
        setPagination((prev) => ({
          ...prev,
          ...(json.pagination || {
            total: data.length,
            totalPages: Math.max(1, Math.ceil(data.length / prev.limit)),
          }),
        }));
      } else {
        showToast(json?.message || "Failed to load customers", "error");
        setCustomers([]);
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
      }
    } catch (e) {
      console.error("fetchCustomers error", e);
      showToast("Failed to load customers.", "error");
      setCustomers([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, pagination.limit, showToast]);

  // NEW — small helper to run bulk ops and toast aggregated results
  const runBulk = useCallback(
    async (ids, worker, label) => {
      if (!Array.isArray(ids) || ids.length === 0) return;
      setIsBulkRunning(true);
      try {
        const results = await Promise.allSettled(ids.map(worker));
        const ok = results.filter((r) => r.status === "fulfilled").length;
        const fail = results.length - ok;
        showToast(
          `${label}: ${ok} succeeded${fail ? `, ${fail} failed` : ""}`,
          fail ? "error" : "success"
        );
      } finally {
        setIsBulkRunning(false);
      }
    },
    [showToast]
  );

  // NEW — Disable/Enable selected (uses /api/customers/auth PUT action: "multi")
  const bulkSetActive = useCallback(
    async (val) => {
      const ids = [...selected];
      if (ids.length === 0) return;

      await runBulk(
        ids,
        async (customerId) => {
          const res = await fetch("/api/customers/auth", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "multi",
              customerId,
              updateData: { isActive: !!val },
            }),
          });
          const j = await res.json();
          if (!res.ok || !j?.success) throw new Error(j?.message || "Failed");
        },
        val ? "Enable customers" : "Disable customers"
      );

      // Optimistic UI: flip active state locally
      setCustomers((prev) =>
        prev.map((c) => (ids.includes(c._id) ? { ...c, isActive: !!val } : c))
      );
      setSelected([]);
    },
    [selected, runBulk]
  );

  // NEW — Reset limits for selected (uses /api/customers/auth PUT action: "resetLimits")
  const bulkResetLimits = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) return;

    await runBulk(
      ids,
      async (customerId) => {
        const res = await fetch("/api/customers/auth", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "resetLimits", customerId }),
        });
        const j = await res.json();
        if (!res.ok || !j?.success) throw new Error(j?.message || "Failed");
      },
      "Reset limits"
    );

    // Ensure fresh quotas in UI
    fetchCustomers();
    setSelected([]);
  }, [selected, runBulk, fetchCustomers]);

  // NEW — Recalculate stats for selected (uses /api/customers/auth PUT action: "recalcStats")
  const bulkRecalcStats = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) return;

    await runBulk(
      ids,
      async (customerId) => {
        const res = await fetch("/api/customers/auth", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "recalcStats", customerId }),
        });
        const j = await res.json();
        if (!res.ok || !j?.success) throw new Error(j?.message || "Failed");
      },
      "Recalculate stats"
    );

    // Stats affect the right-side mini-cards
    fetchCustomers();
    setSelected([]);
  }, [selected, runBulk, fetchCustomers]);

  // NEW — Delete selected (uses /api/customers/auth DELETE?_id=...)
  const bulkDelete = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) return;

    if (!confirm(`Delete ${ids.length} customers? This cannot be undone.`)) {
      return;
    }

    await runBulk(
      ids,
      async (_id) => {
        const res = await fetch(`/api/customers/auth?_id=${_id}`, {
          method: "DELETE",
        });
        const j = await res.json();
        if (!res.ok || !j?.success) throw new Error(j?.message || "Failed");
      },
      "Delete customers"
    );

    // Remove locally
    setCustomers((prev) => prev.filter((c) => !ids.includes(c._id)));
    setSelected([]);
  }, [selected, runBulk]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  /* ------------------------------ Filters -------------------------------- */

  const filtered = useMemo(() => {
    let list = [...customers];

    if (statusFilter !== "all") {
      const wantActive = statusFilter === "active";
      list = list.filter((c) => (wantActive ? c.isActive : !c.isActive));
    }

    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      list = list.filter((c) => {
        const planName = c?.planSnapshot?.name || "";
        return (
          (c?.name || "").toLowerCase().includes(s) ||
          (c?.slug || "").toLowerCase().includes(s) ||
          (c?.email || "").toLowerCase().includes(s) ||
          planName.toLowerCase().includes(s)
        );
      });
    }
    return list;
  }, [customers, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (filtered.length === 0) return setSelectAll(false);
    setSelectAll(filtered.every((c) => selected.includes(c._id)));
  }, [filtered, selected]);

  /* ------------------------------- Modals -------------------------------- */

  const resetForm = useCallback(() => {
    setFormData({
      slug: "",
      isActive: true,
      planId: "",
      email: "",
      firstName: "",
      lastName: "",
      password: "",
      sessionType: "password",
      phoneNo: "",
      address: "",
      country: "",
    });
    setEditingId(null);
  }, []);

  const openAddEditModal = useCallback(
    (customer = null) => {
      if (customer) {
        setFormData({
          slug: customer.slug || "",
          isActive: !!customer.isActive,
          planId: customer.planId || "",

          email: customer.email || "",
          firstName: customer.firstName || "",
          lastName: customer.lastName || "",
          password: "", // never prefill
          sessionType: customer.sessionType || "password",
          phoneNo: customer.phoneNo || "",
          address: customer.address || "",
          country: customer.country || "",
        });
        setEditingId(customer._id);
      } else {
        resetForm();
      }
      setIsModalOpen(true);
    },
    [resetForm]
  );

  const openDetailsModal = useCallback(
    async (customer) => {
      if (!customer?._id) return;
      setIsDetailsModalOpen(true);
      setDetailsLoading(true);
      try {
        const res = await fetch(
          `/api/customers/auth?_id=${customer._id}&withStats=true&expand=plan`
        );
        const json = await res.json();
        if (json?.success) setDetails(json.data);
        else
          showToast(
            json?.message || "Failed to load customer details",
            "error"
          );
      } catch (e) {
        console.error(e);
        showToast("Failed to load customer details", "error");
      } finally {
        setDetailsLoading(false);
      }
    },
    [showToast]
  );

  const closeDetailsModal = useCallback(() => {
    setDetails(null);
    setIsDetailsModalOpen(false);
    setDetailsLoading(false);
  }, []);

  /* ---------------------------- CRUD handlers ---------------------------- */

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((p) => ({
      ...p,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    setModalLoading(true);
    try {
      if (editingId) {
        // 1) update basic + profile fields via multi
        const updatePayload = {
          action: "multi",
          customerId: editingId,
          updateData: {
            slug: formData.slug?.trim() || undefined,
            isActive: !!formData.isActive,

            firstName: formData.firstName?.trim() || "",
            lastName: formData.lastName?.trim() || "",
            phoneNo: formData.phoneNo?.trim() || "",
            address: formData.address?.trim() || "",
            country: formData.country?.trim() || "",
          },
        };
        const put1 = await fetch("/api/customers/auth", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        });
        if (!put1.ok) throw new Error("Failed to update customer");
        const j1 = await put1.json();
        if (!j1?.success) throw new Error(j1?.message || "Update failed");

        const current = customers.find((c) => c._id === editingId);
        const prevPlan = current?.planId || "";

        // 2) assign/replace plan if changed
        if ((formData.planId || "") !== prevPlan) {
          const put2 = await fetch("/api/customers/auth", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "assignPlan",
              customerId: editingId,
              planId: formData.planId || undefined,
              resetLimits: true,
            }),
          });
          const j2 = await put2.json();
          if (!put2.ok || !j2?.success) {
            throw new Error(j2?.message || "Failed to assign plan");
          }
        }

        // 3) Update auth if email/sessionType changed or password provided
        const authChanged =
          (formData.password && formData.password.length > 0) ||
          (formData.email && formData.email !== (current?.email || "")) ||
          (formData.sessionType &&
            formData.sessionType !== (current?.sessionType || "password"));

        if (authChanged) {
          const put3 = await fetch("/api/customers/auth", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "updateAuth",
              customerId: editingId,
              email: formData.email || undefined,
              sessionType: formData.sessionType || undefined,
              password: formData.password || undefined,
            }),
          });
          const j3 = await put3.json();
          if (!put3.ok || !j3?.success)
            throw new Error(j3?.message || "Failed to update auth");
        }

        showToast("Customer updated successfully", "success");
      } else {
        // Create new customer
        const payload = {
          slug: formData.slug?.trim() || undefined,
          ...(formData.planId ? { planId: formData.planId } : {}),
          email: formData.email?.trim() || undefined,
          firstName: formData.firstName?.trim() || undefined,
          lastName: formData.lastName?.trim() || undefined,
          password: formData.password || undefined,
          sessionType: formData.sessionType || "password",
          phoneNo: formData.phoneNo?.trim() || undefined,
          address: formData.address?.trim() || undefined,
          country: formData.country?.trim() || undefined,
        };
        const res = await fetch("/api/customers/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json?.success)
          throw new Error(json?.message || "Create failed");

        showToast("Customer created successfully", "success");
      }

      setIsModalOpen(false);
      resetForm();
      fetchCustomers();
    } catch (e) {
      console.error("save customer error", e);
      showToast(e.message || "Failed to save customer", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteClick = useCallback((customer) => {
    setCustomerToDelete(customer);
    setIsConfirmModalOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!customerToDelete?._id) return;
    setDeletingId(customerToDelete._id);
    setIsConfirmModalOpen(false);
    try {
      const res = await fetch(
        `/api/customers/auth?_id=${customerToDelete._id}`,
        {
          method: "DELETE",
        }
      );
      const json = await res.json();
      if (!res.ok || !json?.success)
        throw new Error(json?.message || "Delete failed");
      showToast("Customer deleted successfully", "success");
      setCustomers((prev) =>
        prev.filter((c) => c._id !== customerToDelete._id)
      );
    } catch (e) {
      console.error(e);
      showToast(e.message || "Failed to delete customer", "error");
    } finally {
      setDeletingId(null);
      setCustomerToDelete(null);
    }
  }, [customerToDelete, showToast]);

  const handleRecalcStats = useCallback(
    async (customerId) => {
      try {
        const res = await fetch("/api/customers/auth", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "recalcStats", customerId }),
        });
        const json = await res.json();
        if (!res.ok || !json?.success)
          throw new Error(json?.message || "Recalc failed");
        showToast("Stats recalculated", "success");
        fetchCustomers();
      } catch (e) {
        console.error(e);
        showToast("Failed to recalc stats", "error");
      }
    },
    [fetchCustomers, showToast]
  );

  const handleResetLimits = useCallback(
    async (customerId) => {
      try {
        const res = await fetch("/api/customers/auth", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "resetLimits", customerId }),
        });
        const json = await res.json();
        if (!res.ok || !json?.success)
          throw new Error(json?.message || "Reset failed");
        showToast("Limits reset from plan", "success");
        fetchCustomers();
      } catch (e) {
        console.error(e);
        showToast("Failed to reset limits", "error");
      }
    },
    [fetchCustomers, showToast]
  );

  /* ------------------------------ UI pieces ------------------------------ */

  const handleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const handleSelectAll = () => {
    if (selectAll) {
      setSelected([]);
      setSelectAll(false);
    } else {
      setSelected(filtered.map((c) => c._id));
      setSelectAll(true);
    }
  };

  const handlePageChange = useCallback(
    (page) => {
      if (page >= 1 && page <= pagination.totalPages) {
        setPagination((prev) => ({ ...prev, currentPage: page }));
      }
    },
    [pagination.totalPages]
  );

  const renderToast = () => (
    <AnimatePresence>
      {toast.show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-[99] flex items-center max-w-md ${
            toast.type === "success"
              ? "bg-green-100 border border-green-300 text-green-800"
              : "bg-red-100 text-red-800 border border-red-200"
          }`}
        >
          <div
            className={`mr-3 rounded-full p-1 ${
              toast.type === "success" ? "bg-green-500" : "bg-red-500"
            }`}
          >
            {toast.type === "success" ? (
              <FiCheck className="h-4 w-4 text-white" />
            ) : (
              <FiX className="h-4 w-4 text-white" />
            )}
          </div>
          <span className="font-medium">{toast.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const CustomerCard = ({ c, isSelected }) => {
    const planName = c?.planSnapshot?.name || "No plan";
    const id = c._id;

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
        <div className="absolute top-4 right-4 z-10">
          <div
            onClick={() => handleSelect(id)}
            className={`w-6 h-6 rounded border cursor-pointer transition-all duration-200 flex items-center justify-center ${
              isSelected
                ? "bg-primary border-primary"
                : "border-zinc-300 hover:border-primary"
            }`}
            title={isSelected ? "Unselect" : "Select"}
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

        <div
          className={`${
            viewMode === "double"
              ? "flex flex-col items-start"
              : "flex items-start xl:items-center flex-col xl:flex-row xl:justify-between"
          } gap-6`}
        >
          {/* Left cluster */}
          <div className="flex flex-col xl:flex-row items-center gap-3 md:gap-5 xl:divide-x">
            <div className="bg-zinc-100 border rounded-md overflow-hidden w-full max-w-28 h-32 p-3 lg:p-9 text-4xl text-zinc-700">
              <Users className="w-full h-full" />
            </div>

            <div className="flex flex-col xl:pl-4">
              <div
                className={`w-fit text-xxs px-2 py-0.5 rounded border ${
                  c.isActive
                    ? "bg-green-200 border-green-500 text-zinc-800"
                    : "bg-red-200 border-red-500 text-red-900"
                }`}
              >
                {c.isActive ? "Currently Active" : "Currently Inactive"}
              </div>
              <button
                onClick={() => openDetailsModal(c)}
                className="text-lg text-zinc-700 font-medium mt-1 text-left hover:underline"
              >
                {c.firstName + " " + c.lastName}
              </button>
              <p className="text-xs text-zinc-500 mb-2">{c.email || "—"}</p>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded bg-zinc-50">
                  <div className="flex items-center gap-1">
                    <h2 className="text-xxs uppercase text-primary">
                      Total Contacts :
                    </h2>
                    <p className="text-xs text-zinc-600">
                      {c?.stats?.totalContacts ?? 0}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded bg-zinc-50">
                  <div className="flex items-center gap-1">
                    <h2 className="text-xxs uppercase text-primary">
                      Total Lists :
                    </h2>
                    <p className="text-xs text-zinc-600">
                      {c?.stats?.totalLists ?? 0}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded bg-zinc-50">
                  <div className="flex items-center gap-1">
                    <h2 className="text-xxs uppercase text-primary">
                      Total Automations :
                    </h2>
                    <p className="text-xs text-zinc-600">
                      {c?.stats?.totalAutomations ?? 0}
                    </p>
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
                        <FiEdit2 />
                        Edit Customer
                      </div>
                    ),
                  },
                  {
                    value: "delete",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        <FiTrash2 />
                        Delete Customer
                      </div>
                    ),
                  },
                  {
                    value: "recalc",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        <FiRefreshCw />
                        Recalc Stats
                      </div>
                    ),
                  },
                  {
                    value: "reset",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        <FiRotateCcw />
                        Reset Limits
                      </div>
                    ),
                  },
                ]}
                placeholder="Actions"
                onChange={(val) => {
                  if (val === "edit") openAddEditModal(c);
                  if (val === "delete") handleDeleteClick(c);
                  if (val === "recalc") handleRecalcStats(id);
                  if (val === "reset") handleResetLimits(id);
                }}
                className="w-32"
              />{" "}
            </div>
          </div>

          {/* Right stats grid */}
          <div
            className={`flex-1 grid gap-3 ${
              viewMode === "double"
                ? "grid-cols-1 lg:grid-cols-3"
                : "grid-cols-4"
            }`}
          >
            <MiniCard title="Plan" subLine={planName} />

            <MiniCard
              title="Emails Sent"
              subLine={c?.stats?.totalEmailSent ?? 0}
            />
            <MiniCard title="Added On" subLine={formatDate(c?.createdAt)} />
          </div>
        </div>

        {deletingId === id && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] grid place-items-center rounded">
            <ImSpinner5 className="animate-spin text-zinc-500 text-2xl" />
          </div>
        )}
      </div>
    );
  };

  const renderGrid = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <ImSpinner5 className="animate-spin text-zinc-400 text-4xl" />
        </div>
      );
    }
    if (filtered.length === 0) {
      const isFiltered = Boolean(debouncedSearch) || statusFilter !== "all";
      return (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 flex items-center justify-center rounded-full bg-zinc-100 mb-4">
            <FiUser className="h-10 w-10 text-zinc-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 mb-1">
            {isFiltered ? "No matching customers" : "No customers"}
          </h3>
          <p className="text-zinc-500">
            {isFiltered
              ? "Try adjusting your search or filters."
              : "Get started by adding your first customer."}
          </p>
          {!isFiltered && (
            <button
              onClick={() => openAddEditModal()}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800"
            >
              <FiPlus className="h-4 w-4 mr-2" />
              Add Customer
            </button>
          )}
        </div>
      );
    }
    return (
      <div
        className={`grid gap-5 ${
          viewMode === "double" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {filtered.map((c) => (
          <CustomerCard
            key={c._id}
            c={c}
            isSelected={selected.includes(c._id)}
          />
        ))}
      </div>
    );
  };

  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;
    const { currentPage, totalPages, total, limit } = pagination;
    const startItem = (currentPage - 1) * limit + 1;
    const endItem = Math.min(currentPage * limit, total);

    return (
      <div className="flex items-center justify-between mt-6 px-2">
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-700">
              Showing <span className="font-medium">{startItem}</span> to{" "}
              <span className="font-medium">{endItem}</span> of{" "}
              <span className="font-medium">{total}</span> results
            </p>
          </div>
          <div>
            <nav
              className="relative z-0 inline-flex rounded-md -space-x-px"
              aria-label="Pagination"
            >
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-zinc-300 bg-white text-sm font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-50"
              >
                <span className="sr-only">Previous</span>
                <FiChevronLeft className="h-5 w-5" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                )
                .map((page, index, array) => {
                  const prev = array[index - 1];
                  const showDots = prev && page - prev > 1;
                  return (
                    <React.Fragment key={page}>
                      {showDots && (
                        <span className="relative inline-flex items-center px-4 py-2 border border-zinc-300 bg-white text-sm font-medium text-zinc-700">
                          ...
                        </span>
                      )}
                      <button
                        onClick={() => handlePageChange(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors ${
                          currentPage === page
                            ? "z-10 bg-zinc-100 border-zinc-500 text-zinc-600"
                            : "bg-white border-zinc-300 text-zinc-500 hover:bg-zinc-50"
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-zinc-300 bg-white text-sm font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-50"
              >
                <span className="sr-only">Next</span>
                <FiChevronRight className="h-5 w-5" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  /* -------------------------- Render main page --------------------------- */
  return (
    <SidebarWrapper>
      {/* Toast */}
      {renderToast()}

      {/* Header */}
      <Header
        title="Customer Management"
        subtitle="Manage your customers, plans and quotas"
        buttonLabel="Add Customer"
        onButtonClick={() => openAddEditModal()}
      />

      {/* Filter / selection bar */}
      <div className="w-full bg-zinc-50 border px-4 p-2 rounded mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left — view + search + status */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* View toggle */}
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
              <input
                type="text"
                placeholder="Search customers by name, slug, email, or plan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 border border-zinc-300 outline-none rounded text-sm bg-white"
              />
            </div>

            {/* Status filter */}
            <div className="relative">
              <Dropdown
                options={[
                  { value: "all", label: "All Status" },
                  { value: "active", label: "Active Only" },
                  { value: "inactive", label: "Inactive Only" },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="Filter by status"
                className="w-40"
              />
            </div>
          </div>

          {/* Right — selection (bulk actions) */}
          <div className="flex items-center gap-3">
            <div
              onClick={handleSelectAll}
              className="text-sm text-primary cursor-pointer"
            >
              Select All
            </div>
            <div
              onClick={handleSelectAll}
              className={`w-6 h-6 rounded border cursor-pointer transition-all duration-200 flex items-center justify-center ${
                selected.length > 0
                  ? "bg-primary border-primary"
                  : "border-zinc-300 hover:border-primary"
              }`}
            >
              {selected.length > 0 && (
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

            {/* NEW — Bulk Actions */}
            {selected.length > 0 && (
              <div className="flex items-center gap-2 pl-3 border-l border-zinc-200">
                <span className="text-xs text-zinc-500">Actions:</span>

                <Dropdown
                  options={[
                    {
                      value: "disable",
                      label: (
                        <div className="flex items-center gap-2">
                          <FiX className="h-3 w-3" />
                          Disable ({selected.length})
                        </div>
                      ),
                    },
                    {
                      value: "enable",
                      label: (
                        <div className="flex items-center gap-2">
                          <FiCheck className="h-3 w-3" />
                          Enable
                        </div>
                      ),
                    },
                    {
                      value: "reset",
                      label: (
                        <div className="flex items-center gap-2">
                          <FiRotateCcw className="h-3 w-3" />
                          Reset Limits
                        </div>
                      ),
                    },
                    {
                      value: "recalc",
                      label: (
                        <div className="flex items-center gap-2">
                          <FiRefreshCw className="h-3 w-3" />
                          Recalc Stats
                        </div>
                      ),
                    },
                    {
                      value: "delete",
                      label: (
                        <div className="flex items-center gap-2 text-red-600">
                          <FiTrash2 className="h-3 w-3" />
                          Delete
                        </div>
                      ),
                    },
                  ]}
                  onChange={(value) => {
                    if (value === "disable") bulkSetActive(false);
                    if (value === "enable") bulkSetActive(true);
                    if (value === "reset") bulkResetLimits();
                    if (value === "recalc") bulkRecalcStats();
                    if (value === "delete") bulkDelete();
                  }}
                  disabled={isBulkRunning}
                  placeholder={
                    isBulkRunning ? (
                      <div className="flex items-center gap-2">
                        <ImSpinner5 className="h-3 w-3 animate-spin" />
                        Processing...
                      </div>
                    ) : (
                      "Bulk Actions"
                    )
                  }
                  position="bottom-right"
                  className="w-40"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mt-6">{renderGrid()}</div>

      {/* Pagination */}
      {renderPagination()}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-6 rounded-xl shadow-lg w-full max-w-3xl"
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
                   
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Email
                      </label>
                      <input
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="customer@domain.com"
                        className="w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary px-4 py-2.5 text-sm text-zinc-800 outline-none placeholder-zinc-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Slug
                      </label>
                      <input
                        name="slug"
                        value={formData.slug}
                        onChange={handleInputChange}
                        placeholder="e.g., acme"
                        className="w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary px-4 py-2.5 text-sm text-zinc-800 outline-none placeholder-zinc-500"
                      />
                    </div>

                    {/* Plan */}
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Plan (optional)
                      </label>
                      <Dropdown
                        options={[
                          { value: "", label: "No Plan" },
                          ...plans.map((p) => ({
                            value: p._id,
                            label: `${p.name} · ${p.length} · ${p.currency} ${
                              p.effectivePrice ?? p.price
                            }`,
                          })),
                        ]}
                        value={formData.planId}
                        onChange={(val) =>
                          setFormData((prev) => ({ ...prev, planId: val }))
                        }
                        placeholder="Select a plan"
                        className="w-full"
                      />
                    </div>
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
                          onChange={handleInputChange}
                          className="sr-only peer"
                        />
                        <div className="w-12 h-6 bg-zinc-300 peer-focus:outline-none  peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-gray-300 after:border after: after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                      <div>
                        <p className="text-sm  text-zinc-800">
                          {formData.isActive ? "Active" : "Inactive"}
                        </p>
                        <p className="text-xs text-zinc-600">
                          {formData.isActive
                            ? "This customer is currently active"
                            : "This customer is disabled"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Session Type
                      </label>
                      <Dropdown
                        options={[
                          { value: "password", label: "Password" },
                          { value: "token", label: "Token" },
                          { value: "sso", label: "SSO" },
                        ]}
                        value={formData.sessionType}
                        onChange={(val) =>
                          setFormData((p) => ({ ...p, sessionType: val }))
                        }
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        First Name
                      </label>
                      <input
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary px-4 py-2.5 text-sm text-zinc-800 outline-none placeholder-zinc-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Last Name
                      </label>
                      <input
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary px-4 py-2.5 text-sm text-zinc-800 outline-none placeholder-zinc-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Password (set/reset)
                      </label>
                      <input
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder={
                          editingId
                            ? "Leave blank to keep current"
                            : "Create a password"
                        }
                        className="w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary px-4 py-2.5 text-sm text-zinc-800 outline-none placeholder-zinc-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Phone
                      </label>
                      <input
                        name="phoneNo"
                        value={formData.phoneNo}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary px-4 py-2.5 text-sm text-zinc-800 outline-none placeholder-zinc-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Address
                      </label>
                      <input
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary px-4 py-2.5 text-sm text-zinc-800 outline-none placeholder-zinc-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Country
                      </label>
                      <Dropdown
                        options={[
                          { value: "US", label: "United States" },
                          { value: "GB", label: "United Kingdom" },
                          { value: "CA", label: "Canada" },
                          { value: "AU", label: "Australia" },
                          { value: "DE", label: "Germany" },
                          { value: "FR", label: "France" },
                          { value: "IT", label: "Italy" },
                          { value: "ES", label: "Spain" },
                          { value: "JP", label: "Japan" },
                          { value: "CN", label: "China" },
                          { value: "IN", label: "India" },
                          { value: "BR", label: "Brazil" },
                          { value: "MX", label: "Mexico" },
                          { value: "RU", label: "Russia" },
                          { value: "ZA", label: "South Africa" },
                          { value: "SG", label: "Singapore" },
                          { value: "AE", label: "United Arab Emirates" },
                          { value: "PK", label: "Pakistan" },
                          { value: "NZ", label: "New Zealand" },
                          { value: "IE", label: "Ireland" },
                        ]}
                        value={formData.country}
                        onChange={(val) =>
                          setFormData((prev) => ({ ...prev, country: val }))
                        }
                        placeholder="Select a country"
                        className="w-full"
                        position="top"
                        searchable={true}
                      />
                    </div>{" "}
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={modalLoading}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      {modalLoading && (
                        <ImSpinner5 className="animate-spin h-4 w-4" />
                      )}
                      {editingId ? "Update Customer" : "Create Customer"}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {isConfirmModalOpen && customerToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/80 flex justify-center items-center p-4"
            onClick={() => setIsConfirmModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
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
                Are you sure you want to delete{" "}
                <strong>
                  {customerToDelete.firstName + " " + customerToDelete.lastName}
                </strong>
                ? This action cannot be undone.
              </p>
              <div className="space-y-3">
                <button
                  onClick={confirmDelete}
                  disabled={modalLoading}
                  className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {modalLoading ? (
                    <ImSpinner5 className="animate-spin h-4 w-4 mr-2" />
                  ) : null}
                  Delete
                </button>
                <button
                  onClick={() => setIsConfirmModalOpen(false)}
                  disabled={modalLoading}
                  className="w-full flex justify-center items-center px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md text-zinc-700 bg-white hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {isDetailsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={closeDetailsModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
              className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-zinc-200/50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative bg-zinc-100 border-b border-zinc-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-md bg-white border border-zinc-200">
                      <FiUser className="h-8 w-8 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">
                        Customer
                      </h2>
                      <p className="text-sm text-zinc-600 mt-1">
                        Plan, quota and aggregated stats
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeDetailsModal}
                    className="p-2 hover:bg-white rounded-lg transition-colors"
                  >
                    <FiX className="h-5 w-5 text-zinc-600" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="overflow-y-auto flex-1 bg-white">
                {detailsLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <ImSpinner5 className="animate-spin text-zinc-400 text-4xl" />
                  </div>
                ) : details ? (
                  <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 divide-x divide-zinc-300">
                      {/* Left: profile */}
                      <div className="lg:col-span-4">
                        <div className="text-center mb-6">
                          <div className="relative inline-block mb-4">
                            <div className="h-20 w-20 rounded-md bg-zinc-100 border border-zinc-200 center-flex">
                              <FiUser className="h-8 w-8 text-zinc-700" />
                            </div>
                            <div
                              className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white ${
                                details.isActive
                                  ? "bg-emerald-400"
                                  : "bg-rose-400"
                              }`}
                            />
                          </div>

                          <p className="text-zinc-600 text-sm mb-1">
                            {details.email || "—"}
                          </p>
                          <p className="text-zinc-600 text-sm mb-1">
                            Name:{" "}
                            {(details.firstName || "—") +
                              " " +
                              (details.lastName || "")}
                          </p>
                          <p className="text-zinc-600 text-sm mb-1">
                            Phone: {details.phoneNo || "—"}
                          </p>
                          <p className="text-zinc-600 text-sm">
                            Country: {details.country || "—"}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                              Email Quota (period)
                            </p>
                            <p className="text-sm font-medium text-zinc-800">
                              {details?.emailLimits?.remaining ?? 0} remaining
                              {"  ·  "}
                              {details?.planSnapshot?.monthlyEmailLimit ??
                                0}{" "}
                              total · {details?.emailLimits?.period || "—"}
                            </p>
                            <p className="text-xs text-zinc-500">
                              Window:{" "}
                              {details?.emailLimits?.periodStart
                                ? new Date(
                                    details.emailLimits.periodStart
                                  ).toLocaleDateString()
                                : "—"}{" "}
                              →{" "}
                              {details?.emailLimits?.periodEnd
                                ? new Date(
                                    details.emailLimits.periodEnd
                                  ).toLocaleDateString()
                                : "—"}
                            </p>
                          </div>

                          <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                              Customer ID
                            </p>
                            <p className="text-xs font-mono text-zinc-600 truncate">
                              {details._id}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Right: metrics */}
                      <div className="lg:col-span-8">
                        <div className="space-y-6 divide-y divide-zinc-300">
                          <div className="bg-white p-6">
                            <h3 className="text-lg font-bold text-zinc-800 mb-6 flex items-center gap-2">
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                              Aggregated Stats
                            </h3>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                              <MiniCard
                                title="Emails Sent"
                                subLine={details?.stats?.totalEmailSent ?? 0}
                              />
                              <MiniCard
                                title="Automations"
                                subLine={details?.stats?.totalAutomations ?? 0}
                              />
                              <MiniCard
                                title="Lists"
                                subLine={details?.stats?.totalLists ?? 0}
                              />
                              <MiniCard
                                title="Contacts"
                                subLine={details?.stats?.totalContacts ?? 0}
                              />
                            </div>
                          </div>

                          {details?.planId && (
                            <div className="bg-white p-6">
                              <h3 className="text-lg font-bold text-zinc-800 mb-4">
                                Current Plan
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                                  <p className="text-xs text-zinc-500">Name</p>
                                  <p className="text-sm text-zinc-800 font-medium">
                                    {details?.planSnapshot?.name || "—"}
                                  </p>
                                </div>
                                <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                                  <p className="text-xs text-zinc-500">
                                    Length
                                  </p>
                                  <p className="text-sm text-zinc-800 font-medium">
                                    {details?.planSnapshot?.length || "—"}
                                  </p>
                                </div>
                                <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                                  <p className="text-xs text-zinc-500">
                                    Email Limit
                                  </p>
                                  <p className="text-sm text-zinc-800 font-medium">
                                    {details?.planSnapshot?.monthlyEmailLimit ??
                                      0}
                                  </p>
                                </div>
                                <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                                  <p className="text-xs text-zinc-500">
                                    Currency
                                  </p>
                                  <p className="text-sm text-zinc-800 font-medium">
                                    {details?.planSnapshot?.currency || "USD"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                      <p className="text-zinc-500 mb-2">
                        Failed to load details
                      </p>
                      <button
                        onClick={() =>
                          details?._id && openDetailsModal(details)
                        }
                        className="text-sm text-indigo-600 hover:text-indigo-700 underline"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end">
                <button
                  onClick={closeDetailsModal}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SidebarWrapper>
  );
};

export default CustomersPage;
