"use client";

import { useEffect, useState } from "react";
import { getEmployeeDocuments, deleteEmployeeDocument } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import EmptyState from "@/components/ui/EmptyState";

interface Props {
  employeeId: string;
}

export default function DocumentsTab({ employeeId }: Props) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const isAdminOrHR = user?.role === "admin" || user?.role === "hr";

  function fetchDocuments() {
    setLoading(true);
    getEmployeeDocuments(employeeId)
      .then((res) => setDocuments(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchDocuments();
  }, [employeeId]);

  async function handleDelete(docName: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await deleteEmployeeDocument(employeeId, docName);
      fetchDocuments();
    } catch {
      alert("Failed to delete document");
    }
  }

  if (loading) return <p className="text-gray-500 py-4">Loading...</p>;

  if (documents.length === 0) {
    return <EmptyState title="No documents" description="No documents have been uploaded for this employee." />;
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {documents.map((doc, i) => (
              <tr key={i}>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {String(doc.file_name)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {doc.file_size
                    ? `${(Number(doc.file_size) / 1024).toFixed(1)} KB`
                    : "-"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {String(doc.creation || "")}
                </td>
                <td className="px-6 py-4 text-sm space-x-3">
                  {doc.file_url ? (
                    <a
                      href={String(doc.file_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Download
                    </a>
                  ) : null}
                  {isAdminOrHR && (
                    <button
                      onClick={() => handleDelete(String(doc.name))}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
