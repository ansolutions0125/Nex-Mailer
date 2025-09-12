"use client";

import React, {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import PropTypes from "prop-types";
import { DropdownSearch } from "@/components/DropdownSearch";
import {
  FiTrash2,
  FiEdit2,
  FiChevronUp,
  FiZap,
  FiLink2,
  FiLoader,
  FiAlertCircle,
  FiInbox,
  FiSearch,
  FiArrowLeft,
} from "react-icons/fi";
import FlowHeader from "./FlowHeader";
import { useToastStore } from "@/store/useToastStore";
import { RxDragHandleVertical } from "react-icons/rx";
import { HiArrowDown, HiArrowLongDown } from "react-icons/hi2";
import Link from "next/link";

/* =========================================================
   Endpoints
========================================================= */
const STEPS_BASE = `/api/work-flow/steps`; // GET/POST/PUT/DELETE steps
const AUTOMATION_BASE = `/api/work-flow/flow`; // GET shell (name, website, list)
const LISTS_BASE = `/api/list`; // GET ?websiteId=...
const TEMPLATES_BASE = `/api/templates`; // GET all
const SERVERS_BASE = `/api/servers`; // GET all

/* =========================================================
   UI tokens - Updated for light theme with zinc colors
========================================================= */
const COLORS = {
  shell: "bg-zinc-50 text-zinc-900",
  border: "border-zinc-200",
  subtext: "text-zinc-500",
  line: "rgba(0,0,0,.15)",
  accent: "bg-blue-500",
  card: "bg-white",
  highlight: "bg-blue-50 border-blue-200",
};

/* =========================================================
   Defaults
========================================================= */
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

/* =========================================================
   Draft helpers
========================================================= */
const draftKey = (flowId) => `wf:draft:${flowId}`;
const stable = (o) => JSON.stringify(o ?? null);
function readDraft(flowId) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(flowId)) || "null");
  } catch {
    return null;
  }
}
function writeDraft(flowId, data) {
  try {
    localStorage.setItem(
      draftKey(flowId),
      JSON.stringify({ ...data, _updatedAt: Date.now() })
    );
  } catch {}
}
function clearDraft(flowId) {
  try {
    localStorage.removeItem(draftKey(flowId));
  } catch {}
}

/* =========================================================
   Helper mappers (UI <-> Server)
========================================================= */

// "a=1&b=2" => [{key:'a', value:'1', type:'static'}, ...]
function toQueryParamsArray(queryStr = "") {
  return String(queryStr).trim()
    ? String(queryStr)
        .split("&")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((kv) => {
          const [key, ...rest] = kv.split("=");
          return {
            key: key?.trim() || "",
            value: rest.join("=") || "",
            type: "static",
          };
        })
    : [];
}

function uiToServerStep(step) {
  const s = step.data;
  if (step.type === "delay") {
    return {
      stepType: "waitSubscriber",
      title: s.title || "Wait",
      waitDuration: Number(s.amount || 0),
      waitUnit: s.unit || "minutes",
    };
  }
  if (s.actionKind === "send_email") {
    return {
      stepType: "sendMail",
      title: s.title || "Send Mail",
      sendMailTemplate: s.templateId || "",
      sendMailSubject: s.subject || "",
    };
  }
  if (s.actionKind === "http_request") {
    return {
      stepType: "sendWebhook",
      title: s.title || "Outgoing Request",
      webhookUrl: s.url || "",
      requestMethod: (s.method || "POST").toUpperCase(),
      retryAttempts: Number(s.retryAttempts ?? 0),
      retryAfterSeconds: Number(s.retryDelaySeconds ?? 3),
      queryParams: toQueryParamsArray(s.query),
    };
  }
  if (s.actionKind === "move_to_list") {
    return {
      stepType: "moveSubscriber",
      title: s.title || "Move to list",
      targetListId: s.targetListId || null,
    };
  }
  if (s.actionKind === "delete_from_current_list") {
    return {
      stepType: "removeSubscriber",
      title: s.title || "Remove from current list",
    };
  }
  if (s.actionKind === "delete_subscriber") {
    return {
      stepType: "deleteSubscriber",
      title: s.title || "Delete subscriber",
    };
  }
  return {
    stepType: "deleteSubscriber",
    title: s.title || "Delete subscriber",
  };
}

function serverToUiStep(sv) {
  if (sv.stepType === "waitSubscriber") {
    return {
      id: sv._id,
      type: "delay",
      data: { title: sv.title, amount: sv.waitDuration, unit: sv.waitUnit },
    };
  }
  if (sv.stepType === "sendMail") {
    return {
      id: sv._id,
      type: "action",
      data: {
        title: sv.title,
        actionKind: "send_email",
        templateId: sv.sendMailTemplate || "",
        subject: sv.sendMailSubject || "",
      },
    };
  }
  if (sv.stepType === "sendWebhook") {
    return {
      id: sv._id,
      type: "action",
      data: {
        title: sv.title,
        actionKind: "http_request",
        method: sv.requestMethod || "POST",
        url: sv.webhookUrl || "",
        query: (sv.queryParams || [])
          .map((q) => `${q.key}=${q.value}`)
          .join("&"),
        retryAttempts: sv.retryAttempts ?? 0,
        retryDelaySeconds: sv.retryAfterSeconds ?? 3,
      },
    };
  }
  if (sv.stepType === "moveSubscriber") {
    return {
      id: sv._id,
      type: "action",
      data: {
        title: sv.title,
        actionKind: "move_to_list",
        targetListId: sv.targetListId || "",
      },
    };
  }
  if (sv.stepType === "removeSubscriber") {
    return {
      id: sv._id,
      type: "action",
      data: { title: sv.title, actionKind: "delete_from_current_list" },
    };
  }
  if (sv.stepType === "deleteSubscriber") {
    return {
      id: sv._id,
      type: "action",
      data: { title: sv.title, actionKind: "delete_subscriber" },
    };
  }
  return null;
}

