export interface Exercise {
  id: string;
  name: string;
  sets: SetData[];
  muscleGroup: string;
  notes?: string;
}

export interface SetData {
  id: string;
  weight: number;
  reps: number;
  rpe?: number;
  completed: boolean;
}

export interface WorkoutSession {
  id: string;
  name: string;
  label: string;
  date: string;
  exercises: Exercise[];
  completed: boolean;
  duration?: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  category: string;
  xp?: number;
  streakType?: "daily" | "weekly" | "monthly" | "total";
}

export interface UserStats {
  streak: number;
  totalWorkouts: number;
  thisWeek: number;
  totalVolume: number;
  level: number;
  xp: number;
  xpToNext: number;
  bodyweight: number;
}

export const userStats: UserStats = {
  streak: 12,
  totalWorkouts: 87,
  thisWeek: 4,
  totalVolume: 245600,
  level: 7,
  xp: 720,
  xpToNext: 1000,
  bodyweight: 78,
};

export const todayWorkout: WorkoutSession = {
  id: "w1",
  name: "Peito & Tríceps",
  label: "Sessão A",
  date: new Date().toISOString(),
  completed: false,
  exercises: [
    {
      id: "e1",
      name: "Supino Reto com Barra",
      muscleGroup: "Peito",
      sets: [
        { id: "s1", weight: 80, reps: 10, rpe: 7, completed: true },
        { id: "s2", weight: 85, reps: 8, rpe: 8, completed: true },
        { id: "s3", weight: 85, reps: 7, rpe: 9, completed: false },
        { id: "s4", weight: 80, reps: 10, rpe: undefined, completed: false },
      ],
    },
    {
      id: "e2",
      name: "Supino Inclinado com Halter",
      muscleGroup: "Peito",
      sets: [
        { id: "s5", weight: 30, reps: 12, rpe: 7, completed: false },
        { id: "s6", weight: 30, reps: 12, rpe: undefined, completed: false },
        { id: "s7", weight: 30, reps: 10, rpe: undefined, completed: false },
      ],
    },
    {
      id: "e3",
      name: "Crossover",
      muscleGroup: "Peito",
      sets: [
        { id: "s8", weight: 20, reps: 15, rpe: undefined, completed: false },
        { id: "s9", weight: 20, reps: 15, rpe: undefined, completed: false },
        { id: "s10", weight: 20, reps: 12, rpe: undefined, completed: false },
      ],
    },
    {
      id: "e4",
      name: "Tríceps Corda",
      muscleGroup: "Tríceps",
      sets: [
        { id: "s11", weight: 25, reps: 12, rpe: undefined, completed: false },
        { id: "s12", weight: 25, reps: 12, rpe: undefined, completed: false },
        { id: "s13", weight: 25, reps: 10, rpe: undefined, completed: false },
      ],
    },
    {
      id: "e5",
      name: "Tríceps Francês",
      muscleGroup: "Tríceps",
      sets: [
        { id: "s14", weight: 15, reps: 12, rpe: undefined, completed: false },
        { id: "s15", weight: 15, reps: 12, rpe: undefined, completed: false },
        { id: "s16", weight: 15, reps: 10, rpe: undefined, completed: false },
      ],
    },
  ],
};

export const recentWorkouts: WorkoutSession[] = [
  {
    id: "w2",
    name: "Costas & Bíceps",
    label: "Sessão B",
    date: new Date(Date.now() - 86400000).toISOString(),
    completed: true,
    duration: 62,
    exercises: [],
  },
  {
    id: "w3",
    name: "Pernas",
    label: "Sessão C",
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    completed: true,
    duration: 75,
    exercises: [],
  },
  {
    id: "w4",
    name: "Ombros & Abs",
    label: "Sessão D",
    date: new Date(Date.now() - 86400000 * 3).toISOString(),
    completed: true,
    duration: 50,
    exercises: [],
  },
];

export const leaderboard = [
  { rank: 1, name: "Carlos M.", xp: 2340, streak: 28, avatar: "CM" },
  { rank: 2, name: "Ana P.", xp: 2100, streak: 21, avatar: "AP" },
  { rank: 3, name: "Lucas R.", xp: 1950, streak: 19, avatar: "LR" },
  { rank: 4, name: "Você", xp: 1720, streak: 12, avatar: "VC", isUser: true },
  { rank: 5, name: "Marina S.", xp: 1680, streak: 15, avatar: "MS" },
  { rank: 6, name: "Pedro H.", xp: 1540, streak: 10, avatar: "PH" },
];

export const weeklyVolume = [
  { day: "Seg", volume: 12400 },
  { day: "Ter", volume: 0 },
  { day: "Qua", volume: 15200 },
  { day: "Qui", volume: 13800 },
  { day: "Sex", volume: 14600 },
  { day: "Sáb", volume: 0 },
  { day: "Dom", volume: 11200 },
];

export const strengthProgress = [
  { week: "S1", supino: 70, agachamento: 90, terra: 100 },
  { week: "S2", supino: 72, agachamento: 95, terra: 105 },
  { week: "S3", supino: 75, agachamento: 95, terra: 110 },
  { week: "S4", supino: 78, agachamento: 100, terra: 115 },
  { week: "S5", supino: 80, agachamento: 105, terra: 120 },
  { week: "S6", supino: 82, agachamento: 105, terra: 120 },
  { week: "S7", supino: 85, agachamento: 110, terra: 125 },
  { week: "S8", supino: 85, agachamento: 112, terra: 130 },
];

export function calculateE1RM(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30));
}

export function suggestNextWeight(weight: number, reps: number, rpe: number): { weight: number; suggestion: string } {
  if (rpe <= 6) {
    const increase = Math.round(weight * 0.05);
    return { weight: weight + increase, suggestion: `Aumente ${increase}kg na próxima sessão` };
  }
  if (rpe >= 9) {
    return { weight, suggestion: "Mantenha a carga atual e foque na técnica" };
  }
  return { weight, suggestion: "Carga adequada. Continue progredindo!" };
}
