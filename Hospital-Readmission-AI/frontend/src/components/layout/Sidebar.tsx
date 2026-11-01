import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Users, Upload, ShieldCheck, Activity, CalendarCheck, FileBarChart,
} from "lucide-react";
import { ROUTES } from "@/routes/paths";
import { APP_NAME } from "@/utils/constants";

const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
  { to: ROUTES.PATIENTS, label: "Patients", icon: Users },
  { to: ROUTES.UPLOAD, label: "Upload", icon: Upload },
  { to: ROUTES.DATA_QUALITY, label: "Data Quality", icon: ShieldCheck },
  { to: ROUTES.PREDICTIONS, label: "Predictions", icon: Activity },
  { to: ROUTES.FOLLOWUPS, label: "Follow-ups", icon: CalendarCheck },
  { to: ROUTES.REPORTS, label: "Reports", icon: FileBarChart },
];

export default function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="px-5 py-5 text-lg font-semibold text-teal-700">{APP_NAME}</div>
      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                isActive ? "bg-teal-50 font-medium text-teal-700" : "text-slate-600 hover:bg-slate-100"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
