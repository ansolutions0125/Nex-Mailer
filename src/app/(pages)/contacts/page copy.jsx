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
import { Checkbox, inputStyles, MiniCard, TabToggle } from "@/presets/styles";
import { Dropdown } from "@/components/Dropdown";
import useCustomerStore from "@/store/useCustomerStore";

export default function ContactsManagementPage() {
  const { admin, token: adminToken } = useAdminStore();
  const { customer, token: customerToken } = useCustomerStore();
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

  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({
    fullName: "",
    email: "",
    listId: "",
  });

  const hasMore = page < totalPages;
  const queryType = useMemo(() => inferQueryType(query), [query]);

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
      if (json?.success) {
        setLists(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch lists", e);
    }
  }, [admin, customer, adminToken, customerToken]);

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
          if (queryType === "objectId") {
            params.set("contactId", query.trim());
          }
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
    [
      admin,
      customerToken,
      showInfo,
      sortKey,
      sortDir,
      statusTab,
      searchMode,
      query,
    ]
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

  return (
    <SidebarWrapper>
      <Header
        title="Contacts"
        subtitle="Manage all your contacts in one place."
        buttonLabel="Add Contact"
        onButtonClick={() => {
          fetchLists(); // fetch lists when opening modal
          setShowAddModal(true);
        }}
      />
    </SidebarWrapper>
  );
}
