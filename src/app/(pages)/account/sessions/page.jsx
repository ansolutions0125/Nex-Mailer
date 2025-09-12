"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import SidebarWrapper from "@/components/SidebarWrapper";
import Header from "@/components/Header";
import { fetchWithAuthAdmin } from "@/helpers/front-end/request"; // re-use your existing helper
import useAdminStore from "@/store/useAdminStore"; // re-use existing auth store
import { useToastStore } from "@/store/useToastStore";
import {
  FiSearch,
  FiTrash2,
  FiPower,
  FiRefreshCw,
  FiDownload,
  FiCopy,
  FiX,
  FiAlertTriangle,
  FiChevronDown,
  FiChevronRight,
} from "react-icons/fi";
import { Checkbox, inputStyles } from "@/presets/styles";
import { Dropdown } from "@/components/Dropdown";

/* ------------------------------ utilities ------------------------------ */

const now = () => new Date();
const safeDate = (d) => (d ? new Date(d) : null);
const formatDate = (d) => (d ? new Date(d).toLocaleString() : "—");

const rel = (d) => {
  const dt = safeDate(d);
  if (!dt) return "—";
  const diff = dt.getTime() - now().getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const table = [
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
    ["second", 1000],
  ];
  for (const [unit, ms] of table) {
    if (abs >= ms || unit === "second") {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
};

const parseUA = (ua = "") => {
  if (!ua) return { device: "Unknown device", browser: "—", os: "—" };
  const b =
    /Edg\/|Chrome\/|Safari\/|Firefox\/|Brave\/|OPR\/|MSIE|Trident\/|Chromium\//.exec(
      ua
    );
  const browser = b
    ? b[0]
        .replace("/", "")
        .replace("Trident", "IE")
        .replace("OPR", "Opera")
        .replace("Edg", "Edge")
    : "Browser";
  const osMatch =
    /\(([^)]+)\)/.exec(ua)?.[1] ||
    (/Windows|Mac OS X|Linux|Android|iPhone OS|iPad OS/.exec(ua)?.[0] ?? "OS");
  const os = osMatch
    .replace("Mac OS X", "macOS")
    .replace("iPhone OS", "iOS")
    .replace("iPad OS", "iPadOS");
  return { device: `${browser} on ${os}`, browser, os };
};

const computeStatus = (s) => {
  const revoked = !!s.revoked;
  const exp = safeDate(s.expiresAt);
  const expired = !!exp && exp.getTime() < now().getTime();
  if (s.isCurrent) return "current";
  if (revoked) return "revoked";
  if (expired) return "expired";
  return "active";
};

const statusChip = (status) => {
  const map = {
    current: "text-emerald-700 bg-emerald-50 border-emerald-200",
    active: "text-sky-700 bg-sky-50 border-sky-200",
    revoked: "text-rose-700 bg-rose-50 border-rose-200",
    expired: "text-amber-800 bg-amber-50 border-amber-200",
  };
  const label = status[0].toUpperCase() + status.slice(1);
  return (
    <span className={`text-xs border px-2 py-0.5 rounded ${map[status] ?? ""}`}>
      {label}
    </span>
  );
};

const truncate = (str = "", n = 8) =>
  str.length > n ? `${str.slice(0, n)}…${str.slice(-4)}` : str;

/* Infer query type for UI context only (we always send q=...) */
const inferQueryType = (q) => {
  const s = (q || "").trim();
  if (!s) return "empty";
  const email =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ||
    (s.includes("@") && s.includes("."));
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(s);
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s
    );
  if (email) return "email";
  if (ipv4) return "ip";
  if (uuid) return "uuid";
  return "text";
};

