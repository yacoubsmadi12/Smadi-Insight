import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { logout, getCurrentUser } from "@/lib/auth";
import { useLocation } from "wouter";

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [, navigate] = useLocation();
  const user = getCurrentUser();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "ar" : "en");
  };

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your analytics and insights</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative hidden md:block">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
            <input
              type="search"
              placeholder={t("common.search")}
              className="pl-10 pr-4 py-2 w-64 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
            <i className="fas fa-bell text-xl"></i>
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <i className={`fas ${theme === "dark" ? "fa-sun" : "fa-moon"} text-xl`}></i>
          </button>

          <button
            onClick={toggleLanguage}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
          >
            <i className="fas fa-globe mr-2"></i>
            {language === "en" ? "EN" : "AR"}
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
          >
            <i className="fas fa-sign-out-alt mr-2"></i>
            {t("auth.logout")}
          </button>
        </div>
      </div>
    </header>
  );
}
