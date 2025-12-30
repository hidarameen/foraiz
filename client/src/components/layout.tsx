import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Terminal, 
  Activity, 
  ScrollText, 
  LogOut,
  Moon,
  Sun,
  Menu
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
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { theme, setTheme } = useTheme();

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <Sidebar collapsible="icon" className="border-e">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Terminal className="text-primary-foreground w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight truncate group-data-[collapsible=icon]:hidden">
                نظام التحكم
              </span>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="px-2">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.href}
                    tooltip={item.label}
                    className="h-11 px-4 rounded-lg transition-all"
                  >
                    <Link href={item.href}>
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium text-base">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 px-2 group-data-[collapsible=icon]:px-0">
                <Avatar className="w-8 h-8 border">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {user?.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-semibold truncate">{user?.username}</p>
                  <p className="text-xs text-muted-foreground truncate">متصل الآن</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="rounded-lg h-9 w-9"
                  title="تبديل النمط"
                >
                  {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => logoutMutation.mutate()}
                  className="rounded-lg h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 relative">
          <header className="h-16 border-b flex items-center justify-between px-6 bg-background/80 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="h-9 w-9" />
              <div className="h-4 w-[1px] bg-border mx-2 hidden md:block" />
              <h2 className="text-sm font-medium text-muted-foreground hidden md:block">
                {navItems.find(i => i.href === location)?.label || "الصفحة الرئيسية"}
              </h2>
            </div>
          </header>
          <div className="flex-1 overflow-auto p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
