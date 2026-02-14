"use client";

import { useEffect, useState } from "react";
import { getEmployeeTimeline } from "@/lib/api";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";

interface Props {
  employeeId: string;
}

interface TimelineEvent {
  type: string;
  date: string;
  actor?: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  description?: string;
  status?: string;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFieldName(field: string) {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TimelineTab({ employeeId }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmployeeTimeline(employeeId)
      .then((res) => {
        const data = (res.data || []) as unknown as TimelineEvent[];
        setEvents(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) return <p className="text-gray-500 py-4">Loading...</p>;

  if (events.length === 0) {
    return <EmptyState title="No timeline events" description="No changes or events recorded yet." />;
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        <ul className="space-y-4">
          {events.map((event, i) => (
            <li key={i} className="relative pl-10">
              <div
                className={`absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 border-white ${
                  event.type === "field_change" ? "bg-blue-500" : "bg-yellow-500"
                }`}
              />
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-400">
                    {formatDate(event.date)}
                  </span>
                  {event.type === "field_change" ? (
                    <Badge variant="info">Field Change</Badge>
                  ) : (
                    <Badge variant={event.status === "Approved" ? "success" : event.status === "Rejected" ? "danger" : "warning"}>
                      Leave
                    </Badge>
                  )}
                </div>
                {event.type === "field_change" ? (
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{formatFieldName(event.field || "")}</span>
                    {" changed from "}
                    <span className="text-red-600 line-through">{event.old_value || "(empty)"}</span>
                    {" to "}
                    <span className="text-green-600 font-medium">{event.new_value || "(empty)"}</span>
                    {event.actor && (
                      <span className="text-gray-400"> by {event.actor}</span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-gray-700">{event.description}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
