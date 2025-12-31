import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTasks, useToggleTask, useDeleteTask, useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { useSessions } from "@/hooks/use-sessions";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, Play, Pause, ArrowLeft, Settings, Loader2, Upload, Download, Filter, Settings2, FileText, Image as ImageIcon, Video, Music, Mic, Ghost, MessageSquare, HelpCircle, User, MapPin, ReceiptText, Brain, Sparkles, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type Task } from "@shared/schema";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

export default function TasksPage() {
  const { data: tasks, isLoading } = useTasks();
  const toggleTask = useToggleTask();
  const deleteTask = useDeleteTask();
  const createTaskMutation = useCreateTask();
  const { toast } = useToast();

  const handleToggle = (id: number, currentStatus: boolean) => {
    toggleTask.mutate({ id, isActive: !currentStatus });
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف بروتوكول المهمة هذا؟")) {
      deleteTask.mutate(id);
    }
  };

  const exportTask = (task: Task) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(task, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `task_${task.id}_${task.name.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast({
      title: "تم التصدير",
      description: "تم تحميل ملف إعدادات المهمة بنجاح",
    });
  };

  const importTask = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedTask = JSON.parse(e.target?.result as string);
        const { id, createdAt, status, errorMessage, ...taskToCreate } = importedTask;
        
        await createTaskMutation.mutateAsync(taskToCreate);
        toast({
          title: "تم الاستيراد",
          description: "تم إنشاء مهمة جديدة من الملف المرفوع",
        });
      } catch (error) {
        toast({
          title: "فشل الاستيراد",
          description: "تأكد من صحة تنسيق ملف المهمة",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  if (isLoading) return <div className="flex items-center justify-center h-full py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            إدارة بروتوكولات المهام
          </h1>
          <p className="text-muted-foreground text-lg text-right">تحكم كامل في عمليات الأتمتة والتحويل الذكي بالذكاء الاصطناعي.</p>
        </div>
        <div className="flex gap-3">
          <label className="cursor-pointer">
            <input 
              type="file" 
              className="hidden" 
              accept=".json"
              onChange={importTask}
            />
            <Button variant="outline" size="lg" className="gap-2 rounded-xl border-primary/20 hover:border-primary/50 transition-all hover:bg-primary/5 h-12">
              <Download className="w-5 h-5" /> استيراد مهمة
            </Button>
          </label>
          <TaskFormDialog />
        </div>
      </motion.div>

      <div className="grid gap-8">
        <AnimatePresence mode="popLayout">
          {tasks?.map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="overflow-hidden border-none shadow-xl bg-card/50 backdrop-blur-md hover:bg-card/80 transition-all duration-300 group ring-1 ring-white/10">
                <div className="absolute top-0 right-0 w-1.5 h-full bg-primary/40 group-hover:bg-primary transition-colors" />
                <CardContent className="p-8">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
                    
                    <div className="flex items-center gap-6 flex-1">
                      <div className={`p-5 rounded-2xl border-2 transition-all duration-500 ${task.isActive ? 'bg-primary/20 border-primary/30 text-primary shadow-2xl shadow-primary/20 scale-105' : 'bg-muted/50 border-muted-foreground/10 text-muted-foreground'}`}>
                        {task.isActive ? <Play className="w-8 h-8 fill-current animate-pulse" /> : <Pause className="w-8 h-8" />}
                      </div>
                      <div className="space-y-2 text-right">
                        <div className="flex items-center gap-3 justify-start md:justify-end flex-row-reverse">
                          <h3 className="text-2xl font-bold tracking-tight">{task.name}</h3>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold ${task.status === "running" ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary"}`}>
                            {task.status === "running" ? "نشط الآن" : "خامل"}
                          </div>
                          {(task.filters as any)?.aiFilters?.isEnabled && (
                            <div className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 flex items-center gap-1">
                              <Brain className="w-3 h-3" /> ذكاء اصطناعي
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm font-medium justify-start md:justify-end flex-row-reverse">
                          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-lg">
                            <span className="font-bold">{task.sourceChannels.length}</span> مصادر
                          </div>
                          <ArrowLeft className="w-4 h-4 text-muted-foreground/50 rotate-180" />
                          <div className="flex items-center gap-2 bg-secondary/10 text-secondary px-3 py-1 rounded-lg">
                            <span className="font-bold">{task.destinationChannels.length}</span> أهداف
                          </div>
                          <span className="text-muted-foreground/60 font-mono text-xs">ID: #{task.id.toString().padStart(4, '0')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-6 lg:pt-0 flex-row-reverse">
                      <div className="flex flex-col items-center lg:items-start gap-2">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold opacity-60">الحالة التشغيلية</span>
                        <Switch 
                          checked={task.isActive || false}
                          onCheckedChange={() => handleToggle(task.id, task.isActive || false)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="rounded-xl hover:bg-primary/20 hover:text-primary transition-all shadow-sm h-10 w-10"
                          onClick={() => exportTask(task)}
                          title="تصدير"
                        >
                          <Upload className="w-5 h-5" />
                        </Button>
                        <TaskFormDialog task={task} trigger={
                          <Button variant="secondary" size="icon" className="rounded-xl hover:bg-primary/20 hover:text-primary transition-all shadow-sm h-10 w-10">
                            <Edit2 className="w-5 h-5" />
                          </Button>
                        } />
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="rounded-xl hover:bg-destructive/20 hover:text-destructive transition-all shadow-sm h-10 w-10"
                          onClick={() => handleDelete(task.id)}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {tasks?.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-32 flex flex-col items-center justify-center text-center space-y-6 border-4 border-dashed rounded-3xl bg-muted/20 border-muted/50"
          >
            <div className="p-8 bg-muted/50 rounded-full shadow-inner">
              <Settings2 className="w-20 h-20 text-muted-foreground opacity-30" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">لا توجد مهام مهيأة</h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">ابدأ رحلة الأتمتة الخاصة بك بإنشاء أول بروتوكول توجيه متطور.</p>
            </div>
            <TaskFormDialog />
          </motion.div>
        )}
      </div>
    </div>
  );
}

