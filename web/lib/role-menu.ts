export interface MenuItem {
  href: string;
  label: string;
  roles: string[];
}

export const menuItems: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/employees", label: "Employees", roles: ["admin", "hr"] },
  { href: "/users", label: "Users", roles: ["admin", "hr"] },
  { href: "/leave", label: "Leave", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/attendance", label: "Attendance", roles: ["admin", "hr", "manager", "employee"] },
  { href: "/settings", label: "Settings", roles: ["admin"] },
];

export function getMenuForRole(role: string): MenuItem[] {
  return menuItems.filter((item) => item.roles.includes(role));
}
