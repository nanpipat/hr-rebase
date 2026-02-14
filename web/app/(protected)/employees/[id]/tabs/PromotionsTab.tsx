"use client";

import { useEffect, useState } from "react";
import { getEmployeePromotions } from "@/lib/api";
import EmptyState from "@/components/ui/EmptyState";

interface Props {
  employeeId: string;
}

export default function PromotionsTab({ employeeId }: Props) {
  const [promotions, setPromotions] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmployeePromotions(employeeId)
      .then((res) => setPromotions(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) return <p className="text-gray-500 py-4">Loading...</p>;

  if (promotions.length === 0) {
    return <EmptyState title="No promotions" description="No promotion history found for this employee." />;
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Promotion History</h3>
      <div className="space-y-4">
        {promotions.map((promo, i) => {
          const details = (promo.details || []) as Array<Record<string, unknown>>;
          return (
            <div key={i} className="bg-white rounded-lg shadow p-4">
              <p className="text-sm font-medium text-gray-900">
                {String(promo.promotion_date)}
              </p>
              {details.length > 0 && (
                <div className="mt-2 space-y-1">
                  {details.map((d, j) => (
                    <p key={j} className="text-sm text-gray-500">
                      <span className="font-medium">{String(d.property)}</span>:{" "}
                      {String(d.current)} → {String(d.new)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
