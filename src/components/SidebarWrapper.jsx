"use client";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import PropTypes from "prop-types";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { GoFile, GoGear, GoGitPullRequest } from "react-icons/go";
import { CgMediaLive } from "react-icons/cg";
import { FaGears } from "react-icons/fa6";

// Lucide React icons
import {
  LayoutDashboard,
  Globe,
  Link as LuLink,
  Network,
  Server,
  Users as LuUsers,
  Package as LuPackage,
  User as LuUser,
  DoorOpen,
  List as LuList,
  FileText,
  Logs,
  Menu as LuMenu,
  X as LuX,
  ChevronRight as LuChevronRight,
  ChevronDown as LuChevronDown,
  BadgeCheck,
  CreditCard,
  Settings,
  LogOut,
  Workflow,
  PanelRightOpen,
  ChartNoAxesCombined,
  ShieldUser,
  UserStar,
  FolderPen,
} from "lucide-react";

import useCustomerStore from "@/store/useCustomerStore";
import useAdminStore from "@/store/useAdminStore";
import { FolderKanban } from "lucide-react";

// Constants
const LAYOUT_CONSTANTS = {
  GAP: 8,
  FLYOUT_WIDTH: 256,
  COLLAPSE_KEY: "sidebarCollapsed",
  CLOSE_DELAY: 110,
  FLYOUT_CLOSE_DELAY: 85,
};

// CENTRALIZED BUTTON STYLES - ONE PLACE TO RULE THEM ALL
const BUTTON_STYLES = {
  // Base styles
  base: "bg-white/0 text-white/80",
  hover: "hover:bg-white/10 hover:text-white",
  active: "bg-white/10 text-white border border-white/10",
  // Icon styles
  iconBase: "bg-white/5 text-white/80",
  iconHover: "bg-white text-[#0e1635]",
  iconActive: "bg-white text-[#0e1635]",
  // Chevron styles
  chevronBase: "text-white/50",
  chevronHover: "text-white/70",
};

const ICON_SIZES = {
  sm: { container: "w-7 h-7", icon: "w-3.5 h-3.5" },
  md: { container: "w-8 h-8", icon: "w-4 h-4" },
  lg: { container: "w-9 h-9", icon: "w-4 h-4" },
};

// Navigation data factory
const createNavigationItems = (customer, admin) => {
  // Base items visible to both customers and admins
  const baseItems = [
    {
      icon: <LayoutDashboard />,
      text: "Dashboard",
      href: customer?._id
        ? "/dashboard"
        : admin?._id
        ? "/admin/dashboard"
        : "/",
      order: 1,
    },
  ];

  // Items only visible to customers
  const customerItems = [
    { icon: <Workflow />, text: "Automations", href: "/automations", order: 2 },
    {
      icon: <LuList />,
      text: "Lists",
      dropdown: [
        {
          icon: <FolderKanban />,
          text: "Overview",
          href: "/overview",
          order: 1,
        },
        { icon: <LuList />, text: "All Lists", href: "/my/lists", order: 2 },
        { icon: <LuUser />, text: "Contacts", href: "/contacts", order: 3 },
      ],
      order: 3,
    },
    {
      icon: <FileText />,
      text: "Email Templates",
      href: "/my/templates",
      order: 4,
    },
    { icon: <Logs />, text: "Logs", href: "/logs", order: 5 },
    {
      icon: <Logs />,
      text: "API Intregration",
      href: "/api-intregration",
      order: 6,
    },
  ];

  // Items only visible to admins
  const adminItems = [
    {
      icon: <Network />,
      text: "Infrastructure",
      dropdown: [
        {
          icon: <Server />,
          text: "Sending Servers",
          href: "/servers",
          order: 1,
        },
        { icon: <DoorOpen />, text: "Gateways", href: "/gateways", order: 2 },
      ],
      order: 3,
    },
    {
      icon: <LuUsers />,
      text: "Customers",
      dropdown: [
        { icon: <LuUsers />, text: "Customers", href: "/customers", order: 1 },
        {
          icon: <CgMediaLive />,
          text: "Customer Sessions",
          href: "/account/sessions",
          order: 2,
        },
      ],
      order: 4,
    },
    { icon: <LuPackage />, text: "Plans", href: "/plans", order: 5 },
    {
      icon: <ShieldUser />,
      text: "Admin Management",
      dropdown: [
        {
          icon: <UserStar />,
          text: "Admins Management",
          href: "/admin/admins-manage",
          order: 1,
        },
        {
          icon: <CgMediaLive />,
          text: "Admin Sessions",
          href: "/admin/sessions",
          order: 2,
        },
        { icon: <FolderPen />, text: "Roles", href: "/admin/roles", order: 3 },
        {
          icon: <GoGitPullRequest />,
          text: "Permissions",
          href: "/admin/permissions",
          order: 4,
        },
      ],
      order: 6,
    },
    {
      icon: <FaGears />,
      text: "Settings",
      dropdown: [
        {
          icon: <GoGear />,
          text: "Admin Auth Settings",
          href: "/admin/auth/settings",
          order: 1,
        },
        {
          icon: <GoFile />,
          text: "CSV Management",
          href: "/csv-manager",
          order: 2,
        },
      ],
      order: 7,
    },
  ];

  // Return combined and sorted navigation items based on user type
  const items = [
    ...baseItems,
    ...(admin ? [...adminItems, ...customerItems] : []),
    ...(customer ? customerItems : []),
  ];

  return items.sort((a, b) => a.order - b.order);
};

