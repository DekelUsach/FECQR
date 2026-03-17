'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Camera, ChevronLeft, Save, User as UserIcon } from 'lucide-react';

export default function ProfesorPerfil() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchPerfil = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        setEmail(user.email ?? '');
        setNombre(user.user_metadata?.nombre ?? '');
        setDni(user.user_metadata?.dni ?? '');
        setAvatarUrl(user.user_metadata?.avatar_url ?? null);
      } catch (err: any) {
        setMensaje({ tipo: 'error', texto: 'No se pudo cargar el perfil.' });
      } finally {
        setCargando(false);
      }
    };

    fetchPerfil();
  }, [router]);

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setGuardando(true);
      if (!e.target.files || e.target.files.length === 0) return;
      
      const file = e.target.files[0];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const nuevaFoto = publicUrlData.publicUrl;
      setAvatarUrl(nuevaFoto);

      await supabase.auth.updateUser({
        data: { avatar_url: nuevaFoto }
      });

      setMensaje({ tipo: 'exito', texto: 'Foto de perfil actualizada.' });
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: 'Error al subir la imagen: ' + error.message });
    } finally {
      setGuardando(false);
    }
  };

  const guardarPerfil = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      const updates: any = { data: { nombre, dni } };
      if (password) updates.password = password;
      if (email) {
        updates.email = email;
        updates.options = {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        };
      }

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;

      setMensaje({ tipo: 'exito', texto: 'Perfil guardado. Si cambiaste tu correo, confirma el enlace enviado.' });
      setPassword('');
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: error.message });
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-muted animate-pulse">Cargando...</div>;

  return (
    <div className="min-h-screen bg-background pb-16 animate-fade-in">
      <header className="pt-16 pb-6 px-6 flex justify-between items-end">
        <div>
          <button
            onClick={() => router.push('/profesor/dashboard')}
            className="flex items-center text-[#007AFF] font-medium text-sm mb-2"
          >
            <ChevronLeft size={16} className="-ml-1" /> Volver
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Mi Perfil</h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="px-4 max-w-lg mx-auto space-y-6">
        {mensaje && (
          <div className={`p-4 rounded-xl text-sm font-medium ${mensaje.tipo === 'error' ? 'bg-red-100/50 text-[#FF3B30]' : 'bg-[#34C759]/10 text-[#34C759]'}`}>
            {mensaje.texto}
          </div>
        )}

        {/* Foto de perfil */}
        <div className="bg-surface rounded-3xl p-6 shadow-sm border border-subtle flex flex-col items-center text-center">
          <div className="relative group mb-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover border border-subtle" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-surface-hover text-muted flex items-center justify-center border border-subtle">
                <UserIcon size={40} />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-[#007AFF] text-white rounded-full flex items-center justify-center shadow-sm disabled:opacity-50"
              disabled={guardando}
            >
              <Camera size={14} />
            </button>
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={subirFoto} />
          </div>
          <p className="font-semibold text-foreground">{nombre || 'Mi Perfil'}</p>
          <p className="text-xs text-muted mb-1">{email}</p>
        </div>

        {/* Formulario */}
        <div className="bg-surface rounded-3xl overflow-hidden shadow-sm border border-subtle divide-y divide-subtle">
          <div className="p-5 flex flex-col">
            <label className="text-xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">Nombre Completo</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full px-4 py-3 bg-transparent text-foreground border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
              placeholder="Tu nombre"
            />
          </div>
          <div className="p-5 flex flex-col">
            <label className="text-xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">DNI</label>
            <input
              type="text"
              value={dni}
              onChange={e => setDni(e.target.value)}
              className="w-full px-4 py-3 bg-transparent text-foreground border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
              placeholder="Tu DNI"
            />
          </div>
          <div className="p-5 flex flex-col">
            <label className="text-xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-transparent text-foreground border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            />
          </div>
          <div className="p-5 flex flex-col">
            <label className="text-xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">Nueva Contraseña (Opcional)</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-transparent text-foreground border border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 placeholder:opacity-50"
              placeholder="**********"
            />
          </div>
        </div>

        <button
          onClick={guardarPerfil}
          disabled={guardando}
          className="w-full flex items-center justify-center gap-2 bg-[#007AFF] text-white font-semibold py-4 rounded-2xl shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <Save size={18} /> {guardando ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </main>
    </div>
  );
}
