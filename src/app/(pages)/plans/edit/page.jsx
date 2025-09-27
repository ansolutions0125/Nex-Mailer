"use client";

import SidebarWrapper from "@/components/SidebarWrapper";
import React, { useCallback, useEffect, useState } from "react";
import { FiArrowLeft, FiCheck, FiX } from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Dropdown } from "@/components/Dropdown";
import {
  inputStyles,
  labelStyles,
  LoadingSpinner,
  ToggleLiver,
  GetUrlParams,
} from "@/presets/styles";
import {
  fetchWithAuthAdmin,
  fetchWithAuthCustomer,
} from "@/helpers/front-end/request";
import useCustomerStore from "@/store/useCustomerStore";
import { useToastStore } from "@/store/useToastStore";
import useAdminStore from "@/store/useAdminStore";

const PlanEditPage = () => {
  const router = useRouter();
  const { showSuccess, showError, showWarning, showInfo } = useToastStore();
  const { admin, token: adminToken } = useAdminStore();
  const { customer, token: customerToken } = useCustomerStore();

  // Get URL parameters
  const urlParams = GetUrlParams();
  const planId = urlParams.planId;
  const isEditMode = !!planId;

  // State
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [servers, setServers] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    slogan: "",
    description: "",
    isActive: true,
    currency: "USD",
    length: "1month",
    price: "",
    discounted: false,
    discount: "",
    serverId: "",
    emailLimit: "",
    featuresText: "",
  });

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

  // Fetch servers
  const fetchServers = useCallback(async () => {
    try {
      const json = await fetchData("/api/servers");
      if (json?.success && Array.isArray(json.data)) {
        setServers(json.data);
      } else {
        console.error("Failed to fetch servers:", json?.message);
        setServers([]);
      }
    } catch (e) {
      console.error("fetchServers error", e);
      setServers([]);
    }
  }, [fetchData]);

  // Fetch plan data for editing
  const fetchPlan = useCallback(async () => {
    if (!isEditMode || !planId) return;

    setLoading(true);
    try {
      const json = await fetchData(`/api/plans?_id=${planId}`);

      if (json?.success && json.data) {
        const plan = Array.isArray(json.data) ? json.data[0] : json.data;

        setFormData({
          name: plan.name || "",
          slogan: plan.slogan || "",
          description: plan.description || "",
          isActive: !!plan.isActive,
          currency: plan.currency || "USD",
          length: plan.length || "1month",
          price: String(plan.price ?? ""),
          discounted: !!plan.discounted,
          discount: String(plan.discount ?? ""),
          serverId: plan.serverId || "",
          emailLimit: String(plan.emailLimit ?? ""),
          featuresText: Array.isArray(plan.features)
            ? plan.features.join(", ")
            : "",
        });
      } else {
        showError(json?.message || "Plan not found");
        router.push("/plans");
      }
    } catch (e) {
      console.error("fetchPlan error", e);
      showError("Failed to load plan data");
      router.push("/plans");
    } finally {
      setLoading(false);
    }
  }, [isEditMode, planId, fetchData, showError, router]);

  // Initialize data
  useEffect(() => {
    fetchServers();
    if (isEditMode) {
      fetchPlan();
    }
  }, [fetchServers, fetchPlan, isEditMode]);

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
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
      length: data.length || "1month",
      price: Number(data.price || 0),
      discounted: !!data.discounted,
      discount:
        data.discounted && data.discount !== ""
          ? Math.max(0, Math.min(100, Number(data.discount)))
          : 0,
      emailLimit: data.emailLimit !== "" ? Number(data.emailLimit) : 0,
      serverId: data.serverId?.trim() || undefined,
      features,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name?.trim()) {
      showWarning("Name is required");
      return;
    }
    if (formData.price === "" || isNaN(Number(formData.price))) {
      showInfo("Price must be a number");
      return;
    }
    if (
      formData.discounted &&
      (formData.discount === "" || isNaN(Number(formData.discount)))
    ) {
      showInfo("Discount % must be a number");
      return;
    }

    setSubmitting(true);
    try {
      const payloadData = normalizePlanPayload(formData);

      if (isEditMode) {
        // Update existing plan
        const json = await fetchData("/api/plans", "PUT", {
          planId: planId,
          ...payloadData,
        });

        if (!json?.success) {
          throw new Error(json?.message || "Failed to update plan");
        }
        showSuccess("Plan updated successfully");
      } else {
        // Create new plan
        const json = await fetchData("/api/plans", "POST", payloadData);

        if (!json?.success) {
          throw new Error(json?.message || "Failed to create plan");
        }
        showSuccess("Plan created successfully");
      }

      // Navigate back to plans list
      router.push("/plans");
    } catch (e) {
      console.error("save plan error", e);
      showError(e.message || "Failed to save plan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/plans");
  };

  if (loading) {
    return (
      <SidebarWrapper>
        <LoadingSpinner type="page" title="Loading plan data..." />
      </SidebarWrapper>
    );
  }

  return (
    <SidebarWrapper>
      <>
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
              {isEditMode ? "Edit Plan" : "Create New Plan"}
            </h1>
            <p className="text-sm text-zinc-600">
              {isEditMode
                ? "Update the plan details below"
                : "Fill in the details to create a new pricing plan"}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="px-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Basic Info */}
              <div className="md:col-span-2 bg-primary text-white px-4 py-2 rounded-sm my-2">
                <h3 className="text-base tracking-wide">Basic Information</h3>
              </div>

              <div className="md:col-span-2 px-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelStyles("base")}>Plan Name *</label>
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Starter Plan"
                    className={inputStyles}
                    required
                  />
                </div>

                <div>
                  <label className={labelStyles("base")}>Slogan</label>
                  <input
                    name="slogan"
                    value={formData.slogan}
                    onChange={handleInputChange}
                    placeholder="e.g., Perfect for small teams"
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
                    placeholder="Describe this plan..."
                    className={inputStyles}
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="md:col-span-2 bg-primary text-white px-4 py-2 rounded-sm my-2">
                <h3 className="text-base tracking-wide">
                  Pricing Configuration
                </h3>
              </div>

              <div className="md:col-span-2 px-3 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      setFormData((prev) => ({ ...prev, currency: val }))
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className={labelStyles("base")}>Billing Length</label>
                  <Dropdown
                    options={[
                      { value: "1month", label: "Monthly" },
                      { value: "3month", label: "3 Months" },
                      { value: "6month", label: "6 Months" },
                      { value: "1year", label: "Annual" },
                    ]}
                    value={formData.length}
                    onChange={(val) =>
                      setFormData((prev) => ({ ...prev, length: val }))
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className={labelStyles("base")}>Price *</label>
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
                  <label className={labelStyles("base")}>Discount %</label>
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
                    className={`${inputStyles} ${
                      !formData.discounted ? "opacity-60" : ""
                    }`}
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center gap-2">
                    <ToggleLiver
                      key="discountedToggle"
                      checked={formData.discounted}
                      onChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          discounted: checked,
                        }))
                      }
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-800">
                        Enable Discount
                      </p>
                      <p className="text-xs text-zinc-600">
                        Apply a percentage discount to this plan
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuration */}
              <div className="md:col-span-2 bg-primary text-white px-4 py-2 rounded-sm my-2">
                <h3 className="text-base tracking-wide">Plan Configuration</h3>
              </div>

              <div className="md:col-span-2 px-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelStyles("base")}>
                    Monthly Email Limit
                  </label>
                  <input
                    name="emailLimit"
                    value={formData.emailLimit}
                    onChange={handleInputChange}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g., 10000"
                    className={inputStyles}
                  />
                </div>

                <div>
                  <label className={labelStyles("base")}>Server</label>
                  <Dropdown
                    options={[
                      { value: "", label: "Select Server (Optional)" },
                      ...servers.map((server) => ({
                        value: server._id,
                        label: server.name || server.host || server._id,
                      })),
                    ]}
                    value={formData.serverId}
                    onChange={(val) =>
                      setFormData((prev) => ({ ...prev, serverId: val }))
                    }
                    className="w-full"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center gap-4">
                    <ToggleLiver
                      key="isActiveToggle"
                      checked={formData.isActive}
                      onChange={(checked) =>
                        setFormData((prev) => ({ ...prev, isActive: checked }))
                      }
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-800">
                        Active Plan
                      </p>
                      <p className="text-xs text-zinc-600">
                        Make this plan available for public use
                      </p>
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className={labelStyles("base")}>
                    Features (comma or newline separated)
                  </label>
                  <textarea
                    name="featuresText"
                    value={formData.featuresText}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Unlimited contacts&#10;Basic automations&#10;Email support&#10;24/7 customer service"
                    className={inputStyles}
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Separate features with commas or new lines
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-zinc-200">
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="btn btn-sm md:btn-md btn-second disabled:opacity-50"
              >
                <FiX className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-sm md:btn-md btn-primary-two disabled:opacity-50"
              >
                {submitting ? (
                  <ImSpinner5 className="animate-spin h-4 w-4" />
                ) : (
                  <FiCheck className="h-4 w-4" />
                )}
                {isEditMode ? "Update Plan" : "Create Plan"}
              </button>
            </div>
          </form>
        </div>
      </>
    </SidebarWrapper>
  );
};

export default PlanEditPage;
