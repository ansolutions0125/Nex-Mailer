"use client";
import SidebarWrapper from "@/components/SidebarWrapper";
import axios from "axios";
import { TrendingDown, TrendingUp } from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  FiZap,
  FiAlertCircle,
  FiMail,
} from "react-icons/fi";
import { ImSpinner, ImSpinner5 } from "react-icons/im";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const Home = () => {
  // State management
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/dashstats");
        const result = await response.json();

        if (response.ok && result.success) {
          setStats(result.data);
        } else {
          throw new Error(result.message || "Failed to fetch dashboard stats.");
        }
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        setError(err.message || "Failed to load dashboard data");
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDashStats();
  }, []);

  const labelStyles = (type) => {
    const baseStyles = "font-semibold text-zinc-500 uppercase tracking-wider";
    return type === "mini"
      ? `text-[0.6rem] ${baseStyles}`
      : `text-xs ${baseStyles}`;
  };

  const [cronLoading, setCronLoading] = useState({
    email: false,
    processing: false,
  });

  const handleCronRuns = (type) => async () => {
    try {
      setCronLoading((prev) => ({ ...prev, [type]: true }));
      if (type === "email") {
        await axios.get("/api/crons/emailProcessor");
      } else if (type === "processing") {
        await axios.get("/api/crons/processingCron");
      }
    } finally {
      setCronLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const MetricCard = ({ title, value, special }) => {
    const getIconColor = (title) => {
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes("total")) return "bg-blue-500/70";
      if (lowerTitle.includes("new")) return "bg-green-500/70";
      if (lowerTitle.includes("email")) return "bg-purple-500/70";
      return "";
    };

    return (
      <div
        className={`flex items-start gap-3   ${
          special ? "border border-zinc-200 rounded" : "bg-white"
        } p-3`}
      >
        {getIconColor(title) && (
          <div className={`w-0.5 h-full rounded-full ${getIconColor(title)}`} />
        )}
        <div>
          <div className="flex items-center gap-2">
            <h3
              className={`text-xs ${
                special ? "text-zinc-800" : "text-zinc-500"
              } uppercase`}
            >
              {title}
            </h3>
          </div>
          <div
            className={`text-lg md:text-xl font-medium ${
              special ? "text-zinc-800" : "text-zinc-700"
            }  mb-1`}
          >
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
            ) : (
              value?.toLocaleString() || "0"
            )}
          </div>
        </div>
      </div>
    );
  };
  // Loading state
  if (loading) {
    return (
      <SidebarWrapper>
        <div className="flex items-center justify-center min-h-64">
          <div className="flex flex-col items-center gap-2">
            <ImSpinner5 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-gray-500">Loading dashboard...</p>
          </div>
        </div>
      </SidebarWrapper>
    );
  }

  // Error state
  if (error) {
    return (
      <SidebarWrapper>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <FiAlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Failed to Load Dashboard
            </h2>
            <p className="text-gray-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Retry
            </button>
          </div>
        </div>
      </SidebarWrapper>
    );
  }

  return (
    <SidebarWrapper>
      <div className="flex flex-col md:flex-row gap-2 justify-between items-start mb-5">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-3 text-zinc-800">
            <div className="flex items-center justify-center relative">
              <span className="w-4 h-4 rounded-full bg-green-500 animate-[pulse_2s_ease-in-out_infinite]"></span>
              <span className="w-4 h-4 rounded-full bg-green-500 absolute top-0 left-0 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]"></span>
            </div>
            Dashboard
          </h1>
          <p className="text-sm text-zinc-500">
            Real-time statistics and key metrics
          </p>
        </div>

        <div className="flex flex-col gap-2 bg-zinc-50 p-3 rounded-lg border border-zinc-200">
          <label className={labelStyles("mini")}>Dashboard Actions</label>
          <div className="flex gap-2">
            <button
              onClick={handleCronRuns("email")}
              disabled={cronLoading.email}
              className="min-w-32 btn btn-sm btn-primary flex items-center gap-1"
            >
              {cronLoading.email ? (
                <div className="flex items-center gap-1">
                  <ImSpinner className="animate-spin" /> Processing
                </div>
              ) : (
                <>
                  <FiMail className="w-3.5 h-3.5" />
                  <span>Run Email Queue</span>
                </>
              )}
            </button>
            <button
              onClick={handleCronRuns("processing")}
              disabled={cronLoading.processing}
              className="min-w-32 btn btn-sm btn-primary flex items-center gap-1"
            >
              {cronLoading.processing ? (
                <div className="flex items-center gap-1">
                  <ImSpinner className="animate-spin" /> Processing
                </div>
              ) : (
                <>
                  <FiZap className="w-3.5 h-3.5" />
                  <span>Run Processing Cron</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="w-full">
        <div className="w-full border-x border-t p-2 rounded-t-md text-zinc-800">
          <div className="text-sm md:text-base lg:text-lg font-semibold p-3">
            Performance Overview
          </div>
        </div>
        <div className="p-3 bg-zinc-50 border border-zinc-200">
          <div className="text-sm font-medium px-3">Subscriber Overview</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-white border-b border-zinc-200">
          <div className="p-3 flex flex-col gap-1 md:border-r border-zinc-200">
            <div className="text-sm uppercase">Total active subscribers</div>
            <h1 className="text-lg font-semibold tracking-wide">
              {stats?.subscribers?.totalActive?.toLocaleString() || "0"}
            </h1>
            <div className="flex items-center space-x-2">
              {stats?.subscribers?.weeklyGrowth?.isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  stats?.subscribers?.weeklyGrowth?.isPositive
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {Math.abs(stats?.subscribers?.weeklyGrowth?.growthRate || 0)}%
              </span>
              <span className="text-xs text-gray-500">vs Prev 7 days</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 divide-y divide-zinc-200 md:border-r border-zinc-200 pr-3">
            <MetricCard
              title="Total Users"
              value={stats?.subscribers?.totalUsers}
            />
            <MetricCard
              title="New Subscribers in (current month)"
              value={stats?.subscribers?.newThisMonth}
            />
          </div>
          <div className="flex flex-col gap-2 divide-y divide-zinc-200">
            <MetricCard
              title="Total Subscribers Requests"
              value={stats?.subscribers?.totalRequests}
            />
            <MetricCard
              title="New Subscribers in (current Day)"
              value={stats?.subscribers?.newToday}
            />
          </div>
        </div>

        <div className="w-full h-64 bg-white p-4 rounded-lg">
          <h3 className="text-sm uppercase font-medium mb-4">
            New Subscribers This Week
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={stats?.charts?.subscribersThisWeek || []}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e4e4e7",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="subscribers"
                stroke="#0891b2"
                strokeWidth={2}
                dot={{ fill: "#0891b2" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="p-3 bg-zinc-50 border border-zinc-200 mt-5">
          <div className="text-sm font-medium px-3">
            Emails / Automations Overview
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-white">
          <div className="flex flex-col gap-2 divide-y divide-zinc-200 md:border-r border-zinc-200 pr-3">
            <MetricCard
              title="Total Emails Sent (life time)"
              special={true}
              value={stats?.globalStats.totalMailSent?.toLocaleString() || "0"}
            />
            <MetricCard
              title="Total Emails Sent (this week)"
              value={stats?.emails?.sentThisWeek?.toLocaleString() || "0"}
            />
          </div>
          <div className="flex flex-col gap-2 divide-y divide-zinc-200 md:border-r border-zinc-200 pr-3">
            <MetricCard
              title="Emails Open Rate (Global)"
              value={`${stats?.emails?.globalOpenRate || 0}%`}
            />
            <MetricCard
              title="Emails Click Rate (Global)"
              value={`${stats?.emails?.globalClickRate || 0}%`}
            />
          </div>
          <div>
            <div className="w-full h-64 bg-white p-4 rounded-lg">
              <h3 className="text-sm uppercase font-medium mb-4">
                Emails Sent This Week
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats?.charts?.emailsThisWeek || []}
                  margin={{ top: 5, right: 0, bottom: 5, left: -30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="day" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#6b7280 " fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #6b7280 ",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="mails" fill="#52525b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="p-3 bg-zinc-50 border border-zinc-200 mt-3">
          <div className="text-sm font-medium px-3">
            Sites / Gateways / Servers
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-white">
          <div className="p-3 flex flex-col gap-1 md:border-r border-zinc-200">
            <div className="text-sm uppercase">Active System Listings</div>
            <h1 className="text-lg font-semibold tracking-wide">
              Configured & in Process
            </h1>
            <div className="text-xs text-gray-600 max-w-xs">
              Total number of active websites, gateways and servers
            </div>
          </div>
          <div className="flex flex-col gap-2 divide-y divide-zinc-200 md:border-r border-zinc-200 pr-3">
            <MetricCard
              title="Total Websites"
              value={stats?.system?.totalWebsites}
            />
            <MetricCard title="Total Lists" value={stats?.system?.totalLists} />
          </div>
          <div className="flex flex-col gap-2 divide-y divide-zinc-200">
            <MetricCard
              title="Total Automations / Campaigns"
              value={stats?.system?.totalAutomations}
            />
            <MetricCard
              title="Total Gateways"
              value={stats?.system?.totalGateways}
            />
          </div>
        </div>
      </div>
    </SidebarWrapper>
  );
};

export default Home;
