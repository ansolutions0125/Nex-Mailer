export function toQueryParamsArray(queryStr = "") {
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

export function uiToServerStep(step) {
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
    return { stepType: "removeSubscriber", title: s.title || "Remove from current list" };
  }
  if (s.actionKind === "delete_subscriber") {
    return { stepType: "deleteSubscriber", title: s.title || "Delete subscriber" };
  }
  return { stepType: "deleteSubscriber", title: s.title || "Delete subscriber" };
}

export function serverToUiStep(sv) {
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
        query: (sv.queryParams || []).map((q) => `${q.key}=${q.value}`).join("&"),
        retryAttempts: sv.retryAttempts ?? 0,
        retryDelaySeconds: sv.retryAfterSeconds ?? 3,
      },
    };
  }
  if (sv.stepType === "moveSubscriber") {
    return {
      id: sv._id,
      type: "action",
      data: { title: sv.title, actionKind: "move_to_list", targetListId: sv.targetListId || "" },
    };
  }
  if (sv.stepType === "removeSubscriber") {
    return { id: sv._id, type: "action", data: { title: sv.title, actionKind: "delete_from_current_list" } };
  }
  if (sv.stepType === "deleteSubscriber") {
    return { id: sv._id, type: "action", data: { title: sv.title, actionKind: "delete_subscriber" } };
  }
  return null;
}
