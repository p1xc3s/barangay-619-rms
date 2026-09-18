import React, { useState, useEffect } from "react";
import { Users, Vote, Mars, Venus, Home, UsersRound } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import StatCard from "./StatCard";
import OfficialsList from "./OfficialsList";
import type { StatData, ChartData, DashboardStats } from "../types";
import { dashboardService } from "../services/dashboardService";
import { notify } from "../utils/notify";
import { useHouseholdDataRefresh } from "../hooks/useHouseholdDataSync";
import { useAuth } from "../hooks/useAuth";

// Helper to format numbers with commas
const fmt = (n: number): string => n.toLocaleString();

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [dateFilter, setDateFilter] = useState<string>("");
  const { user } = useAuth();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const result = await dashboardService.getStats(dateFilter || undefined);
        setData(result);
      } catch (error: unknown) {
        notify.error("Failed to load dashboard statistics.");
        console.error("Dashboard stats fetch failed:", error);
        setData(null);
      }
    };
    fetchDashboard();
  }, [dateFilter]);

  const refreshDashboard = React.useCallback(async () => {
    try {
      const result = await dashboardService.getStats(dateFilter || undefined);
      setData(result);
    } catch (error: unknown) {
      notify.error("Failed to load dashboard statistics.");
      console.error("Dashboard stats fetch failed:", error);
      setData(null);
    }
  }, [dateFilter]);

  useHouseholdDataRefresh(refreshDashboard);

  // Data from API, with zero-value fallback
  const stats: StatData[] = [
    {
      id: "1",
      title: "Total Population",
      value: data ? fmt(data.stats.totalPopulation) : "0",
      icon: Users,
      colorClass: "text-blue-600",
      bgClass: "bg-blue-50",
    },
    {
      id: "2",
      title: "Registered Voters",
      value: data ? fmt(data.stats.registeredVoters) : "0",
      icon: Vote,
      colorClass: "text-emerald-600",
      bgClass: "bg-emerald-50",
    },
    {
      id: "3",
      title: "Male",
      value: data ? fmt(data.stats.male) : "0",
      icon: Mars,
      colorClass: "text-cyan-600",
      bgClass: "bg-cyan-50",
    },
    {
      id: "4",
      title: "Total Household",
      value: data ? fmt(data.stats.totalHouseholds) : "0",
      icon: Home,
      colorClass: "text-violet-600",
      bgClass: "bg-violet-50",
    },
    {
      id: "5",
      title: "Female",
      value: data ? fmt(data.stats.female) : "0",
      icon: Venus,
      colorClass: "text-pink-600",
      bgClass: "bg-pink-50",
    },
    {
      id: "6",
      title: "Total Family",
      value: data ? fmt(data.stats.totalFamilies) : "0",
      icon: UsersRound,
      colorClass: "text-orange-600",
      bgClass: "bg-orange-50",
    },
  ];

  const chartData: ChartData[] = [
    {
      name: "Children",
      value: data?.classification.children ?? 0,
      color: "#93C5FD",
    }, // Blue 300
    { name: "Youth", value: data?.classification.youth ?? 0, color: "#6EE7B7" }, // Emerald 300
    {
      name: "Senior Citizen",
      value: data?.classification.seniorCitizen ?? 0,
      color: "#FCA5A5",
    }, // Red 300
    { name: "PWD", value: data?.classification.pwd ?? 0, color: "#FCD34D" }, // Amber 300
    {
      name: "Employed",
      value: data?.classification.employed ?? 0,
      color: "#C4B5FD",
    }, // Violet 300
    {
      name: "Unemployed",
      value: data?.classification.unemployed ?? 0,
      color: "#CBD5E1",
    }, // Slate 300
  ];

  return (
    <div className="flex-1 p-6 bg-gray-50 overflow-y-auto h-full">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Welcome, {user?.role || "User"}
          </h2>
          <p className="text-sm text-gray-500">
            {dateFilter ? "Viewing historical snapshot" : "Here is your barangay's current live data"}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <label htmlFor="monthFilter" className="text-sm font-semibold text-gray-700">
            Snapshot Date:
          </label>
          <input
            id="monthFilter"
            type="month"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
          {dateFilter && (
            <button 
              onClick={() => setDateFilter("")}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left Section: Stats & Charts */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Stats Grid - 2 Columns x 3 Rows to match draft */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.map((stat) => (
              <StatCard key={stat.id} {...stat} />
            ))}
          </div>

          {/* Bottom Section: Classification & Logs */}
          <div className="flex flex-col md:flex-row gap-6 h-full min-h-87.5">
            {/* Pie Chart Card */}
            <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
              <h3 className="text-base font-bold text-blue-600 mb-2">
                Resident Classification
              </h3>

              <div className="mt-2 flex-1 min-w-0 h-80">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={90}
                      outerRadius={140}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke="none"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                    />
                    <Legend
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      wrapperStyle={{ fontSize: "14px" }}
                      iconSize={14}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Officials */}
        <div className="w-full xl:w-80 shrink-0">
          <OfficialsList />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
