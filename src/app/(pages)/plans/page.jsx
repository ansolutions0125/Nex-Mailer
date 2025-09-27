"use client";

import SidebarWrapper from "@/components/SidebarWrapper";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiGrid,
  FiList,
  FiX,
  FiPackage,
} from "react-icons/fi";
import { AnimatePresence, motion } from "framer-motion";
import Header from "@/components/Header";
import { Dropdown } from "@/components/Dropdown";
import { Checkbox, inputStyles, ViewToggle } from "@/presets/styles";
import {
  fetchWithAuthAdmin,
  fetchWithAuthCustomer,
} from "@/helpers/front-end/request";
import useCustomerStore from "@/store/useCustomerStore";
import { useToastStore } from "@/store/useToastStore";
import useAdminStore from "@/store/useAdminStore";
import ConfirmationModal from "@/components/ConfirmationModal";
import PlanTable from "./PlanTable";
import { useRouter } from "next/navigation";

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

  /* Core state */
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
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

  /* Modals */
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [details, setDetails] = useState(null);

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

      const json = await fetchData(`/api/plans?${query.toString()}`);

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
        showError(json?.message || "Failed to load plans");
        setPlans([]);
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
      }
    } catch (e) {
      console.error("fetchPlans error", e);
      showError("Failed to load plans.");
      setPlans([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
    } finally {
      setLoading(false);
    }
  }, [
    pagination.currentPage,
    pagination.limit,
    statusFilter,
    fetchData,
    showError,
  ]);

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
  const openDetailsModal = useCallback((plan) => {
    setDetails(plan || null);
    setIsDetailsModalOpen(true);
  }, []);

  const closeDetailsModal = useCallback(() => {
    setDetails(null);
    setIsDetailsModalOpen(false);
  }, []);

  /* ---------------------------- CRUD handlers ---------------------------- */
  const handleDeleteClick = useCallback((plan) => {
    setPlanToDelete(plan);
    setIsConfirmModalOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!planToDelete?._id) return;
    setDeletingId(planToDelete._id);
    setIsConfirmModalOpen(false);
    try {
      const json = await fetchData(
        `/api/plans?_id=${planToDelete._id}`,
        "DELETE"
      );

      if (!json?.success) {
        throw new Error(json?.message || "Delete failed");
      }

      showSuccess("Plan deleted successfully");
      setPlans((prev) => prev.filter((p) => p._id !== planToDelete._id));
    } catch (e) {
      console.error(e);
      showError(e.message || "Failed to delete plan");
    } finally {
      setDeletingId(null);
      setPlanToDelete(null);
    }
  }, [planToDelete, showSuccess, showError, fetchData]);

  /* -------------------------- Single & bulk actions ---------------------- */
  const runBulk = useCallback(
    async (ids, worker, label) => {
      if (!Array.isArray(ids) || ids.length === 0) return;
      setIsBulkRunning(true);
      try {
        const results = await Promise.allSettled(ids.map(worker));
        const ok = results.filter((r) => r.status === "fulfilled").length;
        const fail = results.length - ok;
        showSuccess(
          `${label}: ${ok} succeeded${fail ? `, ${fail} failed` : ""}`
        );
      } finally {
        setIsBulkRunning(false);
      }
    },
    [showSuccess]
  );

  const bulkSetActive = useCallback(
    async (val) => {
      const ids = [...selected];
      if (!ids.length) return;

      await runBulk(
        ids,
        async (planId) => {
          const json = await fetchData("/api/plans", "PUT", {
            planId,
            isActive: !!val,
          });
          if (!json?.success) throw new Error(json?.message || "Failed");
        },
        val ? "Enable plans" : "Disable plans"
      );

      // Optimistic UI update
      setPlans((prev) =>
        prev.map((p) => (ids.includes(p._id) ? { ...p, isActive: !!val } : p))
      );
      setSelected([]);
    },
    [selected, runBulk, fetchData]
  );

  const singleSetActive = useCallback(
    async (planId, val) => {
      try {
        const json = await fetchData("/api/plans", "PUT", {
          planId,
          isActive: !!val,
        });

        if (!json?.success) throw new Error(json?.message || "Failed");

        setPlans((prev) =>
          prev.map((p) => (p._id === planId ? { ...p, isActive: !!val } : p))
        );
        showSuccess(`Plan ${val ? "enabled" : "disabled"}`);
      } catch (e) {
        showError(e.message || "Failed to update plan");
      }
    },
    [showSuccess, showError, fetchData]
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
      {/* Header */}
      <Header
        title="Plans"
        subtitle="Create and manage pricing plans & email quotas"
        buttonLabel="Add Plan"
        onButtonClick={() => router.push("/plans/edit")}
      />

      {/* Filters */}
      <div className="w-full border-b-2 border-zinc-100 p-2 mb-4 between-flex">
        <div className="w-full flex items-center gap-3">
          <ViewToggle
            viewMode={viewMode}
            setViewMode={setViewMode}
            viewToggleOptions={[
              { icon: <FiList size={16} />, value: "single" },
              { icon: <FiGrid size={16} />, value: "double" },
            ]}
          />
          <input
            type="text"
            placeholder="Search plans..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputStyles} max-w-xl flex-1`}
          />
          <Dropdown
            options={[
              { value: "all", label: "All Status" },
              { value: "active", label: "Active Only" },
              { value: "inactive", label: "Inactive Only" },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox selected={selectAll} onChange={handleSelectAll} />
          <span className="text-xs text-zinc-600 text-nowrap">
            {selected.length} selected
          </span>
        </div>
      </div>

      <div className="mt-6">
        <PlanTable
          plans={filtered}
          selected={selected}
          onSelect={handleSelect}
          onBulkToggle={handleSelectAll}
          openDetailsModal={openDetailsModal}
          onAction={(val, plan) => {
            if (val === "edit") router.push(`/plans/edit?planId=${plan._id}`);
            if (val === "delete") handleDeleteClick(plan);
            if (val === "disable") {
              selected.length
                ? bulkSetActive(false)
                : singleSetActive(plan._id, false);
            }
            if (val === "enable") {
              selected.length
                ? bulkSetActive(true)
                : singleSetActive(plan._id, true);
            }
          }}
          loading={loading}
        />
      </div>

      {/* Pagination */}
      {renderPagination()}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmModalOpen && planToDelete ? true : false}
        onCancel={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Plan"
        message={`Are you sure you want to delete "${
          planToDelete?.name || "this plan"
        }"? This action cannot be undone.`}
      />

      {/* Details Modal */}
      <AnimatePresence>
        {isDetailsModalOpen && details && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm center-flex p-4 z-50"
            onClick={closeDetailsModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
              className="bg-white rounded-lg w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col border border-zinc-200/50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative bg-zinc-50 border-b border-zinc-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-md bg-white border border-b-2 border-zinc-200">
                      <FiPackage className="h-8 w-8 text-primary" />
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
                    className="w-10 h-10 center-flex bg-white border border-zinc-200 rounded hover:bg-zinc-200 transition-all"
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
                  <div className="lg:col-span-7">
                    <div className="bg-white px-6">
                      <h3 className="text-lg font-medium text-zinc-800 mb-3 flex items-center gap-2">
                        <div className="w-1 h-6  bg-primary rounded-full"></div>
                        Features
                      </h3>
                      {Array.isArray(details.features) &&
                      details.features.length > 0 ? (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {details.features.map((f, idx) => (
                            <li
                              key={`${idx}-${String(f)}`}
                              className="text-xs bg-zinc-50 border border-b-2 px-3 py-1.5 rounded-sm"
                            >
                              <span>{idx + 1}.</span> {String(f)}
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
                        <h3 className="text-lg font-medium text-zinc-800 mb-3 flex items-center gap-2">
                          <div className="w-1 h-6  bg-primary rounded-full"></div>
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
                  className="btn btn-sm md:btn-md btn-second"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    closeDetailsModal();
                    router.push(`/plans/edit?planId=${details._id}`);
                  }}
                  className="btn btn-sm md:btn-md btn-primary-two"
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
