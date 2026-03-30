import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, Zap, Star, LayoutGrid, Calendar, Dumbbell, Users, Loader2, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BadgeCard from "@/components/BadgeCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import type { Badge } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";

export default function Badges() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [dbBadges, setDbBadges] = useState<Badge[]>([]);
  const [dbStats, setDbStats] = useState<any>(null);
  const [dbLeaderboard, setDbLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination for Leaderboard
  const [leaderPage, setLeaderPage] = useState(0);
  const [hasMoreLeaders, setHasMoreLeaders] = useState(true);
  const [fetchingMoreLeaders, setFetchingMoreLeaders] = useState(false);
  const LEADER_PAGE_SIZE = 5;

  // Pull to Refresh
  const { pullProgress, refreshing: ptRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      if (user) await fetchInitialData(user.id);
    }
  });

  useEffect(() => {
    if (user) {
      fetchInitialData(user.id);
    }
  }, [user]);

  const fetchInitialData = async (userId: string) => {
    setLoading(true);
    
    // 1. Fetch all master achievements
    const { data: master } = await supabase.from('master_achievements').select('*');
    
    // 2. Fetch user progress and stats
    let userProg = [];
    const { data: prog } = await supabase.from('user_achievements').select('*').eq('user_id', userId);
    const { data: stats } = await supabase.from('user_stats').select('*').eq('user_id', userId).single();
    if (prog) userProg = prog;
    if (stats) setDbStats(stats);

    // 3. Initial Leaderboard load
    await fetchLeaders(0);

    if (master) {
      const merged: Badge[] = master.map(m => {
        const prog = userProg?.find(u => u.achievement_id === m.id);
        return {
          id: m.id,
          name: m.name,
          description: m.description,
          icon: m.icon,
          category: m.category,
          xp: m.xp,
          maxProgress: m.max_progress,
          unlocked: prog?.unlocked || false,
          progress: prog?.progress || 0
        };
      });
      setDbBadges(merged);
    }
    setLoading(false);
  };

  const fetchLeaders = async (nextPage = 0) => {
    if (nextPage > 0) setFetchingMoreLeaders(true);
    const start = nextPage * LEADER_PAGE_SIZE;
    const end = start + LEADER_PAGE_SIZE - 1;

    try {
      const { data: leaders, error } = await supabase
        .from('user_stats')
        .select(`
          xp,
          streak,
          user_id,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .order('xp', { ascending: false })
        .range(start, end);
      
      if (error) throw error;

      if (leaders) {
        if (nextPage === 0) setDbLeaderboard(leaders);
        else setDbLeaderboard(prev => [...prev, ...leaders]);
        
        if (leaders.length < LEADER_PAGE_SIZE) setHasMoreLeaders(false);
        setLeaderPage(nextPage);
      }
    } catch (e) {
      console.error("Leaderboard fetch error:", e);
    } finally {
      setFetchingMoreLeaders(false);
    }
  };
  
  const unlockedCount = dbBadges.filter((b) => b.unlocked).length;
  const totalXP = dbBadges.reduce((acc, b) => acc + (b.unlocked ? (b.xp || 0) : 0), 0);

  const categories = [
    { id: "all", label: "Tudo", icon: <LayoutGrid size={14} /> },
    { id: "Consistência e Hábito", label: "Hábito", icon: <Calendar size={14} /> },
    { id: "Evolução Física e Performance", label: "Performance", icon: <TrendingUp size={14} /> },
  ];

  const filteredBadges = activeTab === "all" 
    ? dbBadges 
    : dbBadges.filter(b => b.category === activeTab);

  return (
    <div className="min-h-screen bg-background pb-24">
      <PullToRefreshIndicator pullProgress={pullProgress} refreshing={ptRefreshing} />
      {/* Premium Header */}
      <div className="relative px-5 pt-12 pb-8 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary/10 to-transparent -z-10" />
        
        <button 
          onClick={() => navigate("/")} 
          className="mb-6 w-10 h-10 flex items-center justify-center rounded-full bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </button>

        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Conquistas</h1>
            <p className="text-sm text-muted-foreground mt-1">Sua jornada de evolução em marcos</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end text-blood-red font-display font-bold text-lg">
              <Zap size={18} fill="currentColor" />
              {totalXP} XP
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Total Acumulado</p>
          </div>
        </div>

        {/* Level Progress Stats */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          <div className="bg-card/50 backdrop-blur-md border border-border/40 rounded-2xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Taxa de Conquista</p>
            <p className="text-lg font-display font-bold text-foreground">
              {dbBadges.length > 0 ? Math.round((unlockedCount / dbBadges.length) * 100) : 0}%
            </p>
          </div>
          <div className="bg-card/50 backdrop-blur-md border border-border/40 rounded-2xl p-3 text-center border-blood-red/20 ring-1 ring-blood-red/10">
            <p className="text-[10px] text-blood-red uppercase font-bold mb-1">Desbloqueadas</p>
            <div className="text-lg font-display font-bold text-foreground flex items-center justify-center gap-0.5">
              {loading ? <Loader2 size={14} className="animate-spin" /> : unlockedCount}
              <span className="text-muted-foreground text-sm">/{dbBadges.length}</span>
            </div>
          </div>
          <div className="bg-card/50 backdrop-blur-md border border-border/40 rounded-2xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Nível Atual</p>
            <p className="text-lg font-display font-bold text-foreground">LV. {dbStats?.level || 1}</p>
          </div>
        </div>
      </div>

      {/* Categories Tabs */}
      <div className="px-5 mb-6">
        <Tabs defaultValue="all" onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-12 bg-muted/30 p-1 rounded-xl border border-border/30">
            {categories.map(cat => (
              <TabsTrigger 
                key={cat.id} 
                value={cat.id}
                className="flex-1 gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-blood-red"
              >
                {cat.icon}
                <span className="hidden xs:inline text-xs font-bold uppercase tracking-wider">{cat.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Badges Grid with Animation */}
      <div className="px-5 grid grid-cols-2 gap-3 mb-10 min-h-[200px]">
        {loading ? (
          <div className="col-span-2 flex flex-col items-center justify-center py-12 text-muted-foreground animate-pulse">
            <Loader2 className="animate-spin mb-2" />
            <p className="text-xs font-medium uppercase tracking-widest">Sincronizando conquistas...</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredBadges.map((badge, i) => (
              <BadgeCard key={badge.id} badge={badge} index={i} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Leaderboard Section */}
      <div className="px-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
            <Trophy size={20} className="text-yellow-500" />
            Hall da Fama
          </h2>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ranking Global</span>
        </div>
        
        <div className="bg-card rounded-2xl border border-border/50 shadow-xl shadow-black/5 overflow-hidden">
          {dbLeaderboard.length > 0 ? dbLeaderboard.map((leaderUser, i) => {
            const rank = i + 1;
            const isUser = leaderUser.user_id === user?.id;
            const initials = leaderUser.profiles?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "AT";
            
            return (
              <motion.div
                key={leaderUser.user_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (i % LEADER_PAGE_SIZE) * 0.05 }}
                className={`flex items-center justify-between px-5 py-4 ${
                  i < dbLeaderboard.length - 1 ? "border-b border-border/30" : ""
                } ${isUser ? "bg-blood-red/5 ring-inset ring-1 ring-blood-red/10" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <span
                      className={`absolute -left-1 -top-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold z-10 shadow-sm ${
                        rank === 1 ? "bg-yellow-500 text-black" : 
                        rank === 2 ? "bg-slate-300 text-black" :
                        rank === 3 ? "bg-orange-400 text-black" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {rank}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold shadow-inner overflow-hidden border border-border/40">
                      {leaderUser.profiles?.avatar_url ? (
                        <img src={leaderUser.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-muted-foreground">{initials}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className={`text-sm block font-bold ${isUser ? "text-blood-red" : "text-foreground"}`}>
                      {leaderUser.profiles?.full_name || "Membro"}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      🔥 {leaderUser.streak || 0} dias
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-display font-black text-foreground">{leaderUser.xp} XP</p>
                  <div className="flex gap-0.5 justify-end mt-0.5">
                    {[1, 2, 3].map(s => (
                      <Star key={s} size={6} fill={rank <= 3 ? "currentColor" : "none"} className={rank <= 3 ? "text-yellow-500" : "text-muted"} />
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          }) : !loading && (
            <div className="py-10 text-center opacity-40">
               <p className="text-xs italic">Nenhum atleta no ranking ainda.</p>
            </div>
          )}
          
          {hasMoreLeaders && dbLeaderboard.length > 0 && (
            <button 
              onClick={() => fetchLeaders(leaderPage + 1)}
              disabled={fetchingMoreLeaders}
              className="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:bg-muted/10 transition-colors border-t border-border/30 flex items-center justify-center gap-2"
            >
              {fetchingMoreLeaders ? <Loader2 size={12} className="animate-spin" /> : "Ver Mais Atletas"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
