"use client";

import { useRouter, useSearchParams } from "next/navigation";

export interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  basePath: string;
}

export default function Tabs({ tabs, activeTab, basePath }: TabsProps) {
  const router = useRouter();

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => router.push(`${basePath}?tab=${tab.id}`)}
            className={`whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function useActiveTab(defaultTab: string): string {
  const searchParams = useSearchParams();
  return searchParams.get("tab") || defaultTab;
}
