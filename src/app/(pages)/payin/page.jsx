'use client';

import React, { useMemo, useState, useEffect } from "react";
import {
  FiKey,
  FiShield,
  FiPhone,
  FiMail,
  FiTag,
  FiDollarSign,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertTriangle,
  FiServer,
  FiZap,
  FiLink2,
} from "react-icons/fi";

const CHANNELS = [
  {
    key: "ew-easypaisa",
    label: "E-Wallet · Easypaisa",
    type: "ewallet",
    defaultChannelId: 8,
    defaultCategoryId: "",
  },
  {
    key: "ew-jazzcash",
    label: "E-Wallet · JazzCash",
    type: "ewallet",
    defaultChannelId: 10,
    defaultCategoryId: "",
  },
  {
    key: "biller-1bill",
    label: "Biller · 1Bill",
    type: "biller",
    defaultChannelId: 11,
    defaultCategoryId: 3,
  },
];

function generateTxnId(prefix = "TXN") {
  try {
    const raw = (crypto?.randomUUID?.() ?? `${Math.random()}-${Date.now()}`)
      .toString()
      .replace(/[^a-zA-Z0-9]/g, "");
    return `${prefix}-${raw}`.slice(0, 48);
  } catch {
    return `${prefix}-${Math.random()
      .toString(36)
      .slice(2)}${Date.now().toString(36)}`.slice(0, 48);
  }
}

