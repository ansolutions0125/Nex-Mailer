// api/dashstats/route.js

import dbConnect from "@/config/mongoConfig";
import Stats from "@/models/Stats";
import Contact from "@/models/Contact";
import Website from "@/models/Website";
import Flow from "@/models/Flow";
import List from "@/models/List";
import Gateway from "@/models/Gateway";
import Server from "@/models/Server";
import EmailLogs from "@/models/EmailLogs";
import { NextResponse } from "next/server";

const DASH_STATS_DOC_ID = 'current';

export async function GET() {
  await dbConnect();

  try {
    // Fetch basic stats document
    const stats = await Stats.findOne({ _id: DASH_STATS_DOC_ID });
    
    // Get current date boundaries for time-based queries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const prevWeekStart = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));

    // Parallel queries for better performance
    const [
      // Subscriber metrics
      totalActiveSubscribers,
      totalUsers,
      newSubscribersThisMonth,
      newSubscribersToday,
      totalSubscriberRequests,
      subscribersThisWeek,
      subscribersPrevWeek,

      // Email metrics
      totalEmailsSent,
      emailsThisWeek,
      totalEmailsOpened,
      totalEmailsClicked,

      // System counts
      totalWebsites,
      totalLists,
      totalAutomations,
      totalGateways,
      totalServers,

      // Time series data for charts
      dailySubscribers,
      dailyEmails,
    ] = await Promise.all([
      // Subscriber queries
      Contact.countDocuments({ isActive: true }),
      Contact.countDocuments({}),
      Contact.countDocuments({ 
        createdAt: { $gte: monthStart }
      }),
      Contact.countDocuments({ 
        createdAt: { $gte: todayStart }
      }),
      Contact.countDocuments(),

      // Weekly subscriber comparison
      Contact.countDocuments({ 
        createdAt: { $gte: weekStart }
      }),
      Contact.countDocuments({ 
        createdAt: { $gte: prevWeekStart, $lt: weekStart }
      }),

      // Email metrics
      EmailLogs.countDocuments({ status: 'sent' }),
      EmailLogs.countDocuments({ 
        sentAt: { $gte: weekStart }
      }),
      EmailLogs.countDocuments({ status: 'opened' }),
      EmailLogs.aggregate([
        { $match: { 'metadata.clicked': true } },
        { $count: "total" }
      ]),

      // System counts
      Website.countDocuments({ isActive: true }),
      List.countDocuments({ isActive: true }),
      Flow.countDocuments({ isActive: true }),
      Gateway.countDocuments({ isActive: true }),
      Server.countDocuments({ isActive: true }),

      // Time series data for last 7 days
      Contact.aggregate([
        {
          $match: {
            createdAt: { $gte: weekStart }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id": 1 } }
      ]),

      EmailLogs.aggregate([
        {
          $match: {
            sentAt: { $gte: weekStart }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$sentAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id": 1 } }
      ])
    ]);

    // Calculate engagement rates
    const globalOpenRate = totalEmailsSent > 0 
      ? ((totalEmailsOpened / totalEmailsSent) * 100).toFixed(2)
      : 0;
    
    const clickedCount = totalEmailsClicked.length > 0 ? totalEmailsClicked[0].total : 0;
    const globalClickRate = totalEmailsOpened > 0 
      ? ((clickedCount / totalEmailsOpened) * 100).toFixed(2)
      : 0;

    // Calculate week-over-week growth
    const subscriberGrowth = subscribersPrevWeek > 0 
      ? (((subscribersThisWeek - subscribersPrevWeek) / subscribersPrevWeek) * 100).toFixed(1)
      : subscribersThisWeek > 0 ? 100 : 0;

    // Format chart data for last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart.getTime() + (i * 24 * 60 * 60 * 1000));
      return date.toISOString().split('T')[0];
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const subscriberChartData = last7Days.map(date => {
      const dayData = dailySubscribers.find(d => d._id === date);
      const dateObj = new Date(date);
      return {
        day: dayNames[dateObj.getDay()],
        subscribers: dayData ? dayData.count : 0
      };
    });

    const emailChartData = last7Days.map(date => {
      const dayData = dailyEmails.find(d => d._id === date);
      const dateObj = new Date(date);
      return {
        day: dayNames[dateObj.getDay()],
        mails: dayData ? dayData.count : 0
      };
    });

    // Compile response data
    const dashboardData = {
      // Basic stats from Stats document
      globalStats: stats || {
        totalUsers: 0,
        totalAutomations: 0,
        totalWebsites: 0,
        totalGateways: 0,
        totalServers: 0,
        totalLists: 0,
        totalMailSent: 0
      },

      // Subscriber metrics
      subscribers: {
        totalActive: totalActiveSubscribers,
        totalUsers: totalUsers,
        newThisMonth: newSubscribersThisMonth,
        newToday: newSubscribersToday,
        totalRequests: totalSubscriberRequests,
        weeklyGrowth: {
          current: subscribersThisWeek,
          previous: subscribersPrevWeek,
          growthRate: subscriberGrowth,
          isPositive: parseFloat(subscriberGrowth) >= 0
        }
      },

      // Email metrics
      emails: {
        totalSent: totalEmailsSent,
        sentThisWeek: emailsThisWeek,
        globalOpenRate: globalOpenRate,
        globalClickRate: globalClickRate
      },

      // System counts
      system: {
        totalWebsites: totalWebsites,
        totalLists: totalLists,
        totalAutomations: totalAutomations,
        totalGateways: totalGateways,
        totalServers: totalServers
      },

      // Chart data
      charts: {
        subscribersThisWeek: subscriberChartData,
        emailsThisWeek: emailChartData
      },

      // Metadata
      lastUpdated: new Date().toISOString(),
      dateRange: {
        today: todayStart.toISOString(),
        weekStart: weekStart.toISOString(),
        monthStart: monthStart.toISOString()
      }
    };

    return NextResponse.json({ 
      success: true, 
      data: dashboardData 
    }, { status: 200 });

  } catch (error) {
    console.error("GET DashStats Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || "Failed to fetch dashboard stats.",
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}