/* =========================================================
   API helpers
========================================================= */
async function fetchAutomationShell(flowId) {
  const res = await fetch(`${AUTOMATION_BASE}?automationId=${flowId}`, {
    cache: "no-store",
  });
  const json = await res.json();
  if (!json?.success)
    throw new Error(json?.message || "Failed to load automation");
  return json.data;
}

async function fetchSteps(flowId) {
  const res = await fetch(`${STEPS_BASE}?flowId=${flowId}`, {
    cache: "no-store",
  });
  const json = await res.json();
  if (!json?.success) throw new Error(json?.message || "Failed to load steps");
  return (json.data?.steps || [])
    .sort((a, b) => (a.stepCount || 0) - (b.stepCount || 0))
    .map(serverToUiStep)
    .filter(Boolean);
}

async function createServerStep(flowId, uiStep) {
  const payload = uiToServerStep(uiStep);
  const res = await fetch(STEPS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flowId, step: payload }),
  });
  const json = await res.json();
  if (!json?.success) throw new Error(json?.message || "Failed to create step");
  return json.data;
}

async function updateServerStep(flowId, stepId, stepData) {
  const res = await fetch(STEPS_BASE, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flowId, stepId, stepData }),
  });
  const json = await res.json();
  if (!json?.success) throw new Error(json?.message || "Failed to update step");
  return json.data;
}

async function deleteServerStep(flowId, stepId) {
  const res = await fetch(`${STEPS_BASE}?flowId=${flowId}&stepId=${stepId}`, {
    method: "DELETE",
  });
  const json = await res.json();
  if (!json?.success) throw new Error(json?.message || "Failed to delete step");
  return json.data;
}

/* =========================================================
   Loading Components
========================================================= */
function LoadingSpinner({ size = "md", className = "" }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12",
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <FiLoader className={`animate-spin text-blue-500 ${sizeClasses[size]}`} />
    </div>
  );
}

function SkeletonLoader({ lines = 3, className = "" }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-zinc-200 rounded animate-pulse"
          style={{ width: `${100 - i * 10}%` }}
        />
      ))}
    </div>
  );
}

