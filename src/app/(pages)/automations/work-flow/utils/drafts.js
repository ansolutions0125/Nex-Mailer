const key = (flowId) => `wf:draft:${flowId}`;

export function readDraft(flowId) {
  try {
    return JSON.parse(localStorage.getItem(key(flowId)) || "null");
  } catch {
    return null;
  }
}
export function writeDraft(flowId, data) {
  try {
    localStorage.setItem(key(flowId), JSON.stringify({ ...data, _updatedAt: Date.now() }));
  } catch {}
}
export function clearDraft(flowId) {
  try {
    localStorage.removeItem(key(flowId));
  } catch {}
}
