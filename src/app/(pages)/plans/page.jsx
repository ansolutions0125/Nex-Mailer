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
  FiTrash2,
  FiX,
  FiPackage,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { AnimatePresence, motion } from "framer-motion";
import Header from "@/components/Header";
import { Dropdown } from "@/components/Dropdown";
import { inputStyles, labelStyles, MiniCard } from "@/presets/styles";

const formatMoney = (value, currency = "USD") => {
  const n = Number(value || 0);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};

const computeEffectivePrice = (plan) => {
  if (typeof plan?.effectivePrice === "number") return plan.effectivePrice;
  const price = Number(plan?.price || 0);
  const discounted = !!plan?.discounted;
  const pct = Number(plan?.discount || 0);
  if (!discounted || pct <= 0) return price;
  return Math.max(0, price - (price * pct) / 100);
};

/* ------------------------------- Page ------------------------------------ */
const PlansPage = () => {
  /* Core state */
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

  /* Selection (bulk actions) */
  const [selected, setSelected] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkRunning, setIsBulkRunning] = useState(false);

  /* Toasts */
  const [toast, setToast] = useState({ show: false, message: "", type: "" });

  /* Modals */
  const [isModalOpen, setIsModalOpen] = useState(false); // Add/Edit
  const [editingId, setEditingId] = useState(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [details, setDetails] = useState(null);

  /* Form state (aligned with schema) */
  const [formData, setFormData] = useState({
    name: "",
    slogan: "",
    description: "",
    isActive: true,

    currency: "USD",
    length: "1month", // FIXED: must be one of 1month|3month|6month|1year
    price: "",
    discounted: false,
    discount: "",

    emailLimit: "", // FIXED: was monthlyEmailLimit
    featuresText: "", // UI field: comma/newline separated; we convert to array
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
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(pagination.currentPage),
        limit: String(pagination.limit),
      });
      if (statusFilter === "active") query.append("active", "true");
      if (statusFilter === "inactive") query.append("active", "false");

      // Note: server doesn't support ?search, we filter client-side. :contentReference[oaicite:8]{index=8}
      const res = await fetch(`/api/plans?${query.toString()}`);
      const json = await res.json();

      if (json?.success) {
        const data = Array.isArray(json.data) ? json.data : [];
        setPlans(data);
        setPagination((prev) => ({
          ...prev,
          ...(json.pagination || {
            total: data.length,
            totalPages: Math.max(1, Math.ceil(data.length / prev.limit)),
          }),
        }));
      } else {
        showToast(json?.message || "Failed to load plans", "error");
        setPlans([]);
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
      }
    } catch (e) {
      console.error("fetchPlans error", e);
      showToast("Failed to load plans.", "error");
      setPlans([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, pagination.limit, statusFilter, showToast]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  /* ------------------------------ Filters -------------------------------- */
  const filtered = useMemo(() => {
    let list = [...plans];

    if (statusFilter !== "all") {
      const wantActive = statusFilter === "active";
      list = list.filter((p) => (wantActive ? p.isActive : !p.isActive));
    }

    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      list = list.filter((p) => {
        const text = [
          p?.name || "",
          p?.slogan || "",
          p?.length || "",
          p?.currency || "",
          String(p?.price ?? ""),
        ].join(" ");
        return text.toLowerCase().includes(s);
      });
    }
    return list;
  }, [plans, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (filtered.length === 0) return setSelectAll(false);
    setSelectAll(filtered.every((p) => selected.includes(p._id)));
  }, [filtered, selected]);

  /* ------------------------------- Modals -------------------------------- */
  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      slogan: "",
      description: "",
      isActive: true,

      currency: "USD",
      length: "1month",
      price: "",
      discounted: false,
      discount: "",

      emailLimit: "",
      featuresText: "",
    });
    setEditingId(null);
  }, []);

  const openAddEditModal = useCallback(
    (plan = null) => {
      if (plan) {
        setFormData({
          name: plan.name || "",
          slogan: plan.slogan || "",
          description: plan.description || "",
          isActive: !!plan.isActive,

          currency: plan.currency || "USD",
          length: plan.length || "1month", // FIXED
          price: String(plan.price ?? ""),
          discounted: !!plan.discounted,
          discount: String(plan.discount ?? ""),

          emailLimit: String(plan.emailLimit ?? ""), // FIXED
          featuresText: Array.isArray(plan.features)
            ? plan.features.join(", ")
            : "",
        });
        setEditingId(plan._id);
      } else {
        resetForm();
      }
      setIsModalOpen(true);
    },
    [resetForm]
  );

  const openDetailsModal = useCallback((plan) => {
    setDetails(plan || null);
    setIsDetailsModalOpen(true);
  }, []);

  const closeDetailsModal = useCallback(() => {
    setDetails(null);
    setIsDetailsModalOpen(false);
  }, []);

  /* ---------------------------- CRUD handlers ---------------------------- */
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((p) => ({
      ...p,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const normalizePlanPayload = (data) => {
    const features = (data.featuresText || "")
      .split(/\n|,/)
      .map((x) => x.trim())
      .filter(Boolean);

    return {
      name: data.name?.trim(),
      slogan: data.slogan?.trim() || undefined,
      description: data.description?.trim() || undefined,
      isActive: !!data.isActive,

      currency: data.currency || "USD",
      length: data.length || "1month", // FIXED
      price: Number(data.price || 0),
      discounted: !!data.discounted,
      discount:
        data.discounted && data.discount !== ""
          ? Math.max(0, Math.min(100, Number(data.discount)))
          : 0,

      emailLimit: data.emailLimit !== "" ? Number(data.emailLimit) : 0, // FIXED
      features,
    };
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      showToast("Name is required", "error");
      return;
    }
    if (formData.price === "" || isNaN(Number(formData.price))) {
      showToast("Price must be a number", "error");
      return;
    }
    if (
      formData.discounted &&
      (formData.discount === "" || isNaN(Number(formData.discount)))
    ) {
      showToast("Discount % must be a number", "error");
      return;
    }

    setModalLoading(true);
    try {
      const payload = normalizePlanPayload(formData);

      if (editingId) {
        // FIXED: match /api/plans PUT signature (no action/updateData) :contentReference[oaicite:9]{index=9}
        const res = await fetch("/api/plans", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: editingId,
            ...payload,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json?.success)
          throw new Error(json?.message || "Failed to update plan");
        showToast("Plan updated successfully", "success");
      } else {
        // Create plan
        const res = await fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json?.success)
          throw new Error(json?.message || "Failed to create plan");
        showToast("Plan created successfully", "success");
      }

      setIsModalOpen(false);
      resetForm();
      fetchPlans();
    } catch (e) {
      console.error("save plan error", e);
      showToast(e.message || "Failed to save plan", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteClick = useCallback((plan) => {
    setPlanToDelete(plan);
    setIsConfirmModalOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!planToDelete?._id) return;
    setDeletingId(planToDelete._id);
    setIsConfirmModalOpen(false);
    try {
      // Using _id for consistency with other routes
      const res = await fetch(`/api/plans?_id=${planToDelete._id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json?.success)
        throw new Error(json?.message || "Delete failed");

      showToast("Plan deleted successfully", "success");
      setPlans((prev) => prev.filter((p) => p._id !== planToDelete._id));
    } catch (e) {
      console.error(e);
      showToast(e.message || "Failed to delete plan", "error");
    } finally {
      setDeletingId(null);
      setPlanToDelete(null);
    }
  }, [planToDelete, showToast]);

  /* -------------------------- Single & bulk actions ---------------------- */
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

  const bulkSetActive = useCallback(
    async (val) => {
      const ids = [...selected];
      if (!ids.length) return;

      await runBulk(
        ids,
        async (planId) => {
          const res = await fetch("/api/plans", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              planId,
              isActive: !!val, // FIXED contract
            }),
          });
          const j = await res.json();
          if (!res.ok || !j?.success) throw new Error(j?.message || "Failed");
        },
        val ? "Enable plans" : "Disable plans"
      );

      // Optimistic UI
      setPlans((prev) =>
        prev.map((p) => (ids.includes(p._id) ? { ...p, isActive: !!val } : p))
      );
      setSelected([]);
    },
    [selected, runBulk]
  );

  const singleSetActive = useCallback(
    async (planId, val) => {
      try {
        const res = await fetch("/api/plans", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            isActive: !!val, // FIXED contract
          }),
        });
        const j = await res.json();
        if (!res.ok || !j?.success) throw new Error(j?.message || "Failed");
        setPlans((prev) =>
          prev.map((p) => (p._id === planId ? { ...p, isActive: !!val } : p))
        );
        showToast(`Plan ${val ? "enabled" : "disabled"}`, "success");
      } catch (e) {
        showToast(e.message || "Failed to update plan", "error");
      }
    },
    [showToast]
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
      setSelected(filtered.map((p) => p._id));
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

  const PlanCard = ({ p, isSelected }) => {
    const id = p._id;
    const eff = computeEffectivePrice(p);
    const priceStr = formatMoney(eff, p.currency || "USD");
    const badge = p.isActive
      ? "bg-green-200 border-green-500 text-zinc-800"
      : "bg-red-200 border-red-500 text-red-900";

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
              <FiPackage className="w-full h-full" />
            </div>

            <div className="flex flex-col xl:pl-4">
              <div
                className={`w-fit text-xxs px-2 py-0.5 rounded border ${badge}`}
              >
                {p.isActive ? "Currently Active" : "Currently Inactive"}
              </div>
              <button
                onClick={() => openDetailsModal(p)}
                className="text-lg text-zinc-700 font-medium mt-1 text-left hover:underline"
              >
                {p.name}
              </button>
              <p className="text-xs text-zinc-500 mb-2 line-clamp-2 max-w-80">
                {p.slogan || "—"}
              </p>

              <Dropdown
                position="bottom"
                options={[
                  { value: "edit", label: "Edit Plan" },
                  { value: "delete", label: "Delete Plan" },
                  {
                    value: p.isActive ? "disable" : "enable",
                    label: p.isActive ? "Disable" : "Enable",
                  },
                ]}
                onChange={(val) => {
                  if (val === "edit") openAddEditModal(p);
                  if (val === "delete") handleDeleteClick(p);
                  if (val === "disable") {
                    // If nothing is selected, toggle just this plan; else bulk
                    selected.length
                      ? bulkSetActive(false)
                      : singleSetActive(id, false);
                  }
                  if (val === "enable") {
                    selected.length
                      ? bulkSetActive(true)
                      : singleSetActive(id, true);
                  }
                }}
                placeholder="Actions"
                className="w-36"
              />
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
            <MiniCard title="Length" subLine={p.length || "—"} />
            <MiniCard title="Price" subLine={priceStr} />
            <MiniCard
              title={`Email Limit / ${p.length}`}
              subLine={
                typeof p.emailLimit === "number"
                  ? p.emailLimit.toLocaleString()
                  : "0"
              }
            />
            <MiniCard title="Currency" subLine={p.currency || "USD"} />
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
            <FiPackage className="h-10 w-10 text-zinc-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 mb-1">
            {isFiltered ? "No matching plans" : "No plans yet"}
          </h3>
          <p className="text-zinc-500">
            {isFiltered
              ? "Try adjusting your search or filters."
              : "Create your first pricing plan to get started."}
          </p>
          {!isFiltered && (
            <button
              onClick={() => openAddEditModal()}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800"
            >
              <FiPlus className="h-4 w-4 mr-2" />
              Add Plan
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
        {filtered.map((p) => (
          <PlanCard key={p._id} p={p} isSelected={selected.includes(p._id)} />
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
        title="Plans"
        subtitle="Create and manage pricing plans & email quotas"
        buttonLabel="Add Plan"
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
                placeholder="Search plans by name, slogan, currency..."
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
            {/* Bulk Actions */}
            {selected.length > 0 && (
              <div className="flex items-center gap-2 pl-3 border-l border-zinc-200">
                <span className="text-xs text-zinc-500">Actions:</span>
                <button
                  onClick={() => bulkSetActive(false)}
                  disabled={isBulkRunning}
                  className="btn btn-sm rounded hover:bg-zinc-800 hover:text-white"
                >
                  Disable ({selected.length})
                </button>
                <button
                  onClick={() => bulkSetActive(true)}
                  disabled={isBulkRunning}
                  className="btn btn-sm rounded hover:bg-zinc-800 hover:text-white"
                >
                  Enable
                </button>
                <button
                  onClick={async () => {
                    const ids = [...selected];
                    if (!ids.length) return;
                    if (
                      !confirm(
                        `Delete ${ids.length} plans? This cannot be undone.`
                      )
                    )
                      return;

                    setIsBulkRunning(true);
                    try {
                      const results = await Promise.allSettled(
                        ids.map(async (_id) => {
                          const res = await fetch(`/api/plans?_id=${_id}`, {
                            method: "DELETE",
                          });
                          const j = await res.json();
                          if (!res.ok || !j?.success)
                            throw new Error(j?.message || "Failed");
                        })
                      );
                      const ok = results.filter(
                        (r) => r.status === "fulfilled"
                      ).length;
                      showToast(
                        `Delete plans: ${ok} succeeded${
                          results.length - ok
                            ? `, ${results.length - ok} failed`
                            : ""
                        }`,
                        ok === results.length ? "success" : "error"
                      );
                      setPlans((prev) =>
                        prev.filter((p) => !ids.includes(p._id))
                      );
                      setSelected([]);
                    } finally {
                      setIsBulkRunning(false);
                    }
                  }}
                  disabled={isBulkRunning}
                  className="btn btn-sm rounded hover:bg-red-600 hover:text-white"
                >
                  Delete
                </button>
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
                {editingId ? "Edit Plan" : "Add New Plan"}
              </h2>

              {modalLoading ? (
                <div className="flex justify-center items-center py-12">
                  <ImSpinner5 className="animate-spin text-gray-500 text-3xl" />
                </div>
              ) : (
                <form onSubmit={handleFormSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Names */}
                    <div className="flex-1">
                      <label className={labelStyles("base")}>Name</label>
                      <input
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="e.g., Starter"
                        className={inputStyles}
                        required
                      />
                    </div>
                    <div className="flex-1">
                      <label className={labelStyles("base")}>Slogan</label>
                      <input
                        name="slogan"
                        value={formData.slogan}
                        onChange={handleInputChange}
                        placeholder="e.g., Perfect for small teams"
                        className={inputStyles}
                      />
                    </div>

                    {/* Pricing */}
                    <div>
                      <label className={labelStyles("base")}>Currency</label>
                      <Dropdown
                        options={[
                          { value: "USD", label: "USD" },
                          { value: "EUR", label: "EUR" },
                          { value: "GBP", label: "GBP" },
                          { value: "PKR", label: "PKR" },
                          { value: "INR", label: "INR" },
                        ]}
                        value={formData.currency}
                        onChange={(val) =>
                          setFormData((p) => ({ ...p, currency: val }))
                        }
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className={labelStyles("base")}>
                        Billing Length
                      </label>
                      <Dropdown
                        options={[
                          { value: "1month", label: "Monthly" },
                          { value: "3month", label: "3 Months" },
                          { value: "6month", label: "6 Months" },
                          { value: "1year", label: "Annual" },
                        ]}
                        value={formData.length}
                        onChange={(val) =>
                          setFormData((p) => ({ ...p, length: val }))
                        }
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelStyles("base")}>Price</label>
                        <input
                          name="price"
                          value={formData.price}
                          onChange={handleInputChange}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="e.g., 29.00"
                          className={inputStyles}
                          required
                        />
                      </div>

                      <div>
                        <label className={labelStyles("base")}>
                          Discount %
                        </label>
                        <input
                          name="discount"
                          value={formData.discount}
                          onChange={handleInputChange}
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          placeholder="e.g., 20"
                          disabled={!formData.discounted}
                          className="w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary px-4 py-2.5 text-sm text-zinc-800 outline-none placeholder-zinc-500 disabled:opacity-60"
                        />
                      </div>
                    </div>
                    <div className="center-flex">
                      <div className="w-full flex items-center gap-4">
                        <label
                          htmlFor="discountedToggle"
                          className="relative inline-flex items-center cursor-pointer"
                        >
                          <input
                            id="discountedToggle"
                            type="checkbox"
                            name="discounted"
                            checked={formData.discounted}
                            onChange={handleInputChange}
                            className="sr-only peer"
                          />
                          <div className="w-12 h-6 bg-zinc-300 peer-focus:outline-none peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                        <div>
                          <p className="text-sm text-zinc-800">
                            {formData.discounted ? "Discounted" : "No Discount"}
                          </p>
                          <p className="text-xs text-zinc-600">
                            Toggle discount if this plan has a promotional price
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quota */}
                    <div>
                      <label className={labelStyles("base")}>
                        Monthly Email Limit
                      </label>
                      <input
                        name="emailLimit" // FIXED
                        value={formData.emailLimit}
                        onChange={handleInputChange}
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g., 10000"
                        className={inputStyles}
                      />
                    </div>

                    <div className="center-flex">
                      <div className="w-full flex items-center gap-4">
                        <label
                          htmlFor="isActive"
                          className="relative inline-flex items-center cursor-pointer"
                        >
                          <input
                            id="isActive"
                            type="checkbox"
                            name="isActive"
                            checked={formData.isActive}
                            onChange={handleInputChange}
                            className="sr-only peer"
                          />
                          <div className="w-12 h-6 bg-zinc-300 peer-focus:outline-none peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                        <div>
                          <p className="text-sm text-zinc-800">
                            {formData.isActive ? "Active" : "Inactive"}
                          </p>
                          <p className="text-xs text-zinc-600">
                            Toggle if this is Live for public or not
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Features & Description */}
                    <div className="md:col-span-2">
                      <label className={labelStyles("base")}>
                        Features (comma or newline separated)
                      </label>
                      <textarea
                        name="featuresText"
                        value={formData.featuresText}
                        onChange={handleInputChange}
                        rows={3}
                        placeholder="Unlimited contacts,Basic automations,Email support"
                        className={inputStyles}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className={labelStyles("base")}>Description</label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={3}
                        placeholder="Short description about this plan..."
                        className={inputStyles}
                      />
                    </div>
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
                      {editingId ? "Update Plan" : "Create Plan"}
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
        {isConfirmModalOpen && planToDelete && (
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
                Delete Plan
              </h3>
              <p className="text-sm text-zinc-600 text-center mb-6">
                Are you sure you want to delete{" "}
                <strong>{planToDelete.name}</strong>? This action cannot be
                undone.
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
        {isDetailsModalOpen && details && (
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
              className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col border border-zinc-200/50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative bg-zinc-100 border-b border-zinc-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-md bg-white border border-zinc-200">
                      <FiPackage className="h-8 w-8 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">
                        {details.name}
                      </h2>
                      <p className="text-sm text-zinc-600 mt-1">
                        {details.slogan || "—"}
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
                <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 divide-x divide-zinc-300">
                  {/* Left: pricing/quota */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Price
                      </p>
                      <p className="text-sm font-medium text-zinc-800">
                        {formatMoney(
                          computeEffectivePrice(details),
                          details.currency || "USD"
                        )}{" "}
                        {details.discounted && details.discount > 0 && (
                          <span className="ml-2 text-xs text-zinc-500 line-through">
                            {formatMoney(
                              details.price,
                              details.currency || "USD"
                            )}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Billing: {details.length || "1month"} · Currency:{" "}
                        {details.currency || "USD"}
                      </p>
                    </div>

                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Email Quota
                      </p>
                      <p className="text-sm font-medium text-zinc-800">
                        {(details.emailLimit ?? 0).toLocaleString()} / month
                      </p>
                    </div>

                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Plan ID
                      </p>
                      <p className="text-xs font-mono text-zinc-600 truncate">
                        {details._id}
                      </p>
                    </div>
                  </div>

                  {/* Right: features/description */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white p-6">
                      <h3 className="text-lg font-bold text-zinc-800 mb-6 flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        Features
                      </h3>
                      {Array.isArray(details.features) &&
                      details.features.length > 0 ? (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {details.features.map((f, idx) => (
                            <li
                              key={`${idx}-${String(f)}`}
                              className="text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded px-3 py-2"
                            >
                              {String(f)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-zinc-500">
                          No features provided
                        </p>
                      )}
                    </div>

                    {details.description && (
                      <div className="bg-white p-6">
                        <h3 className="text-lg font-bold text-zinc-800 mb-2">
                          Description
                        </h3>
                        <p className="text-sm text-zinc-700 whitespace-pre-line">
                          {details.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
                <button
                  onClick={closeDetailsModal}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const base = details;
                    if (base) {
                      closeDetailsModal();
                      openAddEditModal(base);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-lg hover:bg-primary/90"
                >
                  <FiEdit2 className="h-4 w-4" />
                  Edit Plan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SidebarWrapper>
  );
};

export default PlansPage;
