import { useState } from "react";
import { useSessions, useSessionLogin, useDeleteSession } from "@/hooks/use-sessions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Radio, Plus, Trash2, Smartphone, Key, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export default function SessionsPage() {
  const { data: sessions, isLoading } = useSessions();
  const deleteSession = useDeleteSession();
  const { toast } = useToast();
  
  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد؟ سيؤدي هذا إلى قطع اتصال الجلسة.")) {
      deleteSession.mutate(id, {
        onSuccess: () => toast({ title: "تم قطع اتصال الجلسة" })
      });
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-full py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">الجلسات المتصلة</h1>
          <p className="text-muted-foreground">إدارة حسابات تيليجرام المرتبطة بالنظام.</p>
        </div>
        <AddSessionDialog />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {sessions?.map((session, idx) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="hover-elevate h-full flex flex-col justify-between group bg-card dark:bg-card">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
                      <Radio className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400">متصل</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-1 text-card-foreground">{session.sessionName}</h3>
                  <p className="text-sm font-medium text-muted-foreground">{session.phoneNumber}</p>
                </CardContent>
                
                <CardContent className="border-t pt-4 flex items-center justify-between bg-muted/20 dark:bg-muted/10">
                  <p className="text-xs text-muted-foreground">
                    آخر ظهور: {session.lastActive ? format(new Date(session.lastActive), 'MMM d, HH:mm') : 'غير متوفر'}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg h-9 w-9"
                    onClick={() => handleDelete(session.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          
          {sessions?.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-2xl bg-muted/30">
              <div className="p-4 bg-muted rounded-full">
                <Radio className="w-12 h-12 text-muted-foreground opacity-50" />
              </div>
              <div className="space-y-1">
                <p className="text-xl font-semibold">لا توجد جلسات نشطة</p>
                <p className="text-sm text-muted-foreground">قم بربط حساب تيليجرام لبدء عمليات التحويل التلقائي.</p>
              </div>
              <AddSessionDialog />
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AddSessionDialog() {
  const [step, setStep] = useState<"phone" | "code" | "password">("phone");
  const [data, setData] = useState({ phoneNumber: "", code: "", password: "", phoneCodeHash: "" });
  const [open, setOpen] = useState(false);
  const login = useSessionLogin();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(data, {
      onSuccess: (res) => {
        if (res.status === 'code_sent') {
          setData(prev => ({ ...prev, phoneCodeHash: res.phoneCodeHash || "" }));
          setStep("code");
          toast({ title: "تم إرسال الرمز", description: "يرجى التحقق من تطبيق تيليجرام الخاص بك." });
        } else if (res.status === 'password_required') {
          setStep("password");
          toast({ title: "مطلوب التحقق بخطوتين", description: "يرجى إدخال كلمة مرور الحساب." });
        } else if (res.status === 'logged_in') {
          setOpen(false);
          setStep("phone");
          setData({ phoneNumber: "", code: "", password: "", phoneCodeHash: "" });
          toast({ title: "تم الاتصال", description: "تم إنشاء الجلسة بنجاح." });
        }
      },
      onError: (err) => {
        toast({ title: "خطأ", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 h-11 px-6 rounded-lg shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" /> ربط حساب جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl font-bold text-center lg:text-right">تهيئة اتصال جديد</DialogTitle>
          <div className="flex justify-center lg:justify-start gap-1">
            <div className={`h-1.5 w-1/3 rounded-full transition-colors ${step === 'phone' ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-1.5 w-1/3 rounded-full transition-colors ${step === 'code' ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-1.5 w-1/3 rounded-full transition-colors ${step === 'password' ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </DialogHeader>
        
        <form onSubmit={handleLogin} className="space-y-6 mt-4">
          <div className="relative overflow-hidden min-h-[100px]">
            <AnimatePresence mode="wait">
              {step === "phone" && (
                <motion.div key="phone" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>رقم الهاتف</Label>
                    <div className="relative">
                      <Smartphone className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="+1234567890" 
                        value={data.phoneNumber}
                        onChange={(e) => setData({ ...data, phoneNumber: e.target.value })}
                        className="pr-10 h-11"
                        required
                        dir="ltr"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">أدخل الرقم مع رمز الدولة (مثال: +1...)</p>
                  </div>
                </motion.div>
              )}

              {step === "code" && (
                <motion.div key="code" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>رمز التحقق</Label>
                    <div className="relative">
                      <Key className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="12345" 
                        value={data.code}
                        onChange={(e) => setData({ ...data, code: e.target.value })}
                        className="pr-10 h-11 text-center tracking-[0.5em] text-lg font-bold"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">أدخل الرمز المكون من 5 أرقام الذي وصلك على تيليجرام.</p>
                  </div>
                </motion.div>
              )}

              {step === "password" && (
                <motion.div key="password" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>كلمة مرور التحقق بخطوتين</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input 
                        type="password"
                        placeholder="••••••" 
                        value={data.password}
                        onChange={(e) => setData({ ...data, password: e.target.value })}
                        className="pr-10 h-11"
                        required
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button 
            type="submit" 
            disabled={login.isPending}
            className="w-full h-11 font-bold text-lg rounded-lg shadow-lg shadow-primary/20"
          >
            {login.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5 me-2" />}
            {step === 'phone' ? 'إرسال الرمز' : step === 'code' ? 'تحقق' : 'فتح القفل'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