function StepSkeleton() {
  return (
    <div className="w-full flex gap-3 group opacity-70">
      <div className="flex-1 overflow-hidden rounded-md border bg-white border-zinc-200">
        <div className="flex border-b border-zinc-200">
          <div className="w-10 p-2 bg-zinc-100 center-flex border-r border-zinc-200">
            <div className="w-6 h-6 bg-zinc-200 rounded animate-pulse" />
          </div>
          <div className="flex-1 p-3 between-flex gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-zinc-200 animate-pulse" />
              <div className="h-4 bg-zinc-200 rounded animate-pulse w-32" />
            </div>
            <div className="w-7 h-7 bg-zinc-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="p-4">
          <SkeletonLoader lines={2} />
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200">
          <div className="w-16 h-8 bg-zinc-200 rounded animate-pulse" />
          <div className="w-16 h-8 bg-zinc-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Empty States
========================================================= */
function EmptyState({
  icon: Icon = FiInbox,
  title,
  description,
  action,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center ${className}`}
    >
      <div className="w-16 h-16 rounded-md bg-zinc-100 border center-flex mb-4">
        <Icon className="w-8 h-8 text-zinc-500" />
      </div>
      <h3 className="text-lg font-medium text-zinc-700 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500 mb-4 max-w-md">{description}</p>
      {action}
    </div>
  );
}

/* =========================================================
   Confirm Dialog (Discard)
========================================================= */
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Discard",
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const first =
      ref.current?.querySelector("[data-autofocus]") ||
      ref.current?.querySelector("button");
    first?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "enter")
        onConfirm?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        ref={ref}
        className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-zinc-200">
          <div className="text-base font-semibold text-zinc-900">{title}</div>
        </div>
        <div className="px-5 py-4 text-sm text-zinc-600">{message}</div>
        <div className="px-5 py-4 flex gap-3 justify-end border-t border-zinc-200">
          <button
            className="px-4 py-2 rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-md border border-red-500 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            data-autofocus
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
ConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string,
  message: PropTypes.node,
  confirmLabel: PropTypes.string,
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func,
};

/* =========================================================
   Main Page (reads ?automationId=...)
========================================================= */
export default function WorkflowPage() {
  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    console.log(urlParams)
    return urlParams.get(param);
  }
 
  const [flowId, setFlowId] = useState()
  const [loadingShell, setLoadingShell] = useState(true);
  const [loadingError, setLoadingError] = useState(null);
  const [automation, setAutomation] = useState(null);
  const [websiteData, setWebsiteData] = useState(null);
  const [connectedList, setConnectedList] = useState(null);

  // automation-level drafts
  const [autoDraft, setAutoDraft] = useState({});
  const [hasUnsavedAutomation, setHasUnsavedAutomation] = useState(false);

  // steps child: register commit + dirty flag
  const childCommitRef = useRef(async () => {});
  const [childDirty, setChildDirty] = useState(false);

  // discard dialog
  const [discardOpen, setDiscardOpen] = useState(false);

  // processing states
  const [isProcessing, setIsProcessing] = useState(false);

  const addToast = useToastStore((s) => s.addToast);

  // hydrate shell + possible draft
  useEffect(() => {
    (async () => {
       const flowId = getQueryParam("automationId");
       setFlowId(flowId);
      if (!flowId) return;
      try {
        setLoadingShell(true);
        setLoadingError(null);
        const shell = await fetchAutomationShell(flowId);
        console.log(shell);
        setAutomation(shell.automation);
        setWebsiteData(shell.websiteData || null);
        setConnectedList(shell.connectedList || null);

        const d = readDraft(flowId);
        if (d?.automationPatch && Object.keys(d.automationPatch).length > 0) {
          setAutoDraft(d.automationPatch);
          setHasUnsavedAutomation(true);
          setAutomation((a) => ({ ...a, ...d.automationPatch }));
        }
      } catch (e) {
        console.error(e);
        setLoadingError(e.message || "Failed to load automation");
        addToast("Failed to load automation", "error");
      } finally {
        setLoadingShell(false);
      }
    })();
  }, [flowId, addToast]);

  const hasUnsaved = hasUnsavedAutomation || childDirty;

  // beforeunload guard
  useEffect(() => {
    const handler = (e) => {
      if (!hasUnsaved) return;
      e.preventDefault();
      e.returnValue = ""; // Chrome requires string
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  const saveAll = async () => {
    if (!flowId || isProcessing) return;
    try {
      setIsProcessing(true);
      addToast("Saving changes…", "info");

      // commit automation changes if staged
      if (hasUnsavedAutomation && autoDraft) {
        if (typeof autoDraft.isActive === "boolean") {
          const r = await fetch(AUTOMATION_BASE, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              automationId: flowId,
              status: "statusChange",
              updateData: { isActive: autoDraft.isActive },
            }),
          });
          const j = await r.json();
          if (!j?.success)
            throw new Error(j?.message || "Status update failed");
          setAutomation(j.data.automation);
        }
        if (autoDraft.name && autoDraft.name !== automation?.name) {
          const r = await fetch(AUTOMATION_BASE, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              automationId: flowId,
              status: "nameChange",
              updateData: { name: autoDraft.name },
            }),
          });
          const j = await r.json();
          if (!j?.success) throw new Error(j?.message || "Rename failed");
          setAutomation(j.data.automation);
        }
      }

      // commit steps
      await childCommitRef.current();

      // clear draft & flags
      clearDraft(flowId);
      setAutoDraft({});
      setHasUnsavedAutomation(false);
      setChildDirty(false);

      addToast("Saved ✓", "success");
    } catch (err) {
      console.error(err);
      addToast(err.message || "Save failed", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // staged status/name changes (draft only)
  const stageStatus = async (next) => {
    setAutomation((a) => ({ ...a, isActive: next }));
    setAutoDraft((d) => ({ ...d, isActive: next }));
    setHasUnsavedAutomation(true);
    writeDraft(flowId, {
      ...(readDraft(flowId) || {}),
      automationPatch: {
        ...(readDraft(flowId)?.automationPatch || {}),
        isActive: next,
      },
    });
  };
  const stageRename = async (newName) => {
    setAutomation((a) => ({ ...a, name: newName }));
    setAutoDraft((d) => ({ ...d, name: newName }));
    setHasUnsavedAutomation(true);
    writeDraft(flowId, {
      ...(readDraft(flowId) || {}),
      automationPatch: {
        ...(readDraft(flowId)?.automationPatch || {}),
        name: newName,
      },
    });
  };

  // Handle not found state
  if (!flowId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <EmptyState
          icon={FiSearch}
          title="No Automation Selected"
          description="Please select an automation from the list or create a new one."
          className="max-w-md"
        />
      </div>
    );
  }

  // Handle loading state
  if (loadingShell) {
    return (
      <div className="flex flex-col h-screen p-2">
        <div className="p-2">
          <div className="bg-white rounded-lg border border-zinc-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <LoadingSpinner />
              <div className="h-6 bg-zinc-200 rounded animate-pulse w-48" />
            </div>
            <SkeletonLoader lines={4} />
          </div>
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-4">
          <div className="bg-zinc-100 border border-zinc-200 rounded-md p-4">
            <SkeletonLoader lines={8} />
          </div>
          <div className="col-span-3 space-y-2 px-2">
            <div className="w-full h-10 bg-zinc-200 animate-pulse rounded-md"></div>

            <div className="center-flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <StepSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (loadingError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <Link href={"/automations"} className="btn btn-md btn-primary gap-2">
          <FiArrowLeft /> Go Back
        </Link>
        <EmptyState
          icon={FiAlertCircle}
          title="Failed to Load Automation"
          description={loadingError}
          action={
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          }
          className="max-w-md"
        />
      </div>
    );
  }

  // Handle not found automation
  if (!automation) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <EmptyState
          icon={FiSearch}
          title="Automation Not Found"
          description="The automation you're looking for doesn't exist or you don't have access to it."
          action={
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-md hover:bg-zinc-200 transition-colors"
            >
              Go Back
            </button>
          }
          className="max-w-md"
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen p-2`}>
      <div className="p-2">
        <FlowHeader
          flow={automation}
          saving={isProcessing}
          currentList={connectedList}
          website={websiteData}
          loadingFetching={loadingShell}
          errors={{}}
          // staged changes (draft)
          toggleFlowStatus={stageStatus}
          editFlowName={stageRename}
          // save / discard
          saveFlow={saveAll}
          hasUnsavedChanges={hasUnsaved}
          hasUnsavedStatusChanges={typeof autoDraft.isActive === "boolean"}
          hasUnsavedNameChanges={Boolean(autoDraft.name)}
          discardAllChanges={() => setDiscardOpen(true)}
          automationStats={automation?.stats || {}}
          allLists={[]}
          allWebsites={[]}
          handleChange={() => {}}
          deleteFlow={async () => {
            if (!flowId) return;
            if (!confirm("Delete this automation? This cannot be undone."))
              return;
            const res = await fetch(
              `${AUTOMATION_BASE}?automationId=${flowId}`,
              { method: "DELETE" }
            );
            const json = await res.json();
            if (!json?.success)
              addToast(json?.message || "Delete failed", "error");
          }}
        />
      </div>

      <div className="flex-1 min-h-0">
        <WorkflowBuilderInner
          flowId={flowId}
          currentList={connectedList}
          websiteId={websiteData?._id || null}
          onRegisterCommit={(fn) => (childCommitRef.current = fn)}
          onDirtyChange={setChildDirty}
        />
      </div>

      {/* Draft banner */}
      {hasUnsaved && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 px-3 py-2 text-xs shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
          Unsaved draft changes. Click{" "}
          <span className="font-semibold">Save</span> to apply, or Discard to
          revert.
        </div>
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-40 bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-lg flex items-center gap-3">
            <LoadingSpinner />
            <span className="text-zinc-700">Saving changes...</span>
          </div>
        </div>
      )}

      {/* Discard dialog */}
      <ConfirmDialog
        open={discardOpen}
        title="Discard all changes?"
        message={
          <div className="space-y-2">
            <p>
              This will revert the automation name/status and all step edits
              since your last save.
            </p>
            <p className="text-zinc-500">
              Only local drafts are affected — saved server data remains intact.
            </p>
          </div>
        }
        confirmLabel="Discard changes"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          clearDraft(flowId);
          location.reload(); // guaranteed reset to server state
        }}
      />
    </div>
  );
}

