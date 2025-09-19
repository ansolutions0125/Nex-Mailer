"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";

import useCustomerStore from "@/store/useCustomerStore";
import { useToastStore } from "@/store/useToastStore";
import { fetchWithAuthCustomer } from "@/helpers/front-end/request";

import { LoadingSpinner, StepSkeleton } from "./Loaders";
import { EmptyState } from "./EmptyStates";
import Sidebar from "./Sidebar";
import StepCard from "./StepCard";
import StepConfigModal from "./StepConfigModal";

import { readDraft, writeDraft } from "../utils/drafts";
import { uiToServerStep, serverToUiStep } from "../utils/mappers";
import { HiArrowLongDown } from "react-icons/hi2";

const STEPS_BASE = `/api/work-flow/steps`;
const LISTS_BASE = `/api/list`;
const TEMPLATES_BASE = `/api/templates`;
const SERVERS_BASE = `/api/servers`;

function Connector() {
  return (
    <div className="text-3xl my-4 text-zinc-500" title="Next">
      <HiArrowLongDown />
    </div>
  );
}

// Helpers
const stable = (o) => JSON.stringify(o ?? null);
const DEFAULTS = {
  action: {
    title: "Send Mail",
    actionKind: "send_email",
    sendingServiceId: "",
    templateId: "",
    subject: "",
    rawHtml: "",
    rawHtmlSummary: null,
    method: "POST",
    url: "",
    query: "",
    headers: "",
    body: "",
    retryAttempts: 1,
    retryDelaySeconds: 5,
    targetListId: "",
    reason: "",
  },
  delay: { title: "Wait", amount: 3, unit: "minutes" },
};

