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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Send, Save, Key } from "lucide-react";

export default function AIPage() {
  const { toast } = useToast();
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["/api/ai/config"],
  });

  const testMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/ai/test", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "تم استلام الرد",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleTest = () => {
    if (!provider || !model || !prompt) {
      toast({
        title: "تنبيه",
        description: "يرجى اختيار المزود والموديل وإدخال النص",
        variant: "destructive",
      });
      return;
    }
    testMutation.mutate({ provider, model, prompt, apiKey });
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">الذكاء الاصطناعي</h1>
        <p className="text-muted-foreground">إعدادات مزودي خدمات الذكاء الاصطناعي واختبار الموديلات</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-row-reverse">
              <Key className="w-5 h-5" />
              الإعدادات
            </CardTitle>
            <CardDescription>اختر المزود والموديل المتاح</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>مزود الخدمة</Label>
              <Select onValueChange={(v) => { setProvider(v); setModel(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المزود" />
                </SelectTrigger>
                <SelectContent>
                  {config && Object.entries(config).map(([id, p]: [string, any]) => (
                    <SelectItem key={id} value={id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {provider && (
              <div className="space-y-2">
                <Label>الموديل</Label>
                <Select onValueChange={setModel} value={model}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الموديل" />
                  </SelectTrigger>
                  <SelectContent>
                    {config[provider].models.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>API Key (اختياري للاختبار)</Label>
              <Input 
                type="password" 
                placeholder="أدخل المفتاح هنا..." 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="text-left"
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-row-reverse">
              <Send className="w-5 h-5" />
              اختبار الموديل
            </CardTitle>
            <CardDescription>أرسل استفساراً لتجربة الموديل</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>نص التجربة</Label>
              <Textarea 
                placeholder="اكتب شيئاً هنا..." 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <Button 
              className="w-full gap-2 flex-row-reverse" 
              onClick={handleTest}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              إرسال واختبار
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
