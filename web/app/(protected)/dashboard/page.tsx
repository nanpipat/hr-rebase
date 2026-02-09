"use client";

import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">
          Welcome, <span className="font-semibold">{user.full_name}</span>
        </p>
        <p className="text-sm text-gray-400 mt-1">{user.email}</p>
      </div>

      {(user.role === "admin" || user.role === "hr") && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Employees</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">-</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Pending Leaves</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">-</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Today&apos;s Attendance</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">-</p>
          </div>
        </div>
      )}

      {user.role === "employee" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">My Leave Balance</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">-</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">My Attendance This Month</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">-</p>
          </div>
        </div>
      )}
    </div>
  );
}
