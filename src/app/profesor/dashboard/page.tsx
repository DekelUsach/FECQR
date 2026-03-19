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

interface SesionActiva {
  id: string;
  hora_inicio: string | null;
  materia_id: string;
  materia_nombre: string;
  profesor_email: string | null;
}

export default function ProfesorDashboard() {
  const router = useRouter();
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [sesionesActivas, setSesionesActivas] = useState<{ id: string, materia_nombre: string }[]>([]);
  const [todasSesionesActivas, setTodasSesionesActivas] = useState<SesionActiva[]>([]);
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

        let materiasD = [];
        if (esAdmin) {
          const res = await fetch('/api/admin/materias');
          if (!res.ok) throw new Error('Error al obtener cursos como administrador.');
          materiasD = await res.json();
        } else {
          const { data, error: materiasError } = await supabase
            .from('materias')
            .select('id, nombre, profesor_id')
            .eq('profesor_id', user.id);
          if (materiasError) throw materiasError;
          materiasD = data || [];
        }
        
        setMaterias(materiasD);

        // Fetch active sessions visible to this user
        const materiaIds = materiasD.map((m: any) => m.id);
        if (materiaIds.length > 0) {
          const { data: activasData, error: activasError } = await supabase
            .from('sesiones')
            .select(`
              id,
              materia_id,
              materias ( nombre )
            `)
            .in('materia_id', materiaIds)
            .eq('estado', 'activa');

          if (!activasError && activasData) {
            setSesionesActivas(activasData.map((s: any) => ({
              id: s.id,
              materia_nombre: Array.isArray(s.materias) ? s.materias[0].nombre : s.materias?.nombre || 'Desconocida'
            })));
          }
        }

        // Admin: fetch ALL active sessions globally
        if (esAdmin) {
          const res = await fetch('/api/admin/sesiones');
          if (res.ok) {
            const todas = await res.json();
            setTodasSesionesActivas(todas);
          }
        }
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
      if (isAdmin) {
        // Administrador: Usar siempre la API de admin para bypass de RLS
        const res = await fetch('/api/admin/sesiones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ materiaId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        router.push(`/profesor/sesion/${data.id}`);
      } else {
        // Profesor: Verificar si ya existe una sesión activa para esta materia
        const { data: sesionActiva, error: errorActiva } = await supabase
          .from('sesiones')
          .select('id')
          .eq('materia_id', materiaId)
          .eq('estado', 'activa')
          .maybeSingle();

        if (!errorActiva && sesionActiva) {
          router.push(`/profesor/sesion/${sesionActiva.id}`);
          return;
        }

        // Si no hay activa, crear una nueva (sujeto a RLS del profesor)
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Cursos</h1>
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
              Gestioná profesores, cursos y alumnos.
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

        {/* Admin: Todas las clases activas en este momento */}
        {isAdmin && (
          <div className="mt-4 animate-slide-up" style={{ animationDelay: '30ms', opacity: 0, animationFillMode: 'forwards' }}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#34C759] px-2 mb-2">Clases Activas Ahora</h2>
            <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle">
              {todasSesionesActivas.length === 0 ? (
                <p className="p-6 text-center text-muted text-sm">No hay clases activas en este momento.</p>
              ) : (
                <ul className="divide-y divide-subtle">
                  {todasSesionesActivas.map((sesion, i) => (
                    <li key={sesion.id} className="animate-slide-up" style={{ animationDelay: `${50 + i * 30}ms`, opacity: 0, animationFillMode: 'forwards' }}>
                      <button
                        onClick={() => router.push(`/profesor/sesion/${sesion.id}`)}
                        className="w-full flex justify-between items-center px-5 py-4 bg-[#34C759]/5 hover:bg-[#34C759]/10 tap-scale focus:outline-none group"
                      >
                        <div className="flex items-start gap-3">
                          <span className="relative flex h-3 w-3 mt-1.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#34C759] shadow-[0_0_8px_rgba(52,199,89,0.6)]"></span>
                          </span>
                          <div className="text-left">
                            <p className="font-semibold text-foreground text-sm">{sesion.materia_nombre}</p>
                            {sesion.profesor_email && (
                              <p className="text-xs text-muted mt-0.5">{sesion.profesor_email}</p>
                            )}
                            {sesion.hora_inicio && (
                              <p className="text-xs text-muted">
                                Desde {new Date(sesion.hora_inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="flex items-center text-[#34C759] text-sm font-medium shrink-0 ml-2">
                          Entrar <ChevronRight size={18} className="ml-1 opacity-60 transform transition-transform group-hover:translate-x-1" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Lista de cursos */}
        {cargando ? (
          <p className="text-muted animate-pulse px-2">Cargando...</p>
        ) : (
          <>
            {/* Botón Mi Curso — siempre visible para profesores si tienen cursos, o siempre */}
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
                    <p className="text-xs text-muted">Gestionar alumnos y asistencia de tus cursos</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-placeholder" />
              </button>
            )}

            {/* Clases Activas */}
            {sesionesActivas.length > 0 && (
              <div className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#34C759] px-2 mb-2">Clase Activa</h2>
                <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle">
                  <ul className="divide-y divide-subtle">
                    {sesionesActivas.map((sesion, i) => (
                      <li key={sesion.id} className="animate-slide-up" style={{ animationDelay: `${100 + i * 30}ms`, opacity: 0, animationFillMode: 'forwards' }}>
                        <button
                          onClick={() => router.push(`/profesor/sesion/${sesion.id}`)}
                          className="w-full flex justify-between items-center px-6 py-4 bg-[#34C759]/5 hover:bg-[#34C759]/10 tap-scale focus:outline-none group"
                        >
                          <div className="flex items-center gap-3">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#34C759] shadow-[0_0_8px_rgba(52,199,89,0.6)]"></span>
                            </span>
                            <span className="text-foreground font-medium">{sesion.materia_nombre}</span>
                          </div>
                          <span className="flex items-center text-[#34C759] text-sm font-medium">
                            Ver clase <ChevronRight size={18} className="ml-1 opacity-60 transform transition-transform group-hover:translate-x-1" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Mis Cursos */}
            <div className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted px-2 mb-2">Mis Cursos</h2>
              <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle">
                {materias.filter(m => m.profesor_id === userId).length === 0 ? (
                  <p className="p-6 text-center text-muted text-sm">No tenés cursos asignados.</p>
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

            {/* Cursos Generales (solo Admin) */}
            {isAdmin && (
              <div className="mt-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#007AFF] px-2 mb-2">Cursos Generales</h2>
                <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle">
                  {materias.filter(m => m.profesor_id !== userId).length === 0 ? (
                    <p className="p-6 text-center text-muted text-sm">No hay otros cursos.</p>
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
