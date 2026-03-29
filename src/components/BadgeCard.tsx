import React from "react";
import { motion } from "framer-motion";
import { Lock, Sparkles, Zap, Award } from "lucide-react";
import * as Icons from "lucide-react";

interface BadgeCardProps {
  badge: {
    id: string;
    name: string;
    description: string;
    icon: string; // Isso agora é o nome do ícone do Lucide (ex: 'zap')
    category: string;
    xp?: number;
    unlocked: boolean;
    progress: number;
    maxProgress: number;
  };
  index: number;
}

const formatIconName = (name: string) => {
  if (!name) return "Trophy";
  return name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
};

const BadgeCard = React.forwardRef<HTMLDivElement, BadgeCardProps>(({ badge, index }, ref) => {
  const percent = Math.min(100, Math.round((badge.progress / badge.maxProgress) * 100));
  const isHighTier = (badge.xp || 0) >= 3000;
  
  // Renderizar ícone dinamicamente
  const iconName = formatIconName(badge.icon);
  const LucideIcon = (Icons as any)[iconName] || Icons.Trophy;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.05,
        layout: { duration: 0.3 } 
      }}
      className={`relative group rounded-3xl p-5 overflow-hidden border transition-all duration-500 cursor-pointer ${
        badge.unlocked 
          ? "bg-blood-red border-blood-red shadow-sm" 
          : "bg-card border-border/40 grayscale opacity-60 hover:grayscale-0 hover:opacity-100"
      } ${isHighTier && badge.unlocked ? "ring-1 ring-white/10" : ""}`}
    >
      {/* Clean background for unlocked badges */}
      {badge.unlocked && (
        <div className="absolute inset-0 bg-black/5 opacity-50" />
      )}

      <div className="relative z-10 w-full">
        <div className="flex justify-between items-start mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform duration-500 group-hover:scale-110 ${
            badge.unlocked 
              ? "bg-white/20 backdrop-blur-md text-white border border-white/10" 
              : "bg-muted text-muted-foreground/40 border border-border/10"
          }`}>
            <LucideIcon 
              size={badge.unlocked ? 24 : 20} 
              strokeWidth={2.5} 
              className={badge.unlocked 
                ? "text-white animate-in fade-in zoom-in duration-700" 
                : "text-blood-red/60 grayscale-[0.5]"} 
            />
          </div>
          
          <div className="flex flex-col items-end gap-1">
            {badge.unlocked && (
              <div className="text-white/60 mb-1">
                <Icons.CheckCircle2 size={16} />
              </div>
            )}
            {badge.xp && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                badge.unlocked ? "bg-white text-blood-red" : "bg-muted text-muted-foreground"
              }`}>
                <Zap size={10} fill="currentColor" />
                {badge.xp} XP
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <h3 className={`text-sm font-display font-black uppercase tracking-tight leading-tight ${
            badge.unlocked ? "text-white" : "text-foreground"
          }`}>
            {badge.name}
          </h3>
          <p className={`text-[10px] mb-4 leading-relaxed font-medium ${
            badge.unlocked ? "text-white/80" : "text-muted-foreground"
          }`}>
            {badge.description}
          </p>
        </div>

        <div className="space-y-2 mt-2">
          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-[0.1em]">
            <span className={badge.unlocked ? "text-white/60" : "text-muted-foreground"}>
              {badge.unlocked ? "Conquistado" : `Progresso ${badge.progress}/${badge.maxProgress}`}
            </span>
            <span className={badge.unlocked ? "text-white" : "text-foreground"}>
              {percent}%
            </span>
          </div>
          <div className="h-1.5 bg-black/10 rounded-full overflow-hidden backdrop-blur-sm shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 1.2, delay: 0.2 + index * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className={`h-full rounded-full ${
                badge.unlocked 
                  ? "bg-white" 
                  : "bg-muted-foreground/20"
              }`}
            />
          </div>
        </div>

        {/* High Tier Badge Decor */}
        {isHighTier && badge.unlocked && (
          <div className="absolute -bottom-1 -right-1 opacity-10">
            <Award size={40} className="text-white" />
          </div>
        )}
      </div>
    </motion.div>
  );
});

BadgeCard.displayName = "BadgeCard";

export default BadgeCard;
