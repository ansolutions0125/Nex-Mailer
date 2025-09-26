"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import SidebarWrapper from "@/components/SidebarWrapper";
import Header from "@/components/Header";
import {
  fetchWithAuthAdmin,
  fetchWithAuthCustomer,
} from "@/helpers/front-end/request";
import useAdminStore from "@/store/useAdminStore";
import { useToastStore } from "@/store/useToastStore";
import { inputStyles } from "@/presets/styles";
import { Dropdown } from "@/components/Dropdown";
import useCustomerStore from "@/store/useCustomerStore";
import { FiSearch, FiTrash2, FiRefreshCw, FiCopy, FiX } from "react-icons/fi";

/* ------------------------------ utilities ------------------------------ */
const safeDate = (d) => (d ? new Date(d) : null);
const formatDate = (d) => (d ? new Date(d).toLocaleString() : "—");

const statusChip = (isActive) => {
  const map = {
    true: "text-emerald-700 bg-emerald-50 border-emerald-200",
    false: "text-rose-700 bg-rose-50 border-rose-200",
  };
  return (
    <span
      className={`text-xs border px-2 py-0.5 rounded ${
        map[isActive] ?? "border-zinc-200 text-zinc-600"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
};

/* ------------------------------ main page ------------------------------ */
export default function ContactsManagementPage() {
  const { admin, token: adminToken } = useAdminStore();
  const { customer, token: customerToken } = useCustomerStore();
  const { showSuccess, showError } = useToastStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState([]);

  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState("all"); // all|active|inactive
  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [details, setDetails] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({
    fullName: "",
    email: "",
    listId: "",
  });
  const [lists, setLists] = useState([]);

  const hasMore = page < totalPages;

  const fetchLists = useCallback(async () => {
    try {
      let json;
      if (customer && customer._id && customerToken) {
        json = await fetchWithAuthCustomer({
          url: `/api/list`,
          method: "GET",
          customer,
          token: customerToken,
        });
      } else if (admin && admin._id && adminToken) {
        json = await fetchWithAuthAdmin({
          url: `/api/list`,
          method: "GET",
          admin,
          token: adminToken,
        });
      }
      if (json?.success) setLists(json.data || []);
    } catch (e) {
      console.error("Failed to fetch lists", e);
    }
  }, [admin, adminToken, customer, customerToken]);

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
        if (query.trim()) {
          params.set("search", query.trim());
        }

        let json;
        if (customer && customer._id && customerToken) {
          json = await fetchWithAuthCustomer({
            url: `/api/contact/read?${params.toString()}`,
            method: "GET",
            customer,
            token: customerToken,
          });
        } else if (admin && admin._id && adminToken) {
          json = await fetchWithAuthAdmin({
            url: `/api/contact/read?${params.toString()}`,
            method: "GET",
            admin,
            token: adminToken,
          });
        }

        if (!json?.success)
          throw new Error(json?.message || "Failed to fetch contacts");

        const pagination = json?.pagination || { page: p, totalPages: 1 };
        setRows((prev) => (replace ? json.data : [...prev, ...json.data]));
        setPage(pagination.page || p);
        setTotalPages(pagination.totalPages || 1);
      } catch (e) {
        console.error(e);
        setError(e?.message || "Failed to fetch contacts");
      } finally {
        setLoading(false);
      }
    },
    [
      admin,
      adminToken,
      customer,
      customerToken,
      query,
      sortKey,
      sortDir,
      statusTab,
    ]
  );

  const saveNewContact = async () => {
    try {
      let json;
      if (customer && customer._id && customerToken) {
        json = await fetchWithAuthCustomer({
          url: `/api/contact/register`,
          method: "POST",
          customer,
          token: customerToken,
          payload: newContact,
        });
      } else if (admin && admin._id && adminToken) {
        json = await fetchWithAuthAdmin({
          url: `/api/contact/register`,
          method: "POST",
          admin,
          token: adminToken,
          payload: newContact,
        });
      }
      if (json?.success) {
        showSuccess("Contact added successfully");
        setShowAddModal(false);
        setNewContact({ fullName: "", email: "", listId: "" });
        fetchPage(1, true);
      } else {
        throw new Error(json?.message || "Failed to add contact");
      }
    } catch (e) {
      showError(e?.message || "Failed to add contact");
    }
  };

  useEffect(() => {
    fetchPage(1, true);
  }, [statusTab, sortKey, sortDir, query]);

  return (
    <SidebarWrapper>
      <Header
        title="Contacts"
        subtitle="Manage all your contacts in one place."
        buttonLabel="Add Contact"
        onButtonClick={() => {
          fetchLists();
          setShowAddModal(true);
        }}
      />

      <div className="bg-white border-b border-zinc-200 px-2 pb-1 mb-6">
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              aria-label="Search contacts"
              className={`pl-9 ${inputStyles}`}
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchPage(1, true);
              }}
            />
          </div>
          <Dropdown
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            value={statusTab}
            onChange={setStatusTab}
            position="bottom"
          />
          <Dropdown
            options={[
              { value: "updatedAt:desc", label: "Last updated ↓" },
              { value: "updatedAt:asc", label: "Last updated ↑" },
              { value: "createdAt:desc", label: "Created ↓" },
              { value: "createdAt:asc", label: "Created ↑" },
            ]}
            value={`${sortKey}:${sortDir}`}
            onChange={(val) => {
              const [k, d] = val.split(":");
              setSortKey(k);
              setSortDir(d);
            }}
            position="bottom"
          />
          <button
            onClick={() => fetchPage(1, true)}
            className="btn btn-sm btn-primary gap-2"
          >
            <FiRefreshCw /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="p-4 text-red-600">{error}</div>}

      {loading && rows.length === 0 ? (
        <div className="p-4">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-4 text-center text-zinc-500">No contacts found</div>
      ) : (
        <ContactsTable rows={rows} setDetails={setDetails} />
      )}

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

      {showAddModal && (
        <AddContactModal
          contact={newContact}
          setContact={setNewContact}
          lists={lists}
          onClose={() => setShowAddModal(false)}
          onSave={saveNewContact}
        />
      )}
      {details && (
        <DetailsContactModal
          contact={details}
          onClose={() => setDetails(false)}
          onViewLogs={saveNewContact}
        />
      )}
    </SidebarWrapper>
  );
}

/* ------------------ Contacts Table ------------------ */
function ContactsTable({ rows, setDetails }) {
  return (
    <div className="border border-zinc-200 overflow-hidden">
      <table className="w-full border-collapse">
        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>
            <th className="px-3 py-2 text-left text-xs uppercase">Email</th>
            <th className="px-3 py-2 text-left text-xs uppercase">Name</th>
            <th className="px-3 py-2 text-left text-xs uppercase">Status</th>
            <th className="px-3 py-2 text-left text-xs uppercase">
              Connected Lists
            </th>
            <th className="px-3 py-2 text-left text-xs uppercase">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r._id}
              className="hover:bg-zinc-50 text-sm"
              onClick={() => setDetails(r)}
            >
              <td className="px-3 py-2">{r.email}</td>
              <td className="px-3 py-2">{r.fullName}</td>
              <td className="px-3 py-2">{statusChip(r.isActive)}</td>
              <td className="px-3 py-2 flex flex-wrap gap-1">
                {r.lists.map((l) => (
                  <span
                    key={l._id}
                    className="text-xs bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded"
                  >
                    {l.listId?.name || l.listId}
                  </span>
                ))}
              </td>

              <td className="px-3 py-2">{formatDate(r.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------ Add Contact Modal ------------------ */
function AddContactModal({ contact, setContact, lists, onClose, onSave }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-[90vw] max-w-md bg-white rounded-xl border border-zinc-200 shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Add Contact</h2>
        <div className="space-y-3">
          <input
            type="text"
            className={inputStyles + " w-full"}
            placeholder="Full name"
            value={contact.fullName}
            onChange={(e) =>
              setContact((c) => ({ ...c, fullName: e.target.value }))
            }
          />
          <input
            type="email"
            className={inputStyles + " w-full"}
            placeholder="Email"
            value={contact.email}
            onChange={(e) =>
              setContact((c) => ({ ...c, email: e.target.value }))
            }
          />
          <select
            className={inputStyles + " w-full"}
            value={contact.listId}
            onChange={(e) =>
              setContact((c) => ({ ...c, listId: e.target.value }))
            }
          >
            <option value="">Select list (optional)</option>
            {lists.map((list) => (
              <option key={list._id} value={list._id}>
                {list.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1 text-sm border border-zinc-300 rounded bg-white hover:bg-zinc-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1 text-sm rounded bg-primary text-white hover:bg-primary-dark"
            onClick={onSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailsContactModal({ contact, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-[90vw] max-w-2xl bg-white rounded-xl border border-zinc-200 shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Contact Details</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <p className="text-zinc-500">Email:</p>
            <p className="font-medium">{contact.email}</p>
          </div>
          <div>
            <p className="text-zinc-500">Full Name:</p>
            <p className="font-medium">{contact.fullName || "N/A"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Status:</p>
            <p className="font-medium">{statusChip(contact.isActive)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Created At:</p>
            <p className="font-medium">{formatDate(contact.createdAt)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Last Updated:</p>
            <p className="font-medium">{formatDate(contact.updatedAt)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Engagement Score:</p>
            <p className="font-medium">
              {contact.engagement?.engagementScore || 0}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-md font-semibold mb-2">List Memberships</h3>
          <div className="flex flex-wrap gap-2">
            {contact.lists?.map((l) => (
              <span
                key={l.listId?._id || l.listId}
                className="text-xs bg-zinc-100 border border-zinc-200 px-2 py-1 rounded"
              >
                {l.listId?.name || "Unknown List"}
              </span>
            ))}
            {contact.lists?.length === 0 && (
              <p className="text-sm text-zinc-500">Not in any lists.</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            className="px-4 py-2 text-sm border border-zinc-300 rounded bg-white hover:bg-zinc-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
