"use client";

import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import useAdminStore from "@/store/useAdminStore";
import useCustomerStore from "@/store/useCustomerStore";

const hasAll = (perm = {}, allOf = []) => allOf.every((k) => !!perm?.[k]);
const hasAny = (perm = {}, anyOf = []) => anyOf.some((k) => !!perm?.[k]);

const AuthWrapper = ({
  actor,          // "admin" | "customer"
  requireAuth,    // boolean
  allOf,          // string[] permissions
  anyOf,          // string[] permissions
  redirectTo,     // override redirect
  fallback,       // ReactNode when unauthorized
  children,
}) => {
  const router = useRouter();

  // admin state
  const admin = useAdminStore((s) => s.admin);
  const adminPermissions = useAdminStore((s) => s.permissions);
  const adminToken = useAdminStore((s) => s.token);

  // customer state
  const customer = useCustomerStore((s) => s.customer);
  const customerPermissions = useCustomerStore((s) => s.permissions);
  const customerToken = useCustomerStore((s) => s.token);

  const [hydrated, setHydrated] = useState(false);

  const ctx = useMemo(() => {
    if (actor === "admin") {
      return {
        isAuthed: Boolean(adminToken || Cookies.get("admin_auth_token")),
        permissions: adminPermissions || {},
        profile: admin,
        defaultRedirect: "/admin/auth",
      };
    }
    return {
      isAuthed: Boolean(customerToken || Cookies.get("customer_auth_token")),
      permissions: customerPermissions || {},
      profile: customer,
      defaultRedirect: "/auth",
    };
  }, [
    actor,
    adminToken,
    adminPermissions,
    admin,
    customerToken,
    customerPermissions,
    customer,
  ]);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!hydrated) return;
    if (requireAuth && !ctx.isAuthed) {
      router.replace(redirectTo || ctx.defaultRedirect);
    }
  }, [hydrated, requireAuth, ctx.isAuthed, ctx.defaultRedirect, redirectTo, router]);

  if (!hydrated) return null;

  // permission gates (if provided)
  if (requireAuth && ctx.isAuthed && (allOf?.length || anyOf?.length)) {
    const okAll = allOf?.length ? hasAll(ctx.permissions, allOf) : true;
    const okAny = anyOf?.length ? hasAny(ctx.permissions, anyOf) : true;
    if (!(okAll && okAny)) {
      return (
        fallback || (
          <div className="p-8">
            <div className="bg-zinc-50 border border-zinc-200 rounded p-6">
              <h2 className="text-lg font-semibold text-zinc-800">403 · Forbidden</h2>
              <p className="text-sm text-zinc-600 mt-1">
                You don’t have permission to view this page.
              </p>
            </div>
          </div>
        )
      );
    }
  }

  if (requireAuth && !ctx.isAuthed) return null;

  return <>{children}</>;
};

AuthWrapper.propTypes = {
  actor: PropTypes.oneOf(["admin", "customer"]).isRequired,
  requireAuth: PropTypes.bool,
  allOf: PropTypes.arrayOf(PropTypes.string),
  anyOf: PropTypes.arrayOf(PropTypes.string),
  redirectTo: PropTypes.string,
  fallback: PropTypes.node,
  children: PropTypes.node,
};

AuthWrapper.defaultProps = {
  requireAuth: true,
  allOf: [],
  anyOf: [],
  redirectTo: undefined,
  fallback: null,
};

export default AuthWrapper;
