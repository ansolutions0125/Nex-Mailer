"use client";

import React, { useEffect, useState } from "react";
import SidebarWrapper from "@/components/SidebarWrapper";
import Header from "@/components/Header";
import PropTypes from "prop-types";
import Cookies from "js-cookie";
import { inputStyles, labelStyles, ToggleLiver } from "@/presets/styles";

const cardCls = "bg-white p-4";

const authFetch = async (url, init = {}) => {
  const token = Cookies.get("admin_auth_token");
  const headers = {
    ...(init.headers || {}),
    "Content-Type": "application/json",
  };
  if (token) headers["mailer-auth-token"] = token;
  return fetch(url, { ...init, headers });
};

const Toggle = ({ label, checked, onChange, help }) => (
  <div className="flex items-center justify-between border border-zinc-200 rounded p-3 bg-zinc-50">
    <div className="max-w-80">
      <p className="text-sm text-zinc-800 font-medium border-b border-zinc-300 mb-2 pb-1">
        {label}
      </p>
      {help && <p className="text-xs text-zinc-500">{help}</p>}
    </div>

    <ToggleLiver key={label} checked={checked} onChange={onChange} />
  </div>
);

Toggle.propTypes = {
  label: PropTypes.string.isRequired,
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  help: PropTypes.string,
};

const AdminAuthSettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    admin: {
      allowNormalAdminManageAdmins: false,
      providers: {
        emailPassword: true,
        magicLink: false,
      },
      enforceSessionLimit: true,
      maxActiveSessions: 5,
      sessionDuration: 5,
      enforceSessionDuration: true,
    },
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/auth/settings");
      const json = await res.json();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await authFetch("/api/admin/auth/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to save settings");
      }
      alert("Saved successfully");
    } catch (e) {
      alert(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidebarWrapper>
      <Header
        title="Admin · Auth Settings"
        subtitle="Control admin login methods, access, and session limits"
        buttonText={saving ? "Saving..." : "Save Settings"}
        onButtonClick={save}
      />

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="h-10 w-10 border-2 border-zinc-300 border-t-zinc-700 animate-spin rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 divide-x-2 [&>*:last-child]:border-none">
          {/* Sessions */}
          <div className={cardCls}>
            <h3 className="text-zinc-800 font-semibold mb-3">Sessions</h3>
            <div className="grid gap-3">
              <Toggle
                label="Enforce per-admin session limit"
                help="If on, admins will be prompted to revoke older sessions when they exceed the limit."
                checked={!!settings.admin.enforceSessionLimit}
                onChange={(v) =>
                  setSettings((p) => ({
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
                  className={`max-w-32 ${inputStyles}`}
                  value={settings.admin.maxActiveSessions}
                  onChange={(e) =>
                    setSettings((p) => ({
                      admin: {
                        ...p.admin,
                        maxActiveSessions: Math.max(
                          1,
                          Number(e.target.value || 1)
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
                  className={`max-w-32 ${inputStyles}`}
                  value={settings.admin.sessionDuration}
                  onChange={(e) =>
                    setSettings((p) => ({
                      admin: {
                        ...p.admin,
                        sessionDuration: Math.max(
                          1,
                          Number(e.target.value || 1)
                        ),
                      },
                    }))
                  }
                />
              </div>
              <p className="text-xs text-zinc-500">
                If an admin exceeds the limit, the sign-in UI should prompt them
                to revoke older sessions before proceeding.
              </p>
            </div>
          </div>

          {/* Auth Methods */}
          <div className={cardCls}>
            <h3 className="text-zinc-800 font-semibold mb-3">Auth Methods</h3>
            <div className="grid gap-3">
              <Toggle
                label="Email + Password"
                help="Allow Admins to log in with email and password."
                checked={!!settings.admin.providers.emailPassword}
                onChange={(v) =>
                  setSettings((p) => ({
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
                    admin: {
                      ...p.admin,
                      providers: { ...p.admin.providers, magicLink: v },
                    },
                  }))
                }
              />
            </div>
          </div>
          {/* Access Rules */}
          <div className={cardCls}>
            <h3 className="text-zinc-800 font-semibold mb-3">Access Rules</h3>
            <Toggle
              label="Allow non-owner role or permission to manage Admins / System"
              help="If on, non-owner role or permission can manage Admins and System settings. (if admin has full-access permission on this will be over-rided)"
              checked={settings.admin.allowNormalAdminManageAdmins}
              onChange={(v) =>
                setSettings((p) => ({
                  admin: { ...p.admin, allowNormalAdminManageAdmins: v },
                }))
              }
            />
          </div>
        </div>
      )}
    </SidebarWrapper>
  );
};

export default AdminAuthSettingsPage;
