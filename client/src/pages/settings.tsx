import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{t("settings.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.preferences")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{t("settings.theme")}</p>
                  <p className="text-sm text-muted-foreground">Choose light or dark mode</p>
                </div>
                <div className="flex items-center space-x-2 bg-muted p-1 rounded-md">
                  <button
                    onClick={() => setTheme("light")}
                    className={`px-3 py-1 rounded-md text-sm ${
                      theme === "light" ? "bg-background" : ""
                    }`}
                  >
                    <i className="fas fa-sun mr-1"></i>Light
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`px-3 py-1 rounded-md text-sm ${
                      theme === "dark" ? "bg-background" : ""
                    }`}
                  >
                    <i className="fas fa-moon mr-1"></i>Dark
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{t("settings.language")}</p>
                  <p className="text-sm text-muted-foreground">
                    Select your preferred language
                  </p>
                </div>
                <div className="flex items-center space-x-2 bg-muted p-1 rounded-md">
                  <button
                    onClick={() => setLanguage("en")}
                    className={`px-3 py-1 rounded-md text-sm ${
                      language === "en" ? "bg-background" : ""
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setLanguage("ar")}
                    className={`px-3 py-1 rounded-md text-sm ${
                      language === "ar" ? "bg-background" : ""
                    }`}
                  >
                    العربية
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
