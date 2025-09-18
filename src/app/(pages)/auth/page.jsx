"use client";

import React, { useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Mail, Trash2, ShieldAlert, Lock, X } from "lucide-react";
import {
  Checkbox,
  inputStyles,
  labelStyles,
  LoadingSpinner,
} from "@/presets/styles";
import { useToastStore } from "@/store/useToastStore";
import useCustomerStore from "@/store/useCustomerStore";
import { DropdownSearch } from "@/components/DropdownSearch";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/* Small utilities for rate limit & toast dedupe                     */
/* ------------------------------------------------------------------ */
const COOLDOWN_MS = 2000; // submit throttle window
const TOAST_TTL_MS = 3000; // same-toast dedupe window

const createRateLimiter = (intervalMs) => {
  let last = 0;
  return () => {
    const t = Date.now();
    if (t - last < intervalMs) return false;
    last = t;
    return true;
  };
};

const createToastOnce = (ttlMs = 3000) => {
  const seen = new Map(); // key -> timestamp
  return (key, showFn, message) => {
    const now = Date.now();
    const at = seen.get(key);
    if (at && now - at < ttlMs) return; // ignore duplicates in TTL window
    seen.set(key, now);
    showFn(message);
  };
};

/* ------------------------------------------------------------------ */
/* REUSABLE INPUT COMPONENTS                                          */
/* ------------------------------------------------------------------ */
const Input = ({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  required = false,
  rightIcon,
  helperText,
  error = false,
  minLength,
  maxLength,
  name,
}) => {
  const baseInputCls = `${inputStyles} ${
    error
      ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
      : "border-zinc-300 bg-white focus:border-zinc-500 focus:ring-zinc-500/20"
  }`;

  return (
    <div className="flex flex-col space-y-1">
      {helperText && <p className="text-xxs text-zinc-500">{helperText}</p>}
      {label && <label className={labelStyles("base")}>{label}</label>}
      <div className="relative">
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          className={`${baseInputCls} ${rightIcon ? "pr-11" : ""}`}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightIcon}
          </div>
        )}
      </div>
    </div>
  );
};

