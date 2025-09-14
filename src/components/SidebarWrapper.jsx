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

// Constants
const LAYOUT_CONSTANTS = {
  GAP: 8,
  FLYOUT_WIDTH: 256,
  COLLAPSE_KEY: "sidebarCollapsed",
  CLOSE_DELAY: 110,
  FLYOUT_CLOSE_DELAY: 85,
};

const ICON_SIZES = {
  sm: { container: "w-7 h-7", icon: "w-3.5 h-3.5" },
  md: { container: "w-8 h-8", icon: "w-4 h-4" },
  lg: { container: "w-9 h-9", icon: "w-4 h-4" },
};

// Theme configuration
const THEME_COLORS = {
  dark: {
    idleText: "text-white/80",
    idleBg: "bg-white/0",
    hoverText: "text-white",
    hoverBg: "bg-white/10",
    activeBg: "bg-white/10",
    activeText: "text-white",
    chevron: "text-white/50",
    chevronHover: "text-white/70",
    border: "border-white/10",
  },
  light: {
    idleText: "text-zinc-600",
    idleBg: "bg-transparent",
    hoverText: "text-zinc-800",
    hoverBg: "bg-zinc-100",
    activeBg: "bg-zinc-100",
    activeText: "text-zinc-900",
    chevron: "text-zinc-400",
    chevronHover: "text-zinc-500",
    border: "border-zinc-200",
  },
};

// Navigation data factory
const createNavigationItems = (customer, admin) => [
  {
    icon: <LayoutDashboard />,
    text: "Dashboard",
    href: customer?._id ? "/dashboard" : admin?._id ? "/admin/dashboard" : "/",
  },
  { icon: <Globe />, text: "Websites", href: "/websites" },
  {
    icon: <LuLink />,
    text: "Automations",
    href: "/automations",
    dropdown: [
      { icon: <Workflow />, text: "All Automations", href: "/automations" },
      { icon: <LuList />, text: "Lists", href: "/automations/lists" },
      { icon: <LuUser />, text: "Contacts", href: "/contacts" },
      { icon: <FileText />, text: "Email Templates", href: "/templates" },
    ],
  },
  { icon: <Logs />, text: "Logs", href: "/logs" },
  {
    icon: <Network />,
    text: "Infrastructure",
    dropdown: [
      { icon: <Server />, text: "Sending Servers", href: "/servers" },
      { icon: <DoorOpen />, text: "Gateways", href: "/gateways" },
    ],
  },
  {
    icon: <LuUsers />,
    text: "Customers",
    dropdown: [
      { icon: <LuUsers />, text: "Customers", href: "/customers" },
      { icon: <CgMediaLive />, text: "Customer Sessions", href: "/account/sessions" },
    ],
  },
  { icon: <LuPackage />, text: "Plans", href: "/plans" },
  {
    icon: <ShieldUser />,
    text: "Admin Management",
    dropdown: [
      { icon: <UserStar />, text: "Admins Management", href: "/admin/admins-manage" },
      { icon: <CgMediaLive />, text: "Admin Sessions", href: "/admin/sessions" },
      { icon: <FolderPen />, text: "Roles", href: "/admin/roles" },
      { icon: <GoGitPullRequest />, text: "Permissions", href: "/admin/permissions" },
    ],
  },
  {
    icon: <FaGears />,
    text: "Settings",
    dropdown: [
      { icon: <GoGear />, text: "Admin Auth Settings", href: "/admin/auth/settings" },
      { icon: <GoFile />, text: "CSV Management", href: "/csv-manager" },
    ],
  },
];

// User menu items
const USER_MENU_ITEMS = [
  { label: "My Account", icon: <BadgeCheck />, href: "/account" },
  { label: "Credits & Subscription", icon: <CreditCard />, href: "/account/subscription" },
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
  return user.firstName.charAt(0).toUpperCase();
};

const getFullName = (user) => {
  if (!user?.firstName || !user?.lastName) return "Unknown User";
  return `${user.firstName} ${user.lastName}`;
};

