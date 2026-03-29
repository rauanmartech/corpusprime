import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, MessageCircle, Share2, Trophy, Dumbbell, Flame, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import * as Icons from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const formatIconName = (name: string) => {
  if (!name) return "Trophy";
  if (name.length <= 2) return null; 
  return name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
};

const iconMap = {
  workout: Dumbbell,
  achievement: Trophy,
  milestone: Flame,
};

const typeColors = {
  achievement: "text-blood-red bg-blood-red/10 animate-pulse",
  workout: "text-blue-500 bg-blue-500/10",
  milestone: "text-orange-500 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.3)]",
};

export default function Social() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const PAGE_SIZE = 5;

  useEffect(() => {
    fetchEvents(0);
  }, []);

  const fetchEvents = async (nextPage = 0) => {
    if (nextPage === 0) setLoading(true);
    else setFetchingMore(true);

    const start = nextPage * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    try {
      const { data, error } = await supabase
        .from('community_events')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url
          ),
          event_likes (
            user_id
          )
        `)
        .order('created_at', { ascending: false })
        .range(start, end);

      if (error) throw error;

      if (data) {
        if (nextPage === 0) setEvents(data);
        else setEvents(prev => [...prev, ...data]);
        
        if (data.length < PAGE_SIZE) setHasMore(false);
        setPage(nextPage);
      }
    } catch (e) {
      console.error("Social fetch error:", e);
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  };

  const toggleLike = async (eventId: string) => {
    if (!user) return;
    
    const evIndex = events.findIndex(e => e.id === eventId);
    if (evIndex === -1) return;
    
    const hasLiked = events[evIndex].event_likes?.some((like: any) => like.user_id === user.id);

    // Optimistic UI update
    setEvents(currentEvents => currentEvents.map(ev => {
      if (ev.id === eventId) {
        const newLikes = hasLiked 
          ? ev.event_likes.filter((like: any) => like.user_id !== user.id)
          : [...(ev.event_likes || []), { user_id: user.id }];
        return { ...ev, event_likes: newLikes };
      }
      return ev;
    }));

    try {
      if (hasLiked) {
        await supabase
          .from('event_likes')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('event_likes')
          .insert({ event_id: eventId, user_id: user.id });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      // Revert in case of error could go here
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-blood-red" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-5 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-lg z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Comunidade</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Atividade em tempo real</p>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {events.length > 0 ? events.map((event, i) => {
          const BaseIcon = iconMap[event.event_type as keyof typeof iconMap] || Trophy;
          const initials = event.profiles?.full_name?.split(" ").map((n: any) => n[0]).join("").toUpperCase().slice(0, 2) || "AT";
          const eventColor = typeColors[event.event_type as keyof typeof typeColors] || "text-primary bg-primary/10";
          
          const achievementIconName = event.metadata?.icon ? formatIconName(event.metadata.icon) : null;
          const AchievementLucideIcon = achievementIconName ? (Icons as any)[achievementIconName] : null;
          
          const likesCount = event.event_likes?.length || 0;
          const isLiked = event.event_likes?.some((like: any) => like.user_id === user?.id);

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (i % PAGE_SIZE) * 0.1 }}
              className="bg-card border border-border/40 rounded-3xl p-5 shadow-sm relative overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-muted overflow-hidden flex items-center justify-center shadow-inner">
                  {event.profiles?.avatar_url ? (
                    <img src={event.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">{initials}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">{event.profiles?.full_name || "Membro"}</p>
                  <p className="text-[10px] text-muted-foreground font-medium italic">
                    {new Date(event.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${eventColor}`}>
                  <BaseIcon size={16} strokeWidth={2.5} />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-display font-black text-foreground uppercase tracking-tight">
                  {event.title}
                </h3>
              </div>

              {event.metadata?.icon && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full border border-border/20">
                  {AchievementLucideIcon ? (
                    <AchievementLucideIcon size={16} className="text-blood-red" />
                  ) : (
                    <span className="text-lg">{event.metadata.icon}</span>
                  )}
                  <span className="text-[10px] font-bold text-foreground">+{event.metadata.xp} XP Recompensa</span>
                </div>
              )}

              <div className="flex items-center gap-6 mt-5 pt-4 border-t border-border/40">
                <button 
                  onClick={() => toggleLike(event.id)}
                  className={`flex items-center gap-1.5 transition-colors group ${isLiked ? 'text-blood-red' : 'text-muted-foreground hover:text-blood-red'}`}
                >
                  <Heart size={16} className={isLiked ? "fill-blood-red" : "group-hover:fill-blood-red"} />
                  <span className="text-[10px] font-bold">
                    {likesCount === 0 ? 'MOTIVAR' : likesCount === 1 ? '1 MOTIVAÇÃO' : `${likesCount} MOTIVAÇÕES`}
                  </span>
                </button>
                <div className="ml-auto">
                   <Share2 size={16} className="text-muted-foreground/30" />
                </div>
              </div>
            </motion.div>
          );
        }) : !loading && (
          <div className="text-center py-20 opacity-40">
            <Trophy size={48} className="mx-auto mb-4" />
            <p className="text-xs italic font-medium">A comunidade está aquecendo...</p>
          </div>
        )}

        {hasMore && events.length > 0 && (
          <button 
            onClick={() => fetchEvents(page + 1)}
            disabled={fetchingMore}
            className="w-full py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
          >
            {fetchingMore ? <Loader2 size={14} className="animate-spin" /> : "Carregar Mais Atividade"}
          </button>
        )}
      </div>
    </div>
  );
}
