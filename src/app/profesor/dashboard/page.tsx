'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ChevronRight, Settings } from 'lucide-react';

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

  useEffect(() => {
    const fetchDatos = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';
        const esAdmin = user.email === adminEmail;
        setIsAdmin(esAdmin);

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

  const iniciarSesion = async (materiaId: string) => {
    try {
      const { data, error } = await supabase
        .from('sesiones')
        .insert([{ materia_id: materiaId, estado: 'activa' }])
        .select()
        .single();

      if (error) throw error;
      router.push(`/profesor/sesion/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-16">
      <header className="pt-16 pb-6 px-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1C1C1E]">Materias</h1>
          {isAdmin && (
            <span className="inline-block mt-1 text-xs font-semibold bg-[#007AFF]/10 text-[#007AFF] px-2 py-0.5 rounded-full">
              Admin
            </span>
          )}
        </div>
        <button
          onClick={cerrarSesion}
          className="pb-1 text-[#007AFF] font-medium active:opacity-70 transition-opacity"
        >
          Salir
        </button>
      </header>

      <main className="px-4 max-w-2xl mx-auto space-y-4">
        {error && (
          <div className="p-4 bg-red-100/50 text-[#FF3B30] rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Sección exclusiva Admin */}
        {isAdmin && (
          <div className="bg-[#007AFF] rounded-2xl p-5 shadow-sm">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
              Panel de Administración
            </p>
            <p className="text-white font-medium text-sm mb-4">
              Gestioná profesores, materias y alumnos.
            </p>
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-[0.98] text-sm"
            >
              <Settings size={16} />
              Administrar
            </button>
          </div>
        )}

        {/* Lista de materias */}
        {cargando ? (
          <p className="text-[#8E8E93] animate-pulse px-2">Cargando...</p>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            {materias.length === 0 ? (
              <p className="p-6 text-center text-[#8E8E93]">No hay materias asignadas.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {materias.map(materia => (
                  <li key={materia.id}>
                    <button
                      onClick={() => iniciarSesion(materia.id)}
                      className="w-full flex justify-between items-center px-6 py-4 bg-white hover:bg-gray-50/50 active:bg-gray-100 transition-colors focus:outline-none"
                    >
                      <span className="text-[#1C1C1E] font-medium">{materia.nombre}</span>
                      <span className="flex items-center text-[#007AFF] text-sm font-medium">
                        Iniciar clase <ChevronRight size={18} className="ml-1 opacity-60" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
