"use client";

import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Eye, EyeOff, Mail, Trash2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import useAdminStore from "@/store/useAdminStore";

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

const inputBase =
  "w-full bg-white rounded border border-b-2 border-zinc-300 focus:border-zinc-600 focus:ring-2 focus:ring-zinc-500/10 px-4 py-2.5 text-zinc-800 outline-none placeholder-zinc-500";

const labelStyles = (type) => {
  const baseStyles = "font-semibold text-zinc-500 uppercase tracking-wider";
  return type === "mini"
    ? `text-[0.6rem] ${baseStyles}`
    : `text-xs ${baseStyles}`;
};

const isEmail = (str = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());

async function callAdminApi(action, payload = {}, token) {
  // NOTE: keep a single endpoint; backend routes by `action` value
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "mailer-auth-token": token } : {}),
    },
    body: JSON.stringify({
      action: action === "signIn" ? "login" : action,
      ...payload,
    }),
  });
  const json = await res.json().catch(() => ({}));

  // If the backend is enforcing a session cap, it should return
  // success:false + code:"SESSION_LIMIT_REACHED" + data.sessions
  if (json?.code === "SESSION_LIMIT_REACHED") {
    return json; // surface to caller without throwing
  }

  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Request failed.");
  }
  return json;
}

/* ------------------------------------------------------------------ */
/* Reusable Inputs                                                     */
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
  name,
}) => {
  const cls = `${inputBase} ${
    error
      ? "border-red-300 focus:border-red-600 focus:ring-red-500/10"
      : "border-zinc-300"
  } ${rightIcon ? "pr-11" : ""}`;

  return (
    <div className="space-y-1">
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
          className={cls}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightIcon}
          </div>
        )}
      </div>
      {helperText && <p className="text-xs text-zinc-500">{helperText}</p>}
    </div>
  );
};

Input.propTypes = {
  label: PropTypes.node,
  type: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  autoComplete: PropTypes.string,
  required: PropTypes.bool,
  rightIcon: PropTypes.node,
  helperText: PropTypes.node,
  error: PropTypes.bool,
  name: PropTypes.string,
};

const PasswordInput = ({
  label = "Password",
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
  helperText,
  forgotPasswordLink = true,
  onForgotPassword,
  name = "password",
}) => {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className={labelStyles("base")}>{label}</label>
        {forgotPasswordLink && (
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-zinc-600 hover:text-zinc-800 hover:underline transition-colors"
          >
            Forgot password?
          </button>
        )}
      </div>
      <Input
        name={name}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        rightIcon={
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            {show ? (
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

PasswordInput.propTypes = {
  label: PropTypes.node,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  autoComplete: PropTypes.string,
  helperText: PropTypes.node,
  forgotPasswordLink: PropTypes.bool,
  onForgotPassword: PropTypes.func,
  name: PropTypes.string,
};

const ErrorMessage = ({ errors }) => {
  if (!errors?.length) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
      <ul className="list-disc pl-5 space-y-1">
        {errors.map((err, i) => (
          <li key={i} className="text-sm">
            {err}
          </li>
        ))}
      </ul>
    </div>
  );
};

ErrorMessage.propTypes = {
  errors: PropTypes.arrayOf(PropTypes.string),
};

const InfoMessage = ({ message }) => {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-700">
      <p className="text-sm">{message}</p>
    </div>
  );
};

InfoMessage.propTypes = {
  message: PropTypes.string,
};

const SignInInputs = ({ email, setEmail, password, setPassword, onForgot }) => (
  <div className="space-y-4">
    <Input
      label="Email address"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="Enter your email"
      autoComplete="email"
      required
      name="email"
    />
    <PasswordInput
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      placeholder="Enter your password"
      onForgotPassword={onForgot}
      name="password"
    />
  </div>
);

SignInInputs.propTypes = {
  email: PropTypes.string.isRequired,
  setEmail: PropTypes.func.isRequired,
  password: PropTypes.string.isRequired,
  setPassword: PropTypes.func.isRequired,
  onForgot: PropTypes.func.isRequired,
};

const ForgotPasswordInputs = ({ email, setEmail }) => (
  <div className="space-y-4">
    <Input
      label="Email address"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="Enter your email"
      autoComplete="email"
      required
      name="email"
    />
  </div>
);

ForgotPasswordInputs.propTypes = {
  email: PropTypes.string.isRequired,
  setEmail: PropTypes.func.isRequired,
};

const MagicLinkInputs = ({ email, setEmail }) => (
  <div className="space-y-4">
    <Input
      label="Email address"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="Enter your email"
      autoComplete="email"
      required
      name="email"
    />
  </div>
);

MagicLinkInputs.propTypes = {
  email: PropTypes.string.isRequired,
  setEmail: PropTypes.func.isRequired,
};

/* ------------------------------------------------------------------ */
/* Session Limit UI                                                    */
/* ------------------------------------------------------------------ */

function formatDT(v) {
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v || "-");
  }
}

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

const SessionCard = ({ s, selected, toggle, onDelete }) => (
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
          <p className="text-xs text-zinc-500">sessionId: {s.jti}</p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
      <MiniCard title="Started At" subLine={formatDT(s.startedAt)} />
      <MiniCard title="Last Activity" subLine={formatDT(s.lastActiveAt)} />
      <MiniCard title="Expires On" subLine={formatDT(s.expiresAt)} />
      <MiniCard
        title="IP / Agent"
        subLine={`${s.ip || "-"}${s.userAgent ? ` · ${s.userAgent}` : ""}`}
      />
    </div>
  </div>
);

