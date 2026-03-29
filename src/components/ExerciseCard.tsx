import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Minus, Plus, Check } from "lucide-react";
import type { Exercise } from "@/data/mockData";

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
  onUpdate?: (exercise: Exercise) => void;
}

export default function ExerciseCard({ exercise, index, onUpdate }: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(index === 0);
  const completedSets = exercise.sets.filter((s) => s.completed).length;

  const toggleSet = (setId: string) => {
    if (!onUpdate) return;
    const updated = {
      ...exercise,
      sets: exercise.sets.map((s) =>
        s.id === setId ? { ...s, completed: !s.completed } : s
      ),
    };
    onUpdate(updated);
  };

  const adjustWeight = (setId: string, delta: number) => {
    if (!onUpdate) return;
    const updated = {
      ...exercise,
      sets: exercise.sets.map((s) =>
        s.id === setId ? { ...s, weight: Math.max(0, s.weight + delta) } : s
      ),
    };
    onUpdate(updated);
  };

  const adjustReps = (setId: string, delta: number) => {
    if (!onUpdate) return;
    const updated = {
      ...exercise,
      sets: exercise.sets.map((s) =>
        s.id === setId ? { ...s, reps: Math.max(0, s.reps + delta) } : s
      ),
    };
    onUpdate(updated);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden transition-all"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <span className="text-base font-display font-semibold text-foreground">
              {completedSets}/{exercise.sets.length}
            </span>
          </div>
          <div className="text-left">
            <p className="font-display font-semibold text-base text-foreground mb-1">{exercise.name}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">{exercise.muscleGroup || "Musculação"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ChevronDown
            size={20}
            strokeWidth={1.5}
            className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden bg-card"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                <span className="col-span-2">Série</span>
                <span className="col-span-4 text-center">Peso (kg)</span>
                <span className="col-span-4 text-center">Reps</span>
                <span className="col-span-2 text-center">Feito</span>
              </div>

              {exercise.sets.map((set, i) => {
                return (
                  <div key={set.id}
                    className={`grid grid-cols-12 gap-2 items-center py-2.5 px-2 rounded-xl transition-all border ${
                      set.completed ? "bg-muted/30 border-border/50" : "bg-card border-transparent hover:border-border/40"
                    }`}
                  >
                    <span className="col-span-2 text-sm font-semibold text-muted-foreground">{i + 1}</span>

                    {/* Weight */}
                    <div className="col-span-4 flex items-center justify-center gap-2">
                      <button onClick={() => adjustWeight(set.id, -2.5)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                        <Minus size={14} className="text-foreground" />
                      </button>
                      <span className="text-base font-display font-semibold text-foreground w-12 text-center">{set.weight}</span>
                      <button onClick={() => adjustWeight(set.id, 2.5)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                        <Plus size={14} className="text-foreground" />
                      </button>
                    </div>

                    {/* Reps */}
                    <div className="col-span-4 flex items-center justify-center gap-2">
                      <button onClick={() => adjustReps(set.id, -1)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                        <Minus size={14} className="text-foreground" />
                      </button>
                      <span className="text-base font-display font-semibold text-foreground w-8 text-center">{set.reps}</span>
                      <button onClick={() => adjustReps(set.id, 1)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                        <Plus size={14} className="text-foreground" />
                      </button>
                    </div>

                    {/* Complete */}
                    <div className="col-span-2 flex justify-center">
                      <button
                        onClick={() => toggleSet(set.id)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                          set.completed
                            ? "bg-foreground text-background shadow-sm"
                            : "border-2 border-border/60 hover:border-foreground/40"
                        }`}
                      >
                        {set.completed && <Check size={16} strokeWidth={2.5} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