const DEFAULT_MEDIA_TYPES = {
  text: true, photo: true, video: true, document: true, audio: true, 
  voice: true, sticker: true, videoNote: true, animation: true,
  poll: true, contact: true, location: true, invoice: true
};

// Helper function to normalize aiFilters from old/mixed data structures to new format
  const normalizeAIFilters = (aiFilters: any) => {
    if (!aiFilters) {
      return {
        isEnabled: false,
        provider: "openai",
        model: "gpt-4o-mini",
        mode: "blacklist",
        blacklistRules: [],
        whitelistRules: []
      };
    }

    // Start with the new format fields if they exist
    let blacklistRules = Array.isArray(aiFilters.blacklistRules) ? aiFilters.blacklistRules : [];
    let whitelistRules = Array.isArray(aiFilters.whitelistRules) ? aiFilters.whitelistRules : [];

    // Filter out any suspicious rules like "خخشخش"
    const isSuspiciousRule = (rule: any) => {
      return !rule.name || rule.name === "خخشخش" || rule.name.trim() === "";
    };

    blacklistRules = blacklistRules.filter(r => !isSuspiciousRule(r));
    whitelistRules = whitelistRules.filter(r => !isSuspiciousRule(r));

    // If new format fields are empty, try to migrate from old format
    if (blacklistRules.length === 0 && aiFilters.blacklist?.rules) {
      blacklistRules = (Array.isArray(aiFilters.blacklist.rules) ? aiFilters.blacklist.rules : []).filter(r => !isSuspiciousRule(r));
    }
    if (blacklistRules.length === 0 && Array.isArray(aiFilters.rules)) {
      blacklistRules = aiFilters.rules.filter(r => !isSuspiciousRule(r));
    }

    if (whitelistRules.length === 0 && aiFilters.whitelist?.rules) {
      whitelistRules = (Array.isArray(aiFilters.whitelist.rules) ? aiFilters.whitelist.rules : []).filter(r => !isSuspiciousRule(r));
    }

    // Return normalized structure
    return {
      isEnabled: aiFilters.isEnabled ?? false,
      provider: aiFilters.provider || "openai",
      model: aiFilters.model || "gpt-4o-mini",
      mode: aiFilters.mode || "blacklist",
      blacklistRules,
      whitelistRules
    };
  };