/* =========================================================
   Builder (fetches real lists/servers/templates)
========================================================= */
function WorkflowBuilderInner({
  flowId,
  websiteId,
  currentList,
  onRegisterCommit,
  onDirtyChange,
}) {
  const [steps, setSteps] = useState([]);
  const [serverSteps, setServerSteps] = useState([]); // snapshot from server
  const [history, setHistory] = useState([]);
  const [createModal, setCreateModal] = useState({ open: false, draft: null });
  const [editModal, setEditModal] = useState(null);
  const [loadingSteps, setLoadingSteps] = useState(true);
  const [stepsError, setStepsError] = useState(null);
  const canvasRef = useRef(null);

  // Real options
  const [listOpts, setListOpts] = useState([]);
  const [templateOpts, setTemplateOpts] = useState([]);
  const [serverOpts, setServerOpts] = useState([]);
  const [loadingOpts, setLoadingOpts] = useState(false);

  const addToast = useToastStore((s) => s.addToast);

  // Load steps + hydrate from draft if present (but ignore empty/stale drafts)
  useEffect(() => {
    (async () => {
      if (!flowId) return;
      try {
        setLoadingSteps(true);
        setStepsError(null);
        const svSteps = await fetchSteps(flowId);
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
        addToast("Failed to load steps", "error");
      } finally {
        setLoadingSteps(false);
      }
    })();
  }, [flowId, addToast]);

  // Persist draft & compute dirty flag
  useEffect(() => {
    if (!flowId) return;
    const dirty = stable(steps) !== stable(serverSteps);
    onDirtyChange?.(dirty || Boolean(readDraft(flowId)?.automationPatch));

    const d = readDraft(flowId) || {};
    writeDraft(flowId, { ...d, stepsDraft: steps });
  }, [steps, serverSteps, flowId, onDirtyChange]);

  // Load dropdown options (lists by website, templates, servers)
  useEffect(() => {
    (async () => {
      if (!websiteId) return; // lists filtered by website
      try {
        setLoadingOpts(true);

        const lr = await fetch(`${LISTS_BASE}?websiteId=${websiteId}`, {
          cache: "no-store",
        });
        const lj = await lr.json();
        const lists = Array.isArray(lj?.data) ? lj.data : [];
        setListOpts(lists.map((l) => ({ value: l._id, label: l.name })));

        const tr = await fetch(TEMPLATES_BASE, { cache: "no-store" });
        const tj = await tr.json();
        const templates = Array.isArray(tj?.data) ? tj.data : [];
        setTemplateOpts(
          templates.map((t) => ({ value: t._id, label: t.name }))
        );

        const sr = await fetch(SERVERS_BASE, { cache: "no-store" });
        const sj = await sr.json();
        const servers = Array.isArray(sj?.data) ? sj.data : [];
        setServerOpts(
          servers.map((s) => ({ value: String(s._id), label: s.name }))
        );
      } catch (e) {
        console.error("Options load failed:", e);
        addToast("Failed to load options", "error");
      } finally {
        setLoadingOpts(false);
      }
    })();
  }, [websiteId, addToast]);

  /* --- Add (DnD) --- */
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
    addToast("Step added (draft)", "success");
  };
  const cancelDraft = () => setCreateModal({ open: false, draft: null });

  /* --- Edit --- */
  const openEdit = (id) => setEditModal(id);
  const closeEdit = () => setEditModal(null);
  const saveEdit = async (patch) => {
    setSteps((arr) =>
      arr.map((s) =>
        s.id === editModal ? { ...s, data: { ...s.data, ...(patch || {}) } } : s
      )
    );
    setEditModal(null);
    addToast("Step updated (draft)", "success");
  };

  /* --- Delete (with confirm) --- */
  const onDeleteStep = async (stepId) => {
    const s = steps.find((x) => x.id === stepId);
    const title = s?.data?.title || "this step";
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    setSteps((arr) => arr.filter((s) => s.id !== stepId));
    addToast("Step deleted (draft)", "info");
  };

  /* --- Reorder (left handle -> inline drop zone) --- */
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

  // Strictly validated reorder: drop "onto" step i means "place BEFORE i"
  const onInlineDrop = (targetIndex) => (e) => {
    if (!e.dataTransfer.types.includes("application/x-reorder")) return;
    e.preventDefault();

    const { fromIndex } = dragState.current;
    dragState.current = { fromIndex: null, stepId: null };
    if (fromIndex == null || fromIndex < 0 || fromIndex >= steps.length) return;

    // compute the insertion rule
    const droppingDownward = fromIndex < targetIndex;

    // Work on a copy
    const next = [...steps];
    const [moved] = next.splice(fromIndex, 1);

    // If we removed from above, the target shifts left by 1.
    // AFTER target (downward): insert at targetIndex (because target is now targetIndex-1)
    // BEFORE target (upward): insert at targetIndex (target index unchanged)
    let insertIndex = droppingDownward ? targetIndex : targetIndex;

    // Guard rails
    insertIndex = Math.max(0, Math.min(insertIndex, next.length));

    // If nothing actually changes, bail early
    const noOp =
      insertIndex === fromIndex ||
      (next[insertIndex] && next[insertIndex].id === moved.id);

    if (noOp) {
      addToast("No change in order.", "info");
      return;
    }

    next.splice(insertIndex, 0, moved);
    setSteps(next);
    setHistory((h) => [
      ...h,
      {
        type: "reorder",
        fromIndex,
        toIndex: insertIndex,
        stepId: moved.id,
        at: new Date().toISOString(),
      },
    ]);
    addToast("Step moved (draft)", "success");
  };

  /* --- Commit (diff) --- */
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

    // 1) create new steps and map temp -> real ids
    const idMap = {};
    for (const s of created) {
      const createdRes = await createServerStep(flowId, s);
      idMap[s.id] = createdRes._id;
    }

    // 2) prepare current list with real ids
    const withRealIds = current.map((s) =>
      idMap[s.id] ? { ...s, id: idMap[s.id] } : s
    );

    // 3) updates
    for (const s of updated) {
      const realId = idMap[s.id] || s.id;
      const serverData = uiToServerStep(s);
      serverData.stepCount =
        withRealIds.findIndex((x) => (idMap[x.id] || x.id) === realId) + 1;
      await updateServerStep(flowId, realId, serverData);
    }

    // 4) deletes
    for (const s of deleted) {
      await deleteServerStep(flowId, s.id);
    }

    // 5) ordering sync (now that all ids are real)
    const jobs = withRealIds.map((s, idx) => {
      const mapped = uiToServerStep(s);
      const stepData = { ...mapped, stepCount: idx + 1 };
      return updateServerStep(flowId, s.id, stepData);
    });
    await Promise.all(jobs);

    // 6) refresh snapshot and local
    const fresh = await fetchSteps(flowId);
    setServerSteps(fresh);
    setSteps(fresh);
  }, [flowId, steps, serverSteps]);

  useEffect(() => {
    onRegisterCommit?.(commit);
  }, [commit, onRegisterCommit]);

  const stepCount = (id) => steps.findIndex((s) => s.id === id) + 1;

  // Handle loading steps
  if (loadingSteps) {
    return (
      <div className="grid grid-cols-4 h-full relative">
        <Sidebar onAddDragStart={onAddDragStart} />
        <div className="w-full col-span-3 h-full overflow-y-auto">
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

  // Handle steps error
  if (stepsError) {
    return (
      <div className="grid grid-cols-4 h-full relative">
        <Sidebar onAddDragStart={onAddDragStart} />
        <div className="w-full col-span-3 h-full overflow-y-auto">
          <div className="relative flex-1 overflow-y-auto overflow-x-hidden px-2">
            <div className="mx-auto w-full max-w-[820px] px-4 pb-16">
              <EmptyState
                icon={FiAlertCircle}
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

  return (
    <div className="grid grid-cols-4 h-full relative">
      <Sidebar onAddDragStart={onAddDragStart} />
      <div className="w-full col-span-3 h-full overflow-y-auto">
        <div
          ref={canvasRef}
          className={`relative flex-1 overflow-y-auto overflow-x-hidden px-2`}
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
                Drag the grid handle; drop on a step to place
                <b> after it when dragging downward</b> and{" "}
                <b>before it when dragging upward</b>.
              </span>
            )}
          </div>

          <div className="mx-auto w-full max-w-[820px] px-4 pb-16">
            {steps.length === 0 && (
              <EmptyState
                icon={FiInbox}
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
                    count={stepCount(s.id)}
                    onEdit={() => openEdit(s.id)}
                    onDelete={() => onDeleteStep(s.id)}
                    onDragStartReorder={onReorderDragStart(i, s.id)}
                    canDropInline={steps.length > 1}
                    onInlineDragOver={onInlineDragOver(i)}
                    onInlineDrop={onInlineDrop(i)}
                  />
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create modal (uses real options) */}
      <ConfigModal
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
        currentList={currentList}
        templateOptions={templateOpts}
        serverOptions={serverOpts}
      />

      {/* Edit modal (uses real options) */}
      <ConfigModal
        mode="edit"
        open={Boolean(editModal)}
        step={editModal ? steps.find((s) => s.id === editModal) : null}
        onClose={closeEdit}
        onSave={saveEdit}
        listOptions={listOpts}
        templateOptions={templateOpts}
        serverOptions={serverOpts}
      />
    </div>
  );
}

WorkflowBuilderInner.propTypes = {
  flowId: PropTypes.string,
  websiteId: PropTypes.string,
  onRegisterCommit: PropTypes.func,
  onDirtyChange: PropTypes.func,
};

/* =========================================================
   UI bits
========================================================= */
function Sidebar({ onAddDragStart }) {
  return (
    <aside
      className={`h-full overflow-y-auto bg-zinc-100 border border-zinc-200 rounded-md`}
    >
      <div className="p-4 space-y-6">
        <div>
          <h3 className="text-sm md:text-base font-semibold text-zinc-900 mb-1">
            Actions
          </h3>
          <p className={`text-xs ${COLORS.subtext} mb-3`}>
            Drag to canvas → configure → Save.
          </p>

          <div className="grid grid-cols-1 gap-2">
            <PaletteItem
              label="Send Mail"
              draggableType="action"
              description="Template or custom HTML"
              preset={{ title: "Send Mail", actionKind: "send_email" }}
              onDragStart={onAddDragStart}
            />
            <PaletteItem
              label="Outgoing Request"
              draggableType="action"
              description="HTTP request to your API"
              preset={{
                title: "Outgoing Request",
                actionKind: "http_request",
                method: "POST",
              }}
              onDragStart={onAddDragStart}
            />
            <PaletteItem
              label="Move to targeted list"
              draggableType="action"
              description="Move subscriber to another list"
              preset={{
                title: "Move to targeted list",
                actionKind: "move_to_list",
              }}
              onDragStart={onAddDragStart}
            />
            <PaletteItem
              label="Delete from current list"
              draggableType="action"
              description="Remove subscriber from this list"
              preset={{
                title: "Delete from current list",
                actionKind: "delete_from_current_list",
              }}
              onDragStart={onAddDragStart}
            />
            <PaletteItem
              label="Delete subscriber"
              draggableType="action"
              description="Permanently delete the subscriber"
              preset={{
                title: "Delete subscriber",
                actionKind: "delete_subscriber",
              }}
              onDragStart={onAddDragStart}
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm md:text-base font-semibold text-zinc-900 mb-1">
            Delays
          </h3>
          <p className={`text-xs ${COLORS.subtext} mb-3`}>Pause the flow.</p>
          <div className="grid grid-cols-1 gap-2">
            <PaletteItem
              label="Wait"
              draggableType="delay"
              description="Wait seconds/minutes/hours/days…"
              preset={{ title: "Wait", amount: 3, unit: "minutes" }}
              onDragStart={onAddDragStart}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
Sidebar.propTypes = { onAddDragStart: PropTypes.func.isRequired };

function PaletteItem({
  label,
  description,
  draggableType,
  preset,
  onDragStart,
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, draggableType, preset)}
      className="w-full text-left rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 transition-all p-3 cursor-grab active:cursor-grabbing shadow-xs"
      title="Drag to canvas"
    >
      <div className="text-sm font-medium text-zinc-900">{label}</div>
      {description && (
        <div className={`text-xs ${COLORS.subtext} mt-1`}>{description}</div>
      )}
    </div>
  );
}
PaletteItem.propTypes = {
  label: PropTypes.string.isRequired,
  description: PropTypes.string,
  draggableType: PropTypes.oneOf(["action", "delay"]).isRequired,
  preset: PropTypes.object,
  onDragStart: PropTypes.func.isRequired,
};

function Connector() {
  return (
    <div className="text-3xl my-4 text-zinc-500" title="Next">
      <HiArrowLongDown />
    </div>
  );
}

/**
 * Polished StepCard with richer visuals, safer Tailwind color handling,
 * and small UX touches (icons, focus states, subtle animations).
 * Props unchanged from your original.
 */

const colorMap = {
  delay: {
    header: "bg-violet-50 border-violet-200",
    badge: "bg-violet-100 text-violet-700",
    ring: "ring-violet-200",
    icon: <FiClock className="w-4 h-4" />,
  },
  action: {
    header: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    ring: "ring-blue-200",
    icon: <FiZap className="w-4 h-4" />,
  },
  default: {
    header: "bg-zinc-50 border-zinc-200",
    badge: "bg-zinc-100 text-zinc-700",
    ring: "ring-zinc-200",
    icon: <FiLink2 className="w-4 h-4" />,
  },
};

function StepCard({
  step,
  count,
  onEdit,
  onDelete,
  onDragStartReorder,
  canDropInline,
  onInlineDragOver,
  onInlineDrop,
}) {
  const kind =
    step?.type === "delay"
      ? "delay"
      : step?.type === "action"
      ? "action"
      : "default";
  const colors = colorMap[kind] || colorMap.default;

  const isAction = step?.type === "action";
  const isDelay = step?.type === "delay";

  return (
    <div className="w-full flex gap-3 group">
      {/* Main Card */}
      <div
        className={`flex-1 overflow-hidden rounded-md border bg-white transition-all duration-200 border-zinc-200`}
      >
        {/* Header */}
        <div className={`flex border-b border-zinc-200`}>
          <div
            className={`w-10 p-2 bg-white center-flex cursor-grab active:cursor-grabbing select-none transition-all hover:bg-zinc-50 hover:border-zinc-300 border-r border-zinc-200`}
            draggable
            onDragStart={onDragStartReorder}
            title="Drag to reorder"
            aria-label="Drag handle"
            tabIndex={0}
          >
            <RxDragHandleVertical className="w-full h-full text-zinc-600" />
          </div>

          <div className="w-full flex-1 p-2 between-flex gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-10 rounded-sm bg-zinc-200 center-flex text-zinc-700">
                {colors.icon}
              </div>
              <span className="text-sm md:text-base text-zinc-800 truncate">
                {step?.data?.title || "Untitled step"}
              </span>
            </div>
          </div>
          <div
            className={`w-10 p-2 bg-white text-zinc-700 center-flex flex-col transition-all border-l border-zinc-200`}
          >
            {count}
            <span className="text-xxs text-zinc-500">Step</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-4 py-3.5 text-xs">
          {isDelay && (
            <div className="flex items-center gap-2">
              <div>
                <span
                  className={`px-2 py-1 rounded text-xs bg-sky-100 border border-sky-400 uppercase`}
                >
                  Delay
                </span>{" "}
                :
              </div>
              <div>
                <span className="text-zinc-700">
                  <span className="text-zinc-900 font-semibold">
                    {step?.data?.amount}
                  </span>{" "}
                  {step?.data?.unit}
                </span>
              </div>
            </div>
          )}

          {isAction && (
            <>
              <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 mb-3">
                <div>
                  <span
                    className={`px-2 py-1 rounded text-xs bg-sky-100 border border-sky-400 uppercase`}
                  >
                    Action
                  </span>{" "}
                  :
                </div>
                <div className="text-sm  text-zinc-700">
                  {step?.data?.actionKind === "send_email"
                    ? "Send Mail"
                    : step?.data?.actionKind === "http_request"
                    ? "Outgoing Request"
                    : step?.data?.actionKind === "move_to_list"
                    ? "Move to List"
                    : step?.data?.actionKind === "delete_from_current_list"
                    ? "Delete from Current List"
                    : step?.data?.actionKind === "delete_subscriber"
                    ? "delete_subscriber"
                    : step?.data?.actionKind}
                </div>
              </div>

              {step?.data?.actionKind === "send_email" && (
                <div className="space-y-2">
                  {step?.data?.templateId && (
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="px-2 py-1 text-zinc-600 text-xs font-medium border-l-2 border-orange-400 uppercase">
                        Template
                      </span>
                      <span className="text-zinc-900 font-medium truncate max-w-[220px]">
                        {step.data.templateId}
                      </span>
                    </div>
                  )}
                  {step?.data?.subject && (
                    <Row label="Subject" value={step.data.subject} />
                  )}
                </div>
              )}

              {step?.data?.actionKind === "http_request" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="px-2 py-1 text-zinc-600 text-xs font-medium border-l-2 border-green-400 uppercase">
                      {step?.data?.method || "GET"}
                    </span>
                    <span className="text-zinc-900 font-medium truncate max-w-[220px]">
                      {step?.data?.url || "—"}
                    </span>
                  </div>
                  {step?.data?.query && (
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="px-2 py-1 text-zinc-600 text-xs font-medium border-l-2 border-purple-400 uppercase">
                        Query:
                      </span>
                      <span className="text-zinc-900 font-medium">
                        {step.data.query}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-baseline gap-1.5 pt-1 text-sm">
                    <span className="px-2 py-1 text-zinc-600 text-xs font-medium border-l-2 border-yellow-400 uppercase">
                      Retries:
                    </span>
                    <span className="text-zinc-900 font-medium">
                      {step?.data?.retryAttempts}
                    </span>
                    <span className="text-zinc-400">•</span>
                    <span className="px-2 py-1 text-zinc-600 text-xs font-medium border-l-2 border-yellow-400 uppercase">
                      Delay:
                    </span>
                    <span className="text-zinc-900 font-medium">
                      {step?.data?.retryDelaySeconds}s
                    </span>
                  </div>
                </div>
              )}

              {step?.data?.actionKind === "move_to_list" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="px-2 py-1 text-zinc-600 text-xs font-medium border-l-2 border-green-400 uppercase">
                      Target List
                    </span>
                    <span className="text-zinc-900 font-medium truncate max-w-[220px]">
                      {step?.data?.targetListId || "—"}
                    </span>
                  </div>
                </div>
              )}

              {step?.data?.actionKind === "delete_subscriber" && (
                <div className="space-y-2">
                  {step?.data?.reason && (
                    <Row label="Reason" value={step.data.reason} />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200">
          <button className="btn btn-xs btn-primary" onClick={onEdit}>
            <FiEdit2 /> Edit
          </button>
          <button
            className="btn btn-xs border border-zinc-400 text-zinc-700 center-flex gap-1 rounded hover:bg-red-500 hover:text-white"
            onClick={onDelete}
          >
            <FiTrash2 /> Delete
          </button>
        </div>
      </div>

      {/* Inline Drop Rail */}
      <div
        className={`h-auto w-1/4 shrink-0 transition-all duration-200 rounded-lg ${
          canDropInline
            ? "border-[2px] border-dashed border-blue-200"
            : "opacity-0 border border-zinc-200 group-hover:bg-zinc-50"
        }`}
        onDragOver={canDropInline ? onInlineDragOver : undefined}
        onDrop={canDropInline ? onInlineDrop : undefined}
        title={canDropInline ? "Drop here to place BEFORE this step" : ""}
        aria-label="Drop zone"
      >
        {canDropInline && (
          <div className="h-full w-full flex flex-col items-center justify-center text-xs text-blue-400 p-2">
            <span className="text-center">Dropdown Zone</span>
          </div>
        )}
      </div>
    </div>
  );
}

StepCard.propTypes = {
  step: PropTypes.object.isRequired,
  count: PropTypes.number.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onDragStartReorder: PropTypes.func.isRequired,
  canDropInline: PropTypes.bool,
  onInlineDragOver: PropTypes.func,
  onInlineDrop: PropTypes.func,
};

function Row({ label, value }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-zinc-500">{label}:</span>
      <span className="text-zinc-900 truncate max-w-48">{value}</span>
    </div>
  );
}
Row.propTypes = { label: PropTypes.node, value: PropTypes.node };

/* =========================================================
   Config Modal (Create/Edit)
========================================================= */
function ConfigModal({
  mode,
  open,
  step,
  onClose,
  onSave,
  listOptions = [],
  currentList,
  templateOptions = [],
}) {
  console.log(currentList);
  const tokens = ["{{email}}", "{{fullName}}", "{{expireDate}}"];
  const isOpen = open && step;
  if (!isOpen) return null;

  const isAction = step.type === "action";
  const isDelay = step.type === "delay";

  const [local, setLocal] = useState(() => ({ ...step.data }));
  const set = (patch) => setLocal((l) => ({ ...l, ...patch }));

  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n || 0)));
  const parsePlaceholders = useCallback((html) => {
    if (!html) return { placeholders: new Set(), length: 0 };
    const patterns = [
      /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
      /\{([a-zA-Z0-9_.-]+)\}/g,
      /\[([a-zA-Z0-9_.-]+)\]/g,
    ];
    const found = new Set();
    for (const re of patterns) {
      let m;
      while ((m = re.exec(html))) found.add(m[1]);
    }
    return { placeholders: found, length: html.length };
  }, []);

  const save = async () => {
    let patch = { ...local };
    if (local.actionKind === "send_email" && local.rawHtml) {
      patch.rawHtmlSummary = parsePlaceholders(local.rawHtml);
    }
    if (local.actionKind === "http_request") {
      patch.retryAttempts = clamp(local.retryAttempts, 1, 7);
      patch.retryDelaySeconds = clamp(local.retryDelaySeconds, 1, 300);
    }
    await onSave(patch);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-5xl h-[90vh] overflow-hidden rounded-lg bg-zinc-100 flex flex-col">
        <div className="between-flex p-4 px-6 bg-white">
          <div className="text-lg font-semibold text-zinc-900">
            {mode === "create" ? "Create Step" : "Edit Step"} •{" "}
            {step.data.title}
          </div>
          <div className="flex gap-3">
            <button className="btn btn-md btn-second" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-md btn-add" onClick={save}>
              Save Changes
            </button>
          </div>
        </div>

        <div className="w-full h-full overflow-y-auto p-6 space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-800">Title</label>
            <input
              className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
              value={local.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Step title"
            />
          </div>

          {isDelay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-800">
                  Amount
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                  value={local.amount}
                  onChange={(e) => set({ amount: Number(e.target.value || 0) })}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-800">
                  Unit
                </label>
                <DropdownSearch
                  options={[
                    { value: "seconds", label: "seconds" },
                    { value: "minutes", label: "minutes" },
                    { value: "hours", label: "hours" },
                    { value: "days", label: "days" },
                    { value: "weeks", label: "weeks" },
                    { value: "months", label: "months" },
                  ]}
                  value={local.unit}
                  onChange={(v) => set({ unit: v })}
                  placeholder="Select a unit..."
                  className="max-w-none"
                  isLoading={false}
                />{" "}
              </div>
            </div>
          )}

          {isAction && (
            <>
              {/* SEND EMAIL */}
              {local.actionKind === "send_email" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-zinc-800">
                        Email Template
                      </label>
                      <DropdownSearch
                        options={templateOptions}
                        value={local.templateId}
                        onChange={(v) => set({ templateId: v })}
                        placeholder="Select a template…"
                        className="w-full"
                      />
                    </div>

                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-zinc-800">
                        Subject Line
                      </label>
                      <input
                        className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                        value={local.subject}
                        onChange={(e) => set({ subject: e.target.value })}
                        placeholder="Email subject"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 bg-white p-3 rounded-md">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-zinc-700">
                        Custom HTML (optional)
                      </label>
                    </div>

                    <div className="mb-2 text-xs text-zinc-500">
                      Supported placeholders:{" "}
                      <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-blue-600">{`{email}`}</code>
                      ,{" "}
                      <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-blue-600">{`{{email}}`}</code>
                      ,{" "}
                      <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-blue-600">{`[email]`}</code>
                    </div>
                  </div>
                </>
              )}

              {/* HTTP REQUEST */}
              {local.actionKind === "http_request" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-zinc-700">
                        HTTP Method
                      </label>
                      <DropdownSearch
                        options={[
                          { value: "GET", label: "GET" },
                          { value: "POST", label: "POST" },
                          { value: "PUT", label: "PUT" },
                          { value: "PATCH", label: "PATCH" },
                          { value: "DELETE", label: "DELETE" },
                        ]}
                        value={local.method}
                        onChange={(v) => set({ method: v })}
                        placeholder="Select HTTP method..."
                        className="w-full"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-zinc-700">
                        URL Endpoint
                      </label>
                      <input
                        className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                        value={local.url}
                        onChange={(e) => set({ url: e.target.value })}
                        placeholder="https://api.example.com/endpoint"
                      />
                    </div>
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-zinc-700">
                      Query Parameters
                    </label>
                    <TokenRow
                      tokens={tokens}
                      onAdd={(t) =>
                        set({
                          query:
                            (local.query || "") + (local.query ? " " : "") + t,
                        })
                      }
                    />
                    <input
                      className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                      value={local.query}
                      onChange={(e) => set({ query: e.target.value })}
                      placeholder="key=value&key2=value2"
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-zinc-700">
                      Request Headers
                    </label>
                    <TokenRow
                      tokens={tokens}
                      onAdd={(t) =>
                        set({
                          headers:
                            (local.headers || "") +
                            (local.headers ? " " : "") +
                            t,
                        })
                      }
                    />
                    <textarea
                      className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                      rows={3}
                      value={local.headers}
                      onChange={(e) => set({ headers: e.target.value })}
                      placeholder='{"Authorization":"Bearer ..."}'
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-zinc-700">
                      Request Body
                    </label>
                    <TokenRow
                      tokens={tokens}
                      onAdd={(t) =>
                        set({
                          body:
                            (local.body || "") + (local.body ? " " : "") + t,
                        })
                      }
                    />
                    <textarea
                      className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                      rows={4}
                      value={local.body}
                      onChange={(e) => set({ body: e.target.value })}
                      placeholder='{"email":"{{email}}","name":"{{fullName}}"}'
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-zinc-700">
                        Retry Attempts (1–7)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={7}
                        className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                        value={local.retryAttempts}
                        onChange={(e) => set({ retryAttempts: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-zinc-700">
                        Retry Delay (seconds)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                        value={local.retryDelaySeconds}
                        onChange={(e) =>
                          set({ retryDelaySeconds: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              {/* MOVE TO LIST */}
              {local.actionKind === "move_to_list" && (
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-zinc-700">
                    Target List
                  </label>
                  <DropdownSearch
                    options={listOptions.filter(
                      (l) => l.value !== currentList?._id
                    )}
                    value={local.targetListId}
                    onChange={(v) => set({ targetListId: v })}
                    placeholder="Select a list…"
                    className="max-w-none"
                    isLoading={false}
                  />
                </div>
              )}

              {/* DELETE SUBSCRIBER */}
              {local.actionKind === "delete_subscriber" && (
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-zinc-700">
                    Deletion Reason (Optional)
                  </label>
                  <input
                    className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                    value={local.reason}
                    onChange={(e) => set({ reason: e.target.value })}
                    placeholder="Reason for deletion..."
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

ConfigModal.propTypes = {
  mode: PropTypes.oneOf(["create", "edit"]).isRequired,
  open: PropTypes.bool.isRequired,
  step: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  listOptions: PropTypes.array,
  templateOptions: PropTypes.array,
  serverOptions: PropTypes.array,
};

function TokenRow({ tokens, onAdd }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tokens.map((t) => (
        <button
          key={t}
          type="button"
          className="px-2 py-1 text-[11px] rounded border border-zinc-200 bg-white hover:border-zinc-400 transition-colors"
          onClick={() => onAdd(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
TokenRow.propTypes = {
  tokens: PropTypes.arrayOf(PropTypes.string).isRequired,
  onAdd: PropTypes.func.isRequired,
};
