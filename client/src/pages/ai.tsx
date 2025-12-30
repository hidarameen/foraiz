import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Card, CardContent
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
import { Loader2, Send, Save, Key, Cpu, Zap, Shield, Globe, Sparkles, CheckCircle2, AlertCircle, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PROVIDER_ICONS: Record<string, any> = {
  openai: Sparkles,
  anthropic: Shield,
  groq: Zap,
  gemini: Globe,
  huggingface: Cpu,
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-green-500/10 text-green-600",
  anthropic: "bg-purple-500/10 text-purple-600",
  groq: "bg-orange-500/10 text-orange-600",
  gemini: "bg-blue-500/10 text-blue-600",
  huggingface: "bg-yellow-500/10 text-yellow-600",
};

export default function AIPage() {
  const { data: config, isLoading: configLoading } = useQuery<any>({
    queryKey: ["/api/ai/config"],
  });

  const { data: aiSettings, isLoading: settingsLoading } = useQuery<any[]>({
    queryKey: ["/api/ai/settings"],
  });

  if (configLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 text-right p-4" dir="rtl">
      <div className="flex flex-col gap-2 mb-8">
        <div className="flex items-center justify-end gap-3">
          <div className="text-right">
            <h1 className="text-2xl font-bold tracking-tight">مزودي الخدمة النشطون</h1>
            <p className="text-muted-foreground text-sm">إعداد مفاتيح API وإعدادات الاتصال لخدمات الذكاء الاصطناعي</p>
          </div>
          <div className="p-3 rounded-xl bg-primary/10">
            <Cpu className="w-6 h-6 text-primary" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 max-w-4xl mx-auto">
        {config && Object.entries(config).map(([id, p]: [string, any]) => {
          const setting = aiSettings?.find(s => s.provider === id) || { provider: id, apiKey: "", isActive: false };
          return (
            <ProviderRow 
              key={id}
              id={id}
              provider={p}
              setting={setting}
            />
          );
        })}
      </div>
    </div>
  );
}

function ProviderRow({ id, provider, setting }: any) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [apiKey, setApiKey] = useState(setting.apiKey || "");
  const [isActive, setIsActive] = useState(setting.isActive || false);
  
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

  const Icon = PROVIDER_ICONS[id] || Cpu;
  const colorClass = PROVIDER_COLORS[id] || "bg-muted text-muted-foreground";

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    upsertMutation.mutate({ provider: id, apiKey, isActive: checked });
  };

  const hasApiKey = !!setting.apiKey;

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300 border shadow-sm",
      isActive ? "border-green-500/30" : "border-border"
    )}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-5 flex-row-reverse gap-4">
          {/* Right Side: Icon and Name */}
          <div className="flex items-center flex-row-reverse gap-4 flex-1">
            <div className={cn("p-3 rounded-2xl transition-all shadow-sm", colorClass)}>
              <Icon className="w-7 h-7" />
            </div>
            <div className="text-right">
              <h3 className="font-bold text-xl">{provider.name}</h3>
              <div className="flex items-center justify-end gap-2 text-sm mt-1">
                {hasApiKey ? (
                  <>
                    <span className="text-green-600 font-medium">متصل ونشط</span>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </>
                ) : (
                  <>
                    <span className="text-red-500 font-medium">غير متصل - يحتاج مفتاح API</span>
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Left Side: Controls */}
          <div className="flex items-center gap-6 flex-row-reverse">
            <div className="flex items-center gap-3 flex-row-reverse px-4 py-2 rounded-full bg-muted/50 border">
              <span className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-md",
                isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
              )}>
                {isActive ? "مفعل" : "معطل"}
              </span>
              <Switch checked={isActive} onCheckedChange={handleToggle} disabled={!hasApiKey && !isActive} />
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsEditing(!isEditing)}
              className="px-8 rounded-full font-bold h-10 border-2"
            >
              {hasApiKey ? "تعديل" : "إعداد"}
            </Button>
          </div>
        </div>

        {isEditing && (
          <div className="p-8 border-t bg-muted/10 animate-in slide-in-from-top-2 duration-300">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="space-y-3 text-right">
                <div className="flex items-center justify-end gap-2 text-primary">
                  <Label className="text-sm font-bold">إعدادات الاتصال</Label>
                  <Settings2 className="w-4 h-4" />
                </div>
                <div className="relative">
                  <Input 
                    type="password" 
                    placeholder="أدخل مفتاح الـ API هنا..." 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="text-left font-mono pr-12 h-12 bg-background border-2"
                    dir="ltr"
                  />
                  <Key className="absolute right-4 top-3.5 w-5 h-5 text-muted-foreground/50" />
                </div>
                <p className="text-xs text-muted-foreground mr-1 italic">
                  * سيتم تشفير المفتاح وحفظه لاستخدامه في أتمتة المهام الذكية.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  onClick={() => {
                    upsertMutation.mutate({ provider: id, apiKey, isActive });
                    setIsEditing(false);
                  }}
                  disabled={upsertMutation.isPending}
                  className="px-10 h-11 rounded-xl font-bold shadow-md active-elevate-2"
                >
                  {upsertMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  حفظ التغييرات
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setIsEditing(false)}
                  className="h-11 px-6 font-medium"
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