/* Normalize server response for customer sessions.
   Accepts:
   A) { data: [ { sessionHolder, sessions: [ ... ] }, ... ], pagination }
   B) { data: [ ...sessions ] } (flat)
   Handles both native customer shape and admin-style fields.
*/
const normalize = (json) => {
  const groups = Array.isArray(json?.data) ? json.data : [];
  const out = [];
  const push = (raw, holder) => {
    const email =
      raw?.email || holder || raw?.sessionHolder || "unknown";
    const startedAt = raw?.startedAt || raw?.startDate || raw?.createdAt;
    const expiresAt = raw?.expiresAt || raw?.endDate;
    const endedAt = raw?.endedAt || raw?.revokedAt || null;
    const revoked = raw?.revoked === true || !!raw?.revokedAt;

    out.push({
      id: raw._id,
      raw,
      holder: email,
      holderRole: "customer",
      actorType: raw?.actorType || "customer",
      isCurrent: !!raw?.isCurrent,
      ip: raw?.ip || "",
      userAgent: raw?.userAgent || "",
      jti: raw?.jti || raw?.tokenId || "",
      createdAt: raw?.createdAt,
      startedAt,
      lastActiveAt: raw?.lastActiveAt || raw?.updatedAt || startedAt,
      expiresAt,
      endedAt,
      revoked,
      updatedAt: raw?.updatedAt,
      customerId: raw?.customerId || raw?.actorId,
    });
  };

  if (groups.length && groups[0]?.sessions) {
    groups.forEach((g) => g.sessions.forEach((s) => push(s, g.sessionHolder)));
  } else {
    groups.forEach((s) => push(s));
  }

  return out;
};

