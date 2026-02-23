"use client";

import { useEffect, useState } from "react";
import { getOrgTree, getDepartmentTree } from "@/lib/api";
import Tabs, { useActiveTab } from "@/components/ui/Tabs";
import { useTranslations } from "@/lib/i18n";

interface OrgNode {
  id: string;
  name: string;
  designation: string;
  department: string;
  image: string;
  children: OrgNode[];
}

export default function OrgChartPage() {
  const t = useTranslations();
  const activeTab = useActiveTab("tree");

  const tabs = [
    { id: "tree", label: t("orgchart.treeView") },
    { id: "departments", label: t("orgchart.departmentView") },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        {t("orgchart.title")}
      </h1>
      <Tabs tabs={tabs} activeTab={activeTab} basePath="/orgchart" />
      <div className="mt-6">
        {activeTab === "tree" && <TreeView t={t} />}
        {activeTab === "departments" && <DepartmentView t={t} />}
      </div>
    </div>
  );
}

function TreeView({ t }: { t: (k: string) => string }) {
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getOrgTree();
        setTree((res.data.tree as unknown as OrgNode[]) || []);
        setTotal(res.data.total_employees);
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading)
    return (
      <div className="text-center py-8 text-gray-400">
        {t("common.loading")}
      </div>
    );

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        {t("orgchart.totalEmployees")}: {total}
      </p>
      <div className="space-y-2">
        {tree.map((node) => (
          <TreeNode key={node.id} node={node} level={0} />
        ))}
      </div>
    </div>
  );
}

function TreeNode({ node, level }: { node: OrgNode; level: number }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ marginLeft: level * 24 }}>
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 cursor-pointer ${
          level === 0 ? "border-blue-200 bg-blue-50" : ""
        }`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren && (
          <span className="text-gray-400 text-xs w-4">
            {expanded ? "▼" : "▶"}
          </span>
        )}
        {!hasChildren && <span className="w-4" />}
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
          {node.name.charAt(0)}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-800">{node.name}</div>
          <div className="text-xs text-gray-500">
            {node.designation}
            {node.department ? ` · ${node.department}` : ""}
          </div>
        </div>
        {hasChildren && (
          <span className="text-xs text-gray-400 ml-auto">
            {node.children.length}
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <div className="mt-1 space-y-1 border-l-2 border-gray-100 ml-5">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function DepartmentView({ t }: { t: (k: string) => string }) {
  const [departments, setDepartments] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getDepartmentTree();
        setDepartments(
          (res.data.departments as Array<Record<string, unknown>>) || [],
        );
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading)
    return (
      <div className="text-center py-8 text-gray-400">
        {t("common.loading")}
      </div>
    );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {departments.map((dept) => (
        <div
          key={String(dept.department)}
          className="bg-white border rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">
              {String(dept.department)}
            </h3>
            <span className="text-sm text-gray-400">
              {String(dept.count)} {t("orgchart.members")}
            </span>
          </div>
          <div className="space-y-2">
            {(dept.members as Array<Record<string, unknown>>)?.map((m) => (
              <div key={String(m.id)} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                  {String(m.name).charAt(0)}
                </div>
                <div>
                  <div className="text-sm text-gray-800">{String(m.name)}</div>
                  <div className="text-xs text-gray-400">
                    {String(m.designation || "")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
