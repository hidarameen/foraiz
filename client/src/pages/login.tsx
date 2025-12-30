import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user && !isLoading) {
    setLocation("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Error",
          description: data.message || "Authentication failed",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: isLogin ? "Login successful!" : "Account created! Please login.",
      });

      if (isLogin) {
        setLocation("/");
      } else {
        setIsLogin(true);
        setPassword("");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="username" className="text-sm font-mono">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                data-testid="input-username"
              />
            </div>

            <div className="space-y-2 text-left">
              <Label htmlFor="password" className="text-sm font-mono">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                data-testid="input-password"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !username || !password}
              className="w-full font-bold tracking-widest mt-6"
              data-testid="button-submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : isLogin ? (
                "LOGIN"
              ) : (
                "CREATE ACCOUNT"
              )}
            </Button>

            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-muted-foreground mb-2">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setPassword("");
                }}
                className="text-primary hover:text-primary/80 text-sm font-mono tracking-wider transition-colors"
                data-testid={isLogin ? "link-register" : "link-login"}
              >
                {isLogin ? "Create new account" : "Go back to login"}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-xs text-muted-foreground/50 font-mono">
          SECURE CONNECTION :: ENCRYPTED :: V1.0.0
        </p>
      </div>
    </div>
  );
}
