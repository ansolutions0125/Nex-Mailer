"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import SidebarWrapper from "@/components/SidebarWrapper";
import Header from "@/components/Header";
import { AnimatePresence, motion } from "framer-motion";
import { Dropdown } from "@/components/Dropdown";
import {
  FiPlus,
  FiX,
  FiCheck,
  FiTrash2,
  FiEdit2,
  FiGrid,
  FiList,
  FiSearch,
  FiUser,
  FiShield,
  FiEdit,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { fetchWithAuthAdmin } from "@/helpers/front-end/request";
import useAdminStore from "@/store/useAdminStore";
import { AVAILABLE_PERMISSIONS } from "@/presets/Permissions";
import { inputStyles, KeyValue, labelStyles, MiniCard } from "@/presets/styles";
import { useToastStore } from "@/store/useToastStore";

const RolesPage = () => {
  const { admin, token } = useAdminStore();
  const { showSuccess, showError, showInfo, showWarning } = useToastStore();
  const [roles, setRoles] = useState([]);

  const [viewMode, setViewMode] = useState("single");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const [toast, setToast] = useState({ show: false, message: "", type: "" });

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

  // NEW: confirm delete modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);

  // NEW: details modal state
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [details, setDetails] = useState(null);

  const showToast = useCallback((m, t = "success") => {
    setToast({ show: true, message: m, type: t });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 2200);
  }, []);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/admin/roles?includeSystem=true&page=1&limit=500";
      if (search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }

      const json = await fetchWithAuthAdmin({
        url,
        admin,
        token,
        method: "GET",
      });

      if (!json?.success) {
        showError(json.message);
        throw new Error(json?.message || "Failed to fetch roles");
      }
      setRoles(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error(e);
      showError(e.message);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [search, showToast]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const filtered = useMemo(() => roles, [roles]);

  useEffect(() => {
    if (filtered.length === 0) setSelectAll(false);
    else setSelectAll(filtered.every((x) => selected.includes(x._id)));
  }, [filtered, selected]);

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

  // NEW: open details
  const openDetails = (r) => {
    setDetails(r);
    setIsDetailsModalOpen(true);
  };
  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setDetails(null);
  };

  const togglePerm = (value) => {
    setForm((s) => {
      const has = s.permissions.includes(value);
      return {
        ...s,
        permissions: has
          ? s.permissions.filter((v) => v !== value)
          : [...s.permissions, value],
      };
    });
  };

  const saveRole = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      if (!form.name.trim()) throw new Error("Role name is required");

      let json;
      if (editingId) {
        let payload = {
          roleId: editingId,
          action: "update",
          updateData: {
            name: form.name.trim(),
            description: form.description.trim(),
            permissions: form.permissions,
          },
        };

        let url = "/api/admin/roles";

        json = await fetchWithAuthAdmin({
          url,
          admin,
          token,
          method: "PUT",
          payload,
        });

        if (!json?.success) {
          showError(json.message);
          throw new Error(json?.message || "Failed to fetch roles");
        }
      } else {
        let payload = {
          action: "create",
          name: form.name.trim(),
          key:
            form.key.trim() ||
            form.name.trim().toLowerCase().replace(/\s+/g, "-"),
          description: form.description.trim(),
          permissions: form.permissions,
        };

        let url = "/api/admin/roles";

        json = await fetchWithAuthAdmin({
          url,
          admin,
          token,
          method: "POST",
          payload,
        });

        if (!json?.success) {
          showError(json.message);
          throw new Error(json?.message || "Failed to fetch roles");
        }
      }

      if (!json?.success) {
        showError(json.message);
        throw new Error(json?.message || "Save failed");
      }
      showSuccess(editingId ? "Role updated" : "Role created");
      setIsModalOpen(false);
      fetchRoles();
    } catch (e) {
      console.error(e);
      showError(e.message || "Save Failed");
    } finally {
      setModalLoading(false);
    }
  };

  // UPDATED: open confirm delete instead of window.confirm
  const remove = (role) => {
    setRoleToDelete(role);
    setIsConfirmModalOpen(true);
  };

  // NEW: perform deletion from confirm modal
  const confirmDelete = async () => {
    if (!roleToDelete) return;
    setModalLoading(true);
    let json;
    try {
      let url = `/api/admin/roles?roleId=${roleToDelete._id}`;

      json = await fetchWithAuthAdmin({
        url,
        admin,
        token,
        method: "DELETE",
      });

      if (!json?.success) {
        setIsConfirmModalOpen(false);
        throw new Error(json?.message || "Failed to fetch roles");
      }

      showSuccess("Role deleted");
      setRoles((prev) => prev.filter((x) => x._id !== roleToDelete._id));
      setIsConfirmModalOpen(false);
      setRoleToDelete(null);
    } catch (e) {
      console.error(e);
      showError(e.message || "Delete failed");
    } finally {
      setModalLoading(false);
    }
  };

  const getPermLabel = (value) => {
    if (value === "*") return "Owner Access (Full System)";
    return (AVAILABLE_PERMISSIONS && AVAILABLE_PERMISSIONS[value]) || value;
  };

  const RoleCard = ({ item, isSelected, onSelect }) => (
    <div
      className={`bg-white rounded border transition-all duration-200 gap-6 p-6 relative ${
        isSelected ? "border-primary" : "border-zinc-200 hover:border-zinc-300"
      }`}
    >
      {/* Select checkbox */}
      <div className="absolute top-4 right-4 z-10">
        <div
          onClick={() => onSelect(item._id)}
          className={`w-6 h-6 rounded border cursor-pointer transition-all duration-200 flex items-center justify-center ${
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
          viewMode === "double"
            ? "flex flex-col items-start"
            : "flex items-start xl:items-center flex-col xl:flex-row xl:justify-between"
        } gap-6`}
      >
        <div className="flex flex-col xl:flex-row items-center gap-3 md:gap-5 xl:divide-x">
          <div className="center-flex flex-col gap-2">
            <div
              className={`w-fit text-xxs px-2 py-0.5 rounded border ${
                item.isSystem
                  ? "bg-zinc-200 border-zinc-400 text-zinc-700"
                  : "bg-green-200 border-green-500 text-zinc-800"
              }`}
            >
              {item.isSystem ? "System Role" : "Custom Role"}
            </div>
            <div className="bg-zinc-100 rounded-md w-full max-w-28 h-32 p-3 lg:p-9 text-4xl text-zinc-700 center-flex">
              <FiUser className="w-10 h-10 text-zinc-500" />
            </div>
          </div>
          <div className="flex flex-col xl:pl-4">
            <div
              onClick={() => openDetails(item)}
              className="mt-1 text-lg text-zinc-800 font-medium cursor-pointer hover:underline"
            >
              {item.name}
            </div>
            <p className="text-xs text-zinc-500 mb-2 line-clamp-2 max-w-80">
              {item.description || "—"}
            </p>
            <div className="flex items-center gap-3 mb-2">
              {item.key !== undefined && (
                <KeyValue label={"Key"} value={item.key} />
              )}
              {item.usageCount !== undefined && (
                <KeyValue
                  label={"Used by"}
                  value={`${item.usageCount} admins`}
                />
              )}
            </div>
            <Dropdown
              position="top"
              options={[
                { value: "details", label: "View Details" },
                { value: "edit", label: "Edit Role" },
                { value: "delete", label: "Delete Role" },
              ]}
              onChange={(val) => {
                if (val === "details") openDetails(item);
                if (val === "edit") openEdit(item);
                if (val === "delete") remove(item);
              }}
              placeholder="Actions"
              className="w-40"
            />
          </div>
        </div>

        <div
          className={`flex-1 grid gap-3 ${
            viewMode === "double" ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-4"
          }`}
        >
          <MiniCard
            title="# Permissions"
            subLine={item.permissions?.length || 0}
          />
          <MiniCard
            title="Created"
            subLine={new Date(item.createdAt).toLocaleDateString()}
          />
          <MiniCard title="Usage Count" subLine={item.usageCount || 0} />
        </div>
      </div>
    </div>
  );

  RoleCard.propTypes = {
    item: PropTypes.object.isRequired,
    isSelected: PropTypes.bool,
    onSelect: PropTypes.func.isRequired,
  };

  // Precompute permissions entries (fixes .length on object)
  const permEntries = Object.entries(AVAILABLE_PERMISSIONS || {});

  return (
    <SidebarWrapper>
      <Header
        title="Roles"
        subtitle="Compose roles from permission catalog and assign to admins"
        buttonLabel="Add Role"
        onButtonClick={openAdd}
      />

      {/* Filters */}
      <div className="w-full bg-zinc-50 border px-4 p-2 rounded mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* view mode */}
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
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <FiSearch size={16} />
              </div>
              <input
                type="text"
                placeholder="Search roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-9 ${inputStyles}`}
                onKeyDown={(e) => e.key === "Enter" && fetchRoles()}
              />
            </div>
            <button className="btn btn-sm btn-primary" onClick={fetchRoles}>
              Refresh
            </button>
          </div>

          {/* selection */}
          <div className="flex items-center gap-3">
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
              className="text-sm text-primary cursor-pointer"
            >
              Select All
            </div>
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
          </div>
        </div>
      </div>

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
          <p className="text-zinc-500">
            Create a role and pick permissions from the catalog.
          </p>
          <button onClick={openAdd} className="mt-6 btn btn-primary">
            <FiPlus className="mr-2" /> Add Role
          </button>
        </div>
      ) : (
        <div
          className={`grid gap-5 ${
            viewMode === "double" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {filtered.map((r) => (
            <RoleCard
              key={r._id}
              item={r}
              isSelected={selected.includes(r._id)}
              onSelect={(id) =>
                setSelected((prev) =>
                  prev.includes(id)
                    ? prev.filter((x) => x !== id)
                    : [...prev, id]
                )
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
              className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col border border-zinc-200/50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative bg-zinc-100 border-b border-zinc-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-md bg-white border border-zinc-200">
                      <FiEdit className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">
                        {editingId ? "Edit Role" : "Add Role"}
                      </h2>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-white rounded-lg transition-colors"
                    aria-label="Close"
                  >
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
                        onChange={(e) =>
                          setForm((s) => ({ ...s, name: e.target.value }))
                        }
                        className={inputStyles}
                        placeholder="Support"
                        required
                      />
                    </div>
                    <div>
                      <label className={labelStyles("base")}>Key (slug)</label>
                      <input
                        value={form.key}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, key: e.target.value }))
                        }
                        className="w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary px-3 py-2.5 text-sm font-mono"
                        placeholder="support"
                        disabled={editingId} // Don't allow editing key for existing roles
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelStyles("base")}>Description</label>
                      <textarea
                        value={form.description}
                        onChange={(e) =>
                          setForm((s) => ({
                            ...s,
                            description: e.target.value,
                          }))
                        }
                        className={inputStyles}
                        placeholder="Optional"
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* permissions grid */}
                  <div className="mt-4">
                    {/* Title */}
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                      Permissions ({form.permissions.length} selected)
                    </div>
                    {permEntries.length === 0 ? (
                      <div className="text-sm text-zinc-500">
                        No permissions found. Create some first.
                      </div>
                    ) : (
                      <>
                        {/* Owner Admin Permission */}
                        {Object.entries(AVAILABLE_PERMISSIONS).map(
                          ([value]) => {
                            if (value === "*") {
                              const checked = form.permissions.includes(value);
                              return (
                                <div
                                  key={value}
                                  className="mb-4 border-b pb-4 border-hunter-green/30"
                                >
                                  <div className="font-medium text-sm mb-2 text-hunter-green">
                                    Owner Access
                                  </div>

                                  <label className="flex items-start gap-2 rounded px-3 py-2 text-sm cursor-pointer transition-all bg-primary/10 border border-primary">
                                    <div className="flex items-center gap-4">
                                      {/* Toggle Switch */}
                                      <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => togglePerm(value)}
                                          className="sr-only peer"
                                        />
                                        <div className="w-12 h-6 bg-red-200 peer peer-checked:bg-primary transition-colors relative rounded-sm">
                                          <div
                                            className={`absolute top-0.5 left-0.5 bg-white h-5 w-5 rounded-sm transition-transform ${
                                              checked ? "translate-x-6" : ""
                                            }`}
                                          />
                                        </div>
                                      </label>

                                      {/* Content */}
                                      <div>
                                        <p className="text-sm font-medium text-hunter-green">
                                          Full System Access
                                        </p>
                                        <p className="text-xs text-hunter-green/80">
                                          Grants complete access to all system
                                          features and functions
                                        </p>
                                      </div>
                                    </div>
                                  </label>
                                </div>
                              );
                            }
                            return null;
                          }
                        )}

                        {/* Regular Permissions */}
                        <div className="grid grid-cols-1 sm:grid-cols-1 gap-2 max-h-80 overflow-auto border rounded p-3 bg-zinc-50">
                          {Object.entries(AVAILABLE_PERMISSIONS).map(
                            ([value, label]) => {
                              if (value === "*") return null; // skip owner
                              const checked = form.permissions.includes(value);
                              return (
                                <label
                                  key={value}
                                  className="flex items-start gap-2 rounded px-2 py-1 text-sm cursor-pointer transition-all"
                                >
                                  <div className="flex items-center gap-4">
                                    <label
                                      htmlFor={`perm-${value}`}
                                      className="relative inline-flex items-center cursor-pointer"
                                    >
                                      <input
                                        id={`perm-${value}`}
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => togglePerm(value)}
                                        className="sr-only peer"
                                      />
                                      <div className="w-12 h-6 bg-zinc-300 peer-focus:outline-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:h-5 after:w-5 after:transition-all rounded-sm peer-checked:bg-primary"></div>
                                    </label>
                                    <div>
                                      <p className="text-sm text-zinc-800">
                                        {label}
                                      </p>
                                      <p className="text-xs text-zinc-600">
                                        {value}
                                      </p>
                                    </div>
                                  </div>
                                </label>
                              );
                            }
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50"
                >
                  Close
                </button>
                <button
                  onClick={saveRole}
                  disabled={modalLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-lg hover:bg-primary/90"
                >
                  {modalLoading && <ImSpinner5 className="animate-spin mr-2" />}
                  {editingId ? "Update Role" : "Create Role"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Modal (ROLES) */}
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
              <h3 className="text-lg font-medium text-zinc-900 text-center mb-2">
                Delete Role
              </h3>
              <p className="text-sm text-zinc-600 text-center mb-6">
                Are you sure you want to delete{" "}
                <strong>{roleToDelete.name}</strong>? This action cannot be
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

      {/* Details Modal (ROLES) */}
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
                      <FiShield className="h-8 w-8 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">
                        {details.name}
                      </h2>
                      <p className="text-sm text-zinc-600 mt-1 font-mono">
                        {details.key || "—"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeDetailsModal}
                    className="p-2 hover:bg-white rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <FiX className="h-5 w-5 text-zinc-600" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="overflow-y-auto flex-1 bg-white">
                <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 divide-x divide-zinc-300">
                  {/* Left: summary */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Role Type
                      </p>
                      <p className="text-sm font-medium text-zinc-800">
                        {details.isSystem ? "System Role" : "Custom Role"}
                      </p>
                    </div>

                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Description
                      </p>
                      <p className="text-sm text-zinc-800 whitespace-pre-line">
                        {details.description || "—"}
                      </p>
                    </div>

                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Usage
                      </p>
                      <p className="text-sm font-medium text-zinc-800">
                        {(details.usageCount ?? 0).toLocaleString()} admin(s)
                      </p>
                    </div>

                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Created / Updated
                      </p>
                      <p className="text-sm font-medium text-zinc-800">
                        {details.createdAt
                          ? new Date(details.createdAt).toLocaleString()
                          : "—"}
                      </p>
                      <p className="text-xs text-zinc-600">
                        Updated:{" "}
                        {details.updatedAt
                          ? new Date(details.updatedAt).toLocaleString()
                          : "—"}
                      </p>
                    </div>

                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Role ID
                      </p>
                      <p className="text-xs font-mono text-zinc-600 break-all">
                        {details._id}
                      </p>
                    </div>
                  </div>

                  {/* Right: permissions */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white p-6">
                      <h3 className="text-lg font-bold text-zinc-800 mb-6 flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        Permissions ({details.permissions?.length || 0})
                      </h3>

                      {Array.isArray(details.permissions) &&
                      details.permissions.length > 0 ? (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {details.permissions.map((permVal) => (
                            <li
                              key={permVal}
                              className="text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded px-3 py-2"
                            >
                              <div className="font-medium">
                                {getPermLabel(permVal)}
                              </div>
                              <div className="text-xs text-zinc-600">
                                {permVal}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-zinc-500">
                          No permissions assigned.
                        </p>
                      )}
                    </div>
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
                      openEdit(base);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-lg hover:bg-primary/90"
                >
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
