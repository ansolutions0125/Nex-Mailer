"use client";
import SidebarWrapper from "@/components/SidebarWrapper";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  FiTrash2,
  FiPlus,
  FiCheck,
  FiX,
  FiUser,
  FiChevronRight,
  FiChevronLeft,
  FiEdit2,
  FiClock,
  FiGrid,
  FiList,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { AnimatePresence, motion } from "framer-motion";
import Header from "@/components/Header";
import SelectModal from "@/components/SelectModal";
import { Dropdown } from "@/components/Dropdown";
import { useRouter } from "next/navigation";
import { EthernetPortIcon } from "lucide-react";

const Contacts = () => {
  const router = useRouter();

  // State for contacts, loading, and pagination
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0,
    limit: 10,
  });

  // State for search and filters with debounce
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // 'all' | 'active' | 'inactive'

  // State for the Add/Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [editingContactId, setEditingContactId] = useState(null);

  // State for the Details modal
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [contactDetails, setContactDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsId, setDetailsId] = useState(null);

  // Form data for adding/editing a contact
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    listIds: [],
    automationIds: [],
  });

  // State for fetching lists and automations for the form
  const [lists, setLists] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  // Filter and layout states
  const [viewMode, setViewMode] = useState("single"); // 'single' | 'double'
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedListId, setSelectedListId] = useState("");

  // Toast notification state
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "", // 'success' | 'error'
  });

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to first page when search or filter changes
  useEffect(() => {
    if (pagination.currentPage !== 1) {
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, activeFilter, selectedListId]);

  const showToast = useCallback((message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "" });
    }, 3000);
  }, []);

  // API Call functions
  const fetchLists = useCallback(async () => {
    try {
      const response = await fetch("/api/list");
      if (!response.ok) throw new Error("Failed to fetch lists.");
      const result = await response.json();
      if (result?.success) {
        setLists(result.data || []);
      } else {
        showToast(result?.message || "Failed to load lists.", "error");
        setLists([]);
      }
    } catch (error) {
      console.error("Error fetching lists:", error);
      showToast("Failed to load lists.", "error");
      setLists([]);
    }
  }, [showToast]);

  const fetchAutomations = useCallback(async () => {
    try {
      const response = await fetch("/api/automation");
      const result = await response.json();
      if (result?.success) {
        setAutomations(result.data || []);
      } else {
        showToast(result?.message || "Failed to load automations.", "error");
        setAutomations([]);
      }
    } catch (error) {
      console.error("Error fetching automations:", error);
      setAutomations([]);
    }
  }, [showToast]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(pagination.currentPage),
        limit: String(pagination.limit),
      });

      if (debouncedSearch?.trim()) {
        query.append("search", debouncedSearch.trim());
      }

      if (activeFilter === "active") {
        query.append("isActive", "true");
      } else if (activeFilter === "inactive") {
        query.append("isActive", "false");
      }

      if (selectedListId) {
        query.append("listId", selectedListId);
      }

      const response = await fetch(`/api/contact?${query.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.status}`);
      }

      const result = await response.json();
      if (result?.success) {
        const data = Array.isArray(result.data) ? result.data : [];
        setContacts(data);
        setPagination((prev) => ({
          ...prev,
          ...(result.pagination || {
            total: data.length,
            totalPages: Math.max(1, Math.ceil(data.length / prev.limit)),
          }),
        }));
      } else {
        showToast(result?.message || "Failed to load contacts.", "error");
        setContacts([]);
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
      showToast("Failed to load contacts. Please try again.", "error");
      setContacts([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }));
    } finally {
      setLoading(false);
    }
  }, [
    pagination.currentPage,
    pagination.limit,
    debouncedSearch,
    activeFilter,
    selectedListId,
    showToast,
  ]);

  // Fetch contact details for the modal
  const fetchContactDetails = useCallback(
    async (contactId) => {
      setDetailsLoading(true);
      try {
        const response = await fetch(`/api/contact?contactId=${contactId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch contact details");
        }
        const result = await response.json();
        if (result?.success) {
          console.log(result.data[0]);
          const contact = Array.isArray(result.data)
            ? result.data[0]
            : result.data;
          setContactDetails(contact || null);
        } else {
          showToast(
            result?.message || "Failed to load contact details.",
            "error"
          );
        }
      } catch (error) {
        console.error("Error fetching contact details:", error);
        showToast("Failed to load contact details.", "error");
      } finally {
        setDetailsLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchContacts();
    fetchLists();
  }, [fetchContacts]);

  // Handle form submission (add/edit)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);

    try {
      if (editingContactId) {
        // Update existing contact
        const payload = {
          contactId: editingContactId,
          action: "updateListAssociations",
          listAssociations: formData.listIds,
          fullName: formData.fullName,
        };

        const response = await fetch("/api/contact", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Failed to update contact.");
        }

        const result = await response.json();
        if (result?.success) {
          showToast(
            result?.message || "Contact updated successfully.",
            "success"
          );
          setIsModalOpen(false);
          resetForm();
          fetchContacts();
        } else {
          showToast(result?.message || "Failed to update contact.", "error");
        }
      } else {
        // Create new contact
        if (formData.listIds.length > 0) {
          // If multiple lists selected, use the first one as primary
          const primaryListId = formData.listIds[0];
          const payload = {
            fullName: formData.fullName,
            email: formData.email,
            listId: primaryListId,
            source: "manual",
          };

          const response = await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            throw new Error("Failed to create contact.");
          }

          const result = await response.json();
          if (result?.success) {
            const contactId = result.data._id;

            // If there are additional lists, add them
            if (formData.listIds.length > 1) {
              const additionalLists = formData.listIds.slice(1);

              const updateResponse = await fetch("/api/contact", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contactId: contactId,
                  action: "multiListAdd",
                  listIds: additionalLists,
                }),
              });

              if (!updateResponse.ok) {
                console.warn("Failed to add contact to additional lists");
              }
            }

            showToast("Contact created successfully.", "success");
            setIsModalOpen(false);
            resetForm();
            fetchContacts();
          } else {
            showToast(result?.message || "Failed to create contact.", "error");
          }
        } else {
          // Create contact without list
          const payload = {
            fullName: formData.fullName,
            email: formData.email,
            source: "manual",
          };

          const response = await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            throw new Error("Failed to create contact.");
          }

          const result = await response.json();
          if (result?.success) {
            showToast("Contact created successfully.", "success");
            setIsModalOpen(false);
            resetForm();
            fetchContacts();
          } else {
            showToast(result?.message || "Failed to create contact.", "error");
          }
        }
      }
    } catch (error) {
      console.error("Error saving contact:", error);
      showToast("An error occurred while saving the contact.", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const resetForm = useCallback(() => {
    setFormData({
      fullName: "",
      email: "",
      listIds: [],
      automationIds: [],
    });
    setEditingContactId(null);
  }, []);

  const openAddEditModal = useCallback(
    async (contact = null) => {
      resetForm();
      setIsModalOpen(true);
      setModalLoading(true);

      await Promise.all([fetchLists(), fetchAutomations()]);

      if (contact) {
        // Extract IDs from associations for editing
        const listIds =
          contact.listAssociations?.map((assoc) =>
            typeof assoc.listId === "object" ? assoc.listId._id : assoc.listId
          ) || [];

        const automationIds =
          contact.automationAssociations?.map((assoc) =>
            typeof assoc.automationId === "object"
              ? assoc.automationId._id
              : assoc.automationId
          ) || [];

        setFormData({
          fullName: contact.fullName || "",
          email: contact.email || "",
          listIds,
          automationIds,
        });
        setEditingContactId(contact._id);
      }
      setModalLoading(false);
    },
    [fetchLists, fetchAutomations, resetForm]
  );

  const openDetailsModal = useCallback(
    (contact) => {
      setIsDetailsModalOpen(true);
      setContactDetails(contact); // optimistic hydrate
      setDetailsId(contact?._id || null);
      fetchContactDetails(contact._id);
    },
    [fetchContactDetails]
  );

  const closeDetailsModal = useCallback(() => {
    setContactDetails(null);
    setIsDetailsModalOpen(false);
    setDetailsLoading(false);
    setDetailsId(null);
  }, []);

  const handlePageChange = useCallback(
    (page) => {
      if (page >= 1 && page <= pagination.totalPages) {
        setPagination((prev) => ({ ...prev, currentPage: page }));
      }
    },
    [pagination.totalPages]
  );

  const handleDeleteClick = useCallback((contact) => {
    setContactToDelete(contact);
    setIsConfirmModalOpen(true);
  }, []);

  const confirmDelete = useCallback(
    async (hardDelete = false) => {
      if (!contactToDelete) return;

      setDeletingId(contactToDelete._id);
      setModalLoading(true);

      try {
        const query = new URLSearchParams({
          contactId: contactToDelete._id,
          hardDelete: hardDelete.toString(),
        });

        const response = await fetch(`/api/contact?${query.toString()}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(`Delete failed: ${response.status}`);
        }

        const result = await response.json();
        if (result?.success) {
          showToast(
            result?.message || "Contact deleted successfully",
            "success"
          );
          fetchContacts();
        } else {
          showToast(result?.message || "Failed to delete contact.", "error");
        }
      } catch (error) {
        console.error("Error deleting contact:", error);
        showToast("An error occurred while deleting the contact.", "error");
      } finally {
        setModalLoading(false);
        setIsConfirmModalOpen(false);
        setDeletingId(null);
        setContactToDelete(null);
      }
    },
    [contactToDelete, fetchContacts, showToast]
  );

  // Memoized filter + selection helpers
  const getFilteredAndSortedContacts = useCallback(() => {
    let filtered = [...contacts];
    if (activeFilter !== "all") {
      filtered = filtered.filter((c) =>
        activeFilter === "active" ? c.isActive : !c.isActive
      );
    }
    return filtered;
  }, [contacts, activeFilter]);

  const filteredContacts = useMemo(
    () => getFilteredAndSortedContacts(),
    [getFilteredAndSortedContacts]
  );

  const handleSelectContact = (contactId) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedContacts([]);
      setSelectAll(false);
    } else {
      setSelectedContacts(filteredContacts.map((c) => c._id));
      setSelectAll(true);
    }
  };

  useEffect(() => {
    if (filteredContacts.length === 0) {
      setSelectAll(false);
    } else {
      const allSelected = filteredContacts.every((c) =>
        selectedContacts.includes(c._id)
      );
      setSelectAll(allSelected);
    }
  }, [selectedContacts, filteredContacts]);

  const handleBulkDelete = async () => {
    if (selectedContacts.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedContacts.length} contacts?`
      )
    )
      return;

    try {
      // Delete each contact individually since backend doesn't support bulk delete
      let deletedCount = 0;
      for (const contactId of selectedContacts) {
        try {
          const response = await fetch(
            `/api/contact?contactId=${contactId}&hardDelete=false`,
            {
              method: "DELETE",
            }
          );
          if (response.ok) {
            deletedCount++;
          }
        } catch (error) {
          console.error(`Failed to delete contact ${contactId}:`, error);
        }
      }

      if (deletedCount > 0) {
        setSelectedContacts([]);
        setSelectAll(false);
        fetchContacts();
        showToast(`Successfully deleted ${deletedCount} contacts`, "success");
      } else {
        showToast("Failed to delete contacts", "error");
      }
    } catch (err) {
      showToast("Error deleting contacts: " + err.message, "error");
    }
  };

  // helper
  const getSelectedItems = (ids, items) =>
    items.filter((item) => ids.includes(item._id));

  // Mini card component
  const MiniCard = ({ title, subLine }) => {
    return (
      <div className="w-full flex items-center gap-2">
        <div className="w-[1px] h-full min-h-10 bg-zinc-400 rounded" />
        <div className="flex flex-col gap-1">
          <h2 className="text-sm text-primary">{title}</h2>
          <p className="text-xs text-zinc-500">{subLine}</p>
        </div>
      </div>
    );
  };

  // Contact Card
  const ContactCard = ({ contact, isSelected, onSelect, isDeleting }) => {
    return (
      <div
         className={`rounded border transition-all duration-200 gap-6 p-6 relative ${
          isSelected  
            ? "bg-zinc-50 border-y-2 border-primary"
            : "bg-zinc-50 hover:border-zinc-300"
        }`}
      >
        {isSelected && (
          <div className="absolute -top-3 right-1 bg-primary text-white text-xs px-2 py-1 rounded uppercase tracking-wider transition-all">
            Selected
          </div>
        )}
        {/* Selection checkbox */}
        <div className="absolute top-4 right-4 z-10">
          <div
            onClick={() => onSelect(contact._id)}
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
          <div className="flex flex-col xl:flex-row items-center gap-3 md:gap-5 xl:divide-x">
            <div className="bg-zinc-100 border rounded-md overflow-hidden w-full max-w-28 h-32 p-3 lg:p-9 text-4xl text-zinc-700">
              <EthernetPortIcon className="w-full h-full" />
            </div>

            <div className="flex flex-col xl:pl-4">
              <div
                className={`w-fit text-xxs px-2 py-0.5 rounded border ${
                  contact.isActive
                    ? "bg-green-200 border-green-500 text-zinc-800"
                    : "bg-red-200 border-red-500 text-red-900"
                }`}
              >
                {contact.isActive ? "Currently Active" : "Currently Inactive"}
              </div>
              <button
                onClick={() => openDetailsModal(contact)}
                className="text-lg text-zinc-700 font-medium mt-1 text-left hover:underline"
              >
                {contact.fullName}
              </button>
              <p className="text-xs text-zinc-500 mb-2">{contact.email}</p>

              <Dropdown
                position="bottom"
                options={[
                  { value: "view", label: "View Contact Details" },
                  { value: "edit", label: "Edit Contact" },
                  { value: "delete", label: "Delete Contact" },
                ]}
                onChange={(val) => {
                  const actions = {
                    view: () => openDetailsModal(contact),
                    edit: () => openAddEditModal(contact),
                    delete: () => handleDeleteClick(contact),
                  };
                  actions[val]?.();
                }}
                placeholder="Actions Menu"
                className="w-48"
              />
            </div>
          </div>

          <div
            className={`flex-1 grid gap-3 ${
              viewMode === "double"
                ? "grid-cols-1 lg:grid-cols-2"
                : "grid-cols-4"
            }`}
          >
            <MiniCard
              title="Emails Sent"
              subLine={contact.engagementHistory?.totalEmailsSent ?? 0}
            />
            <MiniCard
              title="Emails Opened"
              subLine={contact.engagementHistory?.totalEmailsOpened ?? 0}
            />
            <MiniCard
              title="Open Rate"
              subLine={`${contact.engagementHistory?.openRate ?? 0}%`}
            />
            <MiniCard
              title="Click Rate"
              subLine={`${contact.engagementHistory?.clickRate ?? 0}%`}
            />
          </div>
        </div>

        {isDeleting && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] grid place-items-center rounded">
            <ImSpinner5 className="animate-spin text-zinc-500 text-2xl" />
          </div>
        )}
      </div>
    );
  };

  const renderContactsGrid = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <ImSpinner5 className="animate-spin text-zinc-400 text-4xl" />
        </div>
      );
    }

    // Use filtered list for empty state + rendering
    if (!filteredContacts || filteredContacts.length === 0) {
     const isFiltered = Boolean(debouncedSearch) || activeFilter !== "all" || Boolean(selectedListId);
     
      return (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 flex items-center justify-center rounded-full bg-zinc-100 mb-4">
            <FiUser className="h-10 w-10 text-zinc-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 mb-1">
            {isFiltered ? "No matching contacts" : "No contacts"}
          </h3>
          <p className="text-zinc-500">
            {isFiltered
              ? "Try adjusting your search or filter criteria."
              : "Get started by adding your first contact."}
          </p>
          {!isFiltered && (
            <button
              onClick={() => openAddEditModal()}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 transition-colors"
            >
              <FiPlus className="h-4 w-4 mr-2" />
              Add Contact
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-5">
        {filteredContacts.map((contact) => {
          const isDeleting = deletingId === contact._id;
          const isSelected = selectedContacts.includes(contact._id);
          return (
            <ContactCard
              key={contact._id}
              contact={contact}
              isSelected={isSelected}
              onSelect={handleSelectContact}
              isDeleting={isDeleting}
            />
          );
        })}
      </div>
    );
  };

  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;

    const { currentPage, totalPages, total, limit } = pagination;
    const startItem = (currentPage - 1) * limit + 1;
    const endItem = Math.min(currentPage * limit, total);

    return (
      <div className="flex items-center justify-between mt-6 px-2">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md text-zinc-700 bg-white hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md text-zinc-700 bg-white hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-700">
              Showing <span className="font-medium">{startItem}</span> to{" "}
              <span className="font-medium">{endItem}</span> of{" "}
              <span className="font-medium">{total}</span> results
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
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-zinc-300 bg-white text-sm font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="sr-only">Previous</span>
                <FiChevronLeft className="h-5 w-5" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                )
                .map((page, index, array) => {
                  const prevPage = array[index - 1];
                  const showEllipsis = prevPage && page - prevPage > 1;

                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && (
                        <span className="relative inline-flex items-center px-4 py-2 border border-zinc-300 bg-white text-sm font-medium text-zinc-700">
                          ...
                        </span>
                      )}
                      <button
                        onClick={() => handlePageChange(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors ${
                          currentPage === page
                            ? "z-10 bg-zinc-100 border-zinc-500 text-zinc-600"
                            : "bg-white border-zinc-300 text-zinc-500 hover:bg-zinc-50"
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-zinc-300 bg-white text-sm font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

  const handleViewLogs = useCallback(
    (contactId) => {
      const id = contactId || detailsId;
      if (id) router.push(`/logs?contactId=${id}`);
    },
    [router, detailsId]
  );

  const renderDetailsModal = () => {
    if (!isDetailsModalOpen) return null;

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={closeDetailsModal}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
            className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-zinc-200/50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-zinc-100 border-b border-zinc-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-md bg-white border border-zinc-200">
                    <FiUser className="h-8 w-8 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">
                      Contact Profile
                    </h2>
                    <p className="text-sm text-zinc-600 mt-1">
                      Comprehensive engagement overview and analytics
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeDetailsModal}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                >
                  <FiX className="h-5 w-5 text-zinc-600" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 bg-white">
              {detailsLoading ? (
                <div className="flex justify-center items-center h-64">
                  <ImSpinner5 className="animate-spin text-zinc-400 text-4xl" />
                </div>
              ) : contactDetails ? (
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 divide-x divide-zinc-300">
                    {/* Profile Card */}
                    <div className="lg:col-span-4">
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white p-3"
                      >
                        <div className="text-center mb-6">
                          <div className="relative inline-block mb-4">
                            <div className="h-20 w-20 rounded-md bg-zinc-100 border border-zinc-200 center-flex">
                              <FiUser className="h-8 w-8 text-zinc-700" />
                            </div>
                            <div
                              className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white ${
                                contactDetails.isActive
                                  ? "bg-emerald-400"
                                  : "bg-rose-400"
                              }`}
                            />
                          </div>
                          <h3 className="text-xl font-bold text-zinc-800 mb-2">
                            {contactDetails.fullName}
                          </h3>
                          <p className="text-zinc-600 text-sm mb-4">
                            {contactDetails.email}
                          </p>
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${
                              contactDetails.isActive
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {contactDetails.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>

                        <div className="space-y-3">
                          <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                              Last Activity
                            </p>
                            <p className="text-sm font-medium text-zinc-800">
                              {contactDetails.updatedAt
                                ? new Date(
                                    contactDetails.updatedAt
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })
                                : "—"}
                            </p>
                          </div>

                          <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                              Contact ID
                            </p>
                            <p className="text-xs font-mono text-zinc-600 truncate">
                              {contactDetails._id}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {/* Analytics & Details */}
                    <div className="lg:col-span-8">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-6 divide-y divide-zinc-300"
                      >
                        {/* Engagement Metrics */}
                        <div className="bg-white p-6">
                          <h3 className="text-lg font-bold text-zinc-800 mb-6 flex items-center gap-2">
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            Engagement Analytics
                          </h3>

                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                              {
                                label: "Emails Sent",
                                value:
                                  contactDetails.engagementHistory
                                    ?.totalEmailsSent ?? 0,
                              },
                              {
                                label: "Emails Opened",
                                value:
                                  contactDetails.engagementHistory
                                    ?.totalEmailsOpened ?? 0,
                              },
                              {
                                label: "Open Rate",
                                value: `${
                                  contactDetails.engagementHistory?.openRate ??
                                  0
                                }%`,
                              },
                              {
                                label: "Click Rate",
                                value: `${
                                  contactDetails.engagementHistory?.clickRate ??
                                  0
                                }%`,
                              },
                            ].map((metric) => (
                              <MiniCard
                                key={metric.label}
                                title={metric.label}
                                subLine={metric.value}
                              />
                            ))}
                          </div>
                        </div>

                        {/* List Memberships */}
                        {Array.isArray(contactDetails.listAssociations) &&
                          contactDetails.listAssociations.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.4 }}
                              className="bg-white p-6"
                            >
                              <h4 className="text-lg font-medium text-zinc-700 mb-6 flex items-center gap-2">
                                <div className="w-[3px] h-6 bg-green-500 rounded-full"></div>
                                List Memberships
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {contactDetails.listAssociations.map(
                                  (assoc, index) => (
                                    <motion.div
                                      key={`list-${
                                        assoc?.listId?._id ||
                                        assoc?.listId ||
                                        index
                                      }`}
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{
                                        delay: 0.5 + index * 0.1,
                                      }}
                                      className="bg-zinc-50 rounded-lg p-4 border border-zinc-200"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <h5 className="font-semibold text-zinc-800">
                                          {assoc?.listId?.name ||
                                            "Unknown List"}
                                        </h5>
                                        <span
                                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                            assoc?.status
                                              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                              : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                                          }`}
                                        >
                                          {assoc?.status ? "✓" : "✗"}
                                        </span>
                                      </div>
                                      <p className="text-xs text-zinc-500">
                                        Joined:{" "}
                                        {assoc?.subscribedAt
                                          ? new Date(
                                              assoc?.subscribedAt
                                            ).toLocaleDateString("en-US", {
                                              year: "numeric",
                                              month: "long",
                                              day: "numeric",
                                              hour: "numeric",
                                              minute: "numeric",
                                              hour12: true,
                                            })
                                          : "—"}
                                      </p>
                                    </motion.div>
                                  )
                                )}
                              </div>
                            </motion.div>
                          )}

                        {/* Automation Memberships */}
                        {Array.isArray(contactDetails.automationAssociations) &&
                          contactDetails.automationAssociations.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.5 }}
                              className="bg-white p-6"
                            >
                              <h4 className="text-lg font-medium text-zinc-700 mb-6 flex items-center gap-2">
                                <div className="w-[3px] h-6 bg-purple-500 rounded-full"></div>
                                Automation Journey
                              </h4>
                              <div className="space-y-4">
                                {contactDetails.automationAssociations.map(
                                  (assoc, index) => {
                                    const status = (
                                      assoc?.status ?? "active"
                                    ).toString();
                                    return (
                                      <motion.div
                                        key={`auto-${
                                          assoc?.automationId?._id ||
                                          assoc?.automationId ||
                                          index
                                        }`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                          delay: 0.6 + index * 0.1,
                                        }}
                                        className="bg-zinc-50 rounded-lg p-4 border border-zinc-200"
                                      >
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <h5 className="font-semibold text-zinc-800 text-base mb-2">
                                              {assoc?.automationId?.name ||
                                                "Unknown Automation"}
                                            </h5>
                                            <div className="space-y-1 text-sm text-zinc-600">
                                              <p className="flex items-center gap-2">
                                                <span className="text-xs">
                                                  📄
                                                </span>
                                                Step {assoc?.stepNumber ?? "—"}{" "}
                                                of process
                                              </p>
                                              <p className="flex items-center gap-2">
                                                <span className="text-xs">
                                                  📅
                                                </span>
                                                Started:{" "}
                                                {assoc?.startedAt
                                                  ? new Date(
                                                      assoc.startedAt
                                                    ).toLocaleDateString()
                                                  : "—"}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-right space-y-2">
                                            <div className="bg-white rounded-md px-3 py-2 border border-purple-200">
                                              <p className="text-xs font-medium text-purple-700 mb-1">
                                                Next Step
                                              </p>
                                              <p className="text-xs font-semibold text-zinc-800">
                                                {assoc?.nextStepTime
                                                  ? new Date(
                                                      assoc.nextStepTime
                                                    ).toLocaleString("en-US", {
                                                      hour: "numeric",
                                                      minute: "2-digit",
                                                      hour12: true,
                                                      month: "short",
                                                      day: "numeric",
                                                    })
                                                  : "—"}
                                              </p>
                                            </div>
                                            <span
                                              className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${
                                                status === "active"
                                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                                  : "bg-zinc-100 text-zinc-700 border-zinc-200"
                                              }`}
                                            >
                                              {status.replace("_", " ")}
                                            </span>
                                          </div>
                                        </div>
                                      </motion.div>
                                    );
                                  }
                                )}
                              </div>
                            </motion.div>
                          )}
                      </motion.div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <p className="text-zinc-500 mb-2">
                      Failed to load contact details
                    </p>
                    <button
                      onClick={() =>
                        detailsId && fetchContactDetails(detailsId)
                      }
                      className="text-sm text-indigo-600 hover:text-indigo-700 underline"
                      disabled={!detailsId}
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-zinc-50 px-6 py-4 border-t border-zinc-200"
            >
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => handleViewLogs(contactDetails?._id)}
                  disabled={!contactDetails && !detailsId}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  <FiClock className="h-4 w-4" />
                  View Logs
                </button>
                <button
                  onClick={closeDetailsModal}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const base =
                      contactDetails ||
                      (contacts || []).find((c) => c._id === detailsId);
                    if (base) {
                      closeDetailsModal();
                      openAddEditModal(base);
                    }
                  }}
                  disabled={!contactDetails && !detailsId}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  <FiEdit2 className="h-4 w-4" />
                  Edit Contact
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  const renderConfirmModal = () => {
    if (!isConfirmModalOpen || !contactToDelete) return null;

    return (
      <AnimatePresence>
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
              Delete Contact
            </h3>
            <p className="text-sm text-zinc-600 text-center mb-6">
              Are you sure you want to delete{" "}
              <strong>{contactToDelete.fullName}</strong>? This action cannot be
              undone.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => confirmDelete(false)}
                disabled={modalLoading}
                className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {modalLoading ? (
                  <ImSpinner5 className="animate-spin h-4 w-4 mr-2" />
                ) : null}
                Soft Delete (Deactivate)
              </button>
              <button
                onClick={() => confirmDelete(true)}
                disabled={modalLoading}
                className="w-full flex justify-center items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {modalLoading ? (
                  <ImSpinner5 className="animate-spin h-4 w-4 mr-2" />
                ) : null}
                Hard Delete (Permanent)
              </button>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={modalLoading}
                className="w-full flex justify-center items-center px-4 py-2 border border-zinc-300 text-sm font-medium rounded-md text-zinc-700 bg-white hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  const renderToast = () => {
    return (
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.5 }}
            className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-[99] flex items-center max-w-md ${
              toast.type === "success"
                ? "bg-green-100 border border-green-300 text-green-800"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            <div
              className={`mr-3 rounded-full p-1 ${
                toast.type === "success" ? "bg-green-500" : "bg-red-500"
              }`}
            >
              {toast.type === "success" ? (
                <FiCheck className="h-4 w-4 text-white" />
              ) : (
                <FiX className="h-4 w-4 text-white" />
              )}
            </div>
            <span className="font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  // Selection modal confirm handler (lists)
  const handleListSelection = (selected) => {
    // Support either array of ids or array of objects
    const ids = (selected || [])
      .map((item) => (typeof item === "string" ? item : item?._id))
      .filter(Boolean);
    setFormData((prev) => ({ ...prev, listIds: ids }));
    setIsListModalOpen(false);
  };

  const renderSelectionModals = () => (
    <>
      {isListModalOpen && (
        <SelectModal
          isOpen={isListModalOpen}
          onCancel={() => setIsListModalOpen(false)}
          title="Select Lists"
          items={lists}
          selectedItems={formData.listIds}
          onConfirm={handleListSelection}
        />
      )}
    </>
  );

  return (
    <SidebarWrapper>
      <Header
        title="Contacts"
        subtitle="Manage all your contacts in one place."
        buttonLabel="Add Contact"
        onButtonClick={() => openAddEditModal()}
      />

      {/* Filter and Selection Controls */}
      <div className="w-full bg-zinc-50 border px-4 p-2 rounded mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left side - Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* View Mode Toggle */}
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

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search contacts by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 border border-zinc-300 outline-none rounded text-sm"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Dropdown
                options={[
                  { value: "all", label: "All Status" },
                  { value: "active", label: "Active Only" },
                  { value: "inactive", label: "Inactive Only" },
                ]}
                value={activeFilter}
                onChange={(value) => setActiveFilter(value)}
                placeholder="Select Status"
              />
            </div>
            {/* NEW: List Filter */}
            <div className="relative">
              <Dropdown
                options={[
                  { value: "", label: "All Lists" },
                  ...lists.map((l) => ({ value: l._id, label: l.name })),
                ]}
                value={selectedListId}
                onChange={(val) => setSelectedListId(val)}
                placeholder="Filter by List"
              />
            </div>
          </div>

          {/* Right side - Selection and Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Selection Info */}
            <div className="flex items-center gap-3">
              <div
                onClick={handleSelectAll}
                className="text-sm text-primary cursor-pointer"
              >
                Select All
              </div>
              <div
                onClick={handleSelectAll}
                className={`w-6 h-6 rounded border cursor-pointer transition-all duration-200 flex items-center justify-center ${
                  selectedContacts.length > 0
                    ? "bg-primary border-primary"
                    : "border-zinc-300 hover:border-primary"
                }`}
              >
                {selectedContacts.length > 0 && (
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

              {/* Bulk Actions */}
              {selectedContacts.length > 0 && (
                <div className="flex items-center gap-2 pl-3 border-l border-zinc-200">
                  <span className="text-xs text-zinc-500">Actions:</span>
                  <button
                    onClick={handleBulkDelete}
                    className="btn btn-sm hover:bg-red-500 rounded hover:text-white"
                  >
                    Delete ({selectedContacts.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="mt-6">{renderContactsGrid()}</div>

      {renderPagination()}

      {/* Modals & Toast */}
      {isConfirmModalOpen && renderConfirmModal()}
      {isDetailsModalOpen && renderDetailsModal()}

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
              className="bg-white p-6 rounded-xl shadow-lg w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">
                {editingContactId ? "Edit Contact" : "Add New Contact"}
              </h2>
              {modalLoading ? (
                <div className="flex justify-center items-center py-12">
                  <ImSpinner5 className="animate-spin text-gray-500 text-3xl" />
                </div>
              ) : (
                <form onSubmit={handleFormSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex-1">
                      <label
                        htmlFor="fullName"
                        className="text-xs font-semibold text-zinc-500 uppercase tracking-wider"
                      >
                        Full Name
                      </label>
                      <input
                        id="fullName"
                        type="text"
                        name="fullName"
                        placeholder="Enter full name"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary px-4 py-2.5 text-sm text-zinc-800 outline-none placeholder-zinc-500"
                        required
                      />
                    </div>
                    <div className="flex-1">
                      <label
                        htmlFor="email"
                        className="text-xs font-semibold text-zinc-500 uppercase tracking-wider"
                      >
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        name="email"
                        placeholder="Enter email address"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary px-4 py-2.5 text-sm text-zinc-800 outline-none placeholder-zinc-500"
                        required
                        disabled={editingContactId} // Disable email editing for existing contacts
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 mt-4">
                    <div className="py-3">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        List Associations
                      </label>
                      <div className="grid grid-cols-1 gap-2 bg-zinc-100 border border-zinc-300 py-2 px-3 rounded text-xs">
                        {getSelectedItems(formData.listIds, lists).map(
                          (list, idx) => (
                            <div
                              key={list._id}
                              className="flex items-center justify-between bg-white px-3 py-2 rounded border border-zinc-200"
                            >
                              {idx + 1}. {list.name}
                            </div>
                          )
                        )}
                        {formData.listIds.length === 0 && (
                          <div className="text-zinc-500 italic">
                            No lists selected
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsListModalOpen(true)}
                          className="bg-primary text-white px-3 py-1 rounded text-xs hover:bg-primary/90 transition-colors"
                        >
                          + Select Lists
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={modalLoading}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {modalLoading && (
                        <ImSpinner5 className="animate-spin h-4 w-4" />
                      )}
                      {editingContactId ? "Update Contact" : "Create Contact"}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection Modals */}
      {renderSelectionModals()}

      {/* Toast Notifications */}
      {renderToast()}
    </SidebarWrapper>
  );
};

export default Contacts;