function TaskFormDialog({ task, trigger }: { task?: any, trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: sessions } = useSessions();
  const create = useCreateTask();
  const update = useUpdateTask();
  const { toast } = useToast();

  const { data: aiConfig } = useQuery<any>({
    queryKey: ["/api/ai/config"],
  });

  const { data: aiSettings } = useQuery<any[]>({
    queryKey: ["/api/ai/settings"],
  });

  const form = useForm({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      name: task?.name || "",
      sessionId: task?.sessionId || (sessions?.[0]?.id || 0),
      sourceChannels: task?.sourceChannels || [],
      destinationChannels: task?.destinationChannels || [],
      filters: {
        mediaTypes: task?.filters?.mediaTypes || DEFAULT_MEDIA_TYPES,
        aiFilters: normalizeAIFilters(task?.filters?.aiFilters)
      },
      options: task?.options || { withCaption: true, dropAuthor: false },
      isActive: task?.isActive ?? false
    }
  });

  const selectedProvider = form.watch("filters.aiFilters.provider");
  const availableModels = aiConfig?.[selectedProvider]?.models || [];
  const activeProviders = aiSettings?.filter(s => s.isActive).map(s => s.provider) || [];

  const currentMode = form.watch("filters.aiFilters.mode");
  const rulesFieldName = currentMode === 'whitelist' ? "filters.aiFilters.whitelistRules" : "filters.aiFilters.blacklistRules";
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: rulesFieldName,
    keyName: `rule_${rulesFieldName}`
  });

  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [tempRule, setTempRule] = useState<any>({ name: "", instruction: "", isActive: true });

  useEffect(() => {
    setRuleDialogOpen(false);
    setEditingRuleIndex(null);
    setTempRule({ name: "", instruction: "", isActive: true });
  }, [currentMode]);

  const handleAddRule = () => {
    setEditingRuleIndex(null);
    setTempRule({ name: "", instruction: "", isActive: true });
    setRuleDialogOpen(true);
  };

  const handleEditRule = (index: number) => {
    const rule = form.getValues(rulesFieldName)?.[index];
    setEditingRuleIndex(index);
    setTempRule({ ...rule });
    setRuleDialogOpen(true);
  };

  const saveRule = () => {
    if (editingRuleIndex !== null) {
      updateRule(editingRuleIndex, tempRule);
    } else {
      append(tempRule);
    }
    setRuleDialogOpen(false);
  };

  const updateRule = (index: number, value: any) => {
    const mode = form.getValues("filters.aiFilters.mode");
    const fieldName = mode === 'whitelist' ? "filters.aiFilters.whitelistRules" : "filters.aiFilters.blacklistRules";
    const rules = [...form.getValues(fieldName)];
    rules[index] = value;
    form.setValue(fieldName, rules);
  };

  const onSubmit = (data: any) => {
    // Filter out empty rules (rules without name)
    const filterEmptyRules = (rules: any[]) => {
      return (rules || [])
        .filter(r => r.name && r.name.trim().length > 0 && r.name !== "خخشخش")
        .map((r: any, idx: number) => ({
          ...r,
          id: r.id || `rule_${Date.now()}_${idx}`,
          priority: r.priority ?? idx
        }));
    };

    const payload = {
      ...data,
      filters: {
        ...data.filters,
        mediaTypes: data.filters.mediaTypes || DEFAULT_MEDIA_TYPES,
        aiFilters: {
          ...data.filters.aiFilters,
          blacklistRules: filterEmptyRules(data.filters.aiFilters.blacklistRules),
          whitelistRules: filterEmptyRules(data.filters.aiFilters.whitelistRules)
        }
      }
    };

    if (task) {
      update.mutate({ id: task.id, ...payload }, {
        onSuccess: () => { setOpen(false); toast({ title: "تم التحديث بنجاح" }); },
        onError: (error) => toast({ title: "خطأ", description: (error as Error).message, variant: "destructive" })
      });
    } else {
      create.mutate(payload, {
        onSuccess: () => { setOpen(false); toast({ title: "تم الإنشاء بنجاح" }); },
        onError: (error) => toast({ title: "خطأ", description: (error as Error).message, variant: "destructive" })
      });
    }
  };

  const mediaTypes = [
    { key: "text", label: "رسائل نصية", icon: MessageSquare },
    { key: "photo", label: "صور", icon: ImageIcon },
    { key: "video", label: "فيديوهات", icon: Video },
    { key: "document", label: "ملفات", icon: FileText },
    { key: "audio", label: "موسيقى", icon: Music },
    { key: "voice", label: "رسائل صوتية", icon: Mic },
    { key: "sticker", label: "ملصقات", icon: Ghost },
    { key: "videoNote", label: "رسائل فيديو", icon: Video },
    { key: "animation", label: "صور متحركة", icon: ImageIcon },
    { key: "poll", label: "استطلاعات", icon: HelpCircle },
    { key: "contact", label: "جهات اتصال", icon: User },
    { key: "location", label: "مواقع", icon: MapPin },
    { key: "invoice", label: "فواتير", icon: ReceiptText },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="lg" className="gap-2 rounded-xl shadow-2xl shadow-primary/30 h-12 px-8 font-bold text-lg">
            <Plus className="w-5 h-5" /> بروتوكول جديد
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] flex flex-col p-0 border-none rounded-3xl overflow-hidden shadow-3xl bg-card">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border-b border-primary/10 text-right shrink-0">
          <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3 justify-end">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            {task ? 'تعديل البروتوكول' : 'تخصيص بروتوكول ذكي جديد'}
          </DialogTitle>
          <p className="text-muted-foreground mt-2">قم بضبط قواعد الأتمتة وفلاتر الذكاء الاصطناعي المتقدمة.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-8 pt-0">
          <form id="task-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-10 pt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-right">
              <div className="space-y-3 col-span-full">
                <Label className="text-sm font-bold uppercase tracking-widest text-primary/70">اسم البروتوكول</Label>
                <Input {...form.register("name")} className="h-14 rounded-2xl bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all text-lg text-right" placeholder="مثال: فلترة الأخبار العاجلة" />
              </div>

              <div className="space-y-3 col-span-full">
                <Label className="text-sm font-bold uppercase tracking-widest text-primary/70">العقدة المرتبطة (Node)</Label>
                <Controller
                  control={form.control}
                  name="sessionId"
                  render={({ field }) => (
                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                      <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-muted-foreground/10 flex-row-reverse">
                        <SelectValue placeholder="اختر جلسة الربط" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-primary/10 text-right">
                        {sessions?.map(s => (
                          <SelectItem key={s.id} value={s.id.toString()} className="rounded-xl my-1 flex-row-reverse">{s.sessionName} ({s.phoneNumber})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold uppercase tracking-widest text-primary/70">القنوات المصدر</Label>
                <Controller
                  control={form.control}
                  name="sourceChannels"
                  render={({ field }) => (
                    <Input 
                      value={field.value?.join(", ") || ""} 
                      onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      className="h-14 rounded-2xl bg-muted/30 border-muted-foreground/10 font-mono text-sm text-right" 
                      placeholder="@source1, @source2" 
                    />
                  )}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold uppercase tracking-widest text-primary/70">القنوات المستهدفة</Label>
                <Controller
                  control={form.control}
                  name="destinationChannels"
                  render={({ field }) => (
                    <Input 
                      value={field.value?.join(", ") || ""} 
                      onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      className="h-14 rounded-2xl bg-muted/30 border-muted-foreground/10 font-mono text-sm text-right" 
                      placeholder="@target_channel" 
                    />
                  )}
                />
              </div>
            </div>

            <Accordion type="multiple" defaultValue={["ai-filters"]} className="w-full space-y-4 text-right">
              <AccordionItem value="ai-filters" className="border rounded-3xl bg-muted/20 px-6 overflow-hidden border-blue-500/10 shadow-inner">
                <AccordionTrigger className="hover:no-underline py-6 font-black text-xl text-blue-500 flex gap-3 flex-row-reverse">
                  <div className="p-2 bg-blue-500/10 rounded-xl"><Brain className="w-5 h-5" /></div>
                  فلاتر الذكاء الاصطناعي (AI Rules)
                </AccordionTrigger>
                <AccordionContent className="pb-8 pt-4 space-y-8">
                  <div className="flex items-center justify-between bg-background/50 p-6 rounded-2xl border border-blue-500/10 flex-row-reverse">
                    <div className="flex items-center gap-4 flex-row-reverse">
                      <div className="space-y-1">
                        <Label className="text-base font-bold">تفعيل التصفية الذكية</Label>
                        <p className="text-xs text-muted-foreground">سيتم فحص محتوى الرسائل وتحليلها برمجياً</p>
                      </div>
                      <Controller
                        control={form.control}
                        name="filters.aiFilters.isEnabled"
                        render={({ field }) => (
                          <Switch 
                            checked={field.value} 
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-blue-500" 
                          />
                        )}
                      />
                    </div>

                    <div className="flex gap-4">
                      <Controller
                        control={form.control}
                        name="filters.aiFilters.mode"
                        render={({ field }) => (
                          <div className="flex gap-2 bg-muted p-1 rounded-xl">
                            <Button 
                              type="button"
                              variant={field.value === 'whitelist' ? 'default' : 'ghost'}
                              size="sm"
                              className={`rounded-lg font-bold gap-2 ${field.value === 'whitelist' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                              onClick={() => field.onChange('whitelist')}
                            >
                              <CheckCircle2 className="w-4 h-4" /> القائمة البيضاء
                            </Button>
                            <Button 
                              type="button"
                              variant={field.value === 'blacklist' ? 'default' : 'ghost'}
                              size="sm"
                              className={`rounded-lg font-bold gap-2 ${field.value === 'blacklist' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                              onClick={() => field.onChange('blacklist')}
                            >
                              <XCircle className="w-4 h-4" /> القائمة السوداء
                            </Button>
                          </div>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="font-bold">مزود الخدمة</Label>
                      <Controller
                        control={form.control}
                        name="filters.aiFilters.provider"
                        render={({ field }) => (
                          <Select 
                            onValueChange={(val) => {
                              field.onChange(val);
                              // Reset model to first available for the provider
                              const providerModels = aiConfig?.[val]?.models || [];
                              if (providerModels.length > 0) {
                                form.setValue("filters.aiFilters.model", providerModels[0].id);
                              }
                            }} 
                            value={field.value}
                          >
                            <SelectTrigger className="rounded-xl flex-row-reverse">
                              <SelectValue placeholder="اختر المزود" />
                            </SelectTrigger>
                            <SelectContent className="text-right">
                              {aiConfig && Object.entries(aiConfig).map(([id, p]: [string, any]) => (
                                <SelectItem key={id} value={id} className="flex-row-reverse gap-2">
                                  <span>{p.name}</span>
                                  {!activeProviders.includes(id) && (
                                    <span className="text-[10px] bg-yellow-500/10 text-yellow-600 px-1.5 py-0.5 rounded ml-2">غير مفعل</span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold">الموديل (Model)</Label>
                      <Controller
                        control={form.control}
                        name="filters.aiFilters.model"
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="rounded-xl flex-row-reverse">
                              <SelectValue placeholder="اختر الموديل" />
                            </SelectTrigger>
                            <SelectContent className="text-right">
                              {availableModels.map((m: any) => (
                                <SelectItem key={m.id} value={m.id} className="flex-row-reverse">{m.name}</SelectItem>
                              ))}
                              {availableModels.length === 0 && (
                                <div className="p-2 text-center text-xs text-muted-foreground">لا توجد موديلات متاحة</div>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-row-reverse">
                      <Label className="text-lg font-bold flex items-center gap-2">
                        قواعد {currentMode === 'whitelist' ? 'القائمة البيضاء' : 'القائمة السوداء'} <Sparkles className="w-4 h-4 text-blue-400" />
                      </Label>
                      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={handleAddRule}
                            className="rounded-lg gap-2 border-blue-500/20 text-blue-500 hover:bg-blue-500/5"
                          >
                            <Plus className="w-4 h-4" /> إضافة قاعدة
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md text-right" dir="rtl">
                          <DialogTitle className="text-xl font-bold border-b pb-4 text-right">
                            {editingRuleIndex !== null ? "تعديل قاعدة ذكية" : "إضافة قاعدة ذكية جديدة"}
                          </DialogTitle>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label className="font-bold">اسم القاعدة</Label>
                              <Input 
                                value={tempRule.name} 
                                onChange={(e) => setTempRule({...tempRule, name: e.target.value})}
                                placeholder="مثال: فلترة الإعلانات"
                                className="text-right"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="font-bold">التعليمات (Prompt)</Label>
                              <Textarea 
                                value={tempRule.instruction} 
                                onChange={(e) => setTempRule({...tempRule, instruction: e.target.value})}
                                placeholder="اشرح للذكاء الاصطناعي ما يجب فعله بهذه القاعدة..."
                                className="min-h-[100px] text-right"
                              />
                            </div>
                            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-xl border flex-row-reverse">
                              <Label className="font-bold">تفعيل القاعدة</Label>
                              <Switch 
                                checked={tempRule.isActive} 
                                onCheckedChange={(checked) => setTempRule({...tempRule, isActive: checked})}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-3 pt-4 border-t flex-row-reverse">
                            <Button type="button" onClick={saveRule} className="bg-blue-500 hover:bg-blue-600 px-8">
                              {editingRuleIndex !== null ? "حفظ التعديلات" : "إضافة القاعدة"}
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setRuleDialogOpen(false)}>إلغاء</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="space-y-4">
                      {fields.map((field, index) => {
                        const rule = form.getValues(rulesFieldName)?.[index];
                        // Skip empty rules (rules without name)
                        if (!rule?.name || rule.name.trim().length === 0) {
                          return null;
                        }
                        return (
                        <div key={field.id || index} className="p-4 bg-background rounded-2xl border border-blue-500/5 space-y-3 relative group hover:border-blue-500/20 transition-all">
                          <div className="flex items-center justify-between flex-row-reverse">
                            <div className="flex items-center gap-3 flex-row-reverse">
                              <span className="bg-blue-500/10 text-blue-500 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</span>
                              <span className="font-bold text-sm">{rule?.name || "قاعدة بدون اسم"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg text-blue-500 hover:bg-blue-500/10"
                                onClick={() => handleEditRule(index)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => remove(index)} 
                                className="h-8 w-8 p-0 rounded-lg text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <Switch 
                                checked={rule?.isActive ?? true} 
                                onCheckedChange={(checked) => updateRule(index, { ...rule, isActive: checked })} 
                                className="scale-75 data-[state=checked]:bg-green-500 ml-2" 
                              />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 text-right bg-muted/20 p-2 rounded-lg italic">
                            {rule?.instruction || "لا توجد تعليمات مضافة لهذه القاعدة"}
                          </p>
                        </div>
                      );
                      })}
                      {fields.length === 0 && (
                        <div className="py-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground gap-2">
                          <AlertTriangle className="w-8 h-8 opacity-20" />
                          <p>لا توجد قواعد تحليل بعد. أضف قاعدة لتبدأ.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="media-filters" className="border rounded-3xl bg-muted/20 px-6 overflow-hidden border-primary/5 shadow-inner">
                <AccordionTrigger className="hover:no-underline py-6 font-black text-xl text-primary flex gap-3 flex-row-reverse">
                  <div className="p-2 bg-primary/10 rounded-xl"><Filter className="w-5 h-5" /></div>
                  فلاتر الوسائط الشاملة
                </AccordionTrigger>
                <AccordionContent className="pb-8 pt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {mediaTypes.map((type) => (
                      <div key={type.key} className="flex items-center justify-between p-4 rounded-2xl bg-background/50 border border-primary/5 hover:border-primary/20 transition-all group flex-row-reverse">
                        <div className="flex items-center gap-3 flex-row-reverse">
                          <div className="p-2 bg-muted rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <type.icon className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-bold">{type.label}</span>
                        </div>
                        <Controller
                          control={form.control}
                          name={`filters.mediaTypes.${type.key}`}
                          render={({ field }) => (
                            <Switch 
                              checked={!!field.value} 
                              onCheckedChange={(val) => field.onChange(val)}
                              className="scale-75 data-[state=checked]:bg-primary" 
                            />
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </form>
        </div>

        <div className="p-8 border-t bg-muted/20 shrink-0">
          <Button 
            type="submit" 
            form="task-form"
            disabled={create.isPending || update.isPending} 
            className="w-full h-16 font-black text-xl rounded-2xl shadow-2xl shadow-primary/40 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {create.isPending || update.isPending ? <Loader2 className="w-6 h-6 animate-spin me-2" /> : <Settings2 className="w-6 h-6 me-2" />}
            تثبيت البروتوكول والتشغيل الذكي
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
