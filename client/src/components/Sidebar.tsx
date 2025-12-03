import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Sidebar() {
  const [location] = useLocation();
  const { t } = useLanguage();

  const navItems = [
    { path: "/dashboard", icon: "fa-chart-line", label: t("nav.dashboard") },
    { path: "/nms-systems", icon: "fa-server", label: "NMS Systems" },
    { path: "/nms-logs", icon: "fa-list-alt", label: "NMS Logs" },
    { path: "/analysis-reports", icon: "fa-chart-bar", label: "Analysis Reports" },
    { path: "/email-settings", icon: "fa-envelope", label: "Email & Reports" },
    { path: "/employees", icon: "fa-users", label: t("nav.employees") },
    { path: "/activity", icon: "fa-history", label: t("nav.activity") },
    { path: "/integration", icon: "fa-plug", label: t("nav.integration") },
    { path: "/settings", icon: "fa-cog", label: t("nav.settings") },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border z-40 flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-xl font-bold text-primary-foreground">YS</span>
          </div>
          <div>
            <h2 className="font-bold text-foreground">{t("common.brand")}</h2>
            <p className="text-xs text-muted-foreground">{t("common.tagline")}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <div
              className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                location === item.path
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <i className={`fas ${item.icon} w-5`}></i>
              <span>{item.label}</span>
            </div>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
