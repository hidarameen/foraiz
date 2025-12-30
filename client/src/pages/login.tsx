import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2, Terminal, ShieldCheck, Zap, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user && !isLoading) {
    setLocation("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "فشل المصادقة",
          description: data.message || "حدث خطأ أثناء محاولة الدخول",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "نجاح",
        description: isLogin ? "تم تسجيل الدخول بنجاح!" : "تم إنشاء الحساب بنجاح، يمكنك الدخول الآن.",
      });

      if (isLogin) {
        setLocation("/");
      } else {
        setIsLogin(true);
        setPassword("");
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ غير متوقع، يرجى المحاولة لاحقاً.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row relative overflow-hidden">
      {/* Visual Side (Hero) */}
      <div className="hidden lg:flex flex-1 relative bg-primary items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary via-primary/80 to-black/20" />
        
        <div className="relative z-10 max-w-lg text-primary-foreground space-y-8">
          <div className="space-y-4">
            <h1 className="text-6xl font-bold tracking-tight">نظام التحكم الذكي</h1>
            <p className="text-xl opacity-90 leading-relaxed">
              أقوى منصة لأتمتة تيليجرام وإدارة الجلسات والرسائل بكفاءة عالية وأمان متقدم.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-6 pt-8">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 mt-1" />
              <div>
                <h3 className="font-semibold">أمان مطلق</h3>
                <p className="text-sm opacity-70">تشفير كامل وحماية متقدمة للجلسات.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="w-6 h-6 mt-1" />
              <div>
                <h3 className="font-semibold">سرعة فائقة</h3>
                <p className="text-sm opacity-70">معالجة فورية وتحويل ذكي للرسائل.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe className="w-6 h-6 mt-1" />
              <div>
                <h3 className="font-semibold">تحكم عن بعد</h3>
                <p className="text-sm opacity-70">إدارة حساباتك من أي مكان وفي أي وقت.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Terminal className="w-6 h-6 mt-1" />
              <div>
                <h3 className="font-semibold">برمجة ذكية</h3>
                <p className="text-sm opacity-70">واجهة برمجية سهلة الاستخدام.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Abstract decorative elements */}
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-black/20 rounded-full blur-3xl" />
      </div>

      {/* Form Side */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-right space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center lg:hidden">
              <Terminal className="text-primary-foreground w-7 h-7" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              {isLogin ? "تسجيل الدخول" : "إنشاء حساب جديد"}
            </h2>
            <p className="text-muted-foreground">
              {isLogin ? "أهلاً بك مجدداً! يرجى إدخال بياناتك للمتابعة." : "انضم إلينا وابدأ بأتمتة أعمالك اليوم."}
            </p>
          </div>

          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">اسم المستخدم</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="أدخل اسم المستخدم"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isSubmitting}
                      className="h-11 rounded-lg"
                      data-testid="input-username"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">كلمة المرور</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="أدخل كلمة المرور"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      className="h-11 rounded-lg"
                      data-testid="input-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !username || !password}
                  className="w-full h-11 font-semibold text-lg rounded-lg shadow-lg shadow-primary/20"
                  data-testid="button-submit"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isLogin ? (
                    "دخول"
                  ) : (
                    "إنشاء حساب"
                  )}
                </Button>

                <div className="text-center pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setPassword("");
                    }}
                    className="text-primary hover:underline font-medium transition-all"
                    data-testid={isLogin ? "link-register" : "link-login"}
                  >
                    {isLogin ? "لا تملك حساباً؟ أنشئ واحداً الآن" : "لديك حساب بالفعل؟ سجل دخولك"}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
          
          <div className="pt-8 text-center lg:text-right border-t">
            <p className="text-xs text-muted-foreground opacity-60">
              جميع الحقوق محفوظة © 2025 نظام التحكم الذكي. النسخة 1.0.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
