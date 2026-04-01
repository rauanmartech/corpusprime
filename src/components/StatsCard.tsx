import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: boolean;
}

export default function StatsCard({ icon: Icon, label, value, subtitle, accent }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-5 border border-border/40 transition-all duration-300 relative overflow-hidden ${
        accent
          ? "bg-foreground text-background shadow-elevated opacity-100"
          : "bg-card hover:bg-muted/30 shadow-card opacity-80"
      }`}
    >
      {/* Watermark */}
      <img
        src="/assets/corpus_isologo.png"
        alt=""
        aria-hidden="true"
        className={`absolute left-0 bottom-0 h-full w-auto object-contain pointer-events-none select-none ${
          accent ? "opacity-100" : "opacity-30"
        }`}
      />
      <div className="flex items-center gap-2.5 mb-3 relative z-10">
        <Icon 
          size={18} 
          strokeWidth={1.5} 
          className={accent ? "text-accent" : "text-muted-foreground"} 
        />
        <span className={`text-xs font-medium tracking-wide ${accent ? "text-muted/80" : "text-muted-foreground"}`}>
          {label}
        </span>
      </div>
      <p className={`text-2xl font-display font-semibold relative z-10 ${accent ? "text-background" : "text-foreground"}`}>
        {value}
      </p>
      {subtitle && (
        <p className={`text-xs mt-1 relative z-10 ${accent ? "text-muted/60" : "text-muted-foreground/70"}`}>
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
