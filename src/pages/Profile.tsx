import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, TrendingUp, Award, Calendar, Target, LogOut, Edit2, Loader2, X, Save, User, Camera, Zap, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import type { Badge } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";

const formatIconName = (name: string) => {
  if (!name) return "Trophy";
  if (name.length <= 2) return null;
  return name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
};

export default function Profile() {
  const navigate = useNavigate();
  
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<any>(null);
  const [previousMeasurement, setPreviousMeasurement] = useState<any>(null);
  const [allMeasurements, setAllMeasurements] = useState<any[]>([]);
  const [showEditMeasurements, setShowEditMeasurements] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Profile state
  const [profile, setProfile] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    height: "",
    weight: "",
    body_fat: "",
    lean_mass: "",
    noInfo: false
  });

  // State for achievements
  const [dbStats, setDbStats] = useState<any>(null);
  const [unlockedBadges, setUnlockedBadges] = useState<Badge[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(true);

  const loadMeasurements = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
      
    if (data && data.length > 0) {
      setAllMeasurements(data);
      setMeasurements(data[data.length - 1]);
      setPreviousMeasurement(data.length > 1 ? data[data.length - 2] : null);
    }
    setLoading(false);
  };

  const fetchUserData = async () => {
    if (!user) return;

    // Fetch Profile
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profileData) {
      setProfile(profileData);
      setEditName(profileData.full_name || "");
    }

    // Fetch master achievements
    const { data: master } = await supabase.from('master_achievements').select('*');
    
    // Fetch user achievements (unlocked)
    const { data: userProg } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', user.id)
      .eq('unlocked', true);

    // Fetch user stats
    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (stats) setDbStats(stats);

    if (master && userProg) {
      const merged: Badge[] = userProg.map(p => {
        const m = master.find(ma => ma.id === p.achievement_id);
        return {
          id: p.achievement_id,
          name: m?.name || 'Conquista',
          description: m?.description || '',
          icon: m?.icon || 'trophy',
          category: m?.category || '',
          xp: m?.xp || 0,
          maxProgress: m?.max_progress || 1,
          unlocked: true,
          progress: p.progress
        };
      });
      setUnlockedBadges(merged);
    }
    setLoadingBadges(false);
  };

  useEffect(() => {
    if (user) {
      loadMeasurements();
      fetchUserData();
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        full_name: editName,
        avatar_url: profile?.avatar_url || null,
        updated_at: new Date().toISOString()
      });

    if (error) {
      toast.error("Erro ao atualizar perfil.");
      console.error(error);
    } else {
      toast.success("Perfil atualizado!");
      setProfile({ ...profile, full_name: editName });
      setShowEditProfile(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Você deve selecionar uma imagem.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${session.user.id}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Usar upsert aqui também para garantir persistência
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ 
          id: session.user.id, 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        });

      if (updateError) throw updateError;

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Foto de perfil atualizada!");
    } catch (error: any) {
      toast.error(error.message || "Erro no upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveMeasurements = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const payload = {
      user_id: session.user.id,
      height: formData.noInfo || !formData.height ? null : Number(formData.height),
      weight: formData.noInfo || !formData.weight ? null : Number(formData.weight),
      body_fat: formData.noInfo || !formData.body_fat ? null : Number(formData.body_fat),
      lean_mass: formData.noInfo || !formData.lean_mass ? null : Number(formData.lean_mass),
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('body_measurements').insert([payload]);
    
    if (error) {
      toast.error("Erro ao salvar medidas.");
    } else {
      toast.success("Medidas salvas com sucesso!");
      setShowEditMeasurements(false);
      loadMeasurements();
    }
  };

  const getTrend = (current: number | null, prev: number | null, inverseGood: boolean = false) => {
    if (current === null || prev === null) return { text: "-", color: "text-muted-foreground" };
    const diff = current - prev;
    if (diff === 0) return { text: "Mesmo", color: "text-muted-foreground" };
    const isPositive = diff > 0;
    let color = isPositive ? (inverseGood ? "text-blood-red" : "text-success") : (inverseGood ? "text-success" : "text-blood-red");
    return { text: `${isPositive ? "+" : ""}${diff.toFixed(1)}`, color };
  };

  const statsToShow = [
    { label: "Peso", value: measurements?.weight ? `${measurements.weight} kg` : "N/I", trend: getTrend(measurements?.weight, previousMeasurement?.weight) },
    { label: "% Gordura", value: measurements?.body_fat ? `${measurements.body_fat}%` : "N/I", trend: getTrend(measurements?.body_fat, previousMeasurement?.body_fat, true) },
    { label: "Massa Magra", value: measurements?.lean_mass ? `${measurements.lean_mass} kg` : "N/I", trend: getTrend(measurements?.lean_mass, previousMeasurement?.lean_mass) },
  ];

  const chartData = allMeasurements.map(m => ({
    date: new Date(m.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short' }),
    peso: m.weight ? Number(m.weight) : undefined,
    gordura: m.body_fat ? Number(m.body_fat) : undefined,
    massa_magra: m.lean_mass ? Number(m.lean_mass) : undefined
  }));

  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Você saiu da conta.");
    navigate("/auth");
  };

  const initials = profile?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "AT";

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header Navigation */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center transition-colors hover:bg-muted/80">
          <ArrowLeft size={20} strokeWidth={1.5} className="text-foreground" />
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowEditProfile(true)} className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
            <User size={16} strokeWidth={1.5} /> Perfil
          </button>
          <button onClick={handleSignOut} className="text-xs font-semibold text-muted-foreground hover:text-destructive flex items-center gap-1.5 transition-colors">
            <LogOut size={16} strokeWidth={1.5} /> Sair
          </button>
        </div>
      </div>

      {/* Profile Info Card */}
      <div className="px-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className={`w-16 h-16 rounded-full ${profile?.avatar_url ? '' : 'bg-gradient-fire'} flex items-center justify-center shadow-red-glow overflow-hidden`}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-display font-bold text-primary-foreground">{initials}</span>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                  <Loader2 className="animate-spin text-foreground" size={16} />
                </div>
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-foreground text-background rounded-full flex items-center justify-center border-2 border-background cursor-pointer hover:bg-foreground/80 transition-colors z-10 shadow-sm">
              <Camera size={12} />
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">
              {profile?.full_name || "Atleta"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Nível {dbStats?.level || 1} • {dbStats?.total_sessions || 0} treinos
            </p>
          </div>
        </div>
      </div>

      {/* Badges Carousel */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
            <Award size={16} className="text-blood-red" /> Conquistas Recentes
          </h2>
          <button onClick={() => navigate("/badges")} className="text-xs text-blood-red font-semibold">Ver todas</button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide min-h-[60px]">
          {loadingBadges ? (
            [1, 2, 3].map(i => <div key={i} className="flex-shrink-0 w-32 h-14 bg-muted animate-pulse rounded-xl" />)
          ) : unlockedBadges.length > 0 ? (
            unlockedBadges.map((badge) => {
              const iconName = formatIconName(badge.icon);
              const LucideIcon = iconName ? (Icons as any)[iconName] : null;
              
              return (
                <div key={badge.id} className="flex-shrink-0 bg-card rounded-2xl p-3 px-4 shadow-card flex items-center gap-3 min-w-[160px] border border-border/40">
                  <div className="w-8 h-8 rounded-lg bg-blood-red/10 flex items-center justify-center text-blood-red">
                    {LucideIcon ? <LucideIcon size={18} strokeWidth={2.5} /> : <span className="text-xl">{badge.icon}</span>}
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-tight text-foreground line-clamp-1">{badge.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Zap size={8} className="text-blood-red" fill="currentColor" />
                      <p className="text-[9px] font-bold text-muted-foreground">+{badge.xp} XP</p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-[10px] text-muted-foreground italic px-2 py-4">Nenhuma conquista desbloqueada ainda.</p>
          )}
        </div>
      </div>

      {/* Evolution Chart */}
      <div className="px-5 mb-6">
        <h2 className="font-display font-bold text-sm text-foreground mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-blood-red" /> Minha Evolução
        </h2>
        {allMeasurements.length > 0 ? (
          <div className="bg-card rounded-xl p-4 shadow-card border border-border/40">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(220 5% 50%)" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tickFormatter={(v) => `${v}kg`} tick={{ fontSize: 10, fill: "hsl(220 5% 50%)" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: "hsl(220 5% 50%)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} />
                <Legend 
                   verticalAlign="top" 
                   align="right"
                   height={36} 
                   iconType="circle" 
                   iconSize={8}
                   wrapperStyle={{ paddingTop: '0px', paddingBottom: '20px', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }} 
                />
                <Line yAxisId="left" type="monotone" dataKey="peso" stroke="#3B82F6" strokeWidth={3} dot={{ r: 3, fill: '#3B82F6' }} name="Peso" connectNulls />
                <Line yAxisId="right" type="monotone" dataKey="gordura" stroke="#EF4444" strokeWidth={3} dot={{ r: 3, fill: '#EF4444' }} name="% Gordura" connectNulls />
                <Line yAxisId="left" type="monotone" dataKey="massa_magra" stroke="#10B981" strokeWidth={3} dot={{ r: 3, fill: '#10B981' }} name="M. Magra" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-card rounded-xl p-8 shadow-card border border-border/40 text-center text-muted-foreground">
             <TrendingUp size={24} className="mx-auto mb-2 opacity-20" />
             <p className="text-xs">Registre medidas para ver seu gráfico.</p>
          </div>
        )}
      </div>

      {/* Body Summary */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-sm text-foreground">Resumo do Corpo</h2>
          <button onClick={() => setShowEditMeasurements(true)} className="text-xs text-blood-red font-semibold flex items-center gap-1">
            <Edit2 size={12} /> Atualizar
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {statsToShow.map((stat) => (
            <div key={stat.label} className="bg-card rounded-xl p-3 shadow-card text-center border border-border/40">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">{stat.label}</p>
              <p className="text-lg font-display font-bold text-foreground">{stat.value}</p>
              <p className={`text-[10px] font-bold mt-1 ${stat.trend.color}`}>{stat.trend.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5">
        <button className="w-full bg-gradient-fire rounded-xl py-4 text-center shadow-red-glow font-display font-bold text-primary-foreground">
          📍 Check-in de Presença
        </button>
      </div>

      <AnimatePresence>
        {/* Modal Editar Perfil */}
        {showEditProfile && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-card border border-border/40 w-full max-w-sm rounded-[2rem] p-6 shadow-xl relative text-center">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-lg text-foreground">Editar Dados</h3>
                <button onClick={() => setShowEditProfile(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X size={16} /></button>
              </div>
              
              <div className="flex flex-col items-center mb-8">
                 <div className="relative mb-4 group cursor-pointer" onClick={() => (document.getElementById('avatar-input-modal') as HTMLInputElement)?.click()}>
                    <div className={`w-24 h-24 rounded-full ${profile?.avatar_url ? '' : 'bg-gradient-fire'} flex items-center justify-center shadow-elevated overflow-hidden`}>
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl font-display font-bold text-primary-foreground">{initials}</span>
                      )}
                      {uploading && (
                        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                          <Loader2 className="animate-spin text-foreground" size={20} />
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-blood-red text-white rounded-full flex items-center justify-center border-2 border-background shadow-lg z-10">
                      <Camera size={14} />
                    </div>
                    <input id="avatar-input-modal" type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} />
                 </div>
                 <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Toque para trocar a foto</p>
              </div>

              <div className="space-y-6 mb-8 text-left">
                <div>
                  <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2 block">Seu Apelido/Nome</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome" className="bg-muted w-full px-5 py-4 rounded-2xl outline-none focus:ring-2 ring-blood-red/20 transition-all font-semibold" />
                </div>
              </div>
              
              <button onClick={handleUpdateProfile} className="w-full py-4 bg-foreground text-background rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors">
                <Save size={18} /> Salvar Alterações
              </button>
            </motion.div>
          </div>
        )}

        {/* Modal Editar Medidas */}
        {showEditMeasurements && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-card border border-border/40 w-full max-w-sm rounded-[2rem] p-6 shadow-xl relative">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-lg text-foreground">Atualizar Medidas</h3>
                <button onClick={() => setShowEditMeasurements(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X size={16} /></button>
              </div>
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-semibold mb-1 block uppercase tracking-wider">PESO (kg)</label>
                    <input type="number" step="0.1" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="bg-muted w-full px-4 py-3 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-semibold mb-1 block uppercase tracking-wider">% GORDURA</label>
                    <input type="number" step="0.1" value={formData.body_fat} onChange={e => setFormData({...formData, body_fat: e.target.value})} className="bg-muted w-full px-4 py-3 rounded-xl outline-none" />
                  </div>
                  <div className="col-span-2">
                     <label className="text-[10px] text-muted-foreground font-semibold mb-1 block uppercase tracking-wider">MASSA MAGRA (kg)</label>
                     <input type="number" step="0.1" value={formData.lean_mass} onChange={e => setFormData({...formData, lean_mass: e.target.value})} className="bg-muted w-full px-4 py-3 rounded-xl outline-none" />
                  </div>
                </div>
              </div>
              <button onClick={handleSaveMeasurements} className="w-full py-4 bg-foreground text-background rounded-xl font-semibold flex items-center justify-center gap-2">
                <Save size={18} /> Salvar Evolução
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
