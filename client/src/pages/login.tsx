import { useState } from "react";
import { useLocation } from "wouter";
import { login } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EagleIcon, EagleBackground } from "@/components/EagleIcon";
import { Eye, EyeOff, Globe } from "lucide-react";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, language, setLanguage } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(username, password);
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
    <div className="min-h-screen eagle-bg flex items-center justify-center p-4 relative overflow-hidden">
      <EagleBackground className="w-[800px] h-[800px] -top-40 -left-40 animate-pulse-slow" />
      <EagleBackground className="w-[600px] h-[600px] -bottom-20 -right-20 rotate-180 animate-pulse-slow" />
      
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50 pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="glass-card rounded-2xl p-8 glow-amber">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse-slow" />
                <EagleIcon size={100} className="relative z-10" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">
              {t("common.brand")}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              {t("common.tagline")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-muted-foreground">
                {t("auth.username")}
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                className="bg-muted/50 border-border/50 focus:border-primary transition-colors"
                data-testid="input-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-muted-foreground">
                {t("auth.password")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="bg-muted/50 border-border/50 focus:border-primary transition-colors pr-10"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full font-semibold" 
              disabled={loading}
              data-testid="button-submit"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {t("common.loading")}
                </span>
              ) : (
                t("auth.login")
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border/50">
            <button
              onClick={() => setLanguage(language === "en" ? "ar" : "en")}
              className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              data-testid="button-language-toggle"
            >
              <Globe className="w-4 h-4" />
              {language === "en" ? "العربية" : "English"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/60 mt-6" data-testid="text-copyright">
          2024 {t("common.brand")}. All rights reserved.
        </p>
        <p className="text-center text-xs text-muted-foreground/40 mt-2" data-testid="text-credit">
          By Eng.Yacoub.Smadi
        </p>
      </div>
    </div>
  );
}
