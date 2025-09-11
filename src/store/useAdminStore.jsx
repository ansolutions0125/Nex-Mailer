// /store/useAdminStore.jsx
import { create } from "zustand";
import Cookies from "js-cookie";

const ADMIN_TOKEN = "admin_auth_token";
const ADMIN_PROFILE = "admin_profile";
const ADMIN_PERMS = "admin_permissions";
const COOKIE_DAYS = 7;

const parseJSON = (str, fallback) => {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
};

const readAllFromCookies = () => ({
  token: Cookies.get(ADMIN_TOKEN) || null,
  admin: parseJSON(Cookies.get(ADMIN_PROFILE), null),
  permissions: parseJSON(Cookies.get(ADMIN_PERMS), {}),
});

const useAdminStore = create((set, get) => ({
  // ⬇️ initial state comes from cookies synchronously
  ...readAllFromCookies(),

  setAdmin: (adminData) => {
    const value = adminData || null;
    set({ admin: value });
    if (value) {
      Cookies.set(ADMIN_PROFILE, JSON.stringify(value), { expires: COOKIE_DAYS, path: "/" });
    } else {
      Cookies.remove(ADMIN_PROFILE, { path: "/" });
    }
  },

  setToken: (token) => {
    const t = token || null;
    set({ token: t });
    if (t) {
      Cookies.set(ADMIN_TOKEN, t, { expires: COOKIE_DAYS, path: "/" });
    } else {
      Cookies.remove(ADMIN_TOKEN, { path: "/" });
    }
  },

  setPermissions: (perms) => {
    const value = perms || {};
    set({ permissions: value });
    Cookies.set(ADMIN_PERMS, JSON.stringify(value), { expires: COOKIE_DAYS, path: "/" });
  },

  // still available if you ever need to re-sync
  hydrateFromCookies: () => set(readAllFromCookies()),

  resetAdmin: () => {
    Cookies.remove(ADMIN_TOKEN, { path: "/" });
    Cookies.remove(ADMIN_PROFILE, { path: "/" });
    Cookies.remove(ADMIN_PERMS, { path: "/" });
    set({ token: null, admin: null, permissions: {} });
  },

  login: ({ token, admin, permissions }) => {
    get().setToken(token || null);
    get().setAdmin(admin || null);
    get().setPermissions(permissions || {});
  },
  logout: () => get().resetAdmin(),
}));

export default useAdminStore;