export default function BuilderCanvas({
  flowId,
  currentList,
  onRegisterCommit,
  onDirtyChange,
}) {
  const { customer, token } = useCustomerStore();
  const { showSuccess, showError, showInfo } = useToastStore();
  const [isOpen, setIsOpen] = useState(false);

  const [steps, setSteps] = useState([]);
  const [serverSteps, setServerSteps] = useState([]);

  const [loadingSteps, setLoadingSteps] = useState(true);
  const [stepsError, setStepsError] = useState(null);

  const [createModal, setCreateModal] = useState({ open: false, draft: null });
  const [editModal, setEditModal] = useState(null);

  // options
  const [listOpts, setListOpts] = useState([]);
  const [templateOpts, setTemplateOpts] = useState([]);
  const [serverOpts, setServerOpts] = useState([]);
  const [loadingOpts, setLoadingOpts] = useState(false);

  const canvasRef = useRef(null);

  // Load steps
  const fetchSteps = useCallback(async () => {
    const res = await fetchWithAuthCustomer({
      url: `${STEPS_BASE}?flowId=${flowId}`,
      method: "GET",
      customer,
      token,
    });
    if (!res?.success) throw new Error(res?.message || "Failed to load steps");
    return (res?.data?.steps || [])
      .sort((a, b) => (a.stepCount || 0) - (b.stepCount || 0))
      .map(serverToUiStep)
      .filter(Boolean);
  }, [flowId, customer, token]);

  useEffect(() => {
    (async () => {
      if (!flowId) return;
      try {
        setLoadingSteps(true);
        setStepsError(null);

        const svSteps = await fetchSteps();
        setServerSteps(svSteps);

        const local = readDraft(flowId);
        const localSteps = Array.isArray(local?.stepsDraft)
          ? local.stepsDraft
          : null;

        if (
          localSteps &&
          localSteps.length > 0 &&
          stable(localSteps) !== stable(svSteps)
        ) {
          setSteps(localSteps);
        } else {
          setSteps(svSteps);
        }
      } catch (e) {
        console.error("Load steps failed:", e);
        setStepsError(e.message || "Failed to load steps");
        showError?.("Failed to load steps");
      } finally {
        setLoadingSteps(false);
      }
    })();
  }, [flowId, fetchSteps, showError]);

  // Dirty tracking + draft persist
  useEffect(() => {
    if (!flowId) return;
    const dirty = stable(steps) !== stable(serverSteps);
    onDirtyChange?.(dirty || Boolean(readDraft(flowId)?.automationPatch));
    const d = readDraft(flowId) || {};
    writeDraft(flowId, { ...d, stepsDraft: steps });
  }, [steps, serverSteps, flowId, onDirtyChange]);

  // Options (lists, templates, servers) — website removed => lists fetch is generic
  useEffect(() => {
    (async () => {
      try {
        setLoadingOpts(true);

        // Lists — no website filter anymore
        const lr = await fetchWithAuthCustomer({
          url: `${LISTS_BASE}?notConnected=false`,
          method: "GET",
          customer,
          token,
        });
        const lists = Array.isArray(lr?.data) ? lr.data : [];
        setListOpts(lists.map((l) => ({ value: l._id, label: l.name })));

        const tr = await fetchWithAuthCustomer({
          url: TEMPLATES_BASE,
          method: "GET",
          customer,
          token,
        });
        const templates = Array.isArray(tr?.data) ? tr.data : [];
        setTemplateOpts(
          templates.map((t) => ({ value: t._id, label: t.name }))
        );

        const sr = await fetchWithAuthCustomer({
          url: SERVERS_BASE,
          method: "GET",
          customer,
          token,
        });
        const servers = Array.isArray(sr?.data) ? sr.data : [];
        setServerOpts(
          servers.map((s) => ({ value: String(s._id), label: s.name }))
        );
      } catch (e) {
        console.error("Options load failed:", e);
        showError?.("Failed to load options");
      } finally {
        setLoadingOpts(false);
      }
    })();
  }, [customer, token, showError]);

  /* ==========================
     Add / Edit / Delete steps
  =========================== */

  const onAddDragStart = (e, type, preset) => {
    e.dataTransfer.setData("application/x-add-step", "1");
    e.dataTransfer.setData("application/x-step-type", type);
    e.dataTransfer.setData(
      "application/x-step-preset",
      JSON.stringify(preset || {})
    );
    e.dataTransfer.effectAllowed = "copy";
  };
  const onCanvasDragOver = (e) => {
    if (e.dataTransfer.types.includes("application/x-add-step")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };
  const onCanvasDrop = (e) => {
    if (!e.dataTransfer.types.includes("application/x-add-step")) return;
    e.preventDefault();
    const type = e.dataTransfer.getData("application/x-step-type");
    const preset = JSON.parse(
      e.dataTransfer.getData("application/x-step-preset") || "{}"
    );
    const base = type === "delay" ? DEFAULTS.delay : DEFAULTS.action;
    setCreateModal({
      open: true,
      draft: { type, data: { ...base, ...preset } },
    });
  };

  const saveDraft = async (patch) => {
    const draft = {
      ...createModal.draft,
      data: { ...createModal.draft.data, ...(patch || {}) },
    };
    const tempId = `tmp_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    setSteps((arr) => [
      ...arr,
      { id: tempId, type: draft.type, data: draft.data },
    ]);
    setCreateModal({ open: false, draft: null });
    requestAnimationFrame(() =>
      canvasRef.current?.scrollTo({
        top: canvasRef.current.scrollHeight,
        behavior: "smooth",
      })
    );
    showSuccess?.("Step added (draft)");
  };
  const cancelDraft = () => setCreateModal({ open: false, draft: null });

  const openEdit = (id) => setEditModal(id);
  const closeEdit = () => setEditModal(null);
  const saveEdit = async (patch) => {
    setSteps((arr) =>
      arr.map((s) =>
        s.id === editModal ? { ...s, data: { ...s.data, ...(patch || {}) } } : s
      )
    );
    setEditModal(null);
    showSuccess?.("Step updated (draft)");
  };

  const onDeleteStep = async (stepId) => {
    const s = steps.find((x) => x.id === stepId);
    const title = s?.data?.title || "this step";
    if (!confirm(`Delete "${title}"?`)) return;
    setSteps((arr) => arr.filter((s) => s.id !== stepId));
    showInfo?.("Step deleted (draft)");
  };

  // Reorder
  const dragState = useRef({ fromIndex: null, stepId: null });
  const onReorderDragStart = (index, stepId) => (e) => {
    dragState.current = { fromIndex: index, stepId };
    e.dataTransfer.setData("application/x-reorder", "1");
    e.dataTransfer.effectAllowed = "move";
  };
  const onInlineDragOver = (targetIndex) => (e) => {
    if (e.dataTransfer.types.includes("application/x-reorder")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  };
  const onInlineDrop = (targetIndex) => (e) => {
    if (!e.dataTransfer.types.includes("application/x-reorder")) return;
    e.preventDefault();
    const { fromIndex } = dragState.current;
    dragState.current = { fromIndex: null, stepId: null };
    if (fromIndex == null || fromIndex < 0 || fromIndex >= steps.length) return;

    const next = [...steps];
    const [moved] = next.splice(fromIndex, 1);
    let insertIndex = targetIndex;
    insertIndex = Math.max(0, Math.min(insertIndex, next.length));
    next.splice(insertIndex, 0, moved);
    setSteps(next);
    showSuccess?.("Step moved (draft)");
  };

  /* ==========================
     Commit diff (create/update/delete + order)
  =========================== */
  const byId = (arr) => Object.fromEntries(arr.map((s) => [s.id, s]));
  const commit = useCallback(async () => {
    if (!flowId) return;

    const current = steps;
    const original = serverSteps;
    const origMap = byId(original);
    const curMap = byId(current);

    const created = current.filter(
      (s) => !origMap[s.id] || String(s.id).startsWith("tmp_")
    );
    const deleted = original.filter((s) => !curMap[s.id]);
    const potentiallyUpdated = current.filter((s) => origMap[s.id]);

    const updated = potentiallyUpdated.filter((s) => {
      const prev = origMap[s.id];
      return stable(uiToServerStep(prev)) !== stable(uiToServerStep(s));
    });

    // 1) create & map temp->real ids
    const idMap = {};
    for (const s of created) {
      const payload = uiToServerStep(s);
      const res = await fetchWithAuthCustomer({
        url: STEPS_BASE,
        method: "POST",
        payload: { flowId, step: payload },
        customer,
        token,
      });
      if (!res?.success)
        throw new Error(res?.message || "Failed to create step");
      idMap[s.id] = res.data?._id;
    }

    // 2) now use real ids for ordering + updates
    const withRealIds = current.map((s) =>
      idMap[s.id] ? { ...s, id: idMap[s.id] } : s
    );

    // 3) updates
    for (const s of updated) {
      const realId = idMap[s.id] || s.id;
      const stepData = uiToServerStep(s);
      stepData.stepCount =
        withRealIds.findIndex((x) => (idMap[x.id] || x.id) === realId) + 1;

      const res = await fetchWithAuthCustomer({
        url: STEPS_BASE,
        method: "PUT",
        payload: { flowId, stepId: realId, stepData },
        customer,
        token,
      });
      if (!res?.success)
        throw new Error(res?.message || "Failed to update step");
    }

    // 4) deletes
    for (const s of deleted) {
      const res = await fetchWithAuthCustomer({
        url: `${STEPS_BASE}?flowId=${flowId}&stepId=${s.id}`,
        method: "DELETE",
        customer,
        token,
      });
      if (!res?.success)
        throw new Error(res?.message || "Failed to delete step");
    }

    // 5) final ordering sync
    const jobs = withRealIds.map((s, idx) => {
      const stepData = { ...uiToServerStep(s), stepCount: idx + 1 };
      return fetchWithAuthCustomer({
        url: STEPS_BASE,
        method: "PUT",
        payload: { flowId, stepId: s.id, stepData },
        customer,
        token,
      });
    });
    const results = await Promise.all(jobs);
    results.forEach((r) => {
      if (!r?.success) throw new Error(r?.message || "Reorder failed");
    });

    // 6) refresh
    const fresh = await fetchSteps();
    setServerSteps(fresh);
    setSteps(fresh);
  }, [flowId, steps, serverSteps, fetchSteps, customer, token]);

  useEffect(() => {
    onRegisterCommit?.(commit);
  }, [commit, onRegisterCommit]);

  /* ==========================
     Render
  =========================== */

  if (loadingSteps) {
    return (
      <div className="grid grid-cols-3 lg:grid-cols-5 h-full relative py-2">
        <Sidebar onAddDragStart={onAddDragStart} />
        <div className="w-full col-span-3 lg:col-span-4 h-full overflow-y-auto">
          <div className="relative flex-1 overflow-y-auto overflow-x-hidden px-2">
            <div className="mx-auto w-full max-w-[820px] px-4 pb-16">
              <div className="flex flex-col items-center gap-6 mt-8">
                <LoadingSpinner size="lg" />
                <div className="text-zinc-600">Loading steps...</div>
              </div>
              <div className="space-y-4 mt-8">
                {[1, 2, 3].map((i) => (
                  <StepSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stepsError) {
    return (
      <div className="grid grid-cols-4 h-full relative">
        <Sidebar onAddDragStart={onAddDragStart} />

        <div className="w-full col-span-2 xl:col-span-3 h-full overflow-y-auto">
          <div className="relative flex-1 overflow-y-auto overflow-x-hidden px-2">
            <div className="mx-auto w-full max-w-[820px] px-4 pb-16">
              <EmptyState
                title="Failed to Load Steps"
                description={stepsError}
                action={
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    Try Again
                  </button>
                }
                className="mt-16"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="grid grid-cols-4 lg:grid-cols-5 lg:gap-20 h-full relative">
      {!isOpen && (
        <button
          onClick={toggleSidebar}
          className="w-10 py-3 center-flex flex-col gap-3 text-sm lg:hidden fixed top-1/4 left-0 z-50 p-2 bg-primary text-white rounded-r hover:bg-opacity-80 transition-all"
          aria-label="Toggle sidebar"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
          <span className="uppercase [writing-mode:vertical-lr] rotate-180">
            ACION MENU
          </span>
        </button>
      )}
      <div className={`py-2 ${!isOpen && "hidden lg:block"}`}>
        <Sidebar
          onAddDragStart={onAddDragStart}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
        />
      </div>

      <div className="w-full h-full col-span-4 px-2 md:px-0 pt-2">
        <div className="w-full h-full overflow-y-auto bg-white rounded-lg lg:rounded-tl-lg md:rounded-r-none">
          <div
            ref={canvasRef}
            className="relative flex-1 overflow-y-auto overflow-x-hidden p-2"
            onDragOver={onCanvasDragOver}
            onDrop={onCanvasDrop}
          >
            <div className="flex flex-col items-center gap-2 p-3 rounded-md bg-zinc-100 border border-zinc-200 mb-3">
              {loadingOpts ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  <span className="text-xs text-zinc-600">
                    Loading options...
                  </span>
                </div>
              ) : (
                <span className="text-xs text-zinc-600">
                  Drag from the left; drop on a step to place <b>before</b> it.
                </span>
              )}
            </div>

            <div className="mx-auto w-full max-w-[820px] px-4 pb-16">
              {steps.length === 0 && (
                <EmptyState
                  title="No steps yet"
                  description="Drag from the sidebar to add your first step"
                  className="mt-24 border-2 border-dashed border-zinc-200 rounded-lg p-8"
                />
              )}

              <div className="relative flex flex-col items-center">
                {steps.map((s, i) => (
                  <React.Fragment key={s.id}>
                    {i > 0 && <Connector />}
                    <StepCard
                      step={s}
                      count={i + 1}
                      onEdit={() => openEdit(s.id)}
                      onDelete={() => onDeleteStep(s.id)}
                      onDragStartReorder={onReorderDragStart(i, s.id)}
                      canDropInline={steps.length > 1}
                      onInlineDragOver={(e) => onInlineDragOver(i)(e)}
                      onInlineDrop={(e) => onInlineDrop(i)(e)}
                    />
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create */}
      <StepConfigModal
        mode="create"
        open={createModal.open}
        step={
          createModal.draft
            ? {
                id: "draft",
                type: createModal.draft.type,
                data: createModal.draft.data,
              }
            : null
        }
        onClose={cancelDraft}
        onSave={saveDraft}
        listOptions={listOpts}
        templateOptions={templateOpts}
        serverOptions={serverOpts}
        currentList={currentList}
      />
      {/* Edit */}
      <StepConfigModal
        mode="edit"
        open={Boolean(editModal)}
        step={editModal ? steps.find((s) => s.id === editModal) : null}
        onClose={closeEdit}
        onSave={saveEdit}
        listOptions={listOpts}
        templateOptions={templateOpts}
        serverOptions={serverOpts}
        currentList={currentList}
      />
    </div>
  );
}

BuilderCanvas.propTypes = {
  flowId: PropTypes.string,
  currentList: PropTypes.object,
  onRegisterCommit: PropTypes.func,
  onDirtyChange: PropTypes.func,
};
