"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SidebarWrapper from "@/components/SidebarWrapper";
import {
  FilesDropdownZone,
  GetUrlParams as getQueryParams,
  TabToggle,
  ToggleLiver,
} from "@/presets/styles";
import { Dropdown } from "@/components/Dropdown";
import { inputStyles, labelStyles, LoadingSpinner } from "@/presets/styles";
import { useToastStore } from "@/store/useToastStore";
import useAdminStore from "@/store/useAdminStore";
import useCustomerStore from "@/store/useCustomerStore";
import {
  fetchWithAuthAdmin,
  fetchWithAuthCustomer,
} from "@/helpers/front-end/request";
import { uploadToImgbb } from "@/presets/Presets.jsx"; // ✅ import uploader
import { FiArrowLeft, FiCheck, FiX } from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";

const EditListPage = () => {
  /* ---------- 1. Hooks + auth wrapper ---------- */
  const { showSuccess, showError } = useToastStore();
  const { admin, token: adminToken } = useAdminStore();
  const { customer, token: customerToken } = useCustomerStore();
  const router = useRouter();

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

  /* ---------- 2. URL params ---------- */
  const params = useMemo(() => getQueryParams(), []);
  const listId = params.listId || "";
  const viewMode = params.mode === "view";
  const isEditing = Boolean(listId);

  /* ---------- 3. State ---------- */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadMethod, setLogoUploadMethod] = useState("file");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState(null);
  const [automations, setAutomations] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true,
    logo: "",
    automationId: "",
  });

  /* ---------- 4. Data fetchers ---------- */
  const loadAutomations = useCallback(async () => {
    try {
      const res = await fetchData("/api/work-flow/flow", "GET");
      if (!res?.success)
        throw new Error(res?.message || "Failed to fetch automations");
      setAutomations(res.data?.automations || []);
    } catch (err) {
      console.error(err);
      showError(err.message || "Failed to fetch automations");
      setAutomations([]);
    }
  }, [fetchData, showError]);

  const loadListIfEditing = useCallback(async () => {
    if (!isEditing) return;
    try {
      const res = await fetchData(`/api/list?id=${listId}`, "GET");
      if (!res?.success) throw new Error(res?.message || "Failed to load list");
      const data = res.data;
      const list = Array.isArray(data)
        ? data.find((l) => l._id === listId)
        : data;
      if (!list) throw new Error("List not found");
      setFormData({
        name: list.name || "",
        description: list.description || "",
        isActive: Boolean(list.isActive),
        logo: list.logo || "",
        automationId: list.automationId || "",
      });
    } catch (err) {
      console.error(err);
      showError(err.message || "Failed to load list");
      router.push("/my/lists");
    }
  }, [isEditing, listId, fetchData, showError, router]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadAutomations(), loadListIfEditing()]);
      setLoading(false);
    })();
  }, [loadAutomations, loadListIfEditing]);

  /* ---------- 5. Handlers ---------- */
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleLogoUpload = async (files) => {
    const file = files[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    setUploadingLogo(true);
    try {
      const result = await uploadToImgbb(
        file,
        process.env.NEXT_PUBLIC_IMGBB_KEY
      );
      setFormData((prev) => ({ ...prev, logo: result.url }));
    } catch (err) {
      console.error(err);
      showError(err.message || "Logo upload failed.");
    } finally {
      setUploadingLogo(false);
      setLogoPreview(null); // Clear preview after upload finishes
    }
  };

  const handleLogoUrlUpload = async () => {
    if (!logoUrl || !logoUrl.startsWith("http")) {
      showError("Please enter a valid image URL.");
      return;
    }
    setUploadingLogo(true);
    try {
      const result = await uploadToImgbb(
        logoUrl,
        process.env.NEXT_PUBLIC_IMGBB_KEY
      );
      setFormData((prev) => ({ ...prev, logo: result.url }));
    } catch (err) {
      console.error(err);
      showError(err.message || "Logo upload from URL failed.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (viewMode) return;
    setSaving(true);
    try {
      const url = isEditing ? `/api/list?id=${listId}` : "/api/list";
      const method = isEditing ? "PUT" : "POST";
      const payload = { ...formData, customerId: customer?._id || null };
      const res = await fetchData(url, method, payload);
      if (!res?.success) throw new Error(res?.message || "Failed to save list");
      showSuccess(isEditing ? "List updated!" : "List created!");
      router.push("/my/lists");
    } catch (err) {
      console.error(err);
      showError(err.message || "An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => router.push("/my/lists");

  /* ---------- 6. Render ---------- */
  if (loading)
    return (
      <SidebarWrapper>
        <LoadingSpinner type="page" title="Loading list data..." />
      </SidebarWrapper>
    );

  return (
    <SidebarWrapper>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleCancel}
          className="w-10 h-10 bg-zinc-50 hover:bg-zinc-100 border hover:border-zinc-300 rounded center-flex transition-all"
        >
          <FiArrowLeft className="h-5 w-5 text-zinc-600" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-800">
            {isEditing
              ? viewMode
                ? "View List"
                : "Edit List"
              : "Create New List"}
          </h1>
          <p className="text-sm text-zinc-600">
            {isEditing
              ? "Update the list details below"
              : "Fill in the details to create a new list"}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="px-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Section header */}
            <div className="md:col-span-2 bg-primary text-white px-4 py-2 rounded-sm my-2">
              <h3 className="text-base tracking-wide">List Information</h3>
            </div>

            <div className="md:col-span-2 px-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Name */}
              <div>
                <label className={labelStyles("base")}>Name *</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., VIP Customers"
                  className={inputStyles}
                  disabled={viewMode}
                  required
                />
              </div>

              {/* Logo */}
              <div>
                <label className={labelStyles("base")}>Logo</label>
                <FilesDropdownZone
                  onFilesSelected={handleLogoUpload}
                  loading={uploadingLogo}
                  disabled={viewMode}
                  id="logo-uploader"
                >
                  {logoPreview || formData.logo ? (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={logoPreview || formData.logo}
                        alt="Logo"
                        className="max-h-24 object-contain rounded"
                      />
                      {!viewMode && (
                        <p className="text-xs text-zinc-500">
                          Click or drop to replace
                        </p>
                      )}
                    </div>
                  ) : null}
                </FilesDropdownZone>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className={labelStyles("base")}>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Short description…"
                  className={inputStyles}
                  disabled={viewMode}
                />
              </div>
            </div>

            {/* Config section */}
            <div className="md:col-span-2 bg-primary text-white px-4 py-2 rounded-sm my-2">
              <h3 className="text-base tracking-wide">Configuration</h3>
            </div>

            <div className="md:col-span-2 px-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Automation dropdown */}
              <div>
                <label className={labelStyles("base")}>
                  Your Active Automations
                </label>
                <Dropdown
                  options={[
                    { value: "", label: "— None —" },
                    ...automations.map((a) => ({
                      value: a._id,
                      label: a.name || a._id,
                    })),
                  ]}
                  value={formData.automationId}
                  onChange={(val) =>
                    setFormData((p) => ({ ...p, automationId: val }))
                  }
                  className="w-full"
                  disabled={viewMode}
                />
              </div>

              {/* Active toggle */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <ToggleLiver
                    checked={formData.isActive}
                    onChange={(checked) =>
                      setFormData((p) => ({ ...p, isActive: checked }))
                    }
                    disabled={viewMode}
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-800">
                      Active List
                    </p>
                    <p className="text-xs text-zinc-600">
                      Make this list available for use
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-zinc-200">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="btn btn-sm md:btn-md btn-second disabled:opacity-50"
            >
              <FiX className="h-4 w-4" />
              Cancel
            </button>

            {!viewMode && (
              <button
                type="submit"
                disabled={saving}
                className="btn btn-sm md:btn-md btn-primary-two disabled:opacity-50"
              >
                {saving ? (
                  <ImSpinner5 className="animate-spin h-4 w-4" />
                ) : (
                  <FiCheck className="h-4 w-4" />
                )}
                {isEditing ? "Save List" : "Create List"}
              </button>
            )}
          </div>
        </form>
      </div>
    </SidebarWrapper>
  );
};

export default EditListPage;