const toCSV = (rows) => {
  const headers = [
    "holder",
    "role",
    "status",
    "ip",
    "device",
    "startedAt",
    "lastActiveAt",
    "expiresAt",
    "endedAt",
    "jti",
    "id",
  ];
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    const { device } = parseUA(r.userAgent);
    const cells = [
      r.holder,
      r.holderRole,
      computeStatus(r),
      r.ip,
      device,
      r.startedAt,
      r.lastActiveAt,
      r.expiresAt,
      r.endedAt || "",
      r.jti,
      r.id,
    ].map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`);
    lines.push(cells.join(","));
  });
  return lines.join("\n");
};

/* ------------------------------- page ---------------------------------- */

export default function CustomerSessionsPage() {
  const { admin, token } = useAdminStore(); // reuse admin auth to call the customer sessions API
  const { showSuccess, showError, showInfo } = useToastStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [raw, setRaw] = useState([]);

  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState("all"); // all|active|revoked|expired
  const [groupByHolder, setGroupByHolder] = useState(true);
  const [sortKey, setSortKey] = useState("lastActiveAt"); // lastActiveAt|startedAt|expiresAt|holder
  const [sortDir, setSortDir] = useState("desc"); // asc|desc
  const [details, setDetails] = useState(null);
  const [searchMode, setSearchMode] = useState("local"); // "local" | "live"

  const [selected, setSelected] = useState(new Set()); // ids

  const hasMore = page < totalPages;

  const queryType = useMemo(() => inferQueryType(query), [query]);

    const fetchPage = async (p = 1, replace = false) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: "20",
          groupBy: groupByHolder ? "holder" : "none",
          sortBy: sortKey,
          sortDir,
        });

        // Server-driven status filter
        if (statusTab !== "all") params.set("status", statusTab);

        // Live API mode: always send q
        if (searchMode === "live" && query.trim()) {
          params.set("q", query.trim());
        }

        const json = await fetchWithAuthAdmin({
          url: `/api/customers/sessions?${params.toString()}`,
          admin,
          token,
          method: "GET",
        });

        if (!json?.success) {
          throw new Error(json?.message || "Failed to fetch sessions");
        }

        const rows = normalize(json);
        const pagination = json?.pagination || { page: p, totalPages: 1 };

        setRaw((prev) => (replace ? rows : [...prev, ...rows]));
        setPage(pagination.page || p);
        setTotalPages(pagination.totalPages || 1);

        if (json.message) showInfo(json.message);
      } catch (e) {
        console.error(e);
        setError(e?.message || "Failed to fetch sessions");
      } finally {
        setLoading(false);
      }
    }

// ✅ one effect to rule them all
useEffect(() => {
  setSelected(new Set());
  setRaw([]);
  setPage(1);
  setTotalPages(1);

  // Only auto-fetch in "live" when searchMode is live; otherwise fetch baseline
  const shouldFetch =
    statusTab !== "all" || searchMode === "live" || raw.length === 0;

  if (shouldFetch) fetchPage(1, true);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [statusTab, searchMode, sortKey, sortDir, groupByHolder]);

  // refetch on status tab change
  useEffect(() => {
    setSelected(new Set());
    setRaw([]);
    setPage(1);
    setTotalPages(1);
    fetchPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab]);

  // refetch when switching search mode
  useEffect(() => {
    setRaw([]);
    setPage(1);
    setTotalPages(1);
    if (searchMode === "live") fetchPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMode]);

  // Live API — debounce fetch on query changes
  useEffect(() => {
    if (searchMode !== "live") return;
    const t = setTimeout(() => fetchPage(1, true), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchMode]);

  const allRows = useMemo(() => raw, [raw]);

  // Local mode = client search; Live mode = server results
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows =
      searchMode === "local"
        ? allRows.filter((r) => {
            const inText =
              !q ||
              r.holder?.toLowerCase().includes(q) ||
              r.ip?.toLowerCase().includes(q) ||
              r.jti?.toLowerCase().includes(q) ||
              r.userAgent?.toLowerCase().includes(q);
            return inText;
          })
        : allRows;

    const dir = sortDir === "asc" ? 1 : -1;
    const valueOf = (r) => {
      switch (sortKey) {
        case "holder":
          return r.holder?.toLowerCase() || "";
        case "startedAt":
          return safeDate(r.startedAt)?.getTime() || 0;
        case "expiresAt":
          return safeDate(r.expiresAt)?.getTime() || 0;
        default:
          return safeDate(r.lastActiveAt)?.getTime() || 0;
      }
    };
    rows.sort((a, b) => {
      const va = valueOf(a);
      const vb = valueOf(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return rows;
  }, [allRows, query, sortKey, sortDir, searchMode]);

  const kpis = useMemo(() => {
    const active = filtered.filter((r) => computeStatus(r) === "active").length;
    const current = filtered.filter((r) => r.isCurrent).length;
    const revoked24h = filtered.filter(
      (r) =>
        computeStatus(r) === "revoked" &&
        safeDate(r.updatedAt) &&
        now().getTime() - safeDate(r.updatedAt).getTime() < 24 * 60 * 60 * 1000
    ).length;
    const lastActiveCurrent =
      filtered.find((r) => r.isCurrent)?.lastActiveAt || null;
    const otherDevices = Math.max(active - current, 0);
    return { active, current, revoked24h, otherDevices, lastActiveCurrent };
  }, [filtered]);

  /* --------------------------- selection helpers -------------------------- */
  const visibleIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleOne = (id, on) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  /* ------------------------------ mutations ------------------------------ */

  const revokeByIds = async (ids) => {
    if (!ids?.length) return;
    if (!confirm(`Revoke ${ids.length} session(s)?`)) return;
    try {
      const json = await fetchWithAuthAdmin({
        url: `/api/customers/sessions`,
        admin,
        token,
        method: "DELETE",
        payload: { sessionIds: ids },
      });
      if (!json?.success) throw new Error(json?.message || "Failed to revoke");
      showSuccess(`Revoked ${ids.length} session(s)`);
      clearSelection();
      await fetchPage(1, true);
    } catch (e) {
      showError(e?.message || "Failed to revoke");
    }
  };

  const revokeAllOthers = async () => {
    // We only proceed if we can identify the current session to avoid logging the user out of the current device.
    try {
      const params = new URLSearchParams({ status: "active", groupBy: "none" });
      const act = await fetchWithAuthAdmin({
        url: `/api/customers/sessions?${params.toString()}`,
        admin,
        token,
        method: "GET",
      });
      const activeRows = normalize(act);
      const hasCurrent = activeRows.some((r) => r.isCurrent);
      if (!hasCurrent) {
        showError(
          "Couldn't identify the current session. Please refresh and try again."
        );
        return;
      }
      const ids = activeRows.filter((r) => !r.isCurrent).map((r) => r.id);
      if (!ids.length) {
        showInfo("No other active sessions to revoke.");
        return;
      }
      const json = await fetchWithAuthAdmin({
        url: `/api/customers/sessions`,
        admin,
        token,
        method: "DELETE",
        payload: { sessionIds: ids },
      });
      if (!json?.success) throw new Error(json?.message || "Failed to revoke");
      showSuccess("Revoked other sessions");
      clearSelection();
      await fetchPage(1, true);
    } catch (e) {
      showError(e?.message || "Failed to revoke");
    }
  };

  const exportCSV = () => {
    const rows = filtered.filter((r) => selected.has(r.id));
    if (rows.length === 0) return;
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer-sessions-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ------------------------------- render -------------------------------- */

  const queryParamUsed =
    searchMode === "live" && query.trim() ? "q" : null;

  return (
    <SidebarWrapper>
      <Header
        title="Security · Customer Sessions"
        subtitle="Review where customer accounts are signed in and take action quickly."
        hideButton
      />

      {/* Live API search context box */}
      {searchMode === "live" && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 text-sky-900 p-3">
          <div className="text-sm font-medium mb-1">Live search context</div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge>Mode: Live API</Badge>
            <Badge>
              Status tab: <strong className="ml-1">{statusTab}</strong>
            </Badge>
            <Badge>
              Group:{" "}
              <strong className="ml-1">
                {groupByHolder ? "holder" : "none"}
              </strong>
            </Badge>
            <Badge>
              Page:{" "}
              <strong className="ml-1">
                {page}/{Math.max(totalPages, 1)}
              </strong>
            </Badge>
            <Badge>
              Query type:{" "}
              <strong className="ml-1">
                {queryType === "empty" ? "—" : queryType}
              </strong>
            </Badge>
            <Badge>
              Param: <strong className="ml-1">{queryParamUsed || "—"}</strong>
            </Badge>
            <span className="ml-auto flex items-center gap-2">
              <button
                className="btn btn-xs"
                onClick={() => setQuery("")}
                title="Clear query"
              >
                Clear query
              </button>
              <button
                className="btn btn-xs btn-primary-third"
                onClick={() => setSearchMode("local")}
                title="Switch to local search"
              >
                Use Local
              </button>
            </span>
          </div>
          {query && (
            <div className="mt-2 text-xs">
              Query:{" "}
              <code className="px-1 py-0.5 bg-white rounded">{query}</code>
            </div>
          )}
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Active sessions" value={kpis.active} />
        <Kpi label="Other devices" value={kpis.otherDevices} />
        <Kpi label="Revoked (24h)" value={kpis.revoked24h} />
        <Kpi
          label="Current last active"
          value={kpis.lastActiveCurrent ? rel(kpis.lastActiveCurrent) : "—"}
        />
      </div>

      {/* Primary actions + search/filters */}
      <div className="bg-white border border-zinc-200 rounded p-3 mb-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 flex gap-2">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-2.5 text-zinc-400" />
              <input
                aria-label="Search sessions"
                className={`pl-9 ${inputStyles}`}
                placeholder={
                  searchMode === "live"
                    ? "Type to live-search (email, IP, token, device)…"
                    : "Search locally (email, IP, token, device)…"
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchMode === "live") {
                    fetchPage(1, true);
                  }
                }}
              />
            </div>
            {searchMode === "live" && (
              <button
                onClick={() => {
                  setQuery(query);
                  fetchPage(1, true);
                }}
                className="btn btn-primary px-4"
                aria-label="Search"
              >
                <FiSearch />
              </button>
            )}
          </div>
          <Dropdown
            options={[
              { value: "local", label: "Local (in‑memory)" },
              { value: "live", label: "Live API" },
            ]}
            value={searchMode}
            onChange={setSearchMode}
            size="sm"
            position="bottom"
          />
          <div className="flex gap-1">
            <button
              onClick={revokeAllOthers}
              className="btn btn-sm btn-primary-third gap-2"
              title="Keep current session and sign out elsewhere"
            >
              <FiPower />
              Sign out of other devices
            </button>
            <button
              onClick={() => fetchPage(1, true)}
              className="btn btn-sm btn-primary gap-2"
              title="Refresh"
            >
              <FiRefreshCw />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs & secondary controls */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Tabs value={statusTab} onChange={setStatusTab} />
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Dropdown
                options={[
                  { value: "lastActiveAt:desc", label: "Last active  ↓" },
                  { value: "lastActiveAt:asc", label: "Last active  ↑" },
                  { value: "startedAt:desc", label: "Started  ↓" },
                  { value: "startedAt:asc", label: "Started  ↑" },
                  { value: "expiresAt:asc", label: "Expires  ↑" },
                  { value: "expiresAt:desc", label: "Expires  ↓" },
                  { value: "holder:asc", label: "Email A→Z" },
                  { value: "holder:desc", label: "Email Z→A" },
                ]}
                value={`${sortKey}:${sortDir}`}
                onChange={(value) => {
                  const [k, d] = value.split(":");
                  setSortKey(k);
                  setSortDir(d);
                }}
                size="sm"
                position="bottom"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <div
                onClick={() => setGroupByHolder(!groupByHolder)}
                className={`h-6 rounded-sm border cursor-pointer transition-all duration-200 center-flex gap-2 px-2 py-1 text-xs ${
                  groupByHolder
                    ? "bg-primary border-primary text-white"
                    : "border-zinc-300 hover:border-primary text-primary"
                }`}
              >
                {groupByHolder && (
                  <svg
                    className="w-4 h-4"
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
                Group by account
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div
          className="sticky top-2 z-10 bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 mb-3 flex items-center gap-2"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="px-2 py-1 rounded-sm text-primary text-xs">
            {selected.size} Selected
          </span>
          <button
            onClick={() => revokeByIds(Array.from(selected))}
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-red-500 hover:bg-red-600"
          >
            <FiTrash2 />
            Revoke selected
          </button>
          <button
            onClick={exportCSV}
            className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-zinc-500 hover:bg-zinc-600"
          >
            <FiDownload />
            Export CSV
          </button>
          <button
            onClick={clearSelection}
            className="btn btn-xs hover:bg-amber-200 ml-auto text-xs text-amber-900/70 hover:underline rounded-sm"
          >
            Clear
          </button>
        </div>
      )}

      {/* Content */}
      {error ? (
        <div className="border border-rose-200 bg-rose-50 text-rose-800 rounded p-4">
          <FiAlertTriangle className="inline mr-2" />
          {error}
        </div>
      ) : loading && allRows.length === 0 ? (
        <Skeleton />
      ) : filtered.length === 0 ? (
        <Empty onRefresh={() => fetchPage(1, true)} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <SessionsTable
              rows={filtered}
              groupByHolder={groupByHolder}
              selected={selected}
              onToggleOne={toggleOne}
              onToggleAllVisible={toggleSelectAllVisible}
              allVisibleSelected={allVisibleSelected}
              onRevokeOne={(id) => revokeByIds([id])}
              onOpenDetails={(session) => setDetails(session)}
            />
          </div>

          {/* Mobile cards */}
          <div className="md:hidden">
            <SessionsCards
              rows={filtered}
              groupByHolder={groupByHolder}
              selected={selected}
              onToggleOne={toggleOne}
              onRevokeOne={(id) => revokeByIds([id])}
              onOpenDetails={(session) => setDetails(session)}
            />
          </div>

          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => fetchPage(page + 1, false)}
                className="text-sm px-4 py-2 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
              >
                Load more ({page}/{totalPages})
              </button>
            </div>
          )}
        </>
      )}

      {/* Details Modal */}
      {details && (
        <DetailsModal
          session={details}
          onClose={() => setDetails(null)}
          onRevoke={() => {
            setDetails(null);
            revokeByIds([details.id]);
          }}
        />
      )}
    </SidebarWrapper>
  );
}

/* ------------------------------ components ------------------------------ */

function Badge({ children }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-sky-300 bg-white text-sky-900">
      {children}
    </span>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3">
      <p className="text-xs uppercase text-zinc-500 font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function Tabs({ value, onChange }) {
  const items = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "revoked", label: "Revoked" },
    { key: "expired", label: "Expired" },
  ];
  return (
    <div className="inline-flex rounded border border-zinc-300 overflow-hidden">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={`text-sm px-3 py-1.5 transition-all ${
            value === it.key
              ? "bg-primary text-white"
              : "bg-white text-zinc-800 hover:bg-zinc-100"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-20 bg-zinc-100 animate-pulse rounded border border-zinc-200"
        />
      ))}
    </div>
  );
}

