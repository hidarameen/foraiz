import { useState } from "react";
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
import { Plus, Edit2, Trash2, Play, Pause, ArrowLeft, Settings, Loader2, Upload, Download, Filter, Settings2, FileText, Image as ImageIcon, Video, Music, Mic, Ghost, MessageSquare, HelpCircle, User, MapPin, ReceiptText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
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
          <p className="text-muted-foreground text-lg text-right">تحكم كامل في عمليات الأتمتة والتحويل الذكي.</p>
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

function TaskFormDialog({ task, trigger }: { task?: any, trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: sessions } = useSessions();
  const create = useCreateTask();
  const update = useUpdateTask();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      name: task?.name || "",
      sessionId: task?.sessionId || (sessions?.[0]?.id || 0),
      sourceChannels: task?.sourceChannels || [],
      destinationChannels: task?.destinationChannels || [],
      filters: {
        keywords: task?.filters?.keywords || [],
        excludeKeywords: task?.filters?.excludeKeywords || [],
        mediaTypes: task?.filters?.mediaTypes || DEFAULT_MEDIA_TYPES
      },
      options: task?.options || { withCaption: true, dropAuthor: false },
      isActive: task?.isActive ?? false
    }
  });

  const onSubmit = (data: any) => {
    // التأكد من أن mediaTypes يتم إرسالها ككائن وليس مصفوفة فارغة
    const mediaTypes = data.filters?.mediaTypes;
    const cleanMediaTypes = (mediaTypes && typeof mediaTypes === 'object' && !Array.isArray(mediaTypes)) 
      ? mediaTypes 
      : DEFAULT_MEDIA_TYPES;

    const payload = {
      ...data,
      filters: {
        ...data.filters,
        mediaTypes: cleanMediaTypes
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 border-none rounded-3xl overflow-hidden shadow-3xl bg-card">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border-b border-primary/10 text-right shrink-0">
          <DialogTitle className="text-3xl font-black tracking-tighter">
            {task ? 'تعديل البروتوكول' : 'تخصيص بروتوكول جديد'}
          </DialogTitle>
          <p className="text-muted-foreground mt-2">قم بضبط قواعد الأتمتة وفلاتر الوسائط بدقة.</p>
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

          <Accordion type="multiple" className="w-full space-y-4 text-right">
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
                            checked={field.value ?? true} 
                            onCheckedChange={field.onChange}
                            className="scale-75 data-[state=checked]:bg-primary" 
                          />
                        )}
                      />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="content-filters" className="border rounded-3xl bg-muted/20 px-6 overflow-hidden border-primary/5 shadow-inner">
              <AccordionTrigger className="hover:no-underline py-6 font-black text-xl text-primary flex gap-3 flex-row-reverse">
                <div className="p-2 bg-primary/10 rounded-xl"><Settings className="w-5 h-5" /></div>
                تخصيص المحتوى والكلمات
              </AccordionTrigger>
              <AccordionContent className="pb-8 pt-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">الكلمات المطلوبة</Label>
                    <Controller
                      control={form.control}
                      name="filters.keywords"
                      render={({ field }) => (
                        <Input 
                          value={field.value?.join(", ") || ""} 
                          onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          placeholder="عاجل، حصري، مباشر" 
                          className="rounded-xl h-12 bg-background/50 text-right" 
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">الكلمات المستبعدة</Label>
                    <Controller
                      control={form.control}
                      name="filters.excludeKeywords"
                      render={({ field }) => (
                        <Input 
                          value={field.value?.join(", ") || ""} 
                          onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          placeholder="إعلان، ممول، ترويجي" 
                          className="rounded-xl h-12 bg-background/50 text-right" 
                        />
                      )}
                    />
                  </div>
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
            تثبيت البروتوكول والتشغيل
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
