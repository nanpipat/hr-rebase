"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInvite } from "@/lib/api";

export default function InviteUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", full_name: "", role: "employee" });
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInviteLink("");
    setLoading(true);

    try {
      const res = await createInvite(form);
      const link = `${window.location.origin}/invite/${res.data.token}`;
      setInviteLink(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Invite User</h1>

      <form onSubmit={handleSubmit} className="max-w-lg bg-white rounded-lg shadow p-6 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>
        )}

        {inviteLink && (
          <div className="bg-green-50 p-4 rounded">
            <p className="text-sm font-medium text-green-800 mb-2">Invite link created!</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 px-3 py-2 border border-green-300 rounded-md text-sm bg-white"
              />
              <button
                type="button"
                onClick={copyLink}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-green-600 mt-2">Share this link with the user. It expires in 72 hours.</p>
          </div>
        )}

        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            id="full_name"
            type="text"
            value={form.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            id="role"
            value={form.role}
            onChange={(e) => update("role", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="hr">HR</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {loading ? "Creating..." : "Create Invite"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/users")}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
          >
            Back to Users
          </button>
        </div>
      </form>
    </div>
  );
}