function Empty({ onRefresh }) {
  return (
    <div className="text-center py-20 border border-zinc-200 rounded bg-white">
      <p className="text-zinc-800 font-medium">
        No sessions match your filters
      </p>
      <p className="text-sm text-zinc-600 mt-1">
        Try clearing the search or switching tabs.
      </p>
      <button
        onClick={onRefresh}
        className="mt-4 text-sm px-3 py-2 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
      >
        <FiRefreshCw className="inline mr-1" />
        Refresh
      </button>
    </div>
  );
}

/* ---------- TABLE (groupable) with row click -> modal ---------- */

function SessionsTable({
  rows,
  groupByHolder,
  selected,
  onToggleOne,
  onToggleAllVisible,
  allVisibleSelected,
  onRevokeOne,
  onOpenDetails,
}) {
  const grouped = useMemo(() => {
    if (!groupByHolder) return { All: rows };
    return rows.reduce((acc, r) => {
      (acc[r.holder] = acc[r.holder] || []).push(r);
      return acc;
    }, {});
  }, [rows, groupByHolder]);

  return (
    <div className="border border-zinc-200 rounded overflow-hidden">
      <table className="w-full border-collapse">
        <thead className="bg-zinc-50 sticky top-0 z-[1] border-b border-zinc-200">
          <tr>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2 w-10">
              <Checkbox
                selected={allVisibleSelected}
                onChange={onToggleAllVisible}
              />
            </th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">
              Account
            </th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">
              Device
            </th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">
              Last active
            </th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">
              Status
            </th>
            <th className="px-3 py-2 w-40" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {Object.entries(grouped).map(([holder, items]) => (
            <GroupSection
              key={holder}
              holder={holder}
              items={items}
              selected={selected}
              onToggleOne={onToggleOne}
              onRevokeOne={onRevokeOne}
              onOpenDetails={onOpenDetails}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupSection({
  holder,
  items,
  selected,
  onToggleOne,
  onRevokeOne,
  onOpenDetails,
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <tr className="bg-zinc-100">
        <td colSpan={7} className="px-3 py-2 text-sm text-zinc-700">
          <button
            className="inline-flex items-center gap-1 mr-2"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <FiChevronDown /> : <FiChevronRight />}
            <span className="font-medium">{holder}</span>
            <span className="text-zinc-500">· {items.length} session(s)</span>
          </button>
        </td>
      </tr>
      {open &&
        items.map((r) => {
          const st = computeStatus(r);
          const { device } = parseUA(r.userAgent);
          return (
            <tr
              key={r.id}
              className="w-full hover:bg-zinc-50 cursor-pointer"
              onClick={() => onOpenDetails(r)}
            >
              <td
                className="px-3 py-2 align-top"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  selected={selected.has(r.id)}
                  onChange={() => onToggleOne(r.id, !selected.has(r.id))}
                />
              </td>
              <td className="px-3 py-2 align-top">
                <div className="text-sm text-zinc-900">{r.holder}</div>
                <div className="text-xs text-zinc-500">
                  role: {r.holderRole} · {r.actorType}
                </div>
                {r.isCurrent && (
                  <div className="mt-1">{statusChip("current")}</div>
                )}
              </td>
              <td className="px-3 py-2 align-top">
                <div className="text-sm text-zinc-900">{device}</div>
              </td>
              <td className="px-3 py-2 align-top text-sm">
                <div>{formatDate(r.lastActiveAt)}</div>
                <div className="text-xs text-zinc-500">
                  {rel(r.lastActiveAt)}
                </div>
              </td>
              <td className="px-3 py-2 align-top">{statusChip(st)}</td>
              <td
                className="px-3 py-2 align-top"
                onClick={(e) => e.stopPropagation()}
              >
                <RowActions session={r} onRevokeOne={onRevokeOne} />
              </td>
            </tr>
          );
        })}
    </>
  );
}

function RowActions({ session, onRevokeOne }) {
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      alert("Copy failed");
    }
  };

  const disabled = session.isCurrent || computeStatus(session) !== "active";

  const options = [
    {
      value: "copy",
      label: (
        <span className="flex items-center gap-2">
          <FiCopy className="text-zinc-500" />
          Copy Token ID
        </span>
      ),
    },
    {
      value: "revoke",
      label: (
        <span className="flex items-center gap-2">
          <FiTrash2 className={disabled ? "text-zinc-400" : "text-rose-500"} />
          Revoke
        </span>
      ),
    },
  ];

  const handleChange = (value) => {
    if (value === "copy") {
      copy(session.jti);
    } else if (value === "revoke" && !disabled) {
      onRevokeOne(session.id);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Dropdown
        options={options}
        value={null}
        onChange={handleChange}
        position="top-right"
        size="sm"
        placeholder="Actions"
      />
    </div>
  );
}

/* ------------------------------- CARDS --------------------------------- */

function SessionsCards({
  rows,
  groupByHolder,
  selected,
  onToggleOne,
  onRevokeOne,
  onOpenDetails,
}) {
  const grouped = useMemo(() => {
    if (!groupByHolder) return { All: rows };
    return rows.reduce((acc, r) => {
      (acc[r.holder] = acc[r.holder] || []).push(r);
      return acc;
    }, {});
  }, [rows, groupByHolder]);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([holder, items]) => (
        <div key={holder}>
          <div className="text-sm font-medium text-zinc-700 mb-2">
            {holder} · {items.length} session(s)
          </div>
          <div className="grid grid-cols-1 gap-3">
            {items.map((r) => {
              const st = computeStatus(r);
              const { device } = parseUA(r.userAgent);
              return (
                <div
                  key={r.id}
                  className="border border-zinc-200 rounded-lg p-3 bg-white cursor-pointer"
                  onClick={() => onOpenDetails(r)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <label
                      className="inline-flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={(e) => onToggleOne(r.id, e.target.checked)}
                      />
                      <div>
                        <div className="text-sm text-zinc-900">{device}</div>
                        <div className="text-xs text-zinc-500">
                          {r.holder} · {r.holderRole}
                        </div>
                      </div>
                    </label>
                    <div>{statusChip(st)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    <Cell label="IP" value={r.ip || "—"} />
                    <Cell
                      label="Last Active"
                      value={formatDate(r.lastActiveAt)}
                    />
                  </div>

                  <div className="flex items-center gap-2 mt-3 justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard
                          .writeText(r.jti)
                          .catch(() => alert("Copy failed"));
                      }}
                      className="text-xs px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
                    >
                      <FiCopy className="inline mr-1" />
                      Copy Token
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRevokeOne(r.id);
                      }}
                      disabled={r.isCurrent || computeStatus(r) !== "active"}
                      className={`text-xs px-2 py-1 rounded border ${
                        r.isCurrent || computeStatus(r) !== "active"
                          ? "border-zinc-200 text-zinc-400 cursor-not-allowed"
                          : "border-rose-300 text-rose-700 bg-white hover:bg-rose-50"
                      }`}
                    >
                      <FiTrash2 className="inline mr-1" />
                      Revoke
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Cell({ label, value }) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded p-2">
      <p className="text-[10px] font-semibold text-zinc-500 uppercase">
        {label}
      </p>
      <p className="text-xs text-zinc-800 break-all">{value ?? "—"}</p>
    </div>
  );
}

/* ---------------------------- DETAILS MODAL ---------------------------- */

function DetailsModal({ session, onClose, onRevoke }) {
  const s = session;
  const st = computeStatus(s);
  const ua = parseUA(s.userAgent);

  // close on Esc
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-[92vw] max-w-2xl bg-white rounded-xl border border-zinc-200 shadow-xl p-4 md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Session details
            </h2>
            <p className="text-sm text-zinc-600">{s.holder}</p>
          </div>
          <button
            className="p-2 rounded hover:bg-zinc-100"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {statusChip(st)}
          {s.isCurrent && statusChip("current")}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <Detail label="Device" value={ua.device} />
          <Detail label="IP" value={s.ip || "—"} copyable />
          <Detail label="Token ID" value={s.jti || "—"} copyable mono />
          <Detail label="Actor" value={`${s.actorType || "—"}`} />
          <Detail label="Role" value={s.holderRole || "—"} />
          <Detail
            label="Customer ID"
            value={s.customerId || "—"}
            copyable
            mono
          />
          <Detail label="Started" value={formatDate(s.startedAt)} />
          <Detail label="Last Active" value={formatDate(s.lastActiveAt)} />
          <Detail label="Expires" value={formatDate(s.expiresAt)} />
          {s.endedAt && <Detail label="Ended" value={formatDate(s.endedAt)} />}
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase mb-1">
            User Agent
          </p>
          <div className="text-xs text-zinc-700 break-all bg-zinc-50 border border-zinc-200 rounded p-2">
            {s.userAgent || "—"}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            className="text-sm px-3 py-2 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
            onClick={onClose}
          >
            Close
          </button>
          <button
            onClick={onRevoke}
            disabled={s.isCurrent || computeStatus(s) !== "active"}
            className={`text-sm px-3 py-2 rounded border ${
              s.isCurrent || computeStatus(s) !== "active"
                ? "border-zinc-200 text-zinc-400 cursor-not-allowed"
                : "border-rose-300 text-rose-700 bg-white hover:bg-rose-50"
            }`}
          >
            <FiTrash2 className="inline mr-1" />
            Revoke this session
          </button>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, copyable = false, mono = false }) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded p-3">
      <p className="text-[10px] font-semibold text-zinc-500 uppercase">
        {label}
      </p>
      <div className={`text-sm text-zinc-800 ${mono ? "font-mono" : ""}`}>
        {value ?? "—"}
      </div>
      {copyable && value ? (
        <button
          onClick={() =>
            navigator.clipboard.writeText(String(value)).catch(() => {})
          }
          className="mt-2 text-xs px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
        >
          <FiCopy className="inline mr-1" />
          Copy
        </button>
      ) : null}
    </div>
  );
}
