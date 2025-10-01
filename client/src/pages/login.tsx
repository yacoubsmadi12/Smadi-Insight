import { useState } from "react";
import { useLocation } from "wouter";
import { login } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardContent className="pt-8 pb-8 px-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-primary-foreground">YS</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-1">{t("common.brand")}</h1>
              <p className="text-sm text-muted-foreground">{t("common.tagline")}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="w-4 h-4 text-primary border-border rounded" />
                  <span className="text-sm text-muted-foreground">{t("auth.rememberMe")}</span>
                </label>
                <a href="#" className="text-sm text-primary hover:underline">
                  {t("auth.forgotPassword")}
                </a>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("common.loading") : t("auth.login")}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {t("auth.noAccount")}{" "}
              <a href="#" className="text-primary hover:underline font-medium">
                {t("auth.signUp")}
              </a>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => setLanguage(language === "en" ? "ar" : "en")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <i className="fas fa-globe mr-2"></i>
                {language === "en" ? "العربية" : "English"}
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2024 {t("common.brand")}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
