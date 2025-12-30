import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-primary"><Loader2 className="w-10 h-10 animate-spin" /></div>;

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden font-body">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-md p-8 border border-white/10 bg-black/60 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col items-center text-center">
        <h1 className="text-5xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-secondary mb-2 tracking-widest">
          NEURO<span className="text-white">BOT</span>
        </h1>
        <p className="text-muted-foreground font-mono text-sm mb-8 tracking-wider">
          ADVANCED TELEGRAM AUTOMATION SYSTEM
        </p>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-8" />

        <button 
          onClick={handleLogin}
          className="cyber-button w-full py-4 text-lg font-bold tracking-widest"
        >
          INITIALIZE LOGIN
        </button>

        <p className="mt-6 text-xs text-muted-foreground/50 font-mono">
          SECURE CONNECTION :: ENCRYPTED :: V1.0.0
        </p>
      </div>
    </div>
  );
}
