"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import SidebarWrapper from "@/components/SidebarWrapper";
import Header from "@/components/Header";
import { fetchWithAuthAdmin } from "@/helpers/front-end/request";
import useAdminStore from "@/store/useAdminStore";
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
  FiUser,
  FiEdit2,
  FiMail,
  FiClock,
  FiCheck,
  FiXCircle,
} from "react-icons/fi";
import { Checkbox, inputStyles, MiniCard, TabToggle } from "@/presets/styles";
import { Dropdown } from "@/components/Dropdown";
import { motion, AnimatePresence } from "framer-motion";

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

const statusChip = (status) => {
  const map = {
    active: "text-emerald-700 bg-emerald-50 border-emerald-200",
    inactive: "text-rose-700 bg-rose-50 border-rose-200",
    subscribed: "text-sky-700 bg-sky-50 border-sky-200",
    unsubscribed: "text-amber-800 bg-amber-50 border-amber-200",
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

/* Infer query type for "Live API" context */
const inferQueryType = (q) => {
  const s = (q || "").trim();
  if (!s) return "empty";
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  if (email) return "email";
  return "text";
};

/* Normalize server response */
const normalize = (json) => {
  const contacts = Array.isArray(json?.data) ? json.data : [];
  return contacts.map((contact) => ({
    id: contact._id,
    raw: contact,
    fullName: contact.fullName || "",
    email: contact.email || "",
    isActive: contact.isActive || false,
    status: contact.isActive ? "active" : "inactive",
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
    lastActivityAt: contact.lastActivityAt,
    lists: contact.listAssociations || [],
    automations: contact.automationAssociations || [],
    engagement: contact.engagementHistory || {
      totalEmailsSent: 0,
      totalEmailsOpened: 0,
      openRate: 0,
      clickRate: 0,
    },
    source: contact.source || "unknown",
  }));
};

const toCSV = (rows) => {
  const headers = [
    "fullName",
    "email",
    "status",
    "lists",
    "source",
    "createdAt",
    "lastActivityAt",
    "emailsSent",
    "emailsOpened",
    "openRate",
    "clickRate",
  ];
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    const listNames = r.lists.map((l) => l.listId?.name || "Unknown").join(";");
    const cells = [
      r.fullName,
      r.email,
      r.status,
      listNames,
      r.source,
      r.createdAt,
      r.lastActivityAt,
      r.engagement.totalEmailsSent,
      r.engagement.totalEmailsOpened,
      r.engagement.openRate,
      r.engagement.clickRate,
    ].map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`);
    lines.push(cells.join(","));
  });
  return lines.join("\n");
};

/* ------------------------------- page ---------------------------------- */

export default function ContactsManagementPage() {
  const { admin, token } = useAdminStore();
  const { showSuccess, showError, showInfo } = useToastStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [raw, setRaw] = useState([]);

  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState("all"); // all|active|inactive
  const [groupByList, setGroupByList] = useState(true);
  const [sortKey, setSortKey] = useState("updatedAt"); // updatedAt|createdAt|fullName|email
  const [sortDir, setSortDir] = useState("desc"); // asc|desc
  const [details, setDetails] = useState(null);
  const [searchMode, setSearchMode] = useState("local"); // "local" | "live"
  const [selected, setSelected] = useState(new Set());
  const [lists, setLists] = useState([]);

  const hasMore = page < totalPages;
  const queryType = useMemo(() => inferQueryType(query), [query]);

  const fetchLists = useCallback(async () => {
    try {
      const json = await fetchWithAuthAdmin({
        url: `/api/list`,
        admin,
        token,
        method: "GET",
      });
      if (json?.success) {
        setLists(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch lists", e);
    }
  }, [admin, token]);

  const fetchPage = useCallback(
    async (p = 1, replace = false) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: "20",
          sortBy: sortKey,
          sortDir,
        });

        if (statusTab !== "all") {
          params.set("isActive", statusTab === "active" ? "true" : "false");
        }

        if (searchMode === "live" && query.trim()) {
          params.set("search", query.trim());
        }

        const json = await fetchWithAuthAdmin({
          url: `/api/contact?${params.toString()}`,
          admin,
          token,
          method: "GET",
        });

        if (!json?.success) {
          throw new Error(json?.message || "Failed to fetch contacts");
        }

        const rows = normalize(json);
        const pagination = json?.pagination || { page: p, totalPages: 1 };

        setRaw((prev) => (replace ? rows : [...prev, ...rows]));
        setPage(pagination.page || p);
        setTotalPages(pagination.totalPages || 1);

        if (json.message) showInfo(json.message);
      } catch (e) {
        console.error(e);
        setError(e?.message || "Failed to fetch contacts");
      } finally {
        setLoading(false);
      }
    },
    [admin, token, showInfo, sortKey, sortDir, statusTab, searchMode, query]
  );

  useEffect(() => {
    fetchPage(1, true);
    fetchLists();
  }, []);

  useEffect(() => {
    setSelected(new Set());
    setRaw([]);
    setPage(1);
    setTotalPages(1);
    fetchPage(1, true);
  }, [statusTab]);

  useEffect(() => {
    setRaw([]);
    setPage(1);
    setTotalPages(1);
    if (searchMode === "live") fetchPage(1, true);
  }, [searchMode]);

  useEffect(() => {
    if (searchMode !== "live") return;
    const t = setTimeout(() => fetchPage(1, true), 400);
    return () => clearTimeout(t);
  }, [query, searchMode]);

  const allRows = useMemo(() => raw, [raw]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows =
      searchMode === "local"
        ? allRows.filter((r) => {
            const inText =
              !q ||
              r.fullName?.toLowerCase().includes(q) ||
              r.email?.toLowerCase().includes(q) ||
              r.source?.toLowerCase().includes(q);
            return inText;
          })
        : allRows;

    const dir = sortDir === "asc" ? 1 : -1;
    const valueOf = (r) => {
      switch (sortKey) {
        case "fullName":
          return r.fullName?.toLowerCase() || "";
        case "email":
          return r.email?.toLowerCase() || "";
        case "createdAt":
          return safeDate(r.createdAt)?.getTime() || 0;
        default:
          return safeDate(r.updatedAt)?.getTime() || 0;
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
    const active = filtered.filter((r) => r.isActive).length;
    const inactive = filtered.filter((r) => !r.isActive).length;
    const subscribed = filtered.filter((r) => 
      r.lists.some(list => list.status === "subscribed")
    ).length;
    const unsubscribed = filtered.filter((r) => 
      r.lists.some(list => list.status === "unsubscribed")
    ).length;
    
    return { active, inactive, subscribed, unsubscribed };
  }, [filtered]);

  const visibleIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

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

  const deleteByIds = async (ids, hardDelete = false) => {
    if (!ids?.length) return;
    if (!confirm(`Delete ${ids.length} contact(s)?`)) return;
    try {
      const promises = ids.map(id => 
        fetchWithAuthAdmin({
          url: `/api/contact?contactId=${id}&hardDelete=${hardDelete}`,
          admin,
          token,
          method: "DELETE",
        })
      );
      
      const results = await Promise.all(promises);
      const failed = results.filter(r => !r?.success);
      
      if (failed.length === 0) {
        showSuccess(`Deleted ${ids.length} contact(s)`);
        clearSelection();
        await fetchPage(1, true);
      } else {
        throw new Error(`${failed.length} deletions failed`);
      }
    } catch (e) {
      showError(e?.message || "Failed to delete contacts");
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
    a.download = `contacts-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const queryParamUsed = searchMode === "live" && query.trim() ? "search" : null;

  return (
    <SidebarWrapper>
      <Header
        title="Contacts"
        subtitle="Manage all your contacts in one place."
        buttonLabel="Add Contact"
        onButtonClick={() => {/* Add contact modal logic here */}}
      />

      {searchMode === "live" && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 text-sky-900 p-3">
          <div className="text-sm font-medium mb-1">Live search context</div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge>Mode: Live API</Badge>
            <Badge>
              Status tab: <strong className="ml-1">{statusTab}</strong>
            </Badge>
            <Badge>
              Group: <strong className="ml-1">{groupByList ? "list" : "none"}</strong>
            </Badge>
            <Badge>
              Page: <strong className="ml-1">{page}/{Math.max(totalPages, 1)}</strong>
            </Badge>
            <Badge>
              Query type: <strong className="ml-1">{queryType === "empty" ? "—" : queryType}</strong>
            </Badge>
            <Badge>
              Param: <strong className="ml-1">{queryParamUsed || "—"}</strong>
            </Badge>
            <span className="ml-auto flex items-center gap-2">
              <button className="btn btn-xs" onClick={() => setQuery("")} title="Clear query">
                Clear query
              </button>
              <button className="btn btn-xs btn-primary-third" onClick={() => setSearchMode("local")} title="Switch to local search">
                Use Local
              </button>
            </span>
          </div>
          {query && (
            <div className="mt-2 text-xs">
              Query: <code className="px-1 py-0.5 bg-white rounded">{query}</code>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MiniCard size="md" title="Active contacts" subLine={kpis.active} />
        <MiniCard size="md" title="Inactive contacts" subLine={kpis.inactive} />
        <MiniCard size="md" title="Subscribed" subLine={kpis.subscribed} />
        <MiniCard size="md" title="Unsubscribed" subLine={kpis.unsubscribed} />
      </div>

      <div className="bg-white border border-zinc-200 rounded p-3 mb-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 flex gap-2">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-2.5 text-zinc-400" />
              <input
                aria-label="Search contacts"
                className={`pl-9 ${inputStyles}`}
                placeholder={searchMode === "live" ? "Type to live-search (name, email)…" : "Search locally (name, email)…"}
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
              <button onClick={() => fetchPage(1, true)} className="btn btn-primary px-4" aria-label="Search">
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
            <button onClick={() => fetchPage(1, true)} className="btn btn-sm btn-primary gap-2" title="Refresh">
              <FiRefreshCw />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <TabToggle
            currentTab={statusTab}
            setCurrentTab={setStatusTab}
            TabToggleOptions={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Dropdown
                options={[
                  { value: "updatedAt:desc", label: "Last updated  ↓" },
                  { value: "updatedAt:asc", label: "Last updated  ↑" },
                  { value: "createdAt:desc", label: "Created  ↓" },
                  { value: "createdAt:asc", label: "Created  ↑" },
                  { value: "fullName:asc", label: "Name A→Z" },
                  { value: "fullName:desc", label: "Name Z→A" },
                  { value: "email:asc", label: "Email A→Z" },
                  { value: "email:desc", label: "Email Z→A" },
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
                onClick={() => setGroupByList(!groupByList)}
                className={`h-6 rounded-sm border cursor-pointer transition-all duration-200 center-flex gap-2 px-2 py-1 text-xs            
                ${
                  groupByList
                    ? "bg-primary border-primary text-white"
                    : "border-zinc-300 hover:border-primary text-primary"
                }`}
              >
                {groupByList && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Group by list
              </div>
            </label>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 mb-3 flex items-center gap-2" role="region" aria-label="Bulk actions">
          <span className="px-2 py-1 rounded-sm text-primary text-xs">{selected.size} Selected</span>
          <button onClick={() => deleteByIds(Array.from(selected), false)} className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-red-500 hover:bg-red-600">
            <FiTrash2 />
            Delete selected (soft)
          </button>
          <button onClick={() => deleteByIds(Array.from(selected), true)} className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-red-500 hover:bg-red-600">
            <FiTrash2 />
            Delete selected (hard)
          </button>
          <button onClick={exportCSV} className="btn px-2 py-1 rounded-sm text-white text-xs center-flex gap-2 bg-zinc-500 hover:bg-zinc-600">
            <FiDownload />
            Export CSV
          </button>
          <button onClick={clearSelection} className="btn btn-xs hover:bg-amber-200 ml-auto text-xs text-amber-900/70 hover:underline rounded-sm">
            Clear
          </button>
        </div>
      )}

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
          <div className="hidden md:block">
            <ContactsTable
              rows={filtered}
              groupByList={groupByList}
              selected={selected}
              onToggleOne={toggleOne}
              onToggleAllVisible={toggleSelectAllVisible}
              allVisibleSelected={allVisibleSelected}
              onDeleteOne={(id) => deleteByIds([id], false)}
              onOpenDetails={(contact) => setDetails(contact)}
            />
          </div>

          <div className="md:hidden">
            <ContactsCards
              rows={filtered}
              groupByList={groupByList}
              selected={selected}
              onToggleOne={toggleOne}
              onDeleteOne={(id) => deleteByIds([id], false)}
              onOpenDetails={(contact) => setDetails(contact)}
            />
          </div>

          {hasMore && (
            <div className="flex justify-center mt-4">
              <button onClick={() => fetchPage(page + 1, false)} className="text-sm px-4 py-2 border border-zinc-300 rounded bg-white hover:bg-zinc-50">
                Load more ({page}/{totalPages})
              </button>
            </div>
          )}
        </>
      )}

      {details && (
        <DetailsModal
          contact={details}
          onClose={() => setDetails(null)}
          onDelete={() => {
            setDetails(null);
            deleteByIds([details.id], false);
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

function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-20 bg-zinc-100 animate-pulse rounded border border-zinc-200" />
      ))}
    </div>
  );
}

function Empty({ onRefresh }) {
  return (
    <div className="text-center py-20 border border-zinc-200 rounded bg-white">
      <p className="text-zinc-800 font-medium">No contacts match your filters</p>
      <p className="text-sm text-zinc-600 mt-1">Try clearing the search or switching tabs.</p>
      <button onClick={onRefresh} className="mt-4 text-sm px-3 py-2 border border-zinc-300 rounded bg-white hover:bg-zinc-50">
        <FiRefreshCw className="inline mr-1" />
        Refresh
      </button>
    </div>
  );
}

/* ---------- CONTACTS TABLE ---------- */

function ContactsTable({
  rows,
  groupByList,
  selected,
  onToggleOne,
  onToggleAllVisible,
  allVisibleSelected,
  onDeleteOne,
  onOpenDetails,
}) {
  const grouped = useMemo(() => {
    if (!groupByList) return { All: rows };
    return rows.reduce((acc, r) => {
      const listNames = r.lists.map(l => l.listId?.name || "No List").join(", ");
      (acc[listNames] = acc[listNames] || []).push(r);
      return acc;
    }, {});
  }, [rows, groupByList]);

  return (
    <div className="border border-zinc-200 rounded overflow-hidden">
      <table className="w-full border-collapse">
        <thead className="bg-zinc-50 sticky top-0 z-[1] border-b border-zinc-200">
          <tr>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2 w-10">
              <Checkbox selected={allVisibleSelected} onChange={onToggleAllVisible} />
            </th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">Contact</th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">Lists</th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">Last activity</th>
            <th className="text-left text-xs font-semibold text-zinc-600 uppercase px-3 py-2">Status</th>
            <th className="px-3 py-2 w-40" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {Object.entries(grouped).map(([listName, items]) => (
            <GroupSection
              key={listName}
              listName={listName}
              items={items}
              selected={selected}
              onToggleOne={onToggleOne}
              onDeleteOne={onDeleteOne}
              onOpenDetails={onOpenDetails}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupSection({
  listName,
  items,
  selected,
  onToggleOne,
  onDeleteOne,
  onOpenDetails,
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <tr className="bg-zinc-100">
        <td colSpan={7} className="px-3 py-2 text-sm text-zinc-700">
          <button className="inline-flex items-center gap-1 mr-2" onClick={() => setOpen((o) => !o)}>
            {open ? <FiChevronDown /> : <FiChevronRight />}
            <span className="font-medium">{listName}</span>
            <span className="text-zinc-500">· {items.length} contact(s)</span>
          </button>
        </td>
      </tr>
      {open &&
        items.map((r) => {
          return (
            <tr key={r.id} className="w-full hover:bg-zinc-50 cursor-pointer" onClick={() => onOpenDetails(r)}>
              <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                <Checkbox selected={selected.has(r.id)} onChange={() => onToggleOne(r.id, !selected.has(r.id))} />
              </td>
              <td className="px-3 py-2 align-top">
                <div className="text-sm text-zinc-900">{r.fullName}</div>
                <div className="text-xs text-zinc-500">{r.email}</div>
              </td>
              <td className="px-3 py-2 align-top">
                <div className="text-sm text-zinc-900">
                  {r.lists.map(l => l.listId?.name || "Unknown").join(", ") || "No lists"}
                </div>
              </td>
              <td className="px-3 py-2 align-top text-sm">
                <div>{formatDate(r.lastActivityAt)}</div>
                <div className="text-xs text-zinc-500">{rel(r.lastActivityAt)}</div>
              </td>
              <td className="px-3 py-2 align-top">{statusChip(r.status)}</td>
              <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                <RowActions contact={r} onDeleteOne={onDeleteOne} />
              </td>
            </tr>
          );
        })}
    </>
  );
}

function RowActions({ contact, onDeleteOne }) {
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      alert("Copy failed");
    }
  };

  const options = [
    {
      value: "copy",
      label: (
        <span className="flex items-center gap-2">
          <FiCopy className="text-zinc-500" />
          Copy Email
        </span>
      ),
    },
    {
      value: "delete",
      label: (
        <span className="flex items-center gap-2">
          <FiTrash2 className="text-rose-500" />
          Delete
        </span>
      ),
    },
  ];

  const handleChange = (value) => {
    if (value === "copy") {
      copy(contact.email);
    } else if (value === "delete") {
      onDeleteOne(contact.id);
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

function ContactsCards({
  rows,
  groupByList,
  selected,
  onToggleOne,
  onDeleteOne,
  onOpenDetails,
}) {
  const grouped = useMemo(() => {
    if (!groupByList) return { All: rows };
    return rows.reduce((acc, r) => {
      const listNames = r.lists.map(l => l.listId?.name || "No List").join(", ");
      (acc[listNames] = acc[listNames] || []).push(r);
      return acc;
    }, {});
  }, [rows, groupByList]);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([listName, items]) => (
        <div key={listName}>
          <div className="text-sm font-medium text-zinc-700 mb-2">
            {listName} · {items.length} contact(s)
          </div>
          <div className="grid grid-cols-1 gap-3">
            {items.map((r) => {
              return (
                <div key={r.id} className="border border-zinc-200 rounded-lg p-3 bg-white cursor-pointer" onClick={() => onOpenDetails(r)}>
                  <div className="flex items-start justify-between gap-3">
                    <label className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={(e) => onToggleOne(r.id, e.target.checked)}
                      />
                      <div>
                        <div className="text-sm text-zinc-900">{r.fullName}</div>
                        <div className="text-xs text-zinc-500">{r.email}</div>
                      </div>
                    </label>
                    <div>{statusChip(r.status)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    <Cell label="Lists" value={r.lists.map(l => l.listId?.name || "Unknown").join(", ") || "No lists"} />
                    <Cell label="Last Activity" value={formatDate(r.lastActivityAt)} />
                  </div>

                  <div className="flex items-center gap-2 mt-3 justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(r.email).catch(() => alert("Copy failed"));
                      }}
                      className="text-xs px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
                    >
                      <FiCopy className="inline mr-1" />
                      Copy Email
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteOne(r.id);
                      }}
                      className="text-xs px-2 py-1 rounded border border-rose-300 text-rose-700 bg-white hover:bg-rose-50"
                    >
                      <FiTrash2 className="inline mr-1" />
                      Delete
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
      <p className="text-[10px] font-semibold text-zinc-500 uppercase">{label}</p>
      <p className="text-xs text-zinc-800 break-all">{value ?? "—"}</p>
    </div>
  );
}

/* ---------------------------- DETAILS MODAL ---------------------------- */

function DetailsModal({ contact, onClose, onDelete }) {
  const c = contact;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-[92vw] max-w-2xl bg-white rounded-xl border border-zinc-200 shadow-xl p-4 md:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Contact details</h2>
            <p className="text-sm text-zinc-600">{c.email}</p>
          </div>
          <button className="p-2 rounded hover:bg-zinc-100" onClick={onClose} aria-label="Close">
            <FiX />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {statusChip(c.status)}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <Detail label="Full Name" value={c.fullName} />
          <Detail label="Email" value={c.email} copyable />
          <Detail label="Source" value={c.source} />
          <Detail label="Created" value={formatDate(c.createdAt)} />
          <Detail label="Last Updated" value={formatDate(c.updatedAt)} />
          <Detail label="Last Activity" value={formatDate(c.lastActivityAt)} />
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase mb-1">Lists</p>
          <div className="space-y-2">
            {c.lists.length > 0 ? c.lists.map((list, index) => (
              <div key={index} className="text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded p-2">
                {list.listId?.name || "Unknown"} - {list.status || "unknown"}
              </div>
            )) : (
              <div className="text-xs text-zinc-500 italic">No lists</div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase mb-1">Engagement</p>
          <div className="grid grid-cols-2 gap-2">
            <Detail label="Emails Sent" value={c.engagement.totalEmailsSent} />
            <Detail label="Emails Opened" value={c.engagement.totalEmailsOpened} />
            <Detail label="Open Rate" value={`${c.engagement.openRate}%`} />
            <Detail label="Click Rate" value={`${c.engagement.clickRate}%`} />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button className="text-sm px-3 py-2 border border-zinc-300 rounded bg-white hover:bg-zinc-50" onClick={onClose}>
            Close
          </button>
          <button
            onClick={onDelete}
            className="text-sm px-3 py-2 rounded border border-rose-300 text-rose-700 bg-white hover:bg-rose-50"
          >
            <FiTrash2 className="inline mr-1" />
            Delete this contact
          </button>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, copyable = false }) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded p-3">
      <p className="text-[10px] font-semibold text-zinc-500 uppercase">{label}</p>
      <div className="text-sm text-zinc-800">{value ?? "—"}</div>
      {copyable && value ? (
        <button
          onClick={() => navigator.clipboard.writeText(String(value)).catch(() => {})}
          className="mt-2 text-xs px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-50"
        >
          <FiCopy className="inline mr-1" />
          Copy
        </button>
      ) : null}
    </div>
  );
}