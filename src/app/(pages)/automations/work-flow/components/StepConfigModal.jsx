"use client";
import PropTypes from "prop-types";
import { useState, useCallback } from "react";
import { DropdownSearch } from "@/components/DropdownSearch";

export default function StepConfigModal({
  mode,
  open,
  step,
  onClose,
  onSave,
  listOptions = [],
  currentList,
  templateOptions = [],
  serverOptions = [],
}) {
  if (!open || !step) return null;
  const isAction = step.type === "action";
  const isDelay = step.type === "delay";

  const [local, setLocal] = useState(() => ({ ...step.data }));
  const set = (patch) => setLocal((l) => ({ ...l, ...patch }));

  const tokens = ["{{email}}", "{{fullName}}", "{{expireDate}}"];

  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n || 0)));
  const parsePlaceholders = useCallback((html) => {
    if (!html) return { placeholders: new Set(), length: 0 };
    const re = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
    const found = new Set();
    let m;
    while ((m = re.exec(html))) found.add(m[1]);
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
            {mode === "create" ? "Create Step" : "Edit Step"} • {step.data.title}
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
          {/* Title */}
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
                <label className="text-sm font-medium text-zinc-800">Amount</label>
                <input
                  type="number"
                  className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                  value={local.amount}
                  onChange={(e) => set({ amount: Number(e.target.value || 0) })}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-800">Unit</label>
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
                />
              </div>
            </div>
          )}

          {isAction && (
            <>
              {local.actionKind === "send_email" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-zinc-800">Email Template</label>
                      <DropdownSearch
                        options={templateOptions}
                        value={local.templateId}
                        onChange={(v) => set({ templateId: v })}
                        placeholder="Select a template…"
                        className="w-full"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-zinc-800">Subject Line</label>
                      <input
                        className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                        value={local.subject}
                        onChange={(e) => set({ subject: e.target.value })}
                        placeholder="Email subject"
                      />
                    </div>
                  </div>
                </>
              )}

              {local.actionKind === "http_request" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-zinc-700">HTTP Method</label>
                      <DropdownSearch
                        options={["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({
                          value: m,
                          label: m,
                        }))}
                        value={local.method}
                        onChange={(v) => set({ method: v })}
                        placeholder="Select HTTP method..."
                        className="w-full"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-zinc-700">URL Endpoint</label>
                      <input
                        className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                        value={local.url}
                        onChange={(e) => set({ url: e.target.value })}
                        placeholder="https://api.example.com/endpoint"
                      />
                    </div>
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-zinc-700">Query Parameters</label>
                    <input
                      className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                      value={local.query || ""}
                      onChange={(e) => set({ query: e.target.value })}
                      placeholder="key=value&key2=value2"
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-zinc-700">Request Headers</label>
                    <textarea
                      className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                      rows={3}
                      value={local.headers || ""}
                      onChange={(e) => set({ headers: e.target.value })}
                      placeholder='{"Authorization":"Bearer ..."}'
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-zinc-700">Request Body</label>
                    <textarea
                      className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                      rows={4}
                      value={local.body || ""}
                      onChange={(e) => set({ body: e.target.value })}
                      placeholder='{"email":"{{email}}","name":"{{fullName}}"}'
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-zinc-700">Retry Attempts (1–7)</label>
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
                      <label className="text-sm font-medium text-zinc-700">Retry Delay (seconds)</label>
                      <input
                        type="number"
                        min={1}
                        max={300}
                        className="w-full px-4 py-3 text-sm rounded bg-white border border-zinc-300 text-zinc-800 focus:border-primary transition-all outline-none"
                        value={local.retryDelaySeconds}
                        onChange={(e) => set({ retryDelaySeconds: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {local.actionKind === "move_to_list" && (
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-zinc-700">Target List</label>
                  <DropdownSearch
                    options={listOptions.filter((l) => l.value !== currentList?._id)}
                    value={local.targetListId}
                    onChange={(v) => set({ targetListId: v })}
                    placeholder="Select a list…"
                    className="max-w-none"
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

StepConfigModal.propTypes = {
  mode: PropTypes.oneOf(["create", "edit"]).isRequired,
  open: PropTypes.bool.isRequired,
  step: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  listOptions: PropTypes.array,
  templateOptions: PropTypes.array,
  serverOptions: PropTypes.array,
  currentList: PropTypes.object,
};
