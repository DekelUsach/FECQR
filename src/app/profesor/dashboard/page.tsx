'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ChevronRight, Settings, Users } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Materia {
  id: string;
  nombre: string;
  profesor_id: string | null;
}

export default function ProfesorDashboard() {
  const router = useRouter();
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDatos = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';
        const esAdmin = user.email === adminEmail;
        setIsAdmin(esAdmin);
        setUserId(user.id);

        let query = supabase.from('materias').select('id, nombre, profesor_id');
        // Admin ve todas; profesor solo las suyas
        if (!esAdmin) query = query.eq('profesor_id', user.id);

        const { data, error: materiasError } = await query;
        if (materiasError) throw materiasError;
        setMaterias(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    };

    fetchDatos();
  }, [router]);

  const iniciarSesion = async (materiaId: string, esMateriaPropia: boolean) => {
    try {
      if (isAdmin && !esMateriaPropia) {
        // Admin starting a class for another professor's subject → use server route
        const res = await fetch('/api/admin/sesiones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ materiaId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        router.push(`/profesor/sesion/${data.id}`);
      } else {
        // Own subject → client supabase (gated by RLS)
        const { data, error } = await supabase
          .from('sesiones')
          .insert([{ materia_id: materiaId, estado: 'activa' }])
          .select()
          .single();
        if (error) throw error;
        router.push(`/profesor/sesion/${data.id}`);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-background pb-16 animate-fade-in">
      <header className="pt-16 pb-6 px-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Materias</h1>
          {isAdmin && (
            <span className="inline-block mt-1 text-xs font-semibold bg-[#007AFF]/10 text-[#007AFF] px-2 py-0.5 rounded-full">
              Admin
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 pb-1">
          <ThemeToggle />
          <button
            onClick={() => router.push('/profesor/perfil')}
            className="text-[#007AFF] font-medium active:opacity-70 transition-opacity"
          >
            Perfil
          </button>
          <button
            onClick={cerrarSesion}
            className="text-[#FF3B30] font-medium active:opacity-70 transition-opacity"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="px-4 max-w-2xl mx-auto space-y-4">
        {error && (
          <div className="p-4 bg-red-100/50 text-[#FF3B30] rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Sección exclusiva Admin */}
        {isAdmin && (
          <div className="bg-[#007AFF] rounded-2xl p-5 shadow-sm animate-slide-up" style={{ animationDelay: '0ms', opacity: 0, animationFillMode: 'forwards' }}>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
              Panel de Administración
            </p>
            <p className="text-white font-medium text-sm mb-4">
              Gestioná profesores, materias y alumnos.
            </p>
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 bg-surface/20 hover:bg-surface/30 text-white font-semibold px-4 py-2.5 rounded-xl tap-scale text-sm"
            >
              <Settings size={16} />
              Administrar
            </button>
          </div>
        )}

        {/* Lista de materias */}
        {cargando ? (
          <p className="text-muted animate-pulse px-2">Cargando...</p>
        ) : (
          <>
            {/* Botón Mi Curso — siempre visible para profesores si tienen materias, o siempre */}
            {materias.some(m => m.profesor_id === userId) && (
              <button
                onClick={() => router.push('/profesor/curso')}
                className="w-full flex items-center justify-between bg-surface px-5 py-4 rounded-2xl shadow-sm border border-subtle hover:bg-surface-hover tap-scale animate-slide-up"
                style={{ animationDelay: '50ms', opacity: 0, animationFillMode: 'forwards' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#5856D6]/10 flex items-center justify-center">
                    <Users size={18} className="text-[#5856D6]" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-foreground text-sm">Mi Curso</p>
                    <p className="text-xs text-muted">Gestionar alumnos y asistencia de tus materias</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-placeholder" />
              </button>
            )}

            {/* Mis Materias */}
            <div className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted px-2 mb-2">Mis Materias</h2>
              <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle">
                {materias.filter(m => m.profesor_id === userId).length === 0 ? (
                  <p className="p-6 text-center text-muted text-sm">No tenés materias asignadas.</p>
                ) : (
                  <ul className="divide-y divide-subtle">
                    {materias.filter(m => m.profesor_id === userId).map((materia, i) => (
                      <li key={materia.id} className="animate-slide-up" style={{ animationDelay: `${100 + i * 30}ms`, opacity: 0, animationFillMode: 'forwards' }}>
                        <button
                          onClick={() => iniciarSesion(materia.id, true)}
                          className="w-full flex justify-between items-center px-6 py-4 bg-surface hover:bg-surface-hover/50 tap-scale focus:outline-none group"
                        >
                          <span className="text-foreground font-medium">{materia.nombre}</span>
                          <span className="flex items-center text-[#007AFF] text-sm font-medium">
                            Iniciar clase <ChevronRight size={18} className="ml-1 opacity-60 transform transition-transform group-hover:translate-x-1" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Materias Generales (solo Admin) */}
            {isAdmin && (
              <div className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#007AFF] px-2 mb-2">Materias Generales</h2>
                <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle">
                  {materias.filter(m => m.profesor_id !== userId).length === 0 ? (
                    <p className="p-6 text-center text-muted text-sm">No hay otras materias.</p>
                  ) : (
                    <ul className="divide-y divide-subtle">
                      {materias.filter(m => m.profesor_id !== userId).map((materia, i) => (
                        <li key={materia.id} className="animate-slide-up" style={{ animationDelay: `${100 + i * 30}ms`, opacity: 0, animationFillMode: 'forwards' }}>
                          <button
                            onClick={() => iniciarSesion(materia.id, false)}
                            className="w-full flex justify-between items-center px-6 py-4 bg-surface hover:bg-surface-hover/50 tap-scale focus:outline-none group"
                          >
                            <span className="text-foreground font-medium">{materia.nombre}</span>
                            <span className="flex items-center text-[#007AFF] text-sm font-medium">
                              Iniciar <ChevronRight size={18} className="ml-1 opacity-60 transform transition-transform group-hover:translate-x-1" />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