const PasswordInput = ({
  label = "Password",
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
  helperText,
  forgotPasswordLink = false,
  onForgotPassword,
  name = "password",
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className={labelStyles("base")}>{label}</label>
        {forgotPasswordLink && (
          <button
            type="button"
            onClick={onForgotPassword}
            className={`${labelStyles("sm")} hover:underline transition-all`}
          >
            Forgot password?
          </button>
        )}
      </div>
      <Input
        name={name}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        }
        helperText={helperText}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* AUTH INPUT BLOCKS                                                  */
/* ------------------------------------------------------------------ */
const SignInInputs = ({
  email,
  setEmail,
  password,
  setPassword,
  onForgotPassword,
}) => (
  <div className="space-y-4">
    <Input
      name="email"
      label="Email address"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="Enter your email"
      autoComplete="email"
      required
    />
    <PasswordInput
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      placeholder="Enter your password"
      forgotPasswordLink
      onForgotPassword={onForgotPassword}
    />
  </div>
);

const SignUpInputs = ({
  email,
  setEmail,
  email2,
  setEmail2,
  password,
  setPassword,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  phoneNo,
  setPhoneNo,
  address,
  setAddress,
  country,
  setCountry,
}) => (
  <div className="grid grid-cols-2 gap-4">
    <Input
      name="email"
      label="Email address"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="Enter your email"
      autoComplete="email"
      required
    />
    <Input
      name="email2"
      label="Confirm email"
      type="email"
      value={email2}
      onChange={(e) => setEmail2(e.target.value)}
      placeholder="Confirm your email"
      autoComplete="email"
      required
    />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 col-span-2 sm:col-span-1">
      <Input
        name="firstName"
        label="First name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="First name"
        autoComplete="given-name"
        required
      />
      <Input
        name="lastName"
        label="Last name"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder="Last name"
        autoComplete="family-name"
        required
      />
    </div>
    <Input
      name="phone"
      label="Phone number"
      type="tel"
      value={phoneNo}
      onChange={(e) => {
        const val = e.target.value;
        if (val.length <= 11) {
          setPhoneNo(val);
        }
      }}
      placeholder="+1 (555) 000-0000"
      autoComplete="tel"
      required
      minLength={11}
      maxLength={11}
    />
    <Input
      name="address"
      label="Address"
      value={address}
      onChange={(e) => setAddress(e.target.value)}
      placeholder="Enter your address"
      autoComplete="street-address"
      required
    />
    <div className="flex flex-col space-y-1">
      <label className={labelStyles("base")}>County</label>
      <DropdownSearch
        value={country}
        onChange={setCountry}
        placeholder="Select a country"
        autoComplete="country-name"
        required
        size="md"
        options={[
          { value: "US", label: "United States" },
          { value: "PK", label: "Pakistan" },
          { value: "CA", label: "Canada" },
          { value: "GB", label: "United Kingdom" },
          { value: "FR", label: "France" },
          { value: "DE", label: "Germany" },
          { value: "IT", label: "Italy" },
          { value: "ES", label: "Spain" },
          { value: "AU", label: "Australia" },
          { value: "NZ", label: "New Zealand" },
          { value: "JP", label: "Japan" },
          { value: "CN", label: "China" },
          { value: "IN", label: "India" },
          { value: "BR", label: "Brazil" },
          { value: "MX", label: "Mexico" },
        ]}
      />
    </div>
    <PasswordInput
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      placeholder="Create a secure password"
      autoComplete="new-password"
      helperText="Must be at least 8 characters long"
    />
  </div>
);

const ForgotPasswordInputs = ({ email, setEmail }) => (
  <div className="space-y-4">
    <Input
      name="email"
      label="Email address"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="Enter your email"
      autoComplete="email"
      required
    />
  </div>
);

const MagicLinkInputs = ({ email, setEmail }) => (
  <div className="space-y-4">
    <Input
      name="email"
      label="Email address"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="Enter your email"
      autoComplete="email"
      required
    />
  </div>
);

/* ------------------------------------------------------------------ */
/* TERMS CHECKBOX + MESSAGES                                          */
/* ------------------------------------------------------------------ */
const TermsCheckbox = ({ agree, setAgree }) => (
  <label className="flex items-start gap-2 cursor-pointer">
    <Checkbox selected={agree} onChange={() => setAgree(!agree)} />
    <span className="text-sm text-zinc-600 leading-relaxed">
      I agree to the{" "}
      <a
        className="text-zinc-800 hover:text-zinc-600 underline transition-colors"
        href="#"
        onClick={(e) => e.preventDefault()}
      >
        Terms of Service
      </a>{" "}
      and{" "}
      <a
        className="text-zinc-800 hover:text-zinc-600 underline transition-colors"
        href="#"
        onClick={(e) => e.preventDefault()}
      >
        Privacy Policy
      </a>
    </span>
  </label>
);

const ErrorMessage = ({ errors }) => {
  if (!errors.length) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
      <ul className="list-disc pl-5 space-y-1">
        {errors.map((error, i) => (
          <li key={i} className="text-sm">
            {error}
          </li>
        ))}
      </ul>
    </div>
  );
};

const InfoMessage = ({ message }) => {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-700">
      <p className="text-sm">{message}</p>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* SESSION LIMIT UI (ported from AdminAuth)                          */
/* ------------------------------------------------------------------ */
const formatDT = (v) => {
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v || "—");
  }
};

const MiniCard = ({ title, subLine }) => (
  <div className="w-full flex items-center gap-2">
    <div className="w-[1px] h-full min-h-10 bg-zinc-400 rounded" />
    <div className="flex flex-col gap-1">
      <h2 className="text-sm text-primary">{title}</h2>
      <p className="text-xs text-zinc-500">{subLine}</p>
    </div>
  </div>
);

/** Works with either schema:
 *  - admin-style: startedAt / lastActiveAt / expiresAt / jti
 *  - customer-style: startDate / endDate / tokenId
 */
