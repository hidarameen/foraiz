import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Send, Save, Key, Cpu, Zap, Shield, Globe, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const PROVIDER_ICONS: Record<string, any> = {
  openai: Sparkles,
  anthropic: Shield,
  groq: Zap,
  gemini: Globe,
  huggingface: Cpu,
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: "border-green-500",
  anthropic: "border-purple-500",
  groq: "border-orange-500",
  gemini: "border-blue-500",
  huggingface: "border-yellow-500",
};

export default function AIPage() {
  const { toast } = useToast();

  const { data: config, isLoading: configLoading } = useQuery<any>({
    queryKey: ["/api/ai/config"],
  });

  const { data: aiSettings, isLoading: settingsLoading } = useQuery<any[]>({
    queryKey: ["/api/ai/settings"],
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/ai/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/settings"] });
      toast({ title: "تم الحفظ", description: "تم تحديث إعدادات المزود بنجاح" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/ai/test", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "رد الموديل", description: data.message });
    },
  });

  if (configLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 text-right" dir="rtl">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-end gap-3">
          <h1 className="text-3xl font-bold tracking-tight">مزودي الخدمة النشطون</h1>
          <Cpu className="w-8 h-8 text-primary" />
        </div>
        <p className="text-muted-foreground text-sm">إعداد مفاتيح API وإعدادات الاتصال لخدمات الذكاء الاصطناعي</p>
      </div>

      <div className="grid gap-4">
        {config && Object.entries(config).map(([id, p]: [string, any]) => {
          const setting = aiSettings?.find(s => s.provider === id) || { provider: id, apiKey: "", isActive: false };
          return (
            <ProviderRow 
              key={id}
              id={id}
              provider={p}
              setting={setting}
              onSave={(data) => upsertMutation.mutate(data)}
              onTest={(model, prompt) => testMutation.mutate({ provider: id, model, prompt, apiKey: setting.apiKey })}
              isPending={upsertMutation.isPending || testMutation.isPending}
            />
          );
        })}
      </div>
    </div>
  );
}

function ProviderRow({ id, provider, setting, onSave, onTest, isPending }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [apiKey, setApiKey] = useState(setting.apiKey || "");
  const [isActive, setIsActive] = useState(setting.isActive || false);
  const Icon = PROVIDER_ICONS[id] || Cpu;
  const borderColor = PROVIDER_COLORS[id] || "border-border";

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    onSave({ provider: id, apiKey, isActive: checked });
  };

  return (
    <Card className={cn("overflow-hidden transition-all duration-300 border-l-4", borderColor, isActive ? "bg-card shadow-sm" : "bg-muted/30 opacity-80")}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4 flex-row-reverse gap-4">
          <div className="flex items-center flex-row-reverse gap-4 flex-1">
            <div className={cn("p-2.5 rounded-xl transition-colors", isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="text-right">
              <h3 className="font-bold text-lg">{provider.name}</h3>
              <div className="flex items-center justify-end gap-2 text-sm mt-0.5">
                {isActive ? (
                  <>
                    <span className="text-green-500 font-medium">متصل ونشط</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground">غير متصل - يحتاج مفتاح API</span>
                    <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-row-reverse">
            <div className="flex items-center gap-2 flex-row-reverse px-3 py-1.5 rounded-full bg-background border">
              <span className={cn("text-xs font-medium", isActive ? "text-green-500" : "text-muted-foreground")}>
                {isActive ? "مفعل" : "معطل"}
              </span>
              <Switch checked={isActive} onCheckedChange={handleToggle} />
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsEditing(!isEditing)}
              className="px-6 rounded-full"
            >
              {isEditing ? "إغلاق" : setting.apiKey ? "تعديل" : "إعداد"}
            </Button>
          </div>
        </div>

        {isEditing && (
          <div className="p-6 border-t bg-muted/20 animate-in slide-in-from-top-2 duration-300">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="space-y-2 text-right">
                <Label className="text-sm font-bold">مفتاح API الخاص بـ {provider.name}</Label>
                <div className="relative">
                  <Input 
                    type="password" 
                    placeholder="أدخل مفتاح الـ API هنا..." 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="text-left font-mono pr-10"
                    dir="ltr"
                  />
                  <Key className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-[10px] text-muted-foreground">سيتم تخزين المفتاح بشكل آمن في قاعدة البيانات لاستخدامه في المهام التلقائية.</p>
              </div>

              <div className="flex justify-end gap-3">
                <Button 
                  onClick={() => onSave({ provider: id, apiKey, isActive })}
                  disabled={isPending}
                  className="px-8 rounded-lg"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  حفظ الإعدادات
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setIsEditing(false)}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
