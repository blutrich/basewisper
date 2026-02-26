import { Link, useLocation } from "react-router-dom";
import { History, Settings, BarChart3, Mic } from "lucide-react";

const navItems = [
  { path: "/", label: "History", icon: History },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-56 border-r bg-muted/30 p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 px-3 py-2 mb-4">
          <Mic className="w-5 h-5 text-primary" />
          <span className="font-semibold text-lg">WisperFlow</span>
        </div>
        {navItems.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              location.pathname === path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