function pretty(x) {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

export default function PayinPage() {
  const [tab, setTab] = useState("api"); // "api" or "pwa"
  const [env, setEnv] = useState("sandbox");

  // Optional: supply from UI; otherwise server will read from .env
  const [clientId, setClientId] = useState(process.env.NEXT_PUBLIC_CLIENT_ID || "");
  const [clientSecret, setClientSecret] = useState(process.env.NEXT_PUBLIC_CLIENT_SECRET || "");

  const [channelKey, setChannelKey] = useState(CHANNELS[0].key);
  const selected = useMemo(() => CHANNELS.find((c) => c.key === channelKey), [channelKey]);

  const [categoryId, setCategoryId] = useState(String(selected?.defaultCategoryId ?? ""));
  const [channelId, setChannelId] = useState(String(selected?.defaultChannelId ?? ""));
  const [customerTransactionId, setCustomerTransactionId] = useState(generateTxnId());
  const [itemName, setItemName] = useState("GoodCourse");
  const [amount, setAmount] = useState("500");
  const [msisdn, setMsisdn] = useState("03225802745");
  const [email, setEmail] = useState("360legntkiller@gmail.com");
  const [payeename, setPayeename] = useState("GoodName");

  // Direct API states
  const [serverToken, setServerToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [payinLoading, setPayinLoading] = useState(false);
  const [payinError, setPayinError] = useState("");
  const [payinResponse, setPayinResponse] = useState(null);
  const [lastRequest, setLastRequest] = useState(null);

  // PWA states
  const [pwaUrl, setPwaUrl] = useState("");
  const [pwaError, setPwaError] = useState("");

  useEffect(() => {
    setCategoryId(String(selected?.defaultCategoryId ?? ""));
    setChannelId(String(selected?.defaultChannelId ?? ""));
  }, [selected?.key]);

  const getTokenServer = async () => {
    setAuthLoading(true);
    setAuthError("");
    setServerToken(null);
    try {
      const res = await fetch("/api/payin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "token", env, clientId, clientSecret }),
      });
      const data = await res.json();
      if (!res.ok || !data?.access_token)
        throw new Error(data?.error_description || data?.error || "Failed to fetch token");
      setServerToken({
        access_token: data.access_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
      });
    } catch (e) {
      setAuthError(e.message || String(e));
    } finally {
      setAuthLoading(false);
    }
  };

  const submitPayin = async () => {
    setPayinLoading(true);
    setPayinError("");
    setPayinResponse(null);

    const payload = {
      customerTransactionId,
      categoryId: categoryId !== "" ? Number(categoryId) : undefined,
      channelId: Number(channelId),
      item: itemName,
      amount: Number(amount),
      msisdn,
      email,
    };

    const body = {
      op: "purchase",
      env,
      purchaseType: selected.type, // 'ewallet' | 'biller'
      clientId,
      clientSecret,
      payload,
    };

    setLastRequest({ url: "/api/payin", method: "POST", body });

    try {
      const res = await fetch("/api/payin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");
      setPayinResponse(data);
    } catch (e) {
      setPayinError(e.message || String(e));
    } finally {
      setPayinLoading(false);
    }
  };

  const buildPwaLink = async () => {
    setPwaError("");
    setPwaUrl("");
    try {
      const res = await fetch("/api/payin/pwa-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          env,
          clientid: clientId,
          customertransactionid: customerTransactionId,
          item: itemName,
          amount,
          payeename,
          email,
          msisdn,
          successRedirectUrl: `${location.origin}/payin/success`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPwaUrl(data.url);
    } catch (e) {
      setPwaError(e.message);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <div className="mx-auto max-w-3xl p-6">
        <header className="mb-6 flex items-center gap-3">
          <FiServer className="h-6 w-6 text-gray-700" />
          <h1 className="text-xl font-semibold text-gray-800">Swich PayIn • Test Console</h1>
        </header>

        {/* Tab Switcher */}
        <div className="mb-4 flex gap-2">
          <button onClick={() => setTab("api")} className={`px-3 py-1 rounded ${tab==="api" ? "bg-indigo-600 text-white" : "bg-gray-200"}`}>Direct API</button>
          <button onClick={() => setTab("pwa")} className={`px-3 py-1 rounded ${tab==="pwa" ? "bg-indigo-600 text-white" : "bg-gray-200"}`}>PWA</button>
        </div>

        {tab === "api" && (
          <>
            {/* Env & Token */}
            <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiShield className="h-5 w-5 text-gray-600" />
                  <h2 className="text-base font-medium text-gray-800">Environment & Token</h2>
                </div>
                <select value={env} onChange={(e) => setEnv(e.target.value)} className="rounded-md border px-2 py-1 text-sm">
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" className="border p-2 rounded"/>
                <input value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Client Secret" className="border p-2 rounded"/>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button onClick={getTokenServer} disabled={authLoading} className="bg-indigo-600 text-white px-4 py-2 rounded">
                  {authLoading ? "Getting Token…" : "Get Token"}
                </button>
                {serverToken?.access_token && <span className="text-green-700 text-sm">Token ready (expires_in {serverToken.expires_in}s)</span>}
                {authError && <span className="text-red-600 text-sm">{authError}</span>}
              </div>
            </section>

            {/* Channel & Payload */}
            <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="text-base font-medium mb-3">Channel & Payload</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={customerTransactionId} onChange={(e)=>setCustomerTransactionId(e.target.value)} placeholder="CustomerTransactionId" className="border p-2 rounded"/>
                <input value={itemName} onChange={(e)=>setItemName(e.target.value)} placeholder="Item" className="border p-2 rounded"/>
                <input value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="Amount" className="border p-2 rounded"/>
                <input value={msisdn} onChange={(e)=>setMsisdn(e.target.value)} placeholder="MSISDN" className="border p-2 rounded"/>
                <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" className="border p-2 rounded"/>
                <input value={categoryId} onChange={(e)=>setCategoryId(e.target.value)} placeholder="CategoryId" className="border p-2 rounded"/>
                <input value={channelId} onChange={(e)=>setChannelId(e.target.value)} placeholder="ChannelId" className="border p-2 rounded"/>
              </div>
              <button onClick={submitPayin} disabled={payinLoading} className="mt-3 bg-emerald-600 text-white px-4 py-2 rounded flex items-center gap-2">
                <FiZap /> {payinLoading ? "Submitting…" : "Submit Direct PayIn"}
              </button>
              {payinError && <p className="text-red-600 mt-2">{payinError}</p>}
            </section>

            {/* Request/Response */}
            <section className="mb-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-medium">Last Request</h3>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs">{pretty(lastRequest)}</pre>
              </div>
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-medium">Response</h3>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs">{pretty(payinResponse)}</pre>
              </div>
            </section>
          </>
        )}

        {tab === "pwa" && (
          <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-base font-medium mb-3">PWA Link Builder</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={clientId} onChange={(e)=>setClientId(e.target.value)} placeholder="Client ID" className="border p-2 rounded"/>
              <input value={customerTransactionId} onChange={(e)=>setCustomerTransactionId(e.target.value)} placeholder="CustomerTransactionId" className="border p-2 rounded"/>
              <input value={itemName} onChange={(e)=>setItemName(e.target.value)} placeholder="Item" className="border p-2 rounded"/>
              <input value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="Amount" className="border p-2 rounded"/>
              <input value={payeename} onChange={(e)=>setPayeename(e.target.value)} placeholder="Payee Name" className="border p-2 rounded"/>
              <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" className="border p-2 rounded"/>
              <input value={msisdn} onChange={(e)=>setMsisdn(e.target.value)} placeholder="MSISDN" className="border p-2 rounded"/>
            </div>
            <button onClick={buildPwaLink} className="mt-3 bg-emerald-600 text-white px-4 py-2 rounded flex items-center gap-2">
              <FiLink2 /> Build PWA Link
            </button>
            {pwaError && <p className="text-red-600 mt-2">{pwaError}</p>}
            {pwaUrl && (
              <div className="mt-3">
                <p className="text-sm">PWA URL:</p>
                <a href={pwaUrl} target="_blank" className="text-blue-600 underline">{pwaUrl}</a>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
