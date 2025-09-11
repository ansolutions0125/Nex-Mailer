// /store/useCustomerStore.jsx
"use client";

import { create } from "zustand";
import Cookies from "js-cookie";

const CUSTOMER_TOKEN = "customer_auth_token";
const CUSTOMER_PROFILE = "customer_profile";
const CUSTOMER_PERMS = "customer_permissions";
const COOKIE_DAYS = 7;

const parseJSON = (str, fallback) => {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
};

const readAllFromCookies = () => ({
  token: Cookies.get(CUSTOMER_TOKEN) || null,
  customer: parseJSON(Cookies.get(CUSTOMER_PROFILE), null),
  permissions: parseJSON(Cookies.get(CUSTOMER_PERMS), {}),
});

const defaultState = {
  customer: null,
  token: null,
  permissions: {},
};

const useCustomerStore = create((set, get) => ({
  // Initial state comes from cookies synchronously
  ...defaultState,
  ...readAllFromCookies(),

  // Setters (mirror to cookies)
  setCustomer: (customerData) => {
    const value = customerData || null;
    set({ customer: value });
    if (value) {
      Cookies.set(CUSTOMER_PROFILE, JSON.stringify(value), {
        expires: COOKIE_DAYS,
        path: "/",
      });
    } else {
      Cookies.remove(CUSTOMER_PROFILE, { path: "/" });
    }
  },

  setToken: (token) => {
    const t = token || null;
    set({ token: t });
    if (t) {
      Cookies.set(CUSTOMER_TOKEN, t, { expires: COOKIE_DAYS, path: "/" });
    } else {
      Cookies.remove(CUSTOMER_TOKEN, { path: "/" });
    }
  },

  setPermissions: (perms) => {
    const value = perms || {};
    set({ permissions: value });
    Cookies.set(CUSTOMER_PERMS, JSON.stringify(value), {
      expires: COOKIE_DAYS,
      path: "/",
    });
  },

  // Re-hydrate on demand (optional)
  hydrateFromCookies: () => set(readAllFromCookies()),

  // Clear everything
  resetCustomer: () => {
    Cookies.remove(CUSTOMER_TOKEN, { path: "/" });
    Cookies.remove(CUSTOMER_PROFILE, { path: "/" });
    Cookies.remove(CUSTOMER_PERMS, { path: "/" });
    set({ ...defaultState });
  },

  // Convenience
  login: ({ token, customer, permissions }) => {
    get().setToken(token || null);
    get().setCustomer(customer || null);
    get().setPermissions(permissions || {});
  },
  logout: () => get().resetCustomer(),
}));

export default useCustomerStore;
