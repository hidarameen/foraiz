import { useState } from "react";
import { useSessions, useSessionLogin, useDeleteSession } from "@/hooks/use-sessions";
import { CyberCard } from "@/components/ui/cyber-card";
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
    if (confirm("Are you sure? This will disconnect the session.")) {
      deleteSession.mutate(id, {
        onSuccess: () => toast({ title: "Session Disconnected" })
      });
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-display uppercase tracking-widest text-white">Connected Nodes</h2>
          <div className="h-1 w-24 bg-gradient-to-r from-secondary to-transparent rounded-full" />
        </div>
        <AddSessionDialog />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {sessions?.map((session, idx) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: idx * 0.1 }}
            >
              <CyberCard gradient="primary" className="h-full flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-primary/10 rounded-lg text-primary neon-text border border-primary/20">
                      <Radio className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse" />
                      <span className="text-xs font-mono text-green-400">ONLINE</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-display text-white mb-1">{session.sessionName}</h3>
                  <p className="text-sm font-mono text-muted-foreground">{session.phoneNumber}</p>
                </div>
                
                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-mono">
                    Last active: {session.lastActive ? format(new Date(session.lastActive), 'MMM d, HH:mm') : 'Never'}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(session.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CyberCard>
            </motion.div>
          ))}
          
          {sessions?.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-white/10 rounded-lg bg-white/5">
              <Radio className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-mono text-lg">No active sessions detected.</p>
              <p className="text-sm">Connect a Telegram account to start forwarding.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </>
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
          toast({ title: "Code Sent", description: "Check your Telegram app." });
        } else if (res.status === 'password_required') {
          setStep("password");
          toast({ title: "2FA Required", description: "Please enter your password." });
        } else if (res.status === 'logged_in') {
          setOpen(false);
          setStep("phone");
          setData({ phoneNumber: "", code: "", password: "", phoneCodeHash: "" });
          toast({ title: "Connected", description: "Session established successfully.", className: "bg-green-900 border-green-700 text-white" });
        }
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="cyber-button px-6 py-3 flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Connect Node
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border-white/10 text-foreground backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider text-xl text-primary">Initialize Connection</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleLogin} className="space-y-6 mt-4">
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait">
              {step === "phone" && (
                <motion.div key="phone" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase tracking-widest text-primary">Phone Number</Label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="+1234567890" 
                        value={data.phoneNumber}
                        onChange={(e) => setData({ ...data, phoneNumber: e.target.value })}
                        className="pl-10 bg-black/20 border-white/10 focus:border-primary/50 font-mono"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Include country code (e.g. +1...)</p>
                  </div>
                </motion.div>
              )}

              {step === "code" && (
                <motion.div key="code" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase tracking-widest text-primary">Verification Code</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="12345" 
                        value={data.code}
                        onChange={(e) => setData({ ...data, code: e.target.value })}
                        className="pl-10 bg-black/20 border-white/10 focus:border-primary/50 font-mono tracking-[0.5em]"
                        required
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === "password" && (
                <motion.div key="password" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase tracking-widest text-primary">2FA Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input 
                        type="password"
                        placeholder="••••••" 
                        value={data.password}
                        onChange={(e) => setData({ ...data, password: e.target.value })}
                        className="pl-10 bg-black/20 border-white/10 focus:border-primary/50 font-mono"
                        required
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              disabled={login.isPending}
              className="bg-primary text-black hover:bg-primary/90 font-bold font-mono tracking-wider w-full"
            >
              {login.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {step === 'phone' ? 'SEND CODE' : step === 'code' ? 'VERIFY' : 'UNLOCK'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
