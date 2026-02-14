"use client";

import Badge, { statusVariant } from "@/components/ui/Badge";

interface Props {
  employee: Record<string, unknown>;
}

function Field({ label, value }: { label: string; value: unknown }) {
  const display = value ? String(value) : "-";
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{display}</dd>
    </div>
  );
}

export default function OverviewTab({ employee }: Props) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-500">
          {String(employee.employee_name || "?").charAt(0)}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {String(employee.employee_name)}
          </h2>
          <p className="text-sm text-gray-500">
            {String(employee.designation || "")}
            {employee.department ? ` · ${employee.department}` : ""}
          </p>
          <Badge variant={statusVariant(String(employee.status))}>
            {String(employee.status)}
          </Badge>
        </div>
      </div>

      {/* Personal Info */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Employee ID" value={employee.employee_id} />
          <Field label="Gender" value={employee.gender} />
          <Field label="Date of Birth" value={employee.date_of_birth} />
          <Field label="Marital Status" value={employee.marital_status} />
          <Field label="Blood Group" value={employee.blood_group} />
        </dl>
      </section>

      {/* Contact */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact</h3>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Phone" value={employee.cell_phone} />
          <Field label="Personal Email" value={employee.personal_email} />
          <Field label="Company Email" value={employee.company_email} />
          <Field label="Current Address" value={employee.current_address} />
          <Field label="Permanent Address" value={employee.permanent_address} />
        </dl>
      </section>

      {/* Emergency */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Emergency Contact</h3>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Contact Person" value={employee.person_to_be_contacted} />
          <Field label="Relation" value={employee.relation} />
          <Field label="Phone" value={employee.emergency_phone} />
        </dl>
      </section>

      {/* Reporting */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Reporting</h3>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Reports To" value={employee.reports_to_name || employee.reports_to} />
          <Field label="Leave Approver" value={employee.leave_approver_name || employee.leave_approver} />
        </dl>
      </section>
    </div>
  );
}
