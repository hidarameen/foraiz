import { useState } from "react";
import { useTasks, useToggleTask, useDeleteTask, useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { useSessions } from "@/hooks/use-sessions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Play, Pause, ArrowLeft, Settings, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema } from "@shared/schema";
import { z } from "zod";

export default function TasksPage() {
  const { data: tasks, isLoading } = useTasks();
  const toggleTask = useToggleTask();
  const deleteTask = useDeleteTask();
  const { toast } = useToast();

  const handleToggle = (id: number, currentStatus: boolean) => {
    toggleTask.mutate({ id, isActive: !currentStatus });
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف بروتوكول المهمة هذا؟")) {
      deleteTask.mutate(id);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-full py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">بروتوكولات المهام</h1>
          <p className="text-muted-foreground">إدارة عمليات تحويل الرسائل التلقائية وفلاترها.</p>
        </div>
        <TaskFormDialog />
      </div>

      <div className="grid gap-6">
        {tasks?.map((task, idx) => (
          <Card key={task.id} className="hover-elevate transition-all border-s-4 border-s-primary">
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                
                <div className="flex items-center gap-4 flex-1">
                  <div className={`p-4 rounded-xl border ${task.isActive ? 'bg-primary/10 border-primary/20 text-primary shadow-lg shadow-primary/10' : 'bg-muted border-muted-foreground/10 text-muted-foreground'}`}>
                    {task.isActive ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{task.name}</h3>
                    <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground mt-1">
                      <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-full">{task.sourceChannels.length} مصادر</span>
                      <ArrowLeft className="w-3 h-3" />
                      <span className="text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">{task.destinationChannels.length} أهداف</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-start md:items-end gap-1 font-mono text-xs">
                    <span className="text-muted-foreground">ID: #{task.id.toString().padStart(4, '0')}</span>
                    <span className={`px-3 py-1 rounded-full font-bold ${task.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                      {task.isActive ? 'قيد التشغيل' : 'متوقف'}
                    </span>
                  </div>

                  <Switch 
                    checked={task.isActive || false}
                    onCheckedChange={() => handleToggle(task.id, task.isActive || false)}
                    className="h-7 w-12"
                  />

                  <div className="flex items-center gap-2 pr-6 border-r">
                    <TaskFormDialog task={task} trigger={
                      <Button variant="ghost" size="icon" className="hover:bg-primary/10 hover:text-primary rounded-lg h-9 w-9">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    } />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="hover:bg-destructive/10 hover:text-destructive rounded-lg h-9 w-9"
                      onClick={() => handleDelete(task.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Filters summary */}
              {(task.filters as any)?.keywords?.length > 0 && (
                <div className="mt-6 pt-6 border-t flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">الفلاتر النشطة:</span> 
                  {(task.filters as any).keywords.map((keyword: string, kIdx: number) => (
                    <span key={kIdx} className="text-xs bg-muted px-2 py-1 rounded border shadow-sm">
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {tasks?.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-2xl bg-muted/30">
            <div className="p-4 bg-muted rounded-full">
              <Settings className="w-12 h-12 text-muted-foreground opacity-50" />
            </div>
            <div className="space-y-1">
              <p className="text-xl font-semibold">لا توجد بروتوكولات مهام</p>
              <p className="text-sm text-muted-foreground">أنشئ مهمة جديدة للبدء في عمليات الأتمتة.</p>
            </div>
            <TaskFormDialog />
          </div>
        )}
      </div>
    </div>
  );
}

// Form Component
const formSchema = insertTaskSchema.extend({
  sourceChannels: z.string().transform(str => str.split(',').map(s => s.trim())),
  destinationChannels: z.string().transform(str => str.split(',').map(s => s.trim())),
});

function TaskFormDialog({ task, trigger }: { task?: any, trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: sessions } = useSessions();
  const create = useCreateTask();
  const update = useUpdateTask();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: task?.name || "",
      sessionId: task?.sessionId || (sessions?.[0]?.id || 0),
      sourceChannels: task?.sourceChannels?.join(", ") || "",
      destinationChannels: task?.destinationChannels?.join(", ") || "",
      filters: task?.filters || { keywords: [], excludeKeywords: [], mediaTypes: [] },
      options: task?.options || { withCaption: true, dropAuthor: false },
    }
  });

  const onSubmit = (data: any) => {
    const payload = {
      ...data,
      filters: {
        ...data.filters,
        keywords: typeof data.filters.keywords === 'string' ? data.filters.keywords.split(',').map((k: string) => k.trim()) : data.filters.keywords,
        excludeKeywords: typeof data.filters.excludeKeywords === 'string' ? data.filters.excludeKeywords.split(',').map((k: string) => k.trim()) : data.filters.excludeKeywords,
      }
    };

    if (task) {
      update.mutate({ id: task.id, ...payload }, {
        onSuccess: () => { setOpen(false); toast({ title: "تم تحديث المهمة" }); }
      });
    } else {
      create.mutate(payload, {
        onSuccess: () => { setOpen(false); toast({ title: "تم إنشاء المهمة" }); }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2 h-11 px-6 rounded-lg shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4" /> بروتوكول جديد
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-bold text-center lg:text-right">
            {task ? 'تعديل بروتوكول المهمة' : 'إنشاء بروتوكول مهمة جديد'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 col-span-full">
              <Label>اسم البروتوكول</Label>
              <Input {...form.register("name")} className="h-11" placeholder="مثال: تحويل قناة الأخبار الرئيسية" />
            </div>

            <div className="space-y-2 col-span-full">
              <Label>حساب الربط (Node)</Label>
              <Controller
                control={form.control}
                name="sessionId"
                render={({ field }) => (
                  <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="اختر جلسة الربط" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions?.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.sessionName} ({s.phoneNumber})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>القنوات المصدر (IDs أو Usernames)</Label>
              <Input {...form.register("sourceChannels")} className="h-11 font-mono text-sm" placeholder="@channel1, -100123456" />
              <p className="text-[10px] text-muted-foreground">افصل بين القنوات بفاصلة (,)</p>
            </div>

            <div className="space-y-2">
              <Label>القنوات المستهدفة (IDs أو Usernames)</Label>
              <Input {...form.register("destinationChannels")} className="h-11 font-mono text-sm" placeholder="@my_archive" />
              <p className="text-[10px] text-muted-foreground">القنوات التي سيتم تحويل الرسائل إليها.</p>
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full border rounded-xl bg-muted/30 overflow-hidden">
            <AccordionItem value="filters" className="border-b-0">
              <AccordionTrigger className="hover:no-underline px-6 py-4 font-semibold text-primary hover:bg-muted/50 transition-colors">
                الفلاتر والخيارات المتقدمة
              </AccordionTrigger>
              <AccordionContent className="space-y-6 px-6 pb-6 pt-4 border-t">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">الكلمات المفتاحية المطلوبة</Label>
                    <Input 
                      placeholder="عاجل، بيع، مهم" 
                      className="h-10 text-sm"
                      {...form.register("filters.keywords")} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">الكلمات المستبعدة</Label>
                    <Input 
                      placeholder="إعلان، سبام، ترويجي" 
                      className="h-10 text-sm"
                      {...form.register("filters.excludeKeywords")}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">خيارات التحويل</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3 space-x-reverse border p-4 rounded-xl bg-background/50">
                      <Controller
                        control={form.control}
                        name="options.withCaption"
                        render={({ field }) => (
                          <Checkbox id="caption" checked={field.value} onCheckedChange={field.onChange} />
                        )}
                      />
                      <label htmlFor="caption" className="text-sm font-medium leading-none cursor-pointer">
                        الحفاظ على نص الصورة (Caption)
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-3 space-x-reverse border p-4 rounded-xl bg-background/50">
                      <Controller
                        control={form.control}
                        name="options.dropAuthor"
                        render={({ field }) => (
                          <Checkbox id="author" checked={field.value} onCheckedChange={field.onChange} />
                        )}
                      />
                      <label htmlFor="author" className="text-sm font-medium leading-none cursor-pointer">
                        إزالة اسم المرسل الأصلي (نسخ)
                      </label>
                    </div>
                  </div>
                </div>

              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Button type="submit" disabled={create.isPending || update.isPending} className="w-full h-12 font-bold text-lg rounded-lg shadow-lg shadow-primary/20">
            {(create.isPending || update.isPending) && <Loader2 className="w-5 h-5 animate-spin me-2" />}
            حفظ بروتوكول المهمة
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
