import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, MessageCircle, Share2, Trophy, Dumbbell, Flame, Loader2, Camera, Plus, X, Image as ImageIcon, Send, Shield, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import * as Icons from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { toast } from "sonner";

const formatIconName = (name: string) => {
  if (!name) return "Trophy";
  if (name.length <= 2) return null; 
  return name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
};

const iconMap = {
  workout: Dumbbell,
  achievement: Trophy,
  milestone: Flame,
  status_photo: Camera,
};

const typeColors = {
  achievement: "text-blood-red bg-blood-red/10 animate-pulse",
  workout: "text-blue-500 bg-blue-500/10",
  milestone: "text-orange-500 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.3)]",
  status_photo: "text-blood-red bg-blood-red/10",
};

export default function Social() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  
  // Status Upload State
  const [showSelector, setShowSelector] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState(false);
  const [statusCaption, setStatusCaption] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 10;

  // Pull to Refresh
  const { pullProgress, refreshing: ptRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      await fetchEvents(0);
    }
  });

  useEffect(() => {
    fetchEvents(0);
    fetchStatuses();
  }, []);

  const fetchStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('community_events')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('event_type', 'status_photo')
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;
      setStatuses(data || []);
    } catch (e) {
      console.error("Error fetching statuses:", e);
    }
  };

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
        .neq('event_type', 'status_photo') // Don't show statuses in main feed, they are at the top
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setShowSelector(false); // Close selector if it was open
      setShowUploadModal(true);
    }
  };

  const uploadStatus = async () => {
    if (!user || !selectedImage) return;

    try {
      setUploadingStatus(true);
      
      const fileExt = selectedImage.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `status_photos/${fileName}`;

      // 1. Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('status_photos')
        .upload(filePath, selectedImage);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('status_photos')
        .getPublicUrl(filePath);

      // 2. Insert into community_events
      const { error: insertError } = await supabase.from('community_events').insert([{
        user_id: user.id,
        event_type: 'status_photo',
        title: 'Nova Vitória!',
        description: statusCaption.slice(0, 50),
        metadata: { 
          photo_url: publicUrl, 
          is_private: isPrivate,
          storage_path: filePath // Keep for easy deletion later
        }
      }]);

      if (insertError) throw insertError;

      toast.success("Status postado com sucesso! 🎉");
      setShowUploadModal(false);
      setStatusCaption("");
      setSelectedImage(null);
      setImagePreview(null);
      fetchStatuses();
    } catch (error: any) {
      toast.error("Erro ao postar status: " + error.message);
    } finally {
      setUploadingStatus(false);
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
      <PullToRefreshIndicator pullProgress={pullProgress} refreshing={ptRefreshing} />
      {/* Header */}
      <div className="px-5 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-lg z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Social</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">A Tribo Evolve</p>
          </div>
        </div>
        <button 
          onClick={() => setShowSelector(true)}
          className="w-12 h-12 rounded-2xl bg-blood-red text-white flex items-center justify-center shadow-red-glow transition-transform active:scale-90"
        >
          <Camera size={20} />
        </button>
        
        {/* Hidden Inputs */}
        <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
        <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileSelect} />
      </div>

      <div className="px-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Vitórias do Dia</h2>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-blood-red">
            <Clock size={12} />
            <span>EFÊMERO (24H)</span>
          </div>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-5 px-5 scrollbar-hide">
          {/* Post Button */}
          <button 
            onClick={() => setShowSelector(true)}
            className="flex-shrink-0 w-28 h-28 rounded-[2rem] bg-card border-2 border-dashed border-border/40 flex flex-col items-center justify-center gap-2 group hover:border-blood-red/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-blood-red/10 text-blood-red flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus size={20} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter">Postar</span>
          </button>

          {/* Status Items */}
          {statuses.map((status, i) => (
            <motion.div 
              key={status.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex-shrink-0 w-28 flex flex-col gap-2"
            >
              <div 
                className="w-28 h-28 rounded-[2rem] overflow-hidden border-2 border-blood-red shadow-red-glow relative cursor-pointer"
                onClick={() => setViewingPhoto(status.metadata?.photo_url)}
              >
                <img 
                  src={status.metadata?.photo_url} 
                  alt="Status" 
                  className="w-full h-full object-cover pointer-events-none"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2 px-3">
                   <p className="text-[8px] font-bold text-white line-clamp-2 leading-tight">
                     {status.description}
                   </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-1">
                 <div className="w-5 h-5 rounded-full border border-background shadow-sm overflow-hidden bg-muted">
                    {status.profiles?.avatar_url ? (
                      <img src={status.profiles.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-blood-red/10 flex items-center justify-center">
                        <span className="text-[6px] font-bold text-blood-red">AT</span>
                      </div>
                    )}
                 </div>
                 <span className="text-[8px] font-black uppercase tracking-tighter flex-1 truncate text-foreground/70">
                   {status.profiles?.full_name?.split(" ")[0]}
                 </span>
              </div>
            </motion.div>
          ))}
          
          {statuses.length === 0 && (
            <div className="flex items-center text-muted-foreground/30 px-6 italic text-[10px] font-medium">
              Nenhuma vitória postada ainda...
            </div>
          )}
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
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.1em] flex items-center gap-1.5 opacity-80">
                    <Clock size={12} className="text-blood-red" />
                    {new Date(event.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })} • {new Date(event.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${eventColor}`}>
                  <BaseIcon size={16} strokeWidth={2.5} />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-[11px] font-display font-black text-foreground uppercase tracking-tight leading-tight">
                  <span className="text-blood-red">{event.profiles?.full_name || "Membro"}</span> {event.title?.split('; [')[0]}
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

      <AnimatePresence>
        {/* Selector Bottom Sheet */}
        {showSelector && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center px-4 pb-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSelector(false)}
              className="absolute inset-0 bg-background/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm bg-card border border-border/40 rounded-[2.5rem] p-6 shadow-2xl overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6 opacity-40" />
              <h3 className="text-lg font-display font-black uppercase tracking-tight text-center mb-6">Compartilhar Vitória</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-blood-red text-white shadow-red-glow transition-transform active:scale-95"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Camera size={24} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Tirar Foto</span>
                </button>
                
                <button 
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-muted text-foreground transition-transform active:scale-95 border border-border/20"
                >
                  <div className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center">
                    <ImageIcon size={24} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Escolher da Galeria</span>
                </button>
              </div>

              <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                <Shield size={12} />
                <span>Suas fotos estão protegidas e são efêmeras</span>
              </div>
              
              <button 
                onClick={() => setShowSelector(false)}
                className="w-full mt-6 py-4 rounded-2xl font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Cancelar
              </button>
            </motion.div>
          </div>
        )}

        {viewingPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewingPhoto(null)}
            className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 cursor-zoom-out"
          >
            <button 
              onClick={() => setViewingPhoto(null)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white z-10"
            >
              <X size={20} />
            </button>
            <motion.img 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={viewingPhoto} 
              alt="Full size status" 
              className="max-w-full max-h-[85vh] object-contain rounded-2xl cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}

        {showUploadModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col p-5 pt-12"
          >
            <div className="flex items-center justify-between mb-8">
               <button onClick={() => setShowUploadModal(false)} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                 <X size={20} />
               </button>
               <h2 className="text-lg font-display font-black uppercase tracking-tight">Nova Vitória</h2>
               <div className="w-10" />
            </div>

            <div className="flex-1 flex flex-col overflow-y-auto pb-4 scrollbar-hide">
              <div className="flex flex-col gap-6 min-h-max">
                <div className="aspect-square w-full shrink-0 rounded-[2.5rem] overflow-hidden border-2 border-blood-red shadow-red-glow bg-card">
                   {imagePreview && (
                     <img src={imagePreview} className="w-full h-full object-cover" />
                   )}
                </div>

                <div className="space-y-4 shrink-0">
                  <div className="bg-card border border-border/40 rounded-2xl p-4 focus-within:border-blood-red/40 transition-colors">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Legenda (Max 50 chars)</label>
                    <textarea 
                      value={statusCaption}
                      onChange={(e) => setStatusCaption(e.target.value.slice(0, 50))}
                      placeholder="Sua vitória de hoje..."
                      className="w-full bg-transparent outline-none text-sm font-medium resize-none"
                      rows={2}
                    />
                    <div className="flex justify-end mt-1">
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {statusCaption.length}/50
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-card border border-border/40 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <Shield size={18} className="text-blue-500" />
                      <div>
                         <p className="text-xs font-bold">Privacidade</p>
                         <p className="text-[10px] text-muted-foreground">Apenas amigos podem ver</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsPrivate(!isPrivate)}
                      className={`w-12 h-6 rounded-full p-1 transition-colors ${isPrivate ? 'bg-blue-500' : 'bg-muted'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
                
                <div className="mt-auto pt-6 shrink-0">
                  <button 
                    onClick={uploadStatus}
                    disabled={uploadingStatus || !statusCaption}
                    className="w-full bg-blood-red text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-red-glow flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                  >
                    {uploadingStatus ? <Loader2 className="animate-spin" /> : <><Send size={18} /> POSTAR VITÓRIA</>}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
