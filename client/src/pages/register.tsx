import { useState } from "react";
import { useLocation } from "wouter";
import { register } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, language, setLanguage } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: t("common.error"),
        description: language === "ar" ? "كلمات المرور غير متطابقة" : "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await register(email, password, name);
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
              <h1 className="text-2xl font-bold text-foreground mb-1">{t("auth.signUp")}</h1>
              <p className="text-sm text-muted-foreground">
                {language === "ar" ? "إنشاء حساب جديد" : "Create a new account"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  {language === "ar" ? "الاسم" : "Name"}
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={language === "ar" ? "الاسم الكامل" : "Full name"}
                  required
                />
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  {language === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("common.loading") : t("auth.signUp")}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {language === "ar" ? "لديك حساب بالفعل؟" : "Already have an account?"}{" "}
              <a href="/login" className="text-primary hover:underline font-medium">
                {t("auth.login")}
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
