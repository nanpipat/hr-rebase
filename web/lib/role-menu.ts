export interface MenuItem {
  href: string;
  labelKey: string;
  roles: string[];
}

export const menuItems: MenuItem[] = [
  { href: "/dashboard", labelKey: "sidebar.dashboard", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/employees", labelKey: "sidebar.employees", roles: ["admin", "hr"] },
  { href: "/departments", labelKey: "sidebar.departments", roles: ["admin", "hr"] },
  { href: "/users", labelKey: "sidebar.users", roles: ["admin", "hr"] },
  { href: "/leave", labelKey: "sidebar.leave", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/attendance", labelKey: "sidebar.attendance", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/shifts", labelKey: "sidebar.shifts", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/overtime", labelKey: "sidebar.overtime", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/payroll", labelKey: "sidebar.payroll", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/benefits", labelKey: "sidebar.benefits", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/tax", labelKey: "sidebar.tax", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/reports", labelKey: "sidebar.reports", roles: ["admin", "hr"] },
  { href: "/orgchart", labelKey: "sidebar.orgchart", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/profile", labelKey: "sidebar.profile", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/settings", labelKey: "sidebar.settings", roles: ["admin"] },
];

export function getMenuForRole(role: string): MenuItem[] {
  return menuItems.filter((item) => item.roles.includes(role));
}
