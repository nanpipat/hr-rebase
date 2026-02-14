"use client";

import { useState } from "react";
import { updateEmployeeContact } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface Props {
  employee: Record<string, unknown>;
  canEdit: boolean;
  onUpdate: () => void;
}

export default function ContactTab({ employee, canEdit, onUpdate }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    cell_phone: String(employee.cell_phone || ""),
    personal_email: String(employee.personal_email || ""),
    current_address: String(employee.current_address || ""),
    permanent_address: String(employee.permanent_address || ""),
    emergency_phone_number: String(employee.emergency_phone || ""),
    person_to_be_contacted: String(employee.person_to_be_contacted || ""),
    relation: String(employee.relation || ""),
  });

  async function handleSave() {
    setSaving(true);
    try {
      await updateEmployeeContact(String(employee.employee_id), form);
      setEditing(false);
      toast("Contact info updated", "success");
      onUpdate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update contact", "error");
    } finally {
      setSaving(false);
    }
  }

  function Field({ label, value }: { label: string; value: unknown }) {
    return (
      <div>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value ? String(value) : "-"}</dd>
      </div>
    );
  }

  function EditField({
    label,
    field,
    type = "text",
  }: {
    label: string;
    field: keyof typeof form;
    type?: string;
  }) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-500 mb-1">{label}</label>
        {type === "textarea" ? (
          <textarea
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            rows={2}
          />
        ) : (
          <input
            type={type}
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        )}
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Edit
            </button>
          )}
        </div>

        <section>
          <h4 className="text-md font-medium text-gray-700 mb-3">Phone & Email</h4>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Phone" value={employee.cell_phone} />
            <Field label="Personal Email" value={employee.personal_email} />
            <Field label="Company Email" value={employee.company_email} />
          </dl>
        </section>

        <section>
          <h4 className="text-md font-medium text-gray-700 mb-3">Addresses</h4>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Current Address" value={employee.current_address} />
            <Field label="Permanent Address" value={employee.permanent_address} />
          </dl>
        </section>

        <section>
          <h4 className="text-md font-medium text-gray-700 mb-3">Emergency Contact</h4>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Contact Person" value={employee.person_to_be_contacted} />
            <Field label="Relation" value={employee.relation} />
            <Field label="Phone" value={employee.emergency_phone} />
          </dl>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Edit Contact Information</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <section>
          <h4 className="text-md font-medium text-gray-700 mb-3">Phone & Email</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditField label="Phone" field="cell_phone" type="tel" />
            <EditField label="Personal Email" field="personal_email" type="email" />
          </div>
        </section>

        <section>
          <h4 className="text-md font-medium text-gray-700 mb-3">Addresses</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditField label="Current Address" field="current_address" type="textarea" />
            <EditField label="Permanent Address" field="permanent_address" type="textarea" />
          </div>
        </section>

        <section>
          <h4 className="text-md font-medium text-gray-700 mb-3">Emergency Contact</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <EditField label="Contact Person" field="person_to_be_contacted" />
            <EditField label="Relation" field="relation" />
            <EditField label="Phone" field="emergency_phone_number" type="tel" />
          </div>
        </section>
      </div>
    </div>
  );
}
