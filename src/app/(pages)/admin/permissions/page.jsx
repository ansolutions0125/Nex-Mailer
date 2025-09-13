// app/(admin)/permissions/page.jsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import SidebarWrapper from "@/components/SidebarWrapper";
import Header from "@/components/Header";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiX,
  FiCheck,
  FiList,
  FiGrid,
  FiSearch,
  FiShield,
  FiUsers,
  FiBarChart,
  FiRefreshCcw,
  FiDownload,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { Dropdown } from "@/components/Dropdown";
import { fetchWithAuthAdmin } from "@/helpers/front-end/request";
import useAdminStore from "@/store/useAdminStore";
import { inputStyles, KeyValue, MiniCard, ViewToggle } from "@/presets/styles";
import { Table } from "lucide-react";
import { useToastStore } from "@/store/useToastStore";

/* ------------------------------ utils ------------------------------ */

const debounce = (fn, ms = 400) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

const findPermissionGroup = (permissionKey, groups) => {
  for (const [groupName, groupPerms] of Object.entries(groups || {})) {
    if (groupPerms.includes(permissionKey)) return groupName;
  }
  return "other";
};

const downloadText = (filename, text) => {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const toCSV = (rows) => {
  const headers = ["key", "description", "group", "usageCount"];
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    const cells = [
      r.key,
      r.description || "",
      r.group || "other",
      r.usage?.count ?? 0,
    ].map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`);
    lines.push(cells.join(","));
  });
  return lines.join("\n");
};

/* ------------------------------- page -------------------------------- */

const PermissionsPage = () => {
  const { admin, token } = useAdminStore();
  const { showSuccess, showError } = useToastStore();

  const [permissions, setPermissions] = useState([]); // [{key, description, group}]
  const [groups, setGroups] = useState({}); // groupName -> [keys]
  const [permissionUsage, setPermissionUsage] = useState({}); // key -> {roles:[], count}
  const [viewMode, setViewMode] = useState("compact"); // compact | double | single

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);

  const [selected, setSelected] = useState([]); // [keys]
  const [selectAll, setSelectAll] = useState(false);

  // Details modal
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [details, setDetails] = useState(null);

  // Usage modal
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [usageDetails, setUsageDetails] = useState(null);

  // fetch: list
  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/admin/permissions?action=list`;
      const json = await fetchWithAuthAdmin({
        url,
        admin,
        token,
        method: "GET",
      });
      if (!json?.success) throw new Error(json?.message || "Failed");
      const list = Object.entries(json.data.permissions || {}).map(
        ([key, description]) => ({
          key,
          description,
          group: findPermissionGroup(key, json.data.groups),
        })
      );
      setPermissions(list);
      setGroups(json.data.groups || {});
    } catch (e) {
      console.error(e);
      showError("Failed to load permissions", 7000, {
        description: "Please try again.",
        action: { label: "Retry", onClick: fetchPermissions },
      });
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [admin, token, showError]);

  // fetch: usage
  const fetchUsageData = useCallback(async () => {
    setUsageLoading(true);
    try {
      const url = `/api/admin/permissions?action=usage`;
      const json = await fetchWithAuthAdmin({
        url,
        admin,
        token,
        method: "GET",
      });
      if (!json?.success) throw new Error(json?.message || "Failed");
      setPermissionUsage(json.data.permissionUsage || {});
    } catch (e) {
      console.error(e);
      showError("Failed to load usage data", 7000, {
        description: "Check your network and try again.",
        action: { label: "Retry", onClick: fetchUsageData },
      });
    } finally {
      setUsageLoading(false);
    }
  }, [admin, token, showError]);

  useEffect(() => {
    fetchPermissions();
    fetchUsageData();
  }, [fetchPermissions, fetchUsageData]);

  // debounce search
  useEffect(() => {
    const run = debounce(setDebouncedSearch, 350);
    run(search.trim());
    return () => run.cancel?.();
  }, [search]);

  // filtered dataset
  const filtered = useMemo(() => {
    let result = permissions;

    // search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.key.toLowerCase().includes(q) ||
          String(p.description || "")
            .toLowerCase()
            .includes(q)
      );
    }

    // group
    if (groupFilter !== "all") {
      result = result.filter((p) => p.group === groupFilter);
    }

    // annotate usage for cards/export without mutating source
    return result.map((p) => ({
      ...p,
      usage: permissionUsage[p.key] || { roles: [], count: 0 },
    }));
  }, [permissions, debouncedSearch, groupFilter, permissionUsage]);

  // sync select-all with filtered
  useEffect(() => {
    if (filtered.length === 0) setSelectAll(false);
    else setSelectAll(filtered.every((x) => selected.includes(x.key)));
  }, [filtered, selected]);

  // KPIs (sessions-style)
  const kpis = useMemo(() => {
    const total = permissions.length;
    const uniqueGroups = new Set(permissions.map((p) => p.group || "other"))
      .size;
    const usedInRoles = permissions.filter(
      (p) => (permissionUsage[p.key]?.count || 0) > 0
    ).length;
    return { total, uniqueGroups, usedInRoles };
  }, [permissions, permissionUsage]);

  // group dropdown options
  const groupOptions = useMemo(() => {
    const uniqueGroups = [...new Set(permissions.map((p) => p.group))];
    return [
      { value: "all", label: "All Groups" },
      ...uniqueGroups.map((g) => ({
        value: g,
        label: g ? g.charAt(0).toUpperCase() + g.slice(1) : "Other",
      })),
    ];
  }, [permissions]);

  // actions
  const openDetails = (permission) => {
    const usage = permissionUsage[permission.key] || { roles: [], count: 0 };
    setDetails({ ...permission, usage });
    setIsDetailsModalOpen(true);
  };
  const closeDetails = () => {
    setIsDetailsModalOpen(false);
    setDetails(null);
  };
  const openUsage = (permission) => {
    const usage = permissionUsage[permission.key] || { roles: [], count: 0 };
    setUsageDetails({ ...permission, usage });
    setIsUsageModalOpen(true);
  };
  const closeUsage = () => {
    setIsUsageModalOpen(false);
    setUsageDetails(null);
  };

  const validatePermissions = async (permissionKeys) => {
    try {
      const url = `/api/admin/permissions?action=validate&permissions=${encodeURIComponent(
        JSON.stringify(permissionKeys)
      )}`;
      const json = await fetchWithAuthAdmin({
        url,
        admin,
        token,
        method: "GET",
      });
      if (json?.success) {
        showSuccess(
          `Validation: ${json.data.summary.valid}/${json.data.summary.total} valid`,
          5000
        );
        return json.data.validation;
      }
    } catch {
      showError("Validation failed", 7000);
    }
    return null;
  };

  const exportSelected = () => {
    if (!selected.length) return;
    const rows = filtered.filter((f) => selected.includes(f.key));
    const csv = toCSV(rows);
    downloadText(
      `permissions-${new Date().toISOString().slice(0, 19)}.csv`,
      csv
    );
  };

  /* ------------------------------ render ------------------------------ */

  const PermissionCard = ({ item, isSelected, onSelect }) => {
    const usage = permissionUsage[item.key] || { roles: [], count: 0 };

    return (
      <div
        className={`bg-white rounded border transition-all duration-200 gap-6 relative
          ${
            viewMode === "single"
              ? "p-4"
              : viewMode === "double"
              ? "p-3"
              : "p-3"
          }
          ${
            isSelected
              ? "border-primary"
              : "border-zinc-200 hover:border-zinc-300"
          }`}
      >
        {/* Select checkbox */}
        <div className="absolute top-4 right-4 z-10">
          <div
            onClick={() => onSelect(item.key)}
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

        <div
          className={`${
            viewMode === "single"
              ? "flex items-center"
              : viewMode === "double"
              ? "flex flex-col items-start"
              : ""
          } gap-6`}
        >
          {/* Left */}
          <div
            className={`flex flex-col xl:flex-row items-start md:items-center gap-3 md:gap-3 ${
              viewMode !== "compact" && "xl:divide-x"
            }`}
          >
            <div
              className={
                viewMode === "compact" ? "hidden" : "center-flex flex-col gap-2"
              }
            >
              <div
                className={`w-fit mb-1 text-xxs px-2 py-0.5 rounded border 
                  ${
                    usage.count > 0
                      ? "bg-green-200 border-green-500 text-zinc-800"
                      : "bg-zinc-200 border-zinc-400 text-zinc-700"
                  }`}
              >
                {usage.count > 0
                  ? `Used in ${usage.count} role${usage.count > 1 ? "s" : ""}`
                  : "Unused"}
              </div>
              <div
                className={`bg-zinc-100 rounded-md w-full text-4xl text-zinc-700 
                ${
                  viewMode === "single"
                    ? "max-w-28 h-32 p-3 lg:p-9 center-flex"
                    : viewMode === "double"
                    ? "max-w-20 h-24 p-3 center-flex"
                    : "hidden"
                }`}
              >
                <FiShield className="w-10 h-10 text-zinc-500" />
              </div>
            </div>

            <div
              className={`flex flex-col ${viewMode !== "compact" && "xl:pl-4"}`}
            >
              <div className="mt-1 text-lg text-zinc-800 font-medium">
                {item.key}
              </div>
              <p className="text-xs text-zinc-500 mb-2 line-clamp-2 max-w-80">
                {item.description || "—"}
              </p>

              <div className="flex items-center gap-3 mb-2">
                <KeyValue
                  label="Group"
                  value={
                    <span className="capitalize">{item.group || "other"}</span>
                  }
                />
                <KeyValue label="Usage" value={`${usage.count} roles`} />
              </div>

              <Dropdown
                position="top"
                options={[
                  { value: "details", label: "View Details" },
                  { value: "usage", label: "View Usage" },
                  { value: "validate", label: "Validate" },
                ]}
                onChange={(val) => {
                  if (val === "details") openDetails(item);
                  if (val === "usage") openUsage(item);
                  if (val === "validate") validatePermissions([item.key]);
                }}
                placeholder="Actions"
                className="w-40"
              />
            </div>
          </div>

          {/* Right mini cards */}
          <div
            className={`w-full flex-1 grid gap-3 ${
              viewMode === "double"
                ? "grid-cols-2"
                : viewMode === "compact"
                ? "grid-cols-2 mt-3"
                : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
            }`}
          >
            <MiniCard title="Group" subLine={item.group || "other"} />
            <MiniCard title="Type" subLine="System" />
          </div>
        </div>
      </div>
    );
  };
  PermissionCard.propTypes = {
    item: PropTypes.object.isRequired,
    isSelected: PropTypes.bool,
    onSelect: PropTypes.func.isRequired,
  };

  /* ------------------------------ UI ------------------------------ */

  return (
    <SidebarWrapper>
      <Header
        title="Permissions"
        subtitle="System permissions catalog used to build roles"
        hideButton
      />

      <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-6">
        <MiniCard
          title="Total permissions"
          subLine={kpis.total}
          size="lg"
          style="medium"
        />
        <MiniCard
          title="Permissions Groups"
          subLine={kpis.uniqueGroups}
          size="lg"
          style="medium"
        />
        <MiniCard
          title="Used in roles"
          subLine={kpis.usedInRoles}
          size="lg"
          style="medium"
        />
      </div>

      {/* Toolbar */}
      <div className="w-full bg-white border border-zinc-200 rounded p-3 mb-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <ViewToggle
              viewMode={viewMode}
              setViewMode={setViewMode}
              viewToggleOptions={[
                {
                  icon: <FiList size={16} />,
                  value: "single",
                },
                {
                  icon: <FiGrid size={16} />,
                  value: "double",
                },
                {
                  icon: <Table size={16} />,
                  value: "compact",
                },
              ]}
            />
            {/* Search */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <FiSearch size={16} />
              </div>
              <input
                type="text"
                placeholder="Search permissions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-9 ${inputStyles}`}
              />
            </div>

            {/* Group filter */}
            <Dropdown
              options={groupOptions}
              value={groupFilter}
              onChange={setGroupFilter}
              placeholder="Filter by group"
              className="min-w-64"
            />

            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                fetchPermissions();
                fetchUsageData();
              }}
              disabled={loading || usageLoading}
            >
              {(loading || usageLoading) && (
                <ImSpinner5 className="animate-spin mr-2" />
              )}
              Refresh
            </button>
          </div>

          {/* Selection & bulk actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectAll) {
                  setSelected([]);
                  setSelectAll(false);
                } else {
                  setSelected(filtered.map((x) => x.key));
                  setSelectAll(true);
                }
              }}
              className="text-sm text-primary"
            >
              {selectAll ? "Unselect All" : "Select All"}
            </button>
            <div
              onClick={() => {
                if (selectAll) {
                  setSelected([]);
                  setSelectAll(false);
                } else {
                  setSelected(filtered.map((x) => x.key));
                  setSelectAll(true);
                }
              }}
              className={`w-6 h-6 rounded border cursor-pointer transition-all duration-200 flex items-center justify-center ${
                selected.length > 0
                  ? "bg-primary border-primary"
                  : "border-zinc-300 hover:border-primary"
              }`}
              title={selected.length > 0 ? "Unselect all" : "Select all"}
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

            {selected.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-sm btn-second"
                  onClick={() => validatePermissions(selected)}
                >
                  <FiCheck className="mr-1" />
                  Validate Selected ({selected.length})
                </button>
                <button className="btn btn-sm" onClick={exportSelected}>
                  <FiDownload className="mr-1" />
                  Export CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky bulk bar (appears like on sessions page) */}
      {selected.length > 0 && (
        <div className="sticky top-2 z-10 bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 mb-3 flex items-center gap-2">
          <span className="px-2 py-1 rounded-sm text-primary text-xs">
            {selected.length} Selected
          </span>
          <button
            className="btn px-2 py-1 rounded-sm text-xs center-flex gap-2 border border-zinc-300 bg-white hover:bg-zinc-50"
            onClick={() => validatePermissions(selected)}
          >
            <FiCheck />
            Validate
          </button>
          <button
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-zinc-500 hover:bg-zinc-600"
            onClick={exportSelected}
          >
            <FiDownload />
            Export CSV
          </button>
          <button
            onClick={() => {
              setSelected([]);
              setSelectAll(false);
            }}
            className="btn btn-xs hover:bg-amber-200 ml-auto text-xs text-amber-900/70 hover:underline rounded-sm"
          >
            Clear
          </button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <ImSpinner5 className="animate-spin text-zinc-400 text-4xl" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 flex items-center justify-center rounded-full bg-zinc-100 mb-4">
            <FiShield className="h-10 w-10 text-zinc-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 mb-1">
            No permissions found
          </h3>
          <p className="text-zinc-500">
            {debouncedSearch || groupFilter !== "all"
              ? "Try adjusting your search or filter criteria."
              : "The permission system appears to be empty."}
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-3 ${
            viewMode === "double"
              ? "grid-cols-1 md:grid-cols-2"
              : viewMode === "compact"
              ? "grid-cols-1 md:grid-cols-3"
              : "grid-cols-1"
          }`}
        >
          {filtered.map((p) => (
            <PermissionCard
              key={p.key}
              item={p}
              isSelected={selected.includes(p.key)}
              onSelect={(key) =>
                setSelected((prev) =>
                  prev.includes(key)
                    ? prev.filter((x) => x !== key)
                    : [...prev, key]
                )
              }
            />
          ))}
        </div>
      )}

      {/* Details Modal */}
      <AnimatePresence>
        {isDetailsModalOpen && details && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={closeDetails}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
              className="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col border border-zinc-200/50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative bg-zinc-100 border-b border-zinc-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-md bg-white border border-zinc-200">
                      <FiShield className="h-8 w-8 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">
                        {details.key}
                      </h2>
                      <p className="text-sm text-zinc-600 mt-1">
                        System Permission
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeDetails}
                    className="p-2 hover:bg-white rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <FiX className="h-5 w-5 text-zinc-600" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="overflow-y-auto flex-1 bg-white">
                <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: summary */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Permission Key
                      </p>
                      <p className="text-sm text-zinc-800">{details.key}</p>
                    </div>
                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Group
                      </p>
                      <p className="text-sm font-medium text-zinc-800 capitalize">
                        {details.group || "other"}
                      </p>
                    </div>
                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Usage Count
                      </p>
                      <p className="text-sm font-medium text-zinc-800">
                        Used in {details.usage?.count || 0} role
                        {(details.usage?.count || 0) !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Type
                      </p>
                      <p className="text-sm font-medium text-zinc-800">
                        System Permission
                      </p>
                    </div>
                  </div>

                  {/* Right: description & usage */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white">
                      <h3 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full" />
                        Description
                      </h3>
                      <p className="text-sm text-zinc-700 mb-6">
                        {details.description || "No description available."}
                      </p>

                      <h3 className="text-lg font-bold text-zinc-800 mb-4 flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        Used In Roles
                      </h3>
                      {details.usage?.roles?.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {details.usage.roles.map((role) => (
                            <div
                              key={role.id}
                              className="bg-zinc-50 rounded-lg p-3 border border-zinc-200"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-zinc-800">
                                  {role.name}
                                </span>
                                {role.isSystem && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                    System
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-500 mt-1">
                                {role.key}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">
                          This permission is not used in any roles.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
                <button
                  onClick={closeDetails}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50"
                >
                  Close
                </button>
                <button
                  onClick={() => openUsage(details)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-lg hover:bg-primary/90"
                >
                  <FiBarChart className="h-4 w-4" />
                  View Usage Details
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Usage Modal */}
      <AnimatePresence>
        {isUsageModalOpen && usageDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={closeUsage}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-zinc-100 border-b border-zinc-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FiUsers className="h-6 w-6 text-blue-600" />
                    <div>
                      <h3 className="text-xl font-bold text-zinc-800">
                        Permission Usage
                      </h3>
                      <p className="text-sm text-zinc-600">
                        {usageDetails.key}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeUsage}
                    className="p-2 hover:bg-white rounded-lg transition-colors"
                  >
                    <FiX className="h-5 w-5 text-zinc-600" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {usageDetails.usage?.roles?.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-600 mb-4">
                      This permission is used in {usageDetails.usage.count} role
                      {usageDetails.usage.count !== 1 ? "s" : ""}:
                    </p>

                    <div className="grid gap-3">
                      {usageDetails.usage.roles.map((role) => (
                        <div
                          key={role.id}
                          className="bg-zinc-50 rounded-lg p-4 border border-zinc-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-zinc-800">
                              {role.name}
                            </h4>
                            <div className="flex gap-2">
                              {role.isSystem && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                  System
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <KeyValue
                              label="Key"
                              value={<span>{role.key}</span>}
                            />
                            <KeyValue
                              label="Type"
                              value={role.isSystem ? "System" : "Custom"}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FiUsers className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-zinc-800 mb-2">
                      No Usage Found
                    </h4>
                    <p className="text-zinc-600">
                      This permission is not currently used in any roles.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end">
                <button
                  onClick={closeUsage}
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

export default PermissionsPage;

/* ----------------------------- bits ----------------------------- */

function Kpi({ label, value }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3">
      <p className="text-xs uppercase text-zinc-500 font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
Kpi.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
