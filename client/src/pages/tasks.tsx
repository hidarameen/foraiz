import { useState } from "react";
import { useTasks, useToggleTask, useDeleteTask, useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { useSessions } from "@/hooks/use-sessions";
import { CyberCard } from "@/components/ui/cyber-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Play, Pause, ArrowRight, Settings, Loader2 } from "lucide-react";
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
    if (confirm("Delete this task protocol?")) {
      deleteTask.mutate(id);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-display uppercase tracking-widest text-white">Task Protocols</h2>
          <div className="h-1 w-24 bg-gradient-to-r from-accent to-transparent rounded-full" />
        </div>
        <TaskFormDialog />
      </div>

      <div className="grid gap-6">
        {tasks?.map((task, idx) => (
          <CyberCard key={task.id} gradient={task.isActive ? "primary" : "secondary"} delay={idx * 0.1} className="py-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              
              <div className="flex items-center gap-4 flex-1">
                <div className={`p-3 rounded-full border ${task.isActive ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-muted/50 border-white/10 text-muted-foreground'}`}>
                  {task.isActive ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-xl font-display text-white">{task.name}</h3>
                  <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground mt-1">
                    <span className="text-primary">{task.sourceChannels.length} Sources</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="text-secondary">{task.destinationChannels.length} Targets</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end gap-1 font-mono text-xs text-muted-foreground mr-4">
                  <span>ID: #{task.id.toString().padStart(4, '0')}</span>
                  <span className={`px-2 py-0.5 rounded ${task.isActive ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {task.isActive ? 'RUNNING' : 'STOPPED'}
                  </span>
                </div>

                <Switch 
                  checked={task.isActive || false}
                  onCheckedChange={() => handleToggle(task.id, task.isActive || false)}
                  className="data-[state=checked]:bg-primary"
                />

                <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/10">
                  <TaskFormDialog task={task} trigger={
                    <Button variant="ghost" size="icon" className="hover:bg-primary/20 hover:text-primary transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  } />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="hover:bg-destructive/20 hover:text-destructive transition-colors"
                    onClick={() => handleDelete(task.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

            </div>
            
            {/* Filters summary */}
            {(task.filters as any)?.keywords?.length > 0 && (
               <div className="mt-4 pt-4 border-t border-white/5 text-xs font-mono text-muted-foreground flex gap-2">
                 <span className="text-accent">Filters:</span> 
                 {(task.filters as any).keywords.join(", ")}
               </div>
            )}
          </CyberCard>
        ))}
        
        {tasks?.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-white/10 rounded-lg bg-white/5">
            <Settings className="w-12 h-12 mb-4 opacity-50" />
            <p className="font-mono text-lg">No protocols defined.</p>
            <p className="text-sm">Create a task to begin automated operations.</p>
          </div>
        )}
      </div>
    </>
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
    // Manually ensure correct types for JSON fields
    const payload = {
      ...data,
      filters: {
        ...data.filters,
        keywords: typeof data.filters.keywords === 'string' ? data.filters.keywords.split(',') : data.filters.keywords,
      }
    };

    if (task) {
      update.mutate({ id: task.id, ...payload }, {
        onSuccess: () => { setOpen(false); toast({ title: "Task Updated" }); }
      });
    } else {
      create.mutate(payload, {
        onSuccess: () => { setOpen(false); toast({ title: "Task Created" }); }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="cyber-button px-6 py-3 flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> New Protocol
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card border-white/10 text-foreground backdrop-blur-xl sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider text-xl text-primary">{task ? 'Edit Protocol' : 'New Protocol'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Protocol Name</Label>
              <Input {...form.register("name")} className="bg-black/20 border-white/10" placeholder="e.g. Main Channel Mirror" />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Session Node</Label>
              <Controller
                control={form.control}
                name="sessionId"
                render={({ field }) => (
                  <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                    <SelectTrigger className="bg-black/20 border-white/10">
                      <SelectValue placeholder="Select Session" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions?.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.sessionName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Source Channels (comma separated IDs/Usernames)</Label>
              <Input {...form.register("sourceChannels")} className="bg-black/20 border-white/10 font-mono text-sm" placeholder="@channel1, -100123456" />
            </div>

            <div className="space-y-2">
              <Label>Destinations (comma separated IDs/Usernames)</Label>
              <Input {...form.register("destinationChannels")} className="bg-black/20 border-white/10 font-mono text-sm" placeholder="@my_archive" />
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full border border-white/10 rounded-lg bg-black/10 px-4">
            <AccordionItem value="filters" className="border-b-0">
              <AccordionTrigger className="hover:no-underline hover:text-primary">Advanced Filters & Options</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Keywords (Include)</Label>
                    <Input 
                      placeholder="urgent, sale, important" 
                      className="h-8 text-xs font-mono bg-black/20"
                      {...form.register("filters.keywords")} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Keywords (Exclude)</Label>
                    <Input 
                      placeholder="spam, ad, promo" 
                      className="h-8 text-xs font-mono bg-black/20"
                      {...form.register("filters.excludeKeywords")}
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-white/5">
                  <Label className="text-xs uppercase text-muted-foreground">Flags</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Controller
                        control={form.control}
                        name="options.withCaption"
                        render={({ field }) => (
                          <Checkbox id="caption" checked={field.value} onCheckedChange={field.onChange} />
                        )}
                      />
                      <label htmlFor="caption" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Preserve Captions
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Controller
                        control={form.control}
                        name="options.dropAuthor"
                        render={({ field }) => (
                          <Checkbox id="author" checked={field.value} onCheckedChange={field.onChange} />
                        )}
                      />
                      <label htmlFor="author" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Remove Sender Name (Copy)
                      </label>
                    </div>
                  </div>
                </div>

              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={create.isPending || update.isPending} className="bg-primary text-black hover:bg-primary/90 font-bold w-full">
              {(create.isPending || update.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              SAVE PROTOCOL
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
