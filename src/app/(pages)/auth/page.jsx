"use client";
import React, { useState } from "react";
import { Eye, EyeOff, Mail } from "lucide-react";

const labelStyles = (type) => {
  const baseStyles = "font-semibold text-zinc-500 uppercase tracking-wider";
  return type === "mini"
    ? `text-[0.6rem] ${baseStyles}`
    : `text-xs ${baseStyles}`;
};

let inputStyles =
  "w-full bg-zinc-50 rounded border border-b-2 border-zinc-300 focus:border-primary  px-4 py-2.5 text-zinc-800 outline-none placeholder-zinc-500";

// ───────────────────────────────────────────
// REUSABLE INPUT COMPONENT
// ───────────────────────────────────────────
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
}) => {
  const baseInputCls = `${inputStyles} ${
    error
      ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
      : "border-zinc-300 bg-white focus:border-zinc-500 focus:ring-zinc-500/20"
  }`;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-zinc-700">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className={`${baseInputCls} ${rightIcon ? "pr-11" : ""}`}
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

// ───────────────────────────────────────────
// PASSWORD INPUT WITH TOGGLE
// ───────────────────────────────────────────
const PasswordInput = ({
  label = "Password",
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
  helperText,
  forgotPasswordLink = false,
  onForgotPassword,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-zinc-700">
          {label}
        </label>
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

// ───────────────────────────────────────────
// AUTH INPUT BLOCKS
// ───────────────────────────────────────────
const SignInInputs = ({
  email,
  setEmail,
  password,
  setPassword,
  onForgotPassword,
}) => (
  <div className="space-y-4">
    <Input
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
  name,
  setName,
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
      label="Email address"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="Enter your email"
      autoComplete="email"
      required
    />
    <Input
      label="Confirm email"
      type="email"
      value={email2}
      onChange={(e) => setEmail2(e.target.value)}
      placeholder="Confirm your email"
      autoComplete="email"
      required
    />
    <Input
      label="Full name"
      value={name}
      onChange={(e) => setName(e.target.value)}
      placeholder="Enter your full name"
      autoComplete="name"
      required
    />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 col-span-2 sm:col-span-1">
      <Input
        label="First name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="First name"
        autoComplete="given-name"
        required
      />
      <Input
        label="Last name"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder="Last name"
        autoComplete="family-name"
        required
      />
    </div>
    <Input
      label="Phone number"
      type="tel"
      value={phoneNo}
      onChange={(e) => setPhoneNo(e.target.value)}
      placeholder="+1 (555) 000-0000"
      autoComplete="tel"
      required
    />
    <Input
      label="Address"
      value={address}
      onChange={(e) => setAddress(e.target.value)}
      placeholder="Enter your address"
      autoComplete="street-address"
      required
    />
    <Input
      label="Country"
      value={country}
      onChange={(e) => setCountry(e.target.value)}
      placeholder="Enter your country"
      autoComplete="country-name"
      required
    />
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

// ───────────────────────────────────────────
// TERMS CHECKBOX COMPONENT
// ───────────────────────────────────────────
const TermsCheckbox = ({ agree, setAgree }) => (
  <label className="flex items-start gap-3 cursor-pointer">
    <input
      type="checkbox"
      checked={agree}
      onChange={(e) => setAgree(e.target.checked)}
      className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-800 focus:ring-zinc-500/30 transition-colors"
    />
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

// ───────────────────────────────────────────
// ERROR/INFO MESSAGE COMPONENTS
// ───────────────────────────────────────────
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

// ───────────────────────────────────────────
// MAIN AUTH COMPONENT
// ───────────────────────────────────────────
const Auth = () => {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [info, setInfo] = useState("");

  // Signup fields
  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNo, setPhoneNo] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");

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
      if (!name.trim()) e.push("Full name is required.");
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

  const fakeWait = (ms = 900) => new Promise((res) => setTimeout(res, ms));

  const onSubmit = async () => {
    resetFeedback();
    const eList = validate();
    if (eList.length) {
      setErrors(eList);
      return;
    }

    setLoading(true);
    await fakeWait();
    setLoading(false);

    if (mode === "signin") {
      setInfo("Signed in! (Mock) Replace with your auth API.");
    } else if (mode === "signup") {
      const payload = {
        name,
        email,
        firstName,
        lastName,
        password,
        phoneNo,
        address,
        country,
      };
      console.log("Signup payload →", payload);
      setMode("check-email");
      setInfo(
        "We've sent a confirmation link to your email. Please verify to finish signup. (Mock)"
      );
    } else if (mode === "forgot") {
      setMode("check-email");
      setInfo("Password reset link sent. Check your inbox to continue.");
    } else if (mode === "magic") {
      setMode("check-email");
      setInfo("Magic sign-in link sent! Click it from your email to continue.");
    }
  };

  // Configuration objects
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
  };

  const currentConfig = config[mode];

  // Render input blocks based on mode
  const renderInputs = () => {
    switch (mode) {
      case "signin":
        return (
          <SignInInputs
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            onForgotPassword={() => setMode("forgot")}
          />
        );
      case "signup":
        return (
          <SignUpInputs
            email={email}
            setEmail={setEmail}
            email2={email2}
            setEmail2={setEmail2}
            password={password}
            setPassword={setPassword}
            name={name}
            setName={setName}
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
        );
      case "forgot":
        return <ForgotPasswordInputs email={email} setEmail={setEmail} />;
      case "magic":
        return <MagicLinkInputs email={email} setEmail={setEmail} />;
      default:
        return null;
    }
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
                  Didn't receive an email?{" "}
                  <button
                    className="text-zinc-800 hover:text-zinc-600 underline transition-colors"
                    onClick={() => {
                      resetFeedback();
                      setMode("signin");
                    }}
                  >
                    Try again
                  </button>
                </p>
              </div>

              <button
                type="button"
                className="w-full rounded-lg bg-zinc-800 px-4 py-3 font-medium text-white shadow-sm hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500/50 transition-colors"
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

        {/* Main Card */}
        <div className="rounded-2xl bg-white shadow-xl border border-zinc-200 overflow-hidden">
          {/* Tab Navigation */}
          {mode !== "forgot" && (
            <div className="border-b border-zinc-200 bg-zinc-50">
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
                      resetFeedback();
                      setMode(tab.key);
                    }}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      mode === tab.key
                        ? "bg-white text-zinc-900 border-b-2 border-zinc-800"
                        : "text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form Content */}
          <div className="p-8">
            <div className="space-y-5">
              <ErrorMessage errors={errors} />
              <InfoMessage message={!errors.length ? info : ""} />

              {renderInputs()}

              {mode === "signup" && (
                <TermsCheckbox agree={agree} setAgree={setAgree} />
              )}

              <button
                type="button"
                onClick={onSubmit}
                disabled={loading}
                className="w-full btn btn-md btn-primary disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
          </div>
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

export default Auth;
