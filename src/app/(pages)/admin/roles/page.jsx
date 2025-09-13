// app/(admin)/roles/page.jsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import SidebarWrapper from "@/components/SidebarWrapper";
import Header from "@/components/Header";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiX,
  FiList,
  FiGrid,
  FiSearch,
  FiUser,
  FiShield,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiCopy,
  FiRefreshCcw,
  FiLayers,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { Dropdown } from "@/components/Dropdown";
import { fetchWithAuthAdmin } from "@/helpers/front-end/request";
import useAdminStore from "@/store/useAdminStore";
import { AVAILABLE_PERMISSIONS } from "@/presets/Permissions";
import { inputStyles, KeyValue, labelStyles, MiniCard, ViewToggle } from "@/presets/styles";
import { useToastStore } from "@/store/useToastStore";

/* ------------------------------ utils ------------------------------ */

const debounce = (fn, ms = 350) => {
  let t;
  const w = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  w.cancel = () => clearTimeout(t);
  return w;
};

const getPermLabel = (value) => (value === "*"
  ? "Owner Access (Full System)"
  : (AVAILABLE_PERMISSIONS && AVAILABLE_PERMISSIONS[value]) || value
);

/* ------------------------------- page -------------------------------- */

const RolesPage = () => {
  const { admin, token } = useAdminStore();
  const { showSuccess, showError } = useToastStore();

  const [roles, setRoles] = useState([]);
  const [viewMode, setViewMode] = useState("single"); // single | double
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState([]); // roleIds
  const [selectAll, setSelectAll] = useState(false);

  // create/edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    key: "",
    description: "",
    permissions: [],
    isSystem: false,
  });

  // confirm delete modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);

  // details modal
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [details, setDetails] = useState(null);

  /* --------------------------- data fetching --------------------------- */

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/admin/roles?includeSystem=true&page=1&limit=500";
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const json = await fetchWithAuthAdmin({ url, admin, token, method: "GET" });
      if (!json?.success) throw new Error(json?.message || "Failed to fetch roles");
      setRoles(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error(e);
      showError(e.message || "Failed to fetch roles");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [admin, token, search, showError]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // debounced enter-to-search
  useEffect(() => {
    const run = debounce(() => fetchRoles(), 350);
    return () => run.cancel?.();
  }, [fetchRoles]);

  const filtered = useMemo(() => roles, [roles]);

  useEffect(() => {
    if (filtered.length === 0) setSelectAll(false);
    else setSelectAll(filtered.every((x) => selected.includes(x._id)));
  }, [filtered, selected]);

  /* ------------------------------- kpis -------------------------------- */

  const kpis = useMemo(() => {
    const total = roles.length;
    const system = roles.filter((r) => r.isSystem).length;
    const custom = total - system;
    const assigned = roles.reduce((sum, r) => sum + (r.usageCount || 0), 0);
    return { total, system, custom, assigned };
  }, [roles]);

  /* ------------------------------ actions ------------------------------ */

  const resetForm = () =>
    setForm({
      name: "",
      key: "",
      description: "",
      permissions: [],
      isSystem: false,
    });

  const openAdd = () => {
    setEditingId(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (r) => {
    setEditingId(r._id);
    setForm({
      name: r.name || "",
      key: r.key || "",
      description: r.description || "",
      permissions: Array.isArray(r.permissions) ? r.permissions : [],
      isSystem: !!r.isSystem,
    });
    setIsModalOpen(true);
  };

  const openDetails = (r) => {
    setDetails(r);
    setIsDetailsModalOpen(true);
  };
  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setDetails(null);
  };

  const togglePerm = (value) =>
    setForm((s) => {
      const has = s.permissions.includes(value);
      return {
        ...s,
        permissions: has ? s.permissions.filter((v) => v !== value) : [...s.permissions, value],
      };
    });

  const saveRole = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      if (!form.name.trim()) throw new Error("Role name is required");

      if (editingId) {
        const payload = {
          roleId: editingId,
          action: "update",
          updateData: {
            name: form.name.trim(),
            description: form.description.trim(),
            permissions: form.permissions,
          },
        };
        const json = await fetchWithAuthAdmin({ url: "/api/admin/roles", admin, token, method: "PUT", payload });
        if (!json?.success) throw new Error(json?.message || "Update failed");
        showSuccess("Role updated");
      } else {
        const payload = {
          action: "create",
          name: form.name.trim(),
          key: (form.key.trim() || form.name.trim().toLowerCase().replace(/\s+/g, "-")),
          description: form.description.trim(),
          permissions: form.permissions,
        };
        const json = await fetchWithAuthAdmin({ url: "/api/admin/roles", admin, token, method: "POST", payload });
        if (!json?.success) throw new Error(json?.message || "Create failed");
        showSuccess("Role created");
      }

      setIsModalOpen(false);
      fetchRoles();
    } catch (e) {
      console.error(e);
      showError(e.message || "Save failed");
    } finally {
      setModalLoading(false);
    }
  };

  // open confirm delete
  const remove = (role) => {
    setRoleToDelete(role);
    setIsConfirmModalOpen(true);
  };
  const confirmDelete = async () => {
    if (!roleToDelete) return;
    setModalLoading(true);
    try {
      // hard guard: server forbids system roles & roles in use
      if (roleToDelete.isSystem) throw new Error("Cannot delete system roles");
      if ((roleToDelete.usageCount || 0) > 0) {
        throw new Error(`Cannot delete role in use by ${roleToDelete.usageCount} admin(s)`);
      }
      const url = `/api/admin/roles?roleId=${roleToDelete._id}`;
      const json = await fetchWithAuthAdmin({ url, admin, token, method: "DELETE" });
      if (!json?.success) throw new Error(json?.message || "Delete failed");
      showSuccess("Role deleted");
      setRoles((prev) => prev.filter((x) => x._id !== roleToDelete._id));
      setSelected((prev) => prev.filter((x) => x !== roleToDelete._id));
      setIsConfirmModalOpen(false);
      setRoleToDelete(null);
    } catch (e) {
      showError(e.message || "Delete failed");
    } finally {
      setModalLoading(false);
    }
  };

  const duplicateRole = async (role) => {
    try {
      const base = role || details;
      if (!base?._id) return;
      const newName = `${base.name} Copy`;
      const newKey = `${base.key}-copy`;
      const json = await fetchWithAuthAdmin({
        url: "/api/admin/roles",
        admin,
        token,
        method: "POST",
        payload: { action: "duplicate", roleId: base._id, newName, newKey },
      });
      if (!json?.success) throw new Error(json?.message || "Duplicate failed");
      showSuccess("Role duplicated");
      fetchRoles();
    } catch (e) {
      showError(e.message || "Duplicate failed");
    }
  };

  /* ------------------------------ bulk ops ------------------------------ */

  const eligibleForDeletion = (r) => !r.isSystem && (r.usageCount || 0) === 0;

  const bulkDelete = async () => {
    if (!selected.length) return;
    const toDelete = roles.filter((r) => selected.includes(r._id) && eligibleForDeletion(r));
    const blocked = roles.filter((r) => selected.includes(r._id) && !eligibleForDeletion(r));

    if (toDelete.length === 0) {
      showError(
        blocked.length
          ? "No selected roles are eligible (system or in use)."
          : "Select at least one role to delete."
      );
      return;
    }

    const ok = confirm(
      `Delete ${toDelete.length} role(s)? System roles or roles in use are skipped automatically.`
    );
    if (!ok) return;

    const promises = toDelete.map((r) =>
      fetchWithAuthAdmin({ url: `/api/admin/roles?roleId=${r._id}`, admin, token, method: "DELETE" })
    );
    const results = await Promise.allSettled(promises);

    const failures = results.filter((res) => res.status === "rejected" || !res.value?.success);
    const successes = results.length - failures.length;

    if (successes > 0) {
      showSuccess(`Deleted ${successes} role(s)`);
      setRoles((prev) => prev.filter((r) => !toDelete.some((x) => x._id === r._id)));
    }
    if (failures.length > 0) {
      showError(`Some deletions failed (${failures.length}).`);
    }
    setSelected([]);
  };

  /* ------------------------------ render ------------------------------ */

  const RoleCard = ({ item, isSelected, onSelect }) => (
    <div
      className={`bg-white rounded border transition-all duration-200 gap-6 p-6 relative ${
        isSelected ? "border-primary" : "border-zinc-200 hover:border-zinc-300"
      }`}
    >
      {/* Select */}
      <div className="absolute top-4 right-4 z-10">
        <div
          onClick={() => onSelect(item._id)}
          className={`w-6 h-6 rounded border cursor-pointer transition-all duration-200 flex items-center justify-center ${
            isSelected ? "bg-primary border-primary" : "border-zinc-300 hover:border-primary"
          }`}
        >
          {isSelected && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
        <div className="flex flex-col xl:flex-row items-center gap-3 md:gap-5 xl:divide-x">
          <div className="center-flex flex-col gap-2">
            <div
              className={`w-fit text-xxs px-2 py-0.5 rounded border ${
                item.isSystem ? "bg-zinc-200 border-zinc-400 text-zinc-700" : "bg-green-200 border-green-500 text-zinc-800"
              }`}
            >
              {item.isSystem ? "System Role" : "Custom Role"}
            </div>
            <div className="bg-zinc-100 rounded-md w-full max-w-28 h-32 p-3 lg:p-9 text-4xl text-zinc-700 center-flex">
              <FiUser className="w-10 h-10 text-zinc-500" />
            </div>
          </div>

          <div className="flex flex-col xl:pl-4">
            <div onClick={() => openDetails(item)} className="mt-1 text-lg text-zinc-800 font-medium cursor-pointer hover:underline">
              {item.name}
            </div>
            <p className="text-xs text-zinc-500 mb-2 line-clamp-2 max-w-80">{item.description || "—"}</p>
            <div className="flex items-center gap-3 mb-2">
              <KeyValue label="Key" value={item.key} />
              <KeyValue label="Used by" value={`${item.usageCount || 0} admin${(item.usageCount || 0) === 1 ? "" : "s"}`} />
            </div>

            <Dropdown
              position="top"
              options={[
                { value: "details", label: "View Details" },
                { value: "edit", label: "Edit Role" },
                { value: "duplicate", label: "Duplicate" },
                {
                  value: "delete",
                  label: (
                    <span className={`${item.isSystem || (item.usageCount || 0) > 0 ? "text-zinc-400" : "text-rose-600"}`}>
                      Delete
                    </span>
                  ),
                },
              ]}
              onChange={(val) => {
                if (val === "details") openDetails(item);
                if (val === "edit") openEdit(item);
                if (val === "duplicate") duplicateRole(item);
                if (val === "delete") {
                  if (eligibleForDeletion(item)) remove(item);
                }
              }}
              placeholder="Actions"
              className="w-40"
            />
          </div>
        </div>

        <div className={`flex-1 grid gap-3 ${viewMode === "double" ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-4"}`}>
          <MiniCard title="# Permissions" subLine={item.permissions?.length || 0} />
          <MiniCard title="Created" subLine={new Date(item.createdAt).toLocaleDateString()} />
          <MiniCard title="Usage Count" subLine={item.usageCount || 0} />
          {/* add any other quick facts if you have them */}
        </div>
      </div>
    </div>
  );

  RoleCard.propTypes = { item: PropTypes.object.isRequired, isSelected: PropTypes.bool, onSelect: PropTypes.func.isRequired };

  /* ------------------------------ UI ------------------------------ */

  return (
    <SidebarWrapper>
      <Header
        title="Roles"
        subtitle="Compose roles from permission catalog and assign to admins"
        buttonLabel="Add Role"
        onButtonClick={openAdd}
      />

      {/* KPI tiles — same vibe as sessions/admins */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Total roles" value={kpis.total} />
        <Kpi label="System roles" value={kpis.system} />
        <Kpi label="Custom roles" value={kpis.custom} />
        <Kpi label="Assigned to admins" value={kpis.assigned} />
      </div>

      {/* Toolbar */}
      <div className="w-full bg-white border border-zinc-200 rounded p-3 mb-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <ViewToggle
              viewMode={viewMode}
              setViewMode={setViewMode}
              viewToggleOptions={[
                { icon: <FiList size={16} />, value: "single" },
                { icon: <FiGrid size={16} />, value: "double" },
              ]}
            />
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <FiSearch size={16} />
              </div>
              <input
                type="text"
                placeholder="Search roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchRoles()}
                className={`pl-9 ${inputStyles}`}
              />
            </div>
            <button className="btn btn-sm btn-primary" onClick={fetchRoles} disabled={loading}>
              {loading && <ImSpinner5 className="animate-spin mr-2" />}
              Refresh
            </button>
          </div>

          {/* Selection controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectAll) {
                  setSelected([]);
                  setSelectAll(false);
                } else {
                  setSelected(filtered.map((x) => x._id));
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
                  setSelected(filtered.map((x) => x._id));
                  setSelectAll(true);
                }
              }}
              className={`w-6 h-6 rounded border cursor-pointer transition-all duration-200 flex items-center justify-center ${
                selected.length > 0 ? "bg-primary border-primary" : "border-zinc-300 hover:border-primary"
              }`}
              title={selected.length > 0 ? "Unselect all" : "Select all"}
            >
              {selected.length > 0 && (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bulk bar */}
      {selected.length > 0 && (
        <div className="sticky top-2 z-10 bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 mb-3 flex items-center gap-2">
          <span className="px-2 py-1 rounded-sm text-primary text-xs">{selected.length} Selected</span>
          <button
            onClick={bulkDelete}
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-rose-500 hover:bg-rose-600"
            title="Delete selected roles (system roles and roles in use are skipped)"
          >
            <FiTrash2 />
            Delete Selected
          </button>
          <button
            onClick={() => {
              const first = roles.find((r) => selected.includes(r._id));
              if (first) duplicateRole(first);
            }}
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-zinc-600 hover:bg-zinc-700"
            title="Duplicate the first selected role"
          >
            <FiLayers />
            Duplicate One
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
          <div className="mx-auto w-24 h-24 flex items-center justify-center rounded-md bg-zinc-100 mb-4">
            <FiUser className="h-10 w-10 text-zinc-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 mb-1">No roles</h3>
          <p className="text-zinc-500">Create a role and pick permissions from the catalog.</p>
          <button onClick={openAdd} className="mt-6 btn btn-primary">
            <FiPlus className="mr-2" /> Add Role
          </button>
        </div>
      ) : (
        <div className={`grid gap-5 ${viewMode === "double" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
          {filtered.map((r) => (
            <RoleCard
              key={r._id}
              item={r}
              isSelected={selected.includes(r._id)}
              onSelect={(id) =>
                setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
              }
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-5xl max-height-[95vh] overflow-hidden flex flex-col border border-zinc-200/50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative bg-zinc-100 border-b border-zinc-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-md bg-white border border-zinc-200">
                      <FiEdit2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">
                        {editingId ? "Edit Role" : "Add Role"}
                      </h2>
                    </div>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-lg transition-colors" aria-label="Close">
                    <FiX className="h-5 w-5 text-zinc-600" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 bg-white p-6">
                <form onSubmit={saveRole}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelStyles("base")}>Name</label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                        className={inputStyles}
                        placeholder="Support"
                        required
                      />
                    </div>
                    <div>
                      <label className={labelStyles("base")}>Key (slug)</label>
                      <input
                        value={form.key}
                        onChange={(e) => setForm((s) => ({ ...s, key: e.target.value }))}
                        className="w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary px-3 py-2.5 text-sm font-mono"
                        placeholder="support"
                        disabled={!!editingId} // cannot edit key of existing role
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelStyles("base")}>Description</label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                        className={inputStyles}
                        placeholder="Optional"
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* permission chooser */}
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                      Permissions ({form.permissions.length} selected)
                    </div>

                    {/* Owner permission (wildcard) */}
                    {Object.entries(AVAILABLE_PERMISSIONS).map(([value]) => {
                      if (value !== "*") return null;
                      const checked = form.permissions.includes(value);
                      return (
                        <div key={value} className="mb-4 border-b pb-4 border-hunter-green/30">
                          <div className="font-medium text-sm mb-2 text-hunter-green">Owner Access</div>
                          <label className="flex items-start gap-2 rounded px-3 py-2 text-sm cursor-pointer transition-all bg-primary/10 border border-primary">
                            <div className="flex items-center gap-4">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={checked} onChange={() => togglePerm(value)} className="sr-only peer" />
                                <div className="w-12 h-6 bg-red-200 peer peer-checked:bg-primary transition-colors relative rounded-sm">
                                  <div className={`absolute top-0.5 left-0.5 bg-white h-5 w-5 rounded-sm transition-transform ${
                                    checked ? "translate-x-6" : ""
                                  }`} />
                                </div>
                              </label>
                              <div>
                                <p className="text-sm font-medium text-hunter-green">Full System Access</p>
                                <p className="text-xs text-hunter-green/80">Grants complete access to all system features and functions</p>
                              </div>
                            </div>
                          </label>
                        </div>
                      );
                    })}

                    {/* Regular permissions */}
                    <div className="grid grid-cols-1 gap-2 max-h-80 overflow-auto border rounded p-3 bg-zinc-50">
                      {Object.entries(AVAILABLE_PERMISSIONS).map(([value, label]) => {
                        if (value === "*") return null;
                        const checked = form.permissions.includes(value);
                        return (
                          <label key={value} className="flex items-start gap-2 rounded px-2 py-1 text-sm cursor-pointer transition-all">
                            <div className="flex items-center gap-4">
                              <label htmlFor={`perm-${value}`} className="relative inline-flex items-center cursor-pointer">
                                <input id={`perm-${value}`} type="checkbox" checked={checked} onChange={() => togglePerm(value)} className="sr-only peer" />
                                <div className="w-12 h-6 bg-zinc-300 peer-focus:outline-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:h-5 after:w-5 after:transition-all rounded-sm peer-checked:bg-primary"></div>
                              </label>
                              <div>
                                <p className="text-sm text-zinc-800">{label}</p>
                                <p className="text-xs text-zinc-600">{value}</p>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </form>
              </div>

              <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50">
                  Close
                </button>
                <button onClick={saveRole} disabled={modalLoading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-lg hover:bg-primary/90">
                  {modalLoading && <ImSpinner5 className="animate-spin mr-2" />}
                  {editingId ? "Update Role" : "Create Role"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {isConfirmModalOpen && roleToDelete && (
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
              <h3 className="text-lg font-medium text-zinc-900 text-center mb-2">Delete Role</h3>
              <p className="text-sm text-zinc-600 text-center mb-6">
                Are you sure you want to delete <strong>{roleToDelete.name}</strong>? This action cannot be undone.
              </p>
              <div className="space-y-3">
                <button onClick={confirmDelete} disabled={modalLoading} className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                  {modalLoading ? <ImSpinner5 className="animate-spin h-4 w-4 mr-2" /> : null}
                  Delete
                </button>
                <button onClick={() => setIsConfirmModalOpen(false)} disabled={modalLoading} className="w-full flex justify-center items-center px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md text-zinc-700 bg-white hover:bg-zinc-50 disabled:opacity-50">
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
              <div className="relative bg-zinc-100 border-b border-zinc-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-md bg-white border border-zinc-200">
                      <FiShield className="h-8 w-8 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">{details.name}</h2>
                      <p className="text-sm text-zinc-600 mt-1 font-mono">{details.key || "—"}</p>
                    </div>
                  </div>
                  <button onClick={closeDetailsModal} className="p-2 hover:bg-white rounded-lg transition-colors" aria-label="Close">
                    <FiX className="h-5 w-5 text-zinc-600" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 bg-white">
                <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 divide-x divide-zinc-300">
                  {/* Left summary */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Role Type</p>
                      <p className="text-sm font-medium text-zinc-800">{details.isSystem ? "System Role" : "Custom Role"}</p>
                    </div>
                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Description</p>
                      <p className="text-sm text-zinc-800 whitespace-pre-line">{details.description || "—"}</p>
                    </div>
                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Usage</p>
                      <p className="text-sm font-medium text-zinc-800">{(details.usageCount ?? 0).toLocaleString()} admin(s)</p>
                    </div>
                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Created / Updated</p>
                      <p className="text-sm font-medium text-zinc-800">{details.createdAt ? new Date(details.createdAt).toLocaleString() : "—"}</p>
                      <p className="text-xs text-zinc-600">Updated: {details.updatedAt ? new Date(details.updatedAt).toLocaleString() : "—"}</p>
                    </div>
                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Role ID</p>
                      <p className="text-xs font-mono text-zinc-600 break-all">{details._id}</p>
                    </div>
                  </div>

                  {/* Right permissions */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white p-6">
                      <h3 className="text-lg font-bold text-zinc-800 mb-6 flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        Permissions ({details.permissions?.length || 0})
                      </h3>

                      {Array.isArray(details.permissions) && details.permissions.length > 0 ? (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {details.permissions.map((permVal) => (
                            <li key={permVal} className="text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded px-3 py-2">
                              <div className="font-medium">{getPermLabel(permVal)}</div>
                              <div className="text-xs text-zinc-600">{permVal}</div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-zinc-500">No permissions assigned.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
                <button onClick={closeDetailsModal} className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50">
                  Close
                </button>
                <button onClick={() => duplicateRole(details)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50">
                  <FiLayers className="h-4 w-4" />
                  Duplicate
                </button>
                <button onClick={() => { closeDetailsModal(); openEdit(details); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-lg hover:bg-primary/90">
                  <FiEdit2 className="h-4 w-4" />
                  Edit Role
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SidebarWrapper>
  );
};

export default RolesPage;

/* ----------------------------- bits ----------------------------- */

function Kpi({ label, value }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3">
      <p className="text-xs uppercase text-zinc-500 font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
Kpi.propTypes = { label: PropTypes.string, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) };