// User menu items
const USER_MENU_ITEMS = [
  { label: "My Account", icon: <BadgeCheck />, href: "/account" },
  {
    label: "Credits & Subscription",
    icon: <CreditCard />,
    href: "/account/subscription",
  },
  { label: "Billing", icon: <FileText />, href: "/account/billing" },
  { label: "Settings", icon: <Settings />, href: "/account/settings" },
];

const ADMIN_MENU_ITEMS = [
  { label: "My Account", icon: <BadgeCheck />, href: "/account" },
  { label: "Permissions", icon: <CreditCard />, href: "/admin/permission" },
];

// Utility functions
const getInitials = (user) => {
  if (!user?.firstName || typeof user.firstName !== "string") return "U";
  return user.firstName.charAt(0);
};

const getFullName = (user) => {
  if (!user?.firstName || !user?.lastName) return "Unknown User";
  return `${user.firstName} ${user.lastName}`;
};

const getEmail = (user) => {
  if (!user?.email || typeof user.email !== "string")
    return "No email available";
  return user.email;
};

const isUserActive = (user) => {
  return user?.hasOwnProperty("isActive") && user.isActive;
};

const getUserRole = (admin, customer) => {
  if (admin?.roleKey && typeof admin.roleKey === "string") {
    return admin.roleKey.toUpperCase();
  }
  return customer ? "CUSTOMER" : "UNKNOWN";
};

// Custom hooks
const useLocalStorage = (key, defaultValue) => {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      if (stored === null || stored === "undefined") return defaultValue;
      return JSON.parse(stored);
    } catch (e) {
      console.warn(`Error parsing localStorage key "${key}":`, e);
      return defaultValue;
    }
  });

  const setStoredValue = useCallback(
    (newValue) => {
      setValue(newValue);
      if (typeof window !== "undefined") {
        localStorage.setItem(key, JSON.stringify(newValue));
      }
    },
    [key]
  );

  return [value, setStoredValue];
};

const useDropdownState = (sideItems, pathname) => {
  return useMemo(() => {
    const openDropdowns = new Set();
    sideItems.forEach((item, idx) => {
      if (item.dropdown?.some((child) => child.href === pathname)) {
        openDropdowns.add(idx);
      }
    });
    return openDropdowns;
  }, [sideItems, pathname]);
};

// Hook for click outside functionality
const useClickOutside = (ref, callback) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [ref, callback]);
};

