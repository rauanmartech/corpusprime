import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PullToRefreshIndicatorProps {
  pullProgress: number;
  refreshing: boolean;
}

export function PullToRefreshIndicator({ pullProgress, refreshing }: PullToRefreshIndicatorProps) {
  if (pullProgress === 0 && !refreshing) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none"
      style={{ 
        transform: `translateY(${Math.min(pullProgress * 60, 60)}px)`,
        paddingTop: '20px'
      }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ 
          opacity: pullProgress > 0.2 ? 1 : 0, 
          scale: pullProgress > 0.2 ? 1 : 0.5,
          rotate: refreshing ? 360 : pullProgress * 360
        }}
        transition={refreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : { type: "spring", stiffness: 300, damping: 20 }}
        className="bg-card border border-border/40 w-10 h-10 rounded-full shadow-elevated flex items-center justify-center text-blood-red"
      >
        <Loader2 size={24} className={refreshing ? "animate-spin" : ""} />
      </motion.div>
    </div>
  );
}