const SessionCard = ({ s, selected, toggle }) => {
  const started = s.startedAt || s.startDate;
  const last = s.lastActiveAt || s.updatedAt || s.startDate || s.startedAt;
  const expires = s.expiresAt || s.endDate;
  const jti = s.jti || s.tokenId;

  return (
    <div
      className={`rounded border transition-all duration-200 gap-6 p-4 relative ${
        selected
          ? "bg-zinc-50 border-y-2 border-primary"
          : "bg-zinc-50 hover:border-zinc-300"
      }`}
    >
      {selected && (
        <div className="absolute -top-3 right-1 bg-primary text-white text-xs px-2 py-1 rounded uppercase tracking-wider transition-all">
          Selected
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3 border-b border-second p-2">
        <div className="flex items-center gap-3">
          <div className="absolute top-4 right-4 z-10">
            <div
              onClick={() => toggle(s._id)}
              className={`w-6 h-6 rounded border cursor-pointer transition-all duration-200 flex items-center justify-center
                ${
                  selected
                    ? "bg-primary border-primary"
                    : "border-zinc-300 hover:border-primary"
                }`}
            >
              {selected && (
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
          <div>
            <p className="font-medium text-zinc-900">Logged In</p>
            <p className="text-xs text-zinc-500">
              {jti ? `sessionId: ${jti}` : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <MiniCard title="Started At" subLine={formatDT(started)} />
        <MiniCard title="Last Activity" subLine={formatDT(last)} />
        <MiniCard title="Expires On" subLine={formatDT(expires)} />
        <MiniCard
          title="IP / Agent"
          subLine={`${s.ip || "-"}${s.userAgent ? ` · ${s.userAgent}` : ""}`}
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Re-auth Modal (customer email + password before deletion)         */
/* ------------------------------------------------------------------ */
const ReauthModal = ({
  open,
  onClose,
  onConfirm,
  email,
  setEmail,
  password,
  setPassword,
  loading = false,
  errors = [],
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-white border border-zinc-200 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">
                Confirm your identity
              </h3>
              <p className="text-xs text-zinc-500">
                Enter your email and password to delete the selected session(s).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-zinc-500 hover:text-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <ErrorMessage errors={errors} />
          <Input
            label="Email"
            type="email"
            name="reauth-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            required
          />
          <PasswordInput
            label="Password"
            name="reauth-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            forgotPasswordLink={false}
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-second"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="btn btn-sm btn-third disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Confirm & Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* MAIN AUTH COMPONENT                                                */
/* ------------------------------------------------------------------ */
const CustomerAuth = () => {
  const router = useRouter();
  const { showSuccess } = useToastStore(); // use only showSuccess(message)
  const { login } = useCustomerStore();

  const [mode, setMode] = useState("signin"); // + "SessionLimit" + "check-email"
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [info, setInfo] = useState("");

  // Signup fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNo, setPhoneNo] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");

  // Session-limit state (ported)
  const [sessions, setSessions] = useState([]);
  const [limit, setLimit] = useState(5);
  const [customerId, setCustomerId] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Re-auth modal state
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthEmail, setReauthEmail] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthErrors, setReauthErrors] = useState([]);

  // Guards
  const submitLimiterRef = useRef(createRateLimiter(COOLDOWN_MS));
  const toastOnceRef = useRef(createToastOnce(TOAST_TTL_MS));
  const safeShowSuccess = (key, message) =>
    toastOnceRef.current(key, showSuccess, message);

  const resetFeedback = () => {
    setErrors([]);
    setInfo("");
  };

  const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());

  const validate = () => {
    const e = [];
    if (!isEmail(email)) e.push("Please enter a valid email address.");

    if (mode === "signup" || mode === "signin") {
      if (!password || password.length < 8)
        e.push("Password must be at least 8 characters.");
    }

    if (mode === "signup") {
      if (email !== email2) e.push("Emails do not match.");
      if (!agree) e.push("You must accept the Terms & Privacy Policy.");
      if (!firstName.trim()) e.push("First name is required.");
      if (!lastName.trim()) e.push("Last name is required.");
      if (!phoneNo.trim()) e.push("Phone number is required.");
      if (!address.trim()) e.push("Address is required.");
      if (!country.trim()) e.push("Country is required.");
      if (phoneNo && phoneNo.replace(/\D/g, "").length < 7)
        e.push("Phone number looks too short.");
    }
    return e;
  };

  // --- API ---
  const authRequest = async (action, payload) => {
    const res = await fetch("/api/customers/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const json = await res.json().catch(() => null);

    // Special-case: surface session-cap payload without throwing
    if (json?.code === "SESSION_LIMIT_REACHED") {
      return json;
    }

    if (!res.ok || !json?.success) {
      throw new Error(json?.message || "Request failed");
    }
    return json;
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  // Confirm deletion after re-auth
  const handleConfirmDeletion = async () => {
    const errs = [];
    if (!isEmail(reauthEmail)) errs.push("Please enter a valid email.");
    if (!reauthPassword || reauthPassword.length < 8)
      errs.push("Password must be at least 8 characters.");
    if (!selectedIds.size) errs.push("Select at least one session to delete.");
    if (errs.length) {
      setReauthErrors(errs);
      return;
    }

    setReauthErrors([]);
    setReauthLoading(true);

    try {
      const ids = [...selectedIds];
      const res = await fetch(`/api/customers/sessions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "customer-sessions-limit-reached",
          email: reauthEmail,
          password: reauthPassword,
          sessionIds: ids,
          customerId,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Failed to delete sessions");
      }

      // remove deleted from local list
      setSessions((prev) => prev.filter((s) => !ids.includes(s._id)));
      setSelectedIds((prev) => {
        const n = new Set(prev);
        ids.forEach((i) => n.delete(i));
        return n;
      });

      setInfo("Selected session(s) deleted.");
      setReauthOpen(false);
      safeShowSuccess("cust:sessions:deleted", "Selected session(s) deleted.");

      // Switch back to signin mode after successful deletion
      setMode("signin");
    } catch (e) {
      setReauthErrors([e.message || "Deletion failed. Please try again."]);
    } finally {
      setReauthLoading(false);
    }
  };

  const onSubmit = async () => {
    // prevent spam: block if already loading OR within cooldown window
    if (loading) return;
    if (!submitLimiterRef.current()) return;

    resetFeedback();

    if (mode === "SessionLimit") {
      // open re-auth modal after selection
      if (!selectedIds.size) {
        setErrors(["Select at least one session to delete."]);
        return;
      }
      setReauthErrors([]);
      setReauthOpen(true);
      return;
    }

    if (mode !== "SessionLimit") {
      const eList = validate();
      if (eList.length) {
        setErrors(eList);
        return;
      }
    }

    try {
      setLoading(true);

      if (mode === "signin") {
        const json = await authRequest("signin", { email, password });

        // Session limit branch (ported from AdminAuth UI)
        if (json?.code === "SESSION_LIMIT_REACHED") {
          const arr = json?.data?.sessions || [];
          setSessions(arr);
          setLimit(json?.data?.limit ?? 5);
          // Works with either schema: "customerId" or nested doc
          const cid =
            json?.data?.customerId ||
            arr?.[0]?.customerId ||
            arr?.[0]?.actorId ||
            "";
          setCustomerId(cid);
          setSelectedIds(new Set());
          setMode("SessionLimit");
          setInfo(json?.message || "Maximum active sessions reached.");
          // pre-fill the re-auth email with the email they just used
          setReauthEmail(email);
          setReauthPassword("");
          return;
        }

        // normal login success
        if (json?.data?.token) {
          login({
            token: json.data.token,
            customer: json.data.customer || null,
            permissions: json.data.permissions || {},
          });
          router.push("/dashboard");
        }
        safeShowSuccess("cust:signin", json?.message || "Signed in!");
        setInfo(json?.message || "Signed in.");
        return;
      }

      if (mode === "signup") {
        const json = await authRequest("signup", {
          email,
          firstName,
          lastName,
          password,
          phoneNo,
          address,
          country,
          sessionType: "password",
        });

        if (json?.data?.token) {
          login({
            token: json.data.token,
            customer: json.data.customer || null,
            permissions: json.data.permissions || {},
          });
          safeShowSuccess(
            "cust:signup:autologin",
            json?.message || "Account created!"
          );
          setInfo(json?.message || "Account created.");

          router.push("/dashboard");
        } else {
          setMode("check-email");
          safeShowSuccess(
            "cust:signup",
            json?.message || "Verification link sent."
          );
          setInfo(
            json?.message ||
              "We've sent a confirmation link to your email. Please verify to finish signup."
          );
        }
        return;
      }

      if (mode === "forgot") {
        const json = await authRequest("forgot", { email });
        setMode("check-email");
        safeShowSuccess(
          "cust:forgot",
          json?.message || "Password reset link sent."
        );
        setInfo(json?.message || "Password reset link sent. Check your inbox.");
        return;
      }

      if (mode === "magic") {
        const json = await authRequest("magic", { email });
        setMode("check-email");
        safeShowSuccess(
          "cust:magic",
          json?.message || "Magic sign-in link sent!"
        );
        setInfo(json?.message || "Magic sign-in link sent! Check your email.");
        return;
      }
    } catch (err) {
      setErrors([err.message || "Something went wrong. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  // UI config
  const config = {
    signin: {
      header: "Welcome back",
      sub: "Sign in to access your dashboard.",
      primaryCta: "Login in your account",
    },
    signup: {
      header: "Create your account",
      sub: "We'll email a verification link after you sign up.",
      primaryCta: "Register an Account",
    },
    forgot: {
      header: "Forgot password",
      sub: "Enter the email you used. We'll send a reset link.",
      primaryCta: "Send Password Reset link",
    },
    magic: {
      header: "Email link sign-in",
      sub: "We'll send you a one-time secure link to sign in.",
      primaryCta: "Send Magic Login link",
    },
    "check-email": {
      header: "Check your email",
      sub: "If you don't see it, check spam or try again in a minute.",
      primaryCta: "Open email app",
    },
    SessionLimit: {
      header: "Maximum sessions reached",
      sub: "Close one or more sessions to continue logging in.",
      primaryCta: "Delete selected sessions",
    },
  };

  // Check email view
  if (mode === "check-email") {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-zinc-50 via-white to-zinc-100 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800 text-white shadow-lg">
              <Mail className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">
              {config["check-email"]?.header}
            </h1>
            <p className="text-zinc-600 leading-relaxed">
              {config["check-email"]?.sub}
            </p>
          </div>

          <div className="rounded-2xl bg-white shadow-xl border border-zinc-200 p-8">
            <div className="space-y-6">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Check your email</p>
                    <p className="text-sm mt-1">
                      {info || "We've sent you a link to continue."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-3">
                <p className="text-sm text-zinc-600">
                  Didn&apos;t receive an email?{" "}
                  <button
                    className="text-zinc-800 hover:text-zinc-600 underline transition-colors"
                    onClick={() => {
                      if (!submitLimiterRef.current()) return;
                      resetFeedback();
                      setMode("signin");
                    }}
                  >
                    Try again
                  </button>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="w-full btn btn-md btn-primary-two"
                  onClick={() => setMode("signin")}
                >
                  Go To Login
                </button>
                <button
                  type="button"
                  className="w-full btn btn-md btn-second"
                  onClick={() => alert("Opening email app (demo)")}
                >
                  {config["check-email"]?.primaryCta}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SessionLimit view (ported format)
  if (mode === "SessionLimit") {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-zinc-50 via-white to-zinc-100 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-6xl">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800 text-white shadow-lg">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">
              {config["SessionLimit"]?.header}
            </h1>
            <p className="text-zinc-600 leading-relaxed">
              {config["SessionLimit"]?.sub} (limit: {limit})
            </p>
          </div>

          <div className="rounded-2xl bg-white shadow-xl border border-zinc-200 overflow-hidden">
            <div className="p-6 space-y-5">
              <ErrorMessage errors={errors} />
              <InfoMessage message={!errors.length ? info : ""} />

              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-600">
                  Selected {selectedIds.size} / {sessions.length} sessions
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="btn btn-md btn-primary"
                  >
                    Back to Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => onSubmit()}
                    disabled={loading || selectedIds.size === 0}
                    className="btn btn-md btn-third disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {config["SessionLimit"]?.primaryCta}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map((s) => (
                  <SessionCard
                    key={s._id}
                    s={s}
                    selected={selectedIds.has(s._id)}
                    toggle={toggleSelect}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Re-auth modal */}
        <ReauthModal
          open={reauthOpen}
          onClose={() => setReauthOpen(false)}
          onConfirm={handleConfirmDeletion}
          email={reauthEmail}
          setEmail={setReauthEmail}
          password={reauthPassword}
          setPassword={setReauthPassword}
          loading={reauthLoading}
          errors={reauthErrors}
        />
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-zinc-50 via-white to-zinc-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800 text-white shadow-lg">
            <Mail className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">
            {config[mode]?.header}
          </h1>
          <p className="text-zinc-600 leading-relaxed">{config[mode]?.sub}</p>
        </div>

        {/* Main Card */}
        <div className="rounded-lg bg-white shadow-xl border border-zinc-200 overflow-hidden">
          {/* Tab Navigation */}
          {/* Form Content */}
          {loading ? (
            <LoadingSpinner />
          ) : (
            <>
              {mode !== "forgot" && mode !== "check-email" && (
                <div className="border-b border-zinc-200">
                  <div className="flex">
                    {[
                      { key: "signin", label: "Sign In" },
                      { key: "signup", label: "Sign Up" },
                      { key: "magic", label: "Email Link" },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          if (!submitLimiterRef.current()) return;
                          resetFeedback();
                          setMode(tab.key);
                        }}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                          mode === tab.key
                            ? "bg-second text-white border-b-2 border-primary"
                            : "text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-8">
                <div className="space-y-5">
                  <ErrorMessage errors={errors} />
                  <InfoMessage message={!errors.length ? info : ""} />

                  {mode === "signin" && (
                    <SignInInputs
                      email={email}
                      setEmail={setEmail}
                      password={password}
                      setPassword={setPassword}
                      onForgotPassword={() => {
                        if (!submitLimiterRef.current()) return;
                        setMode("forgot");
                      }}
                    />
                  )}

                  {mode === "signup" && (
                    <div className="space-y-5">
                      <SignUpInputs
                        email={email}
                        setEmail={setEmail}
                        email2={email2}
                        setEmail2={setEmail2}
                        password={password}
                        setPassword={setPassword}
                        firstName={firstName}
                        setFirstName={setFirstName}
                        lastName={lastName}
                        setLastName={setLastName}
                        phoneNo={phoneNo}
                        setPhoneNo={setPhoneNo}
                        address={address}
                        setAddress={setAddress}
                        country={country}
                        setCountry={setCountry}
                      />
                      <TermsCheckbox agree={agree} setAgree={setAgree} />
                    </div>
                  )}

                  {mode === "forgot" && (
                    <ForgotPasswordInputs email={email} setEmail={setEmail} />
                  )}

                  {mode === "magic" && (
                    <MagicLinkInputs email={email} setEmail={setEmail} />
                  )}

                  <div className="border-t border-zinc-200 pt-5">
                    <button
                      type="button"
                      onClick={onSubmit}
                      disabled={loading}
                      className="w-64 btn btn-md btn-primary mx-auto disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                          Please wait...
                        </div>
                      ) : (
                        config[mode]?.primaryCta
                      )}
                    </button>
                  </div>

                  {mode === "forgot" && (
                    <button
                      type="button"
                      onClick={() => setMode("signin")}
                      className="w-full text-center text-sm text-zinc-700 hover:text-zinc-900 underline"
                    >
                      Back to Sign In
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-zinc-500 leading-relaxed">
          Protected by security measures and subject to our{" "}
          <a
            className="text-zinc-700 hover:text-zinc-900 underline transition-colors"
            href="#"
          >
            Privacy Policy
          </a>{" "}
          and{" "}
          <a
            className="text-zinc-700 hover:text-zinc-900 underline transition-colors"
            href="#"
          >
            Terms of Service
          </a>
        </p>
      </div>
    </div>
  );
};

export default CustomerAuth;