const getEmail = (user) => {
  if (!user?.email || typeof user.email !== "string") return "No email available";
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
      console.warn(`Error parsing localStorage key “${key}”:`, e);
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

// Components
const IconTile = memo(({ svg, size = "md", dark = false, hovered = false, active = false }) => {
  const { container, icon } = ICON_SIZES[size];
  
  const bgClasses = useMemo(() => {
    if (active) return dark ? "bg-white text-[#0e1635]" : "bg-white text-zinc-600";
    if (hovered) return dark ? "bg-white text-[#0e1635]" : "bg-zinc-200 text-zinc-600";
    return dark ? "bg-white/5 text-white/80" : "bg-zinc-100 text-zinc-500";
  }, [active, hovered, dark]);

  const renderedIcon = React.cloneElement(svg, {
    className: `${icon} ${svg.props?.className || ""}`.trim(),
    focusable: "false",
    "aria-hidden": "true",
  });

  return (
    <div className={`rounded-md flex items-center justify-center transition-colors ${container} ${bgClasses}`}>
      {renderedIcon}
    </div>
  );
});

IconTile.displayName = "IconTile";
IconTile.propTypes = {
  svg: PropTypes.element.isRequired,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  dark: PropTypes.bool,
  hovered: PropTypes.bool,
  active: PropTypes.bool,
};

const SidebarButton = memo(({
  svg,
  text,
  active = false,
  hasDropdown = false,
  isDropdownOpen = false,
  isChild = false,
  collapsed = false,
  dark = false,
  forceHover = false,
  onClick,
}) => {
  const colors = THEME_COLORS[dark ? "dark" : "light"];
  const hovered = !active && forceHover;

  const buttonClasses = useMemo(() => {
    const baseClasses = collapsed
      ? "group center-flex py-1 transition-all duration-200 cursor-pointer relative overflow-hidden w-full rounded-md justify-center"
      : "group flex items-center gap-3 px-3 py-2.5 transition-all duration-200 cursor-pointer relative overflow-hidden w-full rounded-md";

    const stateClasses = active
      ? `${colors.activeBg} ${colors.activeText} ${colors.border} border`
      : hovered
      ? `${colors.hoverBg} ${colors.hoverText}`
      : `${colors.idleBg} ${colors.idleText}`;

    const dropdownClasses = isDropdownOpen && !collapsed
      ? `${colors.activeBg} ${colors.activeText}`
      : "";

    return `${baseClasses} ${isChild ? "text-sm" : ""} ${stateClasses} ${dropdownClasses}`.trim();
  }, [collapsed, isChild, active, hovered, isDropdownOpen, colors]);

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
        dark={dark}
        hovered={hovered}
        active={active}
      />
      
      {!collapsed && (
        <span className={`flex-1 text-left ${isChild ? "text-xs" : "text-sm"}`}>
          {text}
        </span>
      )}
      
      {!collapsed && hasDropdown && (
        <LuChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${
            isDropdownOpen ? "rotate-180" : ""
          } ${hovered ? colors.chevronHover : colors.chevron}`}
        />
      )}
    </button>
  );
});

SidebarButton.displayName = "SidebarButton";
SidebarButton.propTypes = {
  svg: PropTypes.element.isRequired,
  text: PropTypes.string.isRequired,
  active: PropTypes.bool,
  hasDropdown: PropTypes.bool,
  isDropdownOpen: PropTypes.bool,
  isChild: PropTypes.bool,
  collapsed: PropTypes.bool,
  dark: PropTypes.bool,
  forceHover: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};

const Flyout = memo(({ label, items, isDropdown, pos, onMouseEnter, onMouseLeave, onItemClick }) => {
  return createPortal(
    <div
      style={{ 
        position: "fixed", 
        top: pos.top, 
        left: pos.left, 
        zIndex: 9999,
        width: LAYOUT_CONSTANTS.FLYOUT_WIDTH 
      }}
      className="rounded-r-2xl shadow-2xl border border-white/10 bg-second text-white py-3"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="px-4 pb-2 text-xs font-semibold text-white/70 tracking-wide uppercase">
        {label}
      </div>
      
      <div className={`px-2 ${isDropdown ? "flex flex-col gap-1" : ""}`}>
        {isDropdown ? (
          items.map((item) => (
            <button
              key={item.text}
              onClick={() => onItemClick(item.href)}
              className="group flex items-center gap-3 rounded-md text-sm text-white/90 hover:text-white hover:bg-white/10 transition-colors p-2"
            >
              <IconTile svg={item.icon} size="sm" dark />
              <span className="flex-1 text-left">{item.text}</span>
              <LuChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/80" />
            </button>
          ))
        ) : (
          <button
            onClick={() => onItemClick(items[0].href)}
            className="w-full group flex items-center gap-3 rounded-md text-sm text-white/90 hover:text-white hover:bg-white/10 transition-colors p-2"
          >
            <IconTile svg={items[0].icon} size="sm" dark />
            <span className="flex-1 text-left">{items[0].text}</span>
            <LuChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/60" />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
});

Flyout.displayName = "Flyout";
Flyout.propTypes = {
  label: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      icon: PropTypes.element.isRequired,
      text: PropTypes.string.isRequired,
      href: PropTypes.string,
    })
  ).isRequired,
  isDropdown: PropTypes.bool.isRequired,
  pos: PropTypes.shape({ 
    top: PropTypes.number, 
    left: PropTypes.number 
  }).isRequired,
  onMouseEnter: PropTypes.func.isRequired,
  onMouseLeave: PropTypes.func.isRequired,
  onItemClick: PropTypes.func.isRequired,
};

const UserAvatar = memo(({ user, size = "sm" }) => {
  const sizeClasses = size === "lg" ? "w-12 h-12 text-lg" : "w-6 h-6";
  
  return (
    <div className={`${sizeClasses} rounded-md bg-white/30 text-white/90 font-medium tracking-wide center-flex first-letter:uppercase`}>
      {getInitials(user)}
    </div>
  );
});

UserAvatar.displayName = "UserAvatar";
UserAvatar.propTypes = {
  user: PropTypes.object,
  size: PropTypes.oneOf(["sm", "lg"]),
};

const UserStatus = memo(({ user }) => {
  const isActive = isUserActive(user);
  
  return (
    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-sm text-xs font-medium ${
      isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
    }`}>
      <span className={`h-2 w-2 rounded-full ${
        isActive ? "bg-emerald-500" : "bg-red-500"
      } animate-pulse`} />
      {isActive ? "Account Active" : "Account Inactive"}
    </span>
  );
});

UserStatus.displayName = "UserStatus";
UserStatus.propTypes = {
  user: PropTypes.object,
};

// Main component
const SidebarWrapper = ({ children }) => {
  const { customer, resetCustomer } = useCustomerStore();
  const { admin, resetAdmin } = useAdminStore();
  const router = useRouter();
  const pathname = usePathname();

  // State management
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useLocalStorage(LAYOUT_CONSTANTS.COLLAPSE_KEY, false);
  const [openDropdowns, setOpenDropdowns] = useState(() => new Set());
  const [flyoutIndex, setFlyoutIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });

  // Refs
  const closeTimer = useRef(0);
  const itemRefs = useRef([]);

  // Memoized values
  const sideItems = useMemo(() => createNavigationItems(customer, admin), [customer, admin]);
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
    (item) => pathname === item.href || item.dropdown?.some((c) => pathname === c.href),
    [pathname]
  );

  const handleNavigation = useCallback(
    (href) => {
      if (!href) return;
      router.push(href);
      setIsMobileOpen(false);
      setHoveredIndex(null);
      setFlyoutIndex(null);
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
    const left = Math.min(
      rect.right + LAYOUT_CONSTANTS.GAP,
      window.innerWidth - LAYOUT_CONSTANTS.GAP - LAYOUT_CONSTANTS.FLYOUT_WIDTH
    );
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - 368));
    return { top, left };
  }, []);

  const openFlyoutForIndex = useCallback((index) => {
    const anchor = itemRefs.current[index];
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setFlyoutPos(computeFlyoutPos(rect));
    setHoveredIndex(index);
    setFlyoutIndex(index);
  }, [computeFlyoutPos]);

  const logout = useCallback(() => {
    resetCustomer();
    resetAdmin();
    router.push(customer ? "/auth" : "/admin/auth");
  }, [resetCustomer, resetAdmin, router, customer]);

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
            ${isCollapsed ? "w-16" : "w-64"}
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
                  onClick={() => setIsCollapsed(prev => !prev)}
                  className="hidden lg:inline-flex p-2 text-white/70 hover:bg-white/10 hover:text-white rounded-lg"
                  aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
              {sideItems.map((item, index) => {
                const active = isItemActive(item);
                const forceHover = isCollapsed && (hoveredIndex === index || flyoutIndex === index);
                const hasDropdown = !!item.dropdown;

                return (
                  <div
                    key={`${item.text}-${index}`}
                    className="relative"
                    ref={(el) => (itemRefs.current[index] = el)}
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
                      dark
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
                          openDropdowns.has(index) ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
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
                              dark
                              onClick={() => handleNavigation(dropdownItem.href)}
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
        <div className="bg-primary px-6 py-3 sticky top-0 z-20 rounded-b-xl text-white">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsMobileOpen(true)}
              className={`lg:hidden p-2 bg-white shadow border border-zinc-300 text-zinc-700 hover:text-zinc-900 hover:border-zinc-400 transition-all duration-200 rounded-md ${
                isMobileOpen ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
              }`}
            >
              <LuMenu className="w-4 h-4" />
            </button>
            
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <span>{process.env.NEXT_PUBLIC_PROJECT_NAME}</span>
              <LuChevronRight className="w-4 h-4 text-zinc-200" />
              {sideItems.map((item, idx) => {
                const childMatch = item.dropdown?.find((c) => c.href === pathname);
                if (childMatch) {
                  return (
                    <React.Fragment key={`breadcrumb-${idx}`}>
                      <span className="text-zinc-100">{item.text}</span>
                      <LuChevronRight className="w-4 h-4 text-zinc-200" />
                      <span className="text-zinc-100 font-medium">{childMatch.text}</span>
                    </React.Fragment>
                  );
                }
                return null;
              })}
              {!sideItems.some((item) => item.dropdown?.some((c) => c.href === pathname)) && (
                <span className="text-zinc-100 font-medium">{currentPage}</span>
              )}
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-3 relative group">
              <div className="flex items-center gap-2 text-sm">
                <UserAvatar user={currentUser} size="sm" />
                <div className="flex items-center gap-1">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {getFullName(currentUser)}
                    </div>
                  </div>
                  <LuChevronDown className="w-4 h-4" />
                </div>
              </div>

              {/* User Dropdown */}
              <div
                role="menu"
                aria-label="Account menu"
                className="
                  absolute -right-5 top-full mt-2 z-50
                  w-[620px] max-w-[calc(100vw-2rem)]
                  bg-primary settings-pattern
                  rounded-b-xl
                  opacity-0 scale-95 translate-y-1 invisible
                  transition-all duration-200 origin-top-right
                  group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 group-hover:visible
                  focus-within:opacity-100 focus-within:scale-100 focus-within:translate-y-0 focus-within:visible
                  overflow-hidden
                "
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
                          className="w-full btn btn-sm flex items-center gap-1 text-primary border hover:border-zinc-300 bg-zinc-100 hover:bg-white/80 rounded mb-1"
                        >
                          <div className="text-primary w-4 h-4 center-flex">
                            {item.icon}
                          </div>
                          {item.label}
                        </button>
                      ))}

                      <div className="my-2 h-px bg-zinc-200" />

                      <button
                        onClick={logout}
                        className="btn btn-sm flex items-center gap-1 text-red-500 border border-red-200 hover:border-red-300 bg-red-100 hover:bg-red-200 rounded"
                      >
                        <div className="text-red-600 w-5 h-5 flex items-center justify-center">
                          <LogOut className="w-5 h-5" />
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
          onMouseLeave={() => scheduleClose(LAYOUT_CONSTANTS.FLYOUT_CLOSE_DELAY)}
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