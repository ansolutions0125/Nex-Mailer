"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import SidebarWrapper from "@/components/SidebarWrapper";
import Header from "@/components/Header";
import PropTypes from "prop-types";
import Cookies from "js-cookie";
import { FiTrash2 } from "react-icons/fi";

const authFetch = async (url, init = {}) => {
  const token = Cookies.get("customer_auth_token");
  const headers = {
    ...(init.headers || {}),
    "Content-Type": "application/json",
  };
  if (token) headers["mailer-auth-token"] = token;
  return fetch(url, { ...init, headers });
};

const Cell = ({ label, value }) => (
  <div className="bg-zinc-50 border border-zinc-200 rounded p-3">
    <p className="text-xs font-semibold text-zinc-500 uppercase">{label}</p>
    <p className="text-sm text-zinc-800">{value || "—"}</p>
  </div>
);
Cell.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
};

const Row = ({ s, selected, onToggle }) => (
  <div
    className={`border rounded p-4 ${
      selected ? "border-zinc-500" : "border-zinc-200"
    }`}
  >
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onToggle(!!e.target.checked)}
        />
        <div>
          <p className="text-zinc-800 font-medium">
            {s.deviceName || s.userAgent || "Unknown device"}
          </p>
          <p className="text-xs text-zinc-500">
            {s.ip || "—"} · {s.location || "—"}
          </p>
        </div>
      </div>
      {s.isCurrent && (
        <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
          current
        </span>
      )}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
      <Cell
        label="Created"
        value={
          s.startDate
            ? new Date(s.startDate).toLocaleString()
            : s.createdAt
            ? new Date(s.createdAt).toLocaleString()
            : "—"
        }
      />
      <Cell
        label="Last Active"
        value={
          s.lastActiveAt
            ? new Date(s.lastActiveAt).toLocaleString()
            : "—"
        }
      />
      <Cell
        label="Expires"
        value={s.endDate ? new Date(s.endDate).toLocaleString() : "—"}
      />
      <Cell label="Session ID" value={<span className="font-mono">{s._id}</span>} />
    </div>
  </div>
);
Row.propTypes = {
  s: PropTypes.object.isRequired,
  selected: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

const CustomerSessionsPage = () => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [revoking, setRevoking] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/customer/auth/sessions");
      const json = await res.json();
      if (json?.success) {
        setSessions(Array.isArray(json.data) ? json.data : []);
      } else {
        setSessions([]);
      }
    } catch (e) {
      console.error(e);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const allSelected = useMemo(
    () => sessions.length > 0 && selectedIds.length === sessions.length,
    [sessions, selectedIds]
  );

  const toggleAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(sessions.map((s) => s._id));
  };

  const toggleOne = (id, on) => {
    setSelectedIds((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const revokeSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Revoke ${selectedIds.length} session(s)?`)) return;
    setRevoking(true);
    try {
      const res = await authFetch("/api/customer/auth/sessions", {
        method: "DELETE",
        body: JSON.stringify({ sessionIds: selectedIds }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed");
      await fetchSessions();
      setSelectedIds([]);
      alert(`Revoked ${selectedIds.length} session(s)`);
    } catch (e) {
      alert(e.message || "Failed to revoke sessions");
    } finally {
      setRevoking(false);
    }
  };

  const revokeAllOthers = async () => {
    if (!confirm("Revoke all other sessions (keep current)?")) return;
    setRevoking(true);
    try {
      const res = await authFetch("/api/customer/auth/sessions", {
        method: "DELETE",
        body: JSON.stringify({ revokeAllOthers: true }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "Failed");
      await fetchSessions();
      setSelectedIds([]);
      alert("Revoked all other sessions");
    } catch (e) {
      alert(e.message || "Failed to revoke");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <SidebarWrapper>
      <Header
        title="Account Sessions"
        subtitle="Manage your active sessions and devices"
        hideButton
      />

      {/* bulk bar */}
      <div className="bg-zinc-50 border border-zinc-200 rounded p-3 mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={toggleAll}
          className="text-sm px-3 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
        >
          {allSelected ? "Unselect All" : "Select All"}
        </button>
        {selectedIds.length > 0 && (
          <button
            onClick={revokeSelected}
            disabled={revoking}
            className="text-sm px-3 py-1 border border-red-300 text-red-700 rounded bg-white hover:bg-red-50"
          >
            <FiTrash2 className="inline mr-1" /> Revoke Selected (
            {selectedIds.length})
          </button>
        )}
        <div className="ml-auto">
          <button
            onClick={revokeAllOthers}
            disabled={revoking}
            className="text-sm px-3 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
          >
            Revoke All Others
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="h-10 w-10 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-14">
          <p className="text-zinc-700">No active sessions</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sessions.map((s) => (
            <Row
              key={s._id}
              s={s}
              selected={selectedIds.includes(s._id)}
              onToggle={(on) => toggleOne(s._id, on)}
            />
          ))}
        </div>
      )}
    </SidebarWrapper>
  );
};

export default CustomerSessionsPage;
