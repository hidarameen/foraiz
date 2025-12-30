import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CyberCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  gradient?: "primary" | "secondary" | "accent";
  delay?: number;
}

export function CyberCard({ children, className, gradient = "primary", delay = 0, ...props }: CyberCardProps) {
  const gradientColors = {
    primary: "from-primary/20 via-transparent to-transparent",
    secondary: "from-secondary/20 via-transparent to-transparent",
    accent: "from-accent/20 via-transparent to-transparent",
  };

  const borderColors = {
    primary: "border-primary/30",
    secondary: "border-secondary/30",
    accent: "border-accent/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-lg bg-card/40 backdrop-blur-xl border p-6 shadow-xl group",
        borderColors[gradient],
        className
      )}
      {...props}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50 pointer-events-none", gradientColors[gradient])} />
      <div className="relative z-10">
        {children}
      </div>
      
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white/50" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-white/50" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-white/50" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white/50" />
    </motion.div>
  );
}
