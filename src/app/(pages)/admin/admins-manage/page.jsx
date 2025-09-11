// app/admins/page.jsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import SidebarWrapper from "@/components/SidebarWrapper";
import Header from "@/components/Header";
import { Dropdown } from "@/components/Dropdown";
import {
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiGrid,
  FiList,
  FiPlus,
  FiTrash2,
  FiUser,
  FiX,
  FiToggleLeft,
  FiToggleRight,
  FiEdit,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { AnimatePresence, motion } from "framer-motion";
import useAdminStore from "@/store/useAdminStore";
import { inputStyles, labelStyles, MiniCard } from "@/presets/styles";
import { fetchWithAuthAdmin } from "@/helpers/front-end/request";
import { DropdownSearch } from "@/components/DropdownSearch";
import { useToastStore } from "@/store/useToastStore";

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

// Enhanced error handling utility
const handleApiError = (error, defaultMessage = "An error occurred") => {
  console.error("API Error:", error);

  // If it's a fetch response error with parsed data
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

  // If it's a structured error object with message
  if (error.message) {
    return error.message;
  }

  // Network or other errors
  if (error.name === "NetworkError" || error.code === "NETWORK_ERROR") {
    return "Network error. Please check your connection.";
  }

  return defaultMessage;
};

// Enhanced success message handler
const getSuccessMessage = (response, defaultMessage) => {
  // Check for API message in response
  if (response?.message) {
    return response.message;
  }

  // Check for nested data message
  if (response?.data?.message) {
    return response.data.message;
  }

  return defaultMessage;
};

// ---------- page ----------
const AdminsPage = () => {
  const { admin, setAdmin, token } = useAdminStore();
  const { showSuccess, showError, showInfo, showWarning } = useToastStore();

  // list state
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters / layout
  const [viewMode, setViewMode] = useState("single");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // pagination (local state naming)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0, // maps from server totalItems
    limit: 10, // maps from server itemsPerPage
  });

  // selection
  const [selected, setSelected] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingOriginal, setEditingOriginal] = useState(null); // keep original admin snapshot for diffs
  const [editingRoleKeyInitial, setEditingRoleKeyInitial] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const [roles, setRoles] = useState([]);

  // form
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
    roleKey: "admin", // single role key (matches API)
  });

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const roleLabel = (a) => {
    const key = a?.roleKey || a?.roleId?.key;
    const name = a?.roleId?.name;
    if (name && key) return `${name} (${key})`;
    return key || name || "—";
  };

  // Updated fetchAdmins with better error handling
  const fetchAdmins = useCallback(async () => {
    setLoading(true);
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

      if (!json?.success) {
        console.error(json?.message || "Failed to fetch admins");
      }

      const data = Array.isArray(json.data) ? json.data : [];

      // Map server pagination -> client
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

      // Show API message if it exists (for important messages)
      if (json.message && json.message !== "Admins fetched successfully") {
        showInfo(json.message);
      }
    } catch (error) {
      const errorMessage = handleApiError(error, "Failed to load admins");
      showError(errorMessage);
      setAdmins([]);
      setPagination((p) => ({ ...p, total: 0, totalPages: 1 }));
    } finally {
      setLoading(false);
    }
  }, [
    pagination.currentPage,
    pagination.limit,
    debouncedSearch,
    showInfo,
    showError,
    admin,
    token,
  ]);

  const fetchRoles = useCallback(async () => {
    try {
      const json = await fetchWithAuthAdmin({
        url: `/api/admin/roles?includeSystem=true`,
        admin,
        token,
        method: "GET",
      });

      if (!json?.success) {
        console.error(json?.message || "Failed to fetch roles");
      }

      const data = Array.isArray(json.data) ? json.data : [];
      setRoles(data);

      // Show API message if it exists
      if (json.message && json.message !== "Roles fetched successfully") {
        showInfo(json.message);
      }
    } catch (error) {
      const errorMessage = handleApiError(error, "Failed to load roles");
      showError(errorMessage);
      setRoles([]);
    }
  }, [showInfo, showError, admin, token]);

  useEffect(() => {
    fetchAdmins();
    fetchRoles();
  }, [fetchAdmins, fetchRoles]);

  // filter client-side for extras (also works if server search omitted)
  const filtered = useMemo(() => {
    const s = (debouncedSearch || "").toLowerCase();
    if (!s) return admins;
    return admins.filter((a) => {
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
  }, [admins, debouncedSearch]);

  useEffect(() => {
    if (filtered.length === 0) return setSelectAll(false);
    setSelectAll(filtered.every((a) => selected.includes(a._id)));
  }, [filtered, selected]);

  // selection
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
      setSelected(filtered.map((a) => a._id));
      setSelectAll(true);
    }
  };

  // open/close modals
  const resetForm = useCallback(() => {
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
  }, []);

  const openAddEditModal = useCallback(
    (adminRow = null) => {
      if (adminRow) {
        setFormData({
          email: adminRow.email || "",
          password: "",
          firstName: adminRow.firstName || "",
          lastName: adminRow.lastName || "",
          phoneNo: adminRow.phoneNo || "",
          address: adminRow.address || "",
          country: adminRow.country || "",
          isActive: !!adminRow.isActive,
          sessionType: adminRow.sessionType || "password",
          roleKey: adminRow.roleKey || adminRow.roleId?.key || "admin",
        });
        setEditingId(adminRow._id);
        setEditingOriginal(adminRow);
        setEditingRoleKeyInitial(
          adminRow.roleKey || adminRow.roleId?.key || "admin"
        );
      } else {
        resetForm();
      }
      setIsModalOpen(true);
    },
    [resetForm]
  );

  const handleDeleteClick = (adminRow) => {
    setToDelete(adminRow);
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
        // 1) Update basic fields
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

        if (!updateResponse?.success) {
          throw new Error(updateResponse?.message || "Update failed");
        }

        // 2) Assign role if changed
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
          if (!roleResponse?.success) {
            throw new Error(roleResponse?.message || "Role assignment failed");
          }
        }

        // 3) Toggle active if changed
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
          if (!statusResponse?.success) {
            throw new Error(statusResponse?.message || "Status update failed");
          }
        }

        // Show success message - prioritize API message
        const successMessage = getSuccessMessage(
          updateResponse,
          "Admin updated successfully"
        );
        showSuccess(successMessage);
      } else {
        // Create new admin
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

        if (!createResponse?.success) {
          throw new Error(createResponse?.message || "Admin creation failed");
        }

        // If created as inactive in UI, reflect that with toggle call
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
          } catch (statusError) {
            console.warn("Failed to set initial status:", statusError);
          }
        }

        // Show success message - prioritize API message
        const successMessage = getSuccessMessage(
          createResponse,
          "Admin created successfully"
        );
        showSuccess(successMessage);
      }

      setIsModalOpen(false);
      resetForm();
      await fetchAdmins();
    } catch (error) {
      const errorMessage = handleApiError(error, "Failed to save admin");
      showError(errorMessage);
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

      if (!response?.success) {
        throw new Error(response?.message || "Failed to update status");
      }

      console.log(response);

      // Show API message if available, otherwise default
      const successMessage = getSuccessMessage(
        response,
        isActive ? "Admin enabled successfully" : "Admin disabled successfully"
      );
      showSuccess(successMessage);

      await fetchAdmins();
    } catch (error) {
      const errorMessage = handleApiError(
        error,
        "Failed to update admin status"
      );
      showError(errorMessage);
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

      if (!response?.success) {
        throw new Error(response?.message || "Delete failed");
      }

      // Show API message if available
      const successMessage = getSuccessMessage(
        response,
        "Admin deleted successfully"
      );
      showSuccess(successMessage);

      setAdmins((prev) => prev.filter((x) => x._id !== toDelete._id));
      setSelected((prev) => prev.filter((x) => x !== toDelete._id));
    } catch (error) {
      const errorMessage = handleApiError(error, "Failed to delete admin");
      showError(errorMessage);
    } finally {
      setToDelete(null);
    }
  };

  // Fixed bulk operations with proper message handling
  const bulkToggle = async (flag) => {
    if (!selected.length) return;

    try {
      const promises = selected.map((id) =>
        fetchWithAuthAdmin({
          url: `/api/admin`,
          admin,
          token,
          method: "PUT",
          payload: {
            action: "toggleActive",
            adminId: id,
            isActive: flag,
          },
        })
      );

      const results = await Promise.allSettled(promises);

      // Check for failures
      const failures = results.filter(
        (result) => result.status === "rejected" || !result.value?.success
      );

      if (failures.length > 0) {
        // Collect error messages
        const errorMessages = failures.map((failure) => {
          if (failure.status === "rejected") {
            return failure.reason?.message || "Request failed";
          }
          return failure.value?.message || "Unknown error";
        });
        throw new Error(`Some operations failed: ${errorMessages.join(", ")}`);
      }

      // Get success message from first successful response or use default
      const firstSuccess = results.find(
        (result) => result.status === "fulfilled" && result.value?.success
      );

      const successMessage = getSuccessMessage(
        firstSuccess?.value,
        flag
          ? "Selected admins enabled successfully"
          : "Selected admins disabled successfully"
      );

      showSuccess(successMessage);
      setSelected([]);
      await fetchAdmins();
    } catch (error) {
      const errorMessage = handleApiError(error, "Failed bulk operation");
      showError(errorMessage);
    }
  };

  const bulkDelete = async () => {
    if (!selected.length) return;
    if (!confirm(`Delete ${selected.length} admins? This cannot be undone.`))
      return;

    try {
      const promises = selected.map((id) =>
        fetchWithAuthAdmin({
          url: `/api/admin?_id=${id}`,
          admin,
          token,
          method: "DELETE",
        })
      );

      const results = await Promise.allSettled(promises);

      // Check for failures
      const failures = results.filter(
        (result) => result.status === "rejected" || !result.value?.success
      );

      if (failures.length > 0) {
        const errorMessages = failures.map((failure) => {
          if (failure.status === "rejected") {
            return failure.reason?.message || "Request failed";
          }
          return failure.value?.message || "Unknown error";
        });
        throw new Error(`Some deletions failed: ${errorMessages.join(", ")}`);
      }

      // Get success message from first successful response
      const firstSuccess = results.find(
        (result) => result.status === "fulfilled" && result.value?.success
      );

      const successMessage = getSuccessMessage(
        firstSuccess?.value,
        "Selected admins deleted successfully"
      );

      showSuccess(successMessage);
      setSelected([]);
      await fetchAdmins();
    } catch (error) {
      const errorMessage = handleApiError(error, "Failed bulk delete");
      showError(errorMessage);
    }
  };

  // pagination
  const handlePageChange = useCallback(
    (page) => {
      if (page >= 1 && page <= pagination.totalPages) {
        setPagination((prev) => ({ ...prev, currentPage: page }));
      }
    },
    [pagination.totalPages]
  );

  // card
  const AdminCard = ({ a, isSelected }) => {
    const id = a._id;
    return (
      <div
        className={`bg-white rounded border transition-all duration-200 gap-6 p-6 relative ${
          isSelected
            ? "border-primary"
            : "border-zinc-200 hover:border-zinc-300"
        }`}
      >
        {/* select */}
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
          {/* left */}
          <div className="flex flex-col xl:flex-row items-center gap-3 md:gap-5 xl:divide-x">
            <div className="bg-zinc-100 rounded-md w-full max-w-28 h-32 p-3 lg:p-9 text-4xl text-zinc-700">
              <FiUser className="w-full h-full" />
            </div>
            <div className="flex flex-col xl:pl-4">
              <div
                className={`w-fit text-xxs px-2 py-0.5 rounded border ${
                  a.isActive
                    ? "bg-green-200 border-green-500 text-zinc-800"
                    : "bg-red-200 border-red-500 text-red-900"
                }`}
              >
                {a.isActive ? "Currently Active" : "Currently Inactive"}
              </div>
              <h2 className="text-lg text-zinc-700 font-medium mt-1 text-left hover:underline">
                {a.name ||
                  `${a.firstName || ""} ${a.lastName || ""}`.trim() ||
                  a.email}
              </h2>
              <p className="text-xs text-zinc-500 mb-2">{a.email}</p>

              {/* Actions dropdown (fixed: edit now opens modal) */}
              <Dropdown
                position="bottom"
                options={[
                  {
                    value: "edit",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        <FiEdit />
                        Edit Admin
                      </div>
                    ),
                  },
                  {
                    value: "delete",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        <FiTrash2 />
                        Delete Admin
                      </div>
                    ),
                  },
                  {
                    value: "toggle",
                    label: (
                      <div className="flex items-center gap-2">
                        {a.isActive ? <FiToggleLeft /> : <FiToggleRight />}
                        {a.isActive ? "Disable" : "Enable"}
                      </div>
                    ),
                  },
                ]}
                placeholder="Actions Menu"
                onChange={(val) => {
                  if (val === "edit") openAddEditModal(a);
                  if (val === "delete") handleDeleteClick(a);
                  if (val === "toggle") handleToggleActive(id, !a.isActive);
                }}
                className="w-48"
              />
            </div>
          </div>

          {/* right */}
          <div
            className={`flex-1 grid gap-3 ${
              viewMode === "double"
                ? "grid-cols-1 lg:grid-cols-3"
                : "grid-cols-4"
            }`}
          >
            <MiniCard title="Role" subLine={roleLabel(a)} />
            <MiniCard title="Session Type" subLine={a.sessionType || "—"} />
            <MiniCard title="Added" subLine={formatDate(a.createdAt)} />
            <MiniCard title="Updated" subLine={formatDate(a.updatedAt)} />
          </div>
        </div>
      </div>
    );
  };
  AdminCard.propTypes = {
    a: PropTypes.object.isRequired,
    isSelected: PropTypes.bool.isRequired,
  };

  // pagination UI
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
              <span className="font-medium">
                {Math.max(startItem, endItem)}
              </span>{" "}
              of <span className="font-medium">{total}</span> results
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
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - currentPage) <= 1
                )
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showDots = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {showDots && (
                        <span className="relative inline-flex items-center px-4 py-2 border border-zinc-300 bg-white text-sm font-medium text-zinc-700">
                          ...
                        </span>
                      )}
                      <button
                        onClick={() => handlePageChange(p)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors ${
                          currentPage === p
                            ? "z-10 bg-zinc-100 border-zinc-500 text-zinc-600"
                            : "bg-white border-zinc-300 text-zinc-500 hover:bg-zinc-50"
                        }`}
                      >
                        {p}
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

  // UI renderers
  const renderGrid = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <ImSpinner5 className="animate-spin text-zinc-400 text-4xl" />
        </div>
      );
    }
    if (filtered.length === 0) {
      const isFiltered = Boolean(debouncedSearch);
      return (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 flex items-center justify-center rounded-full bg-zinc-100 mb-4">
            <FiUser className="h-10 w-10 text-zinc-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 mb-1">
            {isFiltered ? "No matching admins" : "No admins yet"}
          </h3>
          <p className="text-zinc-500">
            {isFiltered
              ? "Try adjusting your search."
              : "Get started by adding your first admin."}
          </p>
          {!isFiltered && (
            <button
              onClick={() => openAddEditModal()}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800"
            >
              <FiPlus className="h-4 w-4 mr-2" />
              Add Admin
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
        {filtered.map((a) => (
          <AdminCard key={a._id} a={a} isSelected={selected.includes(a._id)} />
        ))}
      </div>
    );
  };

  // main render
  return (
    <SidebarWrapper>
      <Header
        title="Admins"
        subtitle="Manage all your admins in one place."
        buttonLabel="Add Admin"
        onButtonClick={() => openAddEditModal()}
      />

      {/* filter bar */}
      <div className="w-full bg-zinc-50 border px-4 p-2 rounded mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* view toggle */}
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

            {/* search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search admins by name, email or role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 border border-zinc-300 outline-none rounded text-sm bg-white"
              />
            </div>
          </div>

          {/* selection + bulk actions */}
          <div className="flex flex-wrap items-center gap-3">
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
            {selected.length > 0 && (
              <Dropdown
                position="bottom"
                options={[
                  {
                    value: "disable",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        <FiToggleLeft />
                        Disable ({selected.length})
                      </div>
                    ),
                  },
                  {
                    value: "enable",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        <FiToggleRight />
                        Enable ({selected.length})
                      </div>
                    ),
                  },
                  {
                    value: "delete",
                    label: (
                      <div className="flex items-center gap-2 w-full">
                        <FiTrash2 />
                        Delete ({selected.length})
                      </div>
                    ),
                  },
                ]}
                placeholder="Bulk Actions"
                onChange={(val) => {
                  if (val === "disable") bulkToggle(false);
                  if (val === "enable") bulkToggle(true);
                  if (val === "delete") bulkDelete();
                }}
                className="w-48"
              />
            )}
          </div>
        </div>
      </div>

      {/* grid */}
      <div className="mt-6">{renderGrid()}</div>

      {/* pagination */}
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
                          setFormData((p) => ({
                            ...p,
                            password: e.target.value,
                          }))
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
                          setFormData((p) => ({
                            ...p,
                            lastName: e.target.value,
                          }))
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
                          setFormData((p) => ({
                            ...p,
                            address: e.target.value,
                          }))
                        }
                        className={inputStyles}
                      />
                    </div>
                    <div>
                      <label className={labelStyles("base")}>Role Key</label>
                      <DropdownSearch
                        name="roleKey"
                        value={formData.roleKey}
                        onChange={(val) =>
                          setFormData((p) => ({
                            ...p,
                            roleKey: val,
                          }))
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
                    </div>{" "}
                    <div>
                      <label className={labelStyles("base")}>Country</label>
                      <DropdownSearch
                        name="country"
                        value={formData.country}
                        onChange={(val) =>
                          setFormData((p) => ({
                            ...p,
                            country: val,
                          }))
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
                    </div>{" "}
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
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              isActive: e.target.checked,
                            }))
                          }
                          className="sr-only peer"
                        />
                        <div className="w-12 h-6 bg-zinc-300 peer-focus:outline-none peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
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
                      {editingId ? "Update Admin" : "Create Admin"}
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
        {isConfirmModalOpen && toDelete && (
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
                Delete Admin
              </h3>
              <p className="text-sm text-zinc-600 text-center mb-6">
                Are you sure you want to delete{" "}
                <strong>{toDelete.email}</strong>? This action cannot be undone.
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SidebarWrapper>
  );
};

export default AdminsPage;
