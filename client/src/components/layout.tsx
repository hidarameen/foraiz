import { Link, useLocation } from "wouter";
import { LayoutDashboard, Radio, ListChecks, History, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tasks", label: "Tasks", icon: ListChecks },
    { href: "/sessions", label: "Sessions", icon: Radio },
    { href: "/logs", label: "Logs", icon: History },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-body overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 bg-black/40 backdrop-blur-xl md:h-screen sticky top-0 z-50 flex-shrink-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary font-display tracking-widest">
            NEURO<span className="text-white">BOT</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1 tracking-widest">SYSTEM ONLINE</p>
        </div>

        <nav className="px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group relative overflow-hidden",
                isActive 
                  ? "text-primary bg-primary/10 border border-primary/30 shadow-[0_0_15px_rgba(0,255,255,0.1)]" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}>
                {isActive && (
                  <motion.div 
                    layoutId="activeNav"
                    className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
                <Icon className={cn("w-5 h-5 relative z-10", isActive && "text-primary drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]")} />
                <span className="font-medium tracking-wide relative z-10 font-mono text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-black font-display">
              {user?.username?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-bold truncate text-white font-mono">{user?.username}</div>
              <div className="text-xs text-primary/70">Operator</div>
            </div>
          </div>
          <button 
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive transition-all text-xs font-mono uppercase tracking-widest"
          >
            <LogOut className="w-4 h-4" /> Disconnect
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-[calc(100vh-64px)] md:h-screen overflow-y-auto p-4 md:p-8 bg-[url('/grid.svg')] bg-fixed bg-center">
        <div className="max-w-7xl mx-auto space-y-8 pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