// Components
const IconTile = memo(
  ({ svg, size = "md", hovered = false, active = false }) => {
    const { container, icon } = ICON_SIZES[size];

    const bgClasses = useMemo(() => {
      if (active) return BUTTON_STYLES.iconActive;
      if (hovered) return BUTTON_STYLES.iconHover;
      return BUTTON_STYLES.iconBase;
    }, [active, hovered]);

    const renderedIcon = React.cloneElement(svg, {
      className: `${icon} ${svg.props?.className || ""}`.trim(),
      focusable: "false",
      "aria-hidden": "true",
    });

    return (
      <div
        className={`rounded-md flex items-center justify-center transition-colors ${container} ${bgClasses}`}
      >
        {renderedIcon}
      </div>
    );
  }
);

IconTile.displayName = "IconTile";
IconTile.propTypes = {
  svg: PropTypes.element.isRequired,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  hovered: PropTypes.bool,
  active: PropTypes.bool,
};

const SidebarButton = memo(
  ({
    svg,
    text,
    active = false,
    hasDropdown = false,
    isDropdownOpen = false,
    isChild = false,
    collapsed = false,
    forceHover = false,
    onClick,
  }) => {
    const hovered = !active && forceHover;

    const buttonClasses = useMemo(() => {
      const baseClasses = collapsed
        ? "group center-flex py-1 transition-all duration-200 cursor-pointer relative overflow-hidden w-full rounded-md justify-center"
        : "group flex items-center gap-3 px-3 py-2.5 transition-all duration-200 cursor-pointer relative overflow-hidden w-full rounded-md";

      const stateClasses = active
        ? BUTTON_STYLES.active
        : `${BUTTON_STYLES.base} ${BUTTON_STYLES.hover}`;

      const dropdownClasses =
        isDropdownOpen && !collapsed ? BUTTON_STYLES.active : "";

      return `${baseClasses} ${
        isChild ? "text-sm" : ""
      } ${stateClasses} ${dropdownClasses}`.trim();
    }, [collapsed, isChild, active, hovered, isDropdownOpen]);

    return (
      <button
        onClick={onClick}
        aria-label={text}
        title={collapsed ? text : undefined}
        className={buttonClasses}
      >
        {!collapsed && active && !isChild && (
          <div className="absolute left-0 top-0 h-full w-1.5 bg-white/70" />
        )}

        <IconTile
          svg={svg}
          size={isChild ? "sm" : "lg"}
          hovered={hovered}
          active={active}
        />

        {!collapsed && (
          <span
            className={`flex-1 text-left ${isChild ? "text-xs" : "text-sm"}`}
          >
            {text}
          </span>
        )}

        {!collapsed && hasDropdown && (
          <LuChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isDropdownOpen ? "rotate-180" : ""
            } ${
              hovered ? BUTTON_STYLES.chevronHover : BUTTON_STYLES.chevronBase
            }`}
          />
        )}
      </button>
    );
  }
);

SidebarButton.displayName = "SidebarButton";

const Flyout = memo(
  ({
    label,
    items,
    isDropdown,
    pos,
    onMouseEnter,
    onMouseLeave,
    onItemClick,
  }) => {
    // Calculate max height based on remaining viewport space
    const maxHeight = Math.max(150, window.innerHeight - pos.top - 40);

    return createPortal(
      <div
        style={{
          position: "fixed",
          top: `${pos.top}px`, // Ensure px unit
          left: `${pos.left}px`, // Ensure px unit
          zIndex: 9999,
          width: LAYOUT_CONSTANTS.FLYOUT_WIDTH,
          maxHeight: `${maxHeight}px`,
        }}
        className="rounded-r-2xl shadow-2xl border border-white/10 bg-second text-white py-3 overflow-hidden"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="px-4 pb-2 text-xs font-semibold text-white/70 tracking-wide uppercase">
          {label}
        </div>

        <div
          className={`px-2 ${isDropdown ? "flex flex-col gap-1" : ""}`}
          style={{
            maxHeight: `${maxHeight - 60}px`, // Subtract header height
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {isDropdown ? (
            items.map((item) => (
              <button
                key={item.text}
                onClick={() => onItemClick(item.href)}
                className={`group flex items-center gap-3 rounded-md text-sm transition-colors p-2 flex-shrink-0 ${BUTTON_STYLES.base} ${BUTTON_STYLES.hover}`}
              >
                <IconTile svg={item.icon} size="sm" />
                <span className="flex-1 text-left">{item.text}</span>
                <LuChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/80" />
              </button>
            ))
          ) : (
            <button
              onClick={() => onItemClick(items[0].href)}
              className={`w-full group flex items-center gap-3 rounded-md text-sm transition-colors p-2 ${BUTTON_STYLES.base} ${BUTTON_STYLES.hover}`}
            >
              <IconTile svg={items[0].icon} size="sm" />
              <span className="flex-1 text-left">{items[0].text}</span>
              <LuChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/60" />
            </button>
          )}
        </div>
      </div>,
      document.body
    );
  }
);

Flyout.displayName = "Flyout";

const UserAvatar = memo(({ user, size = "sm" }) => {
  const sizeClasses = size === "lg" ? "w-12 h-12 text-lg" : "w-6 h-6";

  return (
    <div
      className={`${sizeClasses} rounded-sm bg-white/30 text-white/90 font-medium tracking-wide center-flex uppercase`}
    >
      {getInitials(user)}
    </div>
  );
});

UserAvatar.displayName = "UserAvatar";

const UserStatus = memo(({ user }) => {
  const isActive = isUserActive(user);

  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-sm text-xs font-medium ${
        isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isActive ? "bg-emerald-500" : "bg-red-500"
        } animate-pulse`}
      />
      {isActive ? "Account Active" : "Account Inactive"}
    </span>
  );
});