SessionCard.propTypes = {
  s: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  toggle: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

/* ------------------------------------------------------------------ */
/* Main Auth Component                                                 */
/* ------------------------------------------------------------------ */

const AdminAuth = () => {
  const router = useRouter();
  const { login } = useAdminStore();

  // modes: "signin" | "forgot" | "magic" | "check-email" | "SessionLimit"
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [info, setInfo] = useState("");

  // session-limit state
  const [sessions, setSessions] = useState([]);
  const [limit, setLimit] = useState(5);
  const [adminId, setAdminId] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());

  const currentConfig = useMemo(
    () => ({
      signin: {
        header: "Welcome back Admin",
        sub: "Sign in to access your dashboard.",
        primaryCta: "Login to your account",
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
        sub: "If you don't see it, check spam or try again.",
        primaryCta: "Open email app",
      },
      SessionLimit: {
        header: "Maximum sessions reached",
        sub: "Close one or more sessions to continue logging in.",
        primaryCta: "Delete selected sessions",
      },
    }),
    []
  )[mode];

  useEffect(() => {
    setErrors([]);
    setInfo("");
  }, [mode]);

  const validate = () => {
    const e = [];
    if (["signin", "forgot", "magic"].includes(mode)) {
      if (!isEmail(email)) e.push("Please enter a valid email address.");
    }
    if (mode === "signin") {
      if (!password || password.length < 8) {
        e.push("Password must be at least 8 characters.");
      }
    }
    return e;
  };

  const onSubmit = async () => {
    if (mode === "SessionLimit") {
      // bulk delete selected
      if (!selectedIds.size) {
        setErrors(["Select at least one session to delete."]);
        return;
      }
      await handleDelete([...selectedIds]);
      return;
    }

    const eList = validate();
    if (eList.length) {
      setErrors(eList);
      return;
    }

    setErrors([]);
    setInfo("");
    setLoading(true);

    try {
      if (mode === "signin") {
        const json = await callAdminApi("signIn", { email, password });

        if (json?.code === "SESSION_LIMIT_REACHED") {
          const arr = json?.data?.sessions || [];
          setSessions(arr);
          setLimit(json?.data?.limit ?? 5);
          setAdminId(arr?.[0]?.adminId || "");
          setSelectedIds(new Set());
          setMode("SessionLimit");
          setInfo(json?.message || "Maximum active sessions reached.");
          return;
        }

        // normal login success
        const admin = json?.admin || json?.data?.admin || null;
        if (admin)
          login({
            token: json.data.token,
            admin: json.data.admin,
            permissions: json.data.permissions || {},
          });

        setInfo("Signed in successfully.");
        router.push("/dashboard");
        return;
      }

      if (mode === "forgot") {
        await callAdminApi("forgotPassword", { email });
        setMode("check-email");
        setInfo("Password reset link sent. Check your inbox to continue.");
        return;
      }

      if (mode === "magic") {
        await callAdminApi("magicLink", { email });
        setMode("check-email");
        setInfo(
          "Magic sign-in link sent! Click it from your email to continue."
        );
        return;
      }
    } catch (err) {
      setErrors([err.message || "Something went wrong."]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleDelete = async (ids) => {
    if (!ids?.length) return;
    setLoading(true);
    setErrors([]);
    setInfo("");
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: ids, adminId }),
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
    } catch (e) {
      setErrors([e.message]);
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------- Render ------------------------------- */

  if (mode === "check-email") {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-zinc-50 via-white to-zinc-100 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800 text-white shadow-lg">
              <Mail className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">
              {currentConfig.header}
            </h1>
            <p className="text-zinc-600 leading-relaxed">{currentConfig.sub}</p>
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
                    onClick={() => setMode("signin")}
                  >
                    Try again
                  </button>
                </p>
              </div>

              <button
                type="button"
                className="w-full btn btn-md btn-second"
                onClick={() => alert("Opening email app (demo)")}
              >
                {currentConfig.primaryCta}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "SessionLimit") {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-zinc-50 via-white to-zinc-100 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-6xl">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800 text-white shadow-lg">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">
              {currentConfig.header}
            </h1>
            <p className="text-zinc-600 leading-relaxed">
              {currentConfig.sub} (limit: {limit})
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
                    className="btn btn-md btn-third"
                  >
                    {loading ? (
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {currentConfig.primaryCta}
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
                    onDelete={(ids, aId) => handleDelete(ids)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default Auth (Sign in / Forgot / Magic)
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-zinc-50 via-white to-zinc-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800 text-white shadow-lg">
            <Mail className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">
            {currentConfig.header}
          </h1>
          <p className="text-zinc-600 leading-relaxed">{currentConfig.sub}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white shadow-xl border border-zinc-200 overflow-hidden">
          {/* Tabs (Sign Up removed) */}
          {mode !== "forgot" && (
            <div className="border-b border-zinc-200">
              <div className="flex">
                {[
                  { key: "signin", label: "Sign In" },
                  { key: "magic", label: "Email Link" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setMode(tab.key)}
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

          {/* Form */}
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
                  onForgot={() => setMode("forgot")}
                />
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
                    currentConfig.primaryCta
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
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-zinc-500 leading-relaxed">
          Protected by security measures and subject to our{" "}
          <a className="text-zinc-700 hover:text-zinc-900 underline" href="#">
            Privacy Policy
          </a>{" "}
          and{" "}
          <a className="text-zinc-700 hover:text-zinc-900 underline" href="#">
            Terms of Service
          </a>
        </p>
      </div>
    </div>
  );
};

export default AdminAuth;
