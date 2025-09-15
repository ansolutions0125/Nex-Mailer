"use client";

import React, { useEffect, useState } from "react";
import SidebarWrapper from "@/components/SidebarWrapper";
import Header from "@/components/Header";
import PropTypes from "prop-types";
import {
  inputStyles,
  labelStyles,
  LoadingSpinner,
  TabToggle,
  ToggleLiver,
} from "@/presets/styles";
import { useToastStore } from "@/store/useToastStore";
import useAdminStore from "@/store/useAdminStore";
import { fetchWithAuthAdmin } from "@/helpers/front-end/request";

const cardCls = "bg-white p-4 border";

const Toggle = ({ label, checked, onChange, help }) => (
  <div className="flex items-center justify-between border border-zinc-200 rounded p-3 bg-zinc-50">
    <div className="max-w-80">
      <p className="text-sm text-zinc-800 font-medium border-b border-zinc-300 mb-2 pb-1">
        {label}
      </p>
      {help && <p className="text-xs text-zinc-500">{help}</p>}
    </div>

    <ToggleLiver
      key={label || help || onChange}
      checked={checked}
      onChange={onChange}
    />
  </div>
);

Toggle.propTypes = {
  label: PropTypes.string.isRequired,
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  help: PropTypes.string,
};

const AuthSettings = () => {
  const { showSuccess, showError, showWarning } = useToastStore();
  const { admin, token, setAdmin } = useAdminStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentTab, setCurrentTab] = useState("admin"); // 'admin' or 'customer'
  const [settings, setSettings] = useState({
    admin: {
      allowNormalAdminManageAdmins: false,
      providers: {
        emailPassword: true,
        magicLink: true,
      },
      enforceSessionLimit: true,
      maxActiveSessions: 5,
      sessionDuration: 5,
      enforceSessionDuration: true,
    },
    customer: {
      sessionDuration: 5,
      enforceSessionDuration: true,
      providers: {
        emailPassword: true,
        magicLink: true,
      },
      maxActiveSessions: 5,
      enforceSessionLimit: true,
    },
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuthAdmin({
        url: "/api/admin/auth/settings",
        method: "GET",
        admin: admin,
        token: token,
      });
      const json = res;
      if (json?.success && json.data?.admin) {
        setSettings({
          admin: {
            allowNormalAdminManageAdmins:
              json.data.admin.allowNormalAdminManageAdmins ??
              settings.admin.allowNormalAdminManageAdmins,
            providers: {
              emailPassword:
                json.data.admin.providers?.emailPassword ??
                settings.admin.providers.emailPassword,
              magicLink:
                json.data.admin.providers?.magicLink ??
                settings.admin.providers.magicLink,
            },
            enforceSessionLimit:
              json.data.admin.enforceSessionLimit ??
              settings.admin.enforceSessionLimit,
            maxActiveSessions:
              json.data.admin.maxActiveSessions ??
              settings.admin.maxActiveSessions,
            sessionDuration:
              json.data.admin.sessionDuration ?? settings.admin.sessionDuration,
            enforceSessionDuration:
              json.data.admin.enforceSessionDuration ??
              settings.admin.enforceSessionDuration,
          },
          customer: {
            sessionDuration:
              json.data.customer?.sessionDuration ??
              settings.customer.sessionDuration,
            enforceSessionDuration:
              json.data.customer?.enforceSessionDuration ??
              settings.customer.enforceSessionDuration,
            providers: {
              emailPassword:
                json.data.customer?.providers?.emailPassword ??
                settings.customer.providers.emailPassword,
              magicLink:
                json.data.customer?.providers?.magicLink ??
                settings.customer.providers.magicLink,
            },
            maxActiveSessions:
              json.data.customer?.maxActiveSessions ??
              settings.customer.maxActiveSessions,
            enforceSessionLimit:
              json.data.customer?.enforceSessionLimit ??
              settings.customer.enforceSessionLimit,
          },
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        url: "/api/admin/auth/settings",
        method: "PUT",
        admin: admin,
        token: token,
        payload: settings,
      };
      const res = await fetchWithAuthAdmin(payload);
      const json = res;
      if (!res.success || !json?.data) {
        showError(json?.message || "Failed to save settings");
      } else {
        showSuccess("Saved successfully");
      }
    } catch (e) {
      showError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const renderAdminSettings = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className={cardCls}>
        <h3 className="text-zinc-800 font-semibold mb-3">Sessions</h3>
        <div className="grid gap-3">
          <Toggle
            label="Enforce per-admin session limit"
            help="If on, admins will be prompted to revoke older sessions when they exceed the limit."
            checked={!!settings.admin.enforceSessionLimit}
            onChange={(v) =>
              setSettings((p) => ({
                ...p,
                admin: { ...p.admin, enforceSessionLimit: v },
              }))
            }
          />
          <div className="flex flex-col gap-1">
            <label className={labelStyles("base")}>
              Max sessions per admin
            </label>
            <input
              type="number"
              min={1}
              max={100}
              className={`max-w-32 ${inputStyles}`}
              value={settings.admin.maxActiveSessions}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  admin: {
                    ...p.admin,
                    maxActiveSessions: Math.max(
                      1,
                      Math.min(100, Number(e.target.value || 1))
                    ),
                  },
                }))
              }
            />
          </div>
          <Toggle
            label="Enforce session duration"
            help="If on, admin sessions will expire after the specified duration."
            checked={!!settings.admin.enforceSessionDuration}
            onChange={(v) =>
              setSettings((p) => ({
                ...p,
                admin: { ...p.admin, enforceSessionDuration: v },
              }))
            }
          />
          <div className="flex flex-col gap-1">
            <label className={labelStyles("base")}>
              Session duration (days)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              className={`max-w-32 ${inputStyles}`}
              value={settings.admin.sessionDuration}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  admin: {
                    ...p.admin,
                    sessionDuration: Math.max(
                      1,
                      Math.min(100, Number(e.target.value || 1))
                    ),
                  },
                }))
              }
            />
          </div>
          <p className="text-xs text-zinc-500">
            If an admin exceeds the limit, the sign-in UI should prompt them to
            revoke older sessions before proceeding.
          </p>
        </div>
      </div>

      <div className="bg-white p-4">
        <h3 className="text-zinc-800 font-semibold mb-3">Auth Methods</h3>
        <div className="grid gap-3">
          <Toggle
            label="Email + Password"
            help="Allow Admins to log in with email and password."
            checked={!!settings.admin.providers.emailPassword}
            onChange={(v) =>
              setSettings((p) => ({
                ...p,
                admin: {
                  ...p.admin,
                  providers: { ...p.admin.providers, emailPassword: v },
                },
              }))
            }
          />
          <Toggle
            label="Magic Link"
            help="Allow Admins to log in with an email verification."
            checked={!!settings.admin.providers.magicLink}
            onChange={(v) =>
              setSettings((p) => ({
                ...p,
                admin: {
                  ...p.admin,
                  providers: { ...p.admin.providers, magicLink: v },
                },
              }))
            }
          />
        </div>
      </div>

      <div className={cardCls}>
        <h3 className="text-zinc-800 font-semibold mb-3">Access Rules</h3>
        <Toggle
          label="Allow non-owner role or permission to manage Admins / System"
          help="If on, non-owner role or permission can manage Admins and System settings. (if admin has full-access permission on this will be over-rided)"
          checked={settings.admin.allowNormalAdminManageAdmins}
          onChange={(v) =>
            setSettings((p) => ({
              ...p,
              admin: { ...p.admin, allowNormalAdminManageAdmins: v },
            }))
          }
        />
      </div>
    </div>
  );

  const renderCustomerSettings = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 divide-x-2 [&>*:last-child]:border-none">
      <div className={cardCls}>
        <h3 className="text-zinc-800 font-semibold mb-3">Sessions</h3>
        <div className="grid gap-3">
          <Toggle
            label="Enforce per-customer session limit"
            help="If on, customers will be prompted to revoke older sessions when they exceed the limit."
            checked={!!settings.customer.enforceSessionLimit}
            onChange={(v) =>
              setSettings((p) => ({
                ...p,
                customer: { ...p.customer, enforceSessionLimit: v },
              }))
            }
          />
          <div className="flex flex-col gap-1">
            <label className={labelStyles("base")}>
              Max sessions per customer
            </label>
            <input
              type="number"
              min={1}
              max={100}
              className={`max-w-32 ${inputStyles}`}
              value={settings.customer.maxActiveSessions}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  customer: {
                    ...p.customer,
                    maxActiveSessions: Math.max(
                      1,
                      Math.min(100, Number(e.target.value || 1))
                    ),
                  },
                }))
              }
            />
          </div>
          <Toggle
            label="Enforce session duration"
            help="If on, customer sessions will expire after the specified duration."
            checked={!!settings.customer.enforceSessionDuration}
            onChange={(v) =>
              setSettings((p) => ({
                ...p,
                customer: { ...p.customer, enforceSessionDuration: v },
              }))
            }
          />
          <div className="flex flex-col gap-1">
            <label className={labelStyles("base")}>
              Session duration (days)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              className={`max-w-32 ${inputStyles}`}
              value={settings.customer.sessionDuration}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  customer: {
                    ...p.customer,
                    sessionDuration: Math.max(
                      1,
                      Math.min(100, Number(e.target.value || 1))
                    ),
                  },
                }))
              }
            />
          </div>
          <p className="text-xs text-zinc-500">
            If a customer exceeds the limit, the sign-in UI should prompt them
            to revoke older sessions before proceeding.
          </p>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className="text-zinc-800 font-semibold mb-3">Auth Methods</h3>
        <div className="grid gap-3">
          <Toggle
            label="Email + Password"
            help="Allow Customers to log in with email and password."
            checked={!!settings.customer.providers.emailPassword}
            onChange={(v) =>
              setSettings((p) => ({
                ...p,
                customer: {
                  ...p.customer,
                  providers: { ...p.customer.providers, emailPassword: v },
                },
              }))
            }
          />
          <Toggle
            label="Magic Link"
            help="Allow Customers to log in with an email verification."
            checked={!!settings.customer.providers.magicLink}
            onChange={(v) =>
              setSettings((p) => ({
                ...p,
                customer: {
                  ...p.customer,
                  providers: { ...p.customer.providers, magicLink: v },
                },
              }))
            }
          />
        </div>
      </div>
    </div>
  );

  return (
    <SidebarWrapper>
      <Header
        title="Admin · Authentication Settings"
        subtitle="Control admin and customer login methods, access, and session limits"
        buttonText={saving ? "Saving..." : "Save Settings"}
        onButtonClick={save}
      />

      <div className="mb-4">
        <TabToggle
          label="Authentication Settings Controller"
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          TabToggleOptions={[
            {
              label: "Admin Auth Settings",
              value: "admin",
            },
            {
              label: "Customer Auth Settings",
              value: "customer",
            },
          ]}
          size="md"
        />
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {currentTab === "admin" && renderAdminSettings()}
          {currentTab === "customer" && renderCustomerSettings()}
        </>
      )}
    </SidebarWrapper>
  );
};

export default AuthSettings;
