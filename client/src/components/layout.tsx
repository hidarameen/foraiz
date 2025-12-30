import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Terminal, 
  Activity, 
  ScrollText, 
  LogOut,
  Moon,
  Sun,
  Menu,
  Cpu
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { icon: LayoutDashboard, label: "لوحة التحكم", href: "/" },
  { icon: Activity, label: "الجلسات", href: "/sessions" },
  { icon: Terminal, label: "المهام", href: "/tasks" },
  { icon: ScrollText, label: "السجلات", href: "/logs" },
  { icon: Cpu, label: "الذكاء الاصطناعي", href: "/ai" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background overflow-hidden" dir="rtl">
        <Sidebar collapsible="icon" side="right" className="border-s bg-sidebar dark:bg-sidebar">
          <SidebarHeader className="p-4 bg-sidebar dark:bg-sidebar text-right">
            <div className="flex items-center justify-end gap-3 px-2">
              <span className="font-bold text-xl tracking-tight truncate group-data-[collapsible=icon]:hidden text-sidebar-foreground">
                نظام التحكم
              </span>
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Terminal className="text-primary-foreground w-5 h-5" />
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="px-2 bg-sidebar dark:bg-sidebar">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.href}
                    tooltip={item.label}
                    className="h-11 px-4 rounded-lg transition-all data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground flex-row-reverse text-right"
                  >
                    <Link href={item.href} className="flex flex-row-reverse items-center gap-3 w-full">
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium text-base flex-1">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t bg-sidebar dark:bg-sidebar">
            <div className="flex flex-col gap-4">
              <div className="flex items-center flex-row-reverse gap-3 px-2 group-data-[collapsible=icon]:px-0 text-sidebar-foreground text-right">
                <Avatar className="w-8 h-8 border">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {user?.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-semibold truncate">{user?.username}</p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">متصل الآن</p>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-2 group-data-[collapsible=icon]:flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="rounded-lg h-9 w-9 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground"
                  title="تبديل النمط"
                >
                  {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => logout()}
                  className="rounded-lg h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden bg-background">
          <header className="h-16 border-b flex flex-row-reverse items-center justify-between px-4 md:px-6 bg-background/80 backdrop-blur-md sticky top-0 z-30">
            <div className="flex flex-row-reverse items-center gap-2 md:gap-4">
              <SidebarTrigger className="h-9 w-9" />
              <div className="h-4 w-[1px] bg-border mx-1 md:mx-2 hidden sm:block" />
              <h2 className="text-sm font-medium text-muted-foreground hidden sm:block text-right truncate max-w-[150px] md:max-w-none">
                {navItems.find(i => i.href === location)?.label || "الصفحة الرئيسية"}
              </h2>
            </div>
          </header>
          <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
