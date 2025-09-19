"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { FiAlertCircle, FiArrowLeft, FiSearch } from "react-icons/fi";

import useCustomerStore from "@/store/useCustomerStore";
import { useToastStore } from "@/store/useToastStore";
import { fetchWithAuthCustomer } from "@/helpers/front-end/request";
import { GetUrlParams, LoadingSpinner } from "@/presets/styles";

import FlowHeader from "./components/FlowHeader";
import BuilderCanvas from "./components/BuilderCanvas";
import { EmptyState } from "./components/EmptyStates";
import { readDraft, writeDraft, clearDraft } from "./utils/drafts";

const AUTOMATION_BASE = `/api/work-flow/flow`;

export default function AutomationBuilderPage() {
  const { customer, token } = useCustomerStore(); // ✅ always import & use
  const { showSuccess, showError, showInfo } = useToastStore();

  const [flowId, setFlowId] = useState(null);
  const [loadingShell, setLoadingShell] = useState(true);
  const [loadingError, setLoadingError] = useState(null);

  const [automation, setAutomation] = useState(null);
  const [connectedList, setConnectedList] = useState(null);

  // staged header edits
  const [autoDraft, setAutoDraft] = useState({});
  const [hasUnsavedAutomation, setHasUnsavedAutomation] = useState(false);

  // child (steps) commit + dirty
  const childCommitRef = useRef(async () => {});
  const [childDirty, setChildDirty] = useState(false);

  const hasUnsaved = hasUnsavedAutomation || childDirty;

  // read automationId from URL
  useEffect(() => {
    const params = GetUrlParams();
    setFlowId(params.automationId || null);
  }, []);

  // load shell
  useEffect(() => {
    if (!flowId) return;
    (async () => {
      try {
        setLoadingShell(true);
        setLoadingError(null);

        const res = await fetchWithAuthCustomer({
          url: `${AUTOMATION_BASE}?automationId=${flowId}`,
          method: "GET",
          customer,
          token,
        });

        if (!res?.success)
          throw new Error(res?.message || "Failed to load automation");

        const shell = res.data;
        setAutomation(shell.automation || null);
        setConnectedList(shell.connectedList || null);

        const local = readDraft(flowId);
        if (
          local?.automationPatch &&
          Object.keys(local.automationPatch).length
        ) {
          setAutoDraft(local.automationPatch);
          setHasUnsavedAutomation(true);
          setAutomation((a) => ({ ...a, ...local.automationPatch }));
        }
      } catch (e) {
        console.error(e);
        setLoadingError(e.message || "Failed to load automation");
        showError("Failed to load automation");
      } finally {
        setLoadingShell(false);
      }
    })();
  }, [flowId, customer, token, showError]);

  // onbeforeunload guard
  useEffect(() => {
    const handler = (e) => {
      if (!hasUnsaved) return;
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  // stage changes (draft only)
  const stageStatus = useCallback(
    (next) => {
      setAutomation((a) => ({ ...a, isActive: next }));
      setAutoDraft((d) => ({ ...d, isActive: next }));
      setHasUnsavedAutomation(true);
      const prior = readDraft(flowId) || {};
      writeDraft(flowId, {
        ...prior,
        automationPatch: { ...(prior.automationPatch || {}), isActive: next },
      });
    },
    [flowId]
  );
  const stageRename = useCallback(
    (newName) => {
      setAutomation((a) => ({ ...a, name: newName }));
      setAutoDraft((d) => ({ ...d, name: newName }));
      setHasUnsavedAutomation(true);
      const prior = readDraft(flowId) || {};
      writeDraft(flowId, {
        ...prior,
        automationPatch: { ...(prior.automationPatch || {}), name: newName },
      });
    },
    [flowId]
  );

  // Save header + steps
  const saveAll = useCallback(async () => {
    if (!flowId) return;
    try {
      showInfo?.("Saving changes…");
      // 1) header
      if (hasUnsavedAutomation && autoDraft) {
        if (typeof autoDraft.isActive === "boolean") {
          const r1 = await fetchWithAuthCustomer({
            url: AUTOMATION_BASE,
            method: "PUT",
            payload: {
              automationId: flowId,
              status: "statusChange",
              updateData: { isActive: autoDraft.isActive },
            },
            customer,
            token,
          });
          if (!r1?.success)
            throw new Error(r1?.message || "Status update failed");
          setAutomation(r1.data.automation);
        }
        console.log(autoDraft.name, autoDraft.name)
        if (autoDraft.name && automation?.name) {
          const r2 = await fetchWithAuthCustomer({
            url: AUTOMATION_BASE,
            method: "PUT",
            payload: {
              automationId: flowId,
              status: "nameChange",
              updateData: { name: autoDraft.name },
            },
            customer,
            token,
          });
          if (!r2?.success) throw new Error(r2?.message || "Rename failed");
          setAutomation(r2.data.automation);
        }
      }
      // 2) steps (child)
      await childCommitRef.current();

      // 3) clear drafts
      clearDraft(flowId);
      setAutoDraft({});
      setHasUnsavedAutomation(false);
      setChildDirty(false);

      showSuccess?.("Saved ✓");
    } catch (err) {
      console.error(err);
      showError?.(err.message || "Save failed");
    }
  }, [
    flowId,
    automation?.name,
    autoDraft,
    hasUnsavedAutomation,
    customer,
    token,
    showSuccess,
    showError,
    showInfo,
  ]);

  // Rendering short-circuits
  if (!flowId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <EmptyState
          icon={FiSearch}
          title="No Automation Selected"
          description="Please open from the Automations list."
          className="max-w-md"
        />
      </div>
    );
  }

  if (loadingShell) {
    return (
      <div className="w-full h-screen center-flex">
        <LoadingSpinner
          title={"Processing!"}
          subLine={"Fetch the Work-Flow from API"}
        />
      </div>
    );
  }

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

  if (!automation) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <EmptyState
          icon={FiSearch}
          title="Automation Not Found"
          description="It may not exist or you don't have access."
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
    <div className="flex flex-col h-screen bg-zinc-200">
      <div className="w-full max-w-[90rem] mx-auto px-2">
        <FlowHeader
          flow={automation}
          saving={false}
          currentList={connectedList}
          // staged changes
          toggleFlowStatus={stageStatus}
          editFlowName={stageRename}
          // save / discard
          saveFlow={saveAll}
          hasUnsavedChanges={hasUnsaved}
          hasUnsavedStatusChanges={typeof autoDraft.isActive === "boolean"}
          hasUnsavedNameChanges={Boolean(autoDraft.name)}
          discardAllChanges={() => {
            clearDraft(flowId);
            location.reload();
          }}
          automationStats={automation?.stats || {}}
          handleChange={() => {}}
          deleteFlow={async () => {
            if (!confirm("Delete this automation? This cannot be undone."))
              return;
            const res = await fetchWithAuthCustomer({
              url: `${AUTOMATION_BASE}?automationId=${flowId}`,
              method: "DELETE",
              customer,
              token,
            });
            if (!res?.success)
              return showError?.(res?.message || "Delete failed");
            showSuccess?.("Automation deleted");
            window.location.href = "/automations";
          }}
        />
      </div>

      <div className="flex-1 min-h-0">
        <BuilderCanvas
          flowId={flowId}
          currentList={connectedList}
          onRegisterCommit={(fn) => (childCommitRef.current = fn)}
          onDirtyChange={setChildDirty}
        />
      </div>

      {hasUnsaved && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 px-3 py-2 text-xs shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
          Unsaved draft changes. Save to apply, or Discard to revert.
        </div>
      )}
    </div>
  );
}