UserStatus.displayName = "UserStatus";

// Main component
const SidebarWrapper = ({ children }) => {
  const { customer, resetCustomer } = useCustomerStore();
  const { admin, resetAdmin } = useAdminStore();

  const router = useRouter();
  const pathname = usePathname();

  // State management
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useLocalStorage(
    LAYOUT_CONSTANTS.COLLAPSE_KEY,
    false
  );
  const [openDropdowns, setOpenDropdowns] = useState(() => new Set());
  const [flyoutIndex, setFlyoutIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  // Refs
  const closeTimer = useRef(0);
  const itemRefs = useRef([]);
  const userDropdownRef = useRef(null);

  // Click outside hook for user dropdown
  useClickOutside(userDropdownRef, () => setIsUserDropdownOpen(false));

  // Memoized values
  const sideItems = useMemo(
    () => createNavigationItems(customer, admin),
    [customer, admin]
  );
  const autoOpenDropdowns = useDropdownState(sideItems, pathname);

  const currentUser = customer || admin;
  const menuItems = customer ? USER_MENU_ITEMS : ADMIN_MENU_ITEMS;

  const currentPage = useMemo(() => {
    const main = sideItems.find((item) => item.href === pathname);
    if (main) return main.text;

    for (const item of sideItems) {
      const child = item.dropdown?.find((c) => c.href === pathname);
      if (child) return child.text;
    }
    return "Dashboard";
  }, [sideItems, pathname]);

  // Callbacks
  const isItemActive = useCallback(
    (item) =>
      pathname === item.href || item.dropdown?.some((c) => pathname === c.href),
    [pathname]
  );

  const handleNavigation = useCallback(
    (href) => {
      if (!href) return;
      router.push(href);
      setIsMobileOpen(false);
      setHoveredIndex(null);
      setFlyoutIndex(null);
      setIsUserDropdownOpen(false); // Close user dropdown on navigation
    },
    [router]
  );

  const toggleDropdown = useCallback((index) => {
    setOpenDropdowns((prev) => {
      const newSet = new Set(prev);
      newSet.has(index) ? newSet.delete(index) : newSet.add(index);
      return newSet;
    });
  }, []);

  const scheduleClose = useCallback((delay = LAYOUT_CONSTANTS.CLOSE_DELAY) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setHoveredIndex(null);
      setFlyoutIndex(null);
    }, delay);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = 0;
    }
  }, []);

  const computeFlyoutPos = useCallback((rect) => {
    // Get the exact position of the hovered sidebar item
    const itemTop = rect.top;
    const itemLeft = rect.left;
    const itemRight = rect.right;
    const itemHeight = rect.height;
    const left = itemRight + LAYOUT_CONSTANTS.GAP;
    let top = itemTop;

    const ESTIMATED_FLYOUT_HEIGHT = 200; // Conservative estimate
    const viewportHeight = window.innerHeight;

    if (top + ESTIMATED_FLYOUT_HEIGHT > viewportHeight - 20) {
      top = viewportHeight - ESTIMATED_FLYOUT_HEIGHT - 20;
      top = Math.max(20, top);
    }
    return { top, left };
  }, []);

  const openFlyoutForIndex = useCallback(
    (index) => {
      const anchor = itemRefs.current[index];
      if (!anchor) {
        return;
      }

      // Get the bounding rect of the actual sidebar button
      const rect = anchor.getBoundingClientRect();

      const pos = computeFlyoutPos(rect);
      setFlyoutPos(pos);
      setHoveredIndex(index);
      setFlyoutIndex(index);
    },
    [computeFlyoutPos]
  );

  const logout = useCallback(() => {
    resetCustomer();
    resetAdmin();
    router.push(customer ? "/auth" : "/admin/auth");
  }, [resetCustomer, resetAdmin, router, customer]);

  const toggleUserDropdown = useCallback(() => {
    setIsUserDropdownOpen((prev) => !prev);
  }, []);

  // Effects
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    setOpenDropdowns(autoOpenDropdowns);
  }, [autoOpenDropdowns]);

  useEffect(() => {
    if (flyoutIndex === null) return;

    const updateFlyoutPosition = () => {
      const anchor = itemRefs.current[flyoutIndex];
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setFlyoutPos(computeFlyoutPos(rect));
    };

    const handleResize = () => updateFlyoutPosition();
    const handleScroll = () => requestAnimationFrame(updateFlyoutPosition);

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    updateFlyoutPosition();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [flyoutIndex, computeFlyoutPos]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
      }
    };
  }, []);

  return (
    <div className="w-full h-screen flex relative bg-zinc-300">
      {/* Sidebar */}
      <div className="py-2">
        <div
          className={`
            ${isCollapsed ? "w-16" : "w-72"}
            h-full bg-primary text-zinc-100 flex flex-col z-40 fixed lg:static 
            transform transition-[transform,width] duration-300 ease-out
            ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
            lg:translate-x-0 overflow-x-visible border-r border-white/10 rounded-r-xl 
          `}
          onMouseLeave={() => {
            if (!isCollapsed) {
              setFlyoutIndex(null);
              setHoveredIndex(null);
            }
          }}
        >
          {/* Header */}
          <div className="px-3 py-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                {!isCollapsed && (
                  <>
                    <div className="w-9 h-9 p-2 rounded-md bg-white/5 center-flex border border-white/10">
                      <ChartNoAxesCombined className="w-full h-full text-white" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-lg font-semibold text-white truncate">
                        {process.env.NEXT_PUBLIC_PROJECT_NAME}
                      </h1>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsCollapsed((prev) => !prev)}
                  className="hidden lg:inline-flex p-2 text-white/70 hover:bg-white/10 hover:text-white rounded-lg"
                  aria-label={
                    isCollapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
                  title={isCollapsed ? "Expand" : "Collapse"}
                >
                  <PanelRightOpen className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="lg:hidden p-2 text-white/70 hover:bg-white/10 hover:text-white rounded-lg"
                >
                  <LuX className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto overflow-x-visible p-2 space-y-1 scrollbar-thin">
            {!isCollapsed && (
              <h3 className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-3 px-3">
                Main Navigation
              </h3>
            )}

            <div className="flex flex-col gap-1">
              {sideItems
                .sort((a, b) => a.order - b.order)
                .map((item, index) => {
                  const active = isItemActive(item);
                  const forceHover =
                    isCollapsed &&
                    (hoveredIndex === index || flyoutIndex === index);
                  const hasDropdown = !!item.dropdown;

                  return (
                    <div
                      key={`${item.text}-${index}`}
                      className="relative"
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      onMouseEnter={() => {
                        if (isCollapsed) {
                          cancelClose();
                          openFlyoutForIndex(index);
                        }
                      }}
                      onMouseLeave={() => {
                        if (isCollapsed) {
                          scheduleClose(100);
                        }
                      }}
                    >
                      <SidebarButton
                        svg={item.icon}
                        text={item.text}
                        active={active}
                        hasDropdown={hasDropdown}
                        isDropdownOpen={openDropdowns.has(index)}
                        collapsed={isCollapsed}
                        forceHover={forceHover}
                        onClick={() => {
                          if (hasDropdown) {
                            if (isCollapsed) {
                              openFlyoutForIndex(index);
                            } else {
                              toggleDropdown(index);
                            }
                          } else if (item.href) {
                            handleNavigation(item.href);
                          }
                        }}
                      />

                      {/* Dropdown menu */}
                      {!isCollapsed && hasDropdown && (
                        <div
                          className={`overflow-hidden transition-all duration-300 ease-in-out ${
                            openDropdowns.has(index)
                              ? "max-h-96 opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="ml-3 mt-1 space-y-1 border-l border-white/10 p-1.5">
                            {item.dropdown.map((dropdownItem) => (
                              <SidebarButton
                                key={dropdownItem.text}
                                svg={dropdownItem.icon}
                                text={dropdownItem.text}
                                active={pathname === dropdownItem.href}
                                isChild
                                collapsed={false}
                                onClick={() =>
                                  handleNavigation(dropdownItem.href)
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Footer Settings */}
          <div className="p-3">
            <div className="w-full min-h-10 h-10 p-2 text-sm rounded-md center-flex gap-2 bg-white/20 hover:bg-white/30 cursor-pointer transition-all">
              {isCollapsed ? (
                <FaGears className="w-full h-full" />
              ) : (
                <>
                  <FaGears className="text-lg" /> Settings
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 h-full overflow-hidden space-y-2 flex flex-col px-2">
        {/* Top Bar */}
        <div className="bg-primary px-3 md:px-6 py-2 sticky top-0 z-20 rounded-b-xl text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMobileOpen(true)}
                className={`lg:hidden p-2 bg-white shadow border border-zinc-300 text-zinc-700 hover:text-zinc-900 hover:border-zinc-400 transition-all duration-200 rounded-md ${
                  isMobileOpen
                    ? "opacity-0 pointer-events-none"
                    : "opacity-100 pointer-events-auto"
                }`}
              >
                <LuMenu className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-start flex-wrap gap-1 text-xs md:text-sm">
                <span>{process.env.NEXT_PUBLIC_PROJECT_NAME}</span>
                <LuChevronRight className="w-4 h-4 text-zinc-200" />
                {sideItems.map((item, idx) => {
                  const childMatch = item.dropdown?.find(
                    (c) => c.href === pathname
                  );
                  if (childMatch) {
                    return (
                      <React.Fragment key={`breadcrumb-${idx}`}>
                        <span className="text-zinc-100">{item.text}</span>
                        <LuChevronRight className="w-4 h-4 text-zinc-200" />
                        <span className="text-zinc-100 font-medium">
                          {childMatch.text}
                        </span>
                      </React.Fragment>
                    );
                  }
                  return null;
                })}
                {!sideItems.some((item) =>
                  item.dropdown?.some((c) => c.href === pathname)
                ) && (
                  <span className="text-zinc-100 font-medium">
                    {currentPage}
                  </span>
                )}
              </div>
            </div>

            {/* User Menu */}
            <div
              className="flex items-center gap-3 relative"
              ref={userDropdownRef}
            >
              <button
                onClick={toggleUserDropdown}
                className={`flex items-center gap-2 text-sm rounded-sm p-2 transition-colors ${
                  isUserDropdownOpen ? "bg-white/10" : "hover:bg-white/10"
                }`}
              >
                <UserAvatar user={currentUser} size="sm" />
                <div className="flex items-center gap-1">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {getFullName(currentUser)}
                    </div>
                  </div>
                  <LuChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isUserDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {/* User Dropdown */}
              <div
                role="menu"
                aria-label="Account menu"
                className={`
                  absolute -right-2 md:-right-5 top-full mt-2 z-50
                  w-[580px] max-w-[94vw]
                  bg-primary settings-pattern
                  rounded-lg border-t-2 border-zinc-300
                  transition-all duration-200 origin-top-right
                  overflow-hidden
                  ${
                    isUserDropdownOpen
                      ? "opacity-100 scale-100 translate-y-0 visible"
                      : "opacity-0 scale-95 translate-y-1 invisible"
                  }
                `}
              >
                <div className="flex">
                  {/* Left panel: User Identity */}
                  <div className="w-[56%] p-4 sm:p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={currentUser} size="lg" />
                      <div className="min-w-0">
                        <div className="text-sm sm:text-base font-semibold text-white truncate">
                          {getFullName(currentUser)}
                        </div>
                        <div className="text-xs sm:text-sm text-zinc-100 truncate">
                          {getEmail(currentUser)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <UserStatus user={currentUser} />
                      <span className="bg-white/30 inline-flex items-center gap-2 px-2.5 py-1 rounded-sm text-xs font-medium">
                        Role:
                        <span className="uppercase">
                          {getUserRole(admin, customer)}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Right panel: Menu Items */}
                  <div className="w-[44%] min-w-[10rem] p-2 sm:p-3">
                    <div className="flex flex-col">
                      {menuItems.map((item) => (
                        <button
                          key={item.label}
                          onClick={() => handleNavigation(item.href)}
                          className="w-full btn btn-sm flex items-center gap-2 text-white hover:bg-white/30 rounded mb-1"
                        >
                          <div className="w-4 h-4 center-flex">{item.icon}</div>
                          {item.label}
                        </button>
                      ))}

                      <div className="my-1 mb-2 h-px bg-white/50" />

                      <button
                        onClick={logout}
                        className="btn btn-sm flex items-center gap-1 text-red-500 border border-red-200 hover:border-red-300 bg-red-100 hover:bg-red-200 rounded"
                      >
                        <div className="text-red-600 center-flex">
                          <LogOut className="w-4 h-4" />
                        </div>
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 h-full overflow-hidden flex flex-col bg-zinc-50 rounded-t-lg">
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 bg-white min-h-full">{children}</div>
          </div>
        </div>
      </div>

      {/* Flyout for Collapsed Mode */}
      {isCollapsed && flyoutIndex !== null && sideItems[flyoutIndex] && (
        <Flyout
          label={sideItems[flyoutIndex].text}
          isDropdown={!!sideItems[flyoutIndex].dropdown}
          items={
            sideItems[flyoutIndex].dropdown || [
              {
                icon: sideItems[flyoutIndex].icon,
                text: sideItems[flyoutIndex].text,
                href: sideItems[flyoutIndex].href,
              },
            ]
          }
          pos={flyoutPos}
          onMouseEnter={cancelClose}
          onMouseLeave={() =>
            scheduleClose(LAYOUT_CONSTANTS.FLYOUT_CLOSE_DELAY)
          }
          onItemClick={handleNavigation}
        />
      )}
    </div>
  );
};

SidebarWrapper.propTypes = {
  children: PropTypes.node,
};

export default SidebarWrapper;
