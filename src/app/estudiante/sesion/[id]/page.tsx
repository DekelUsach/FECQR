'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { User, CheckCircle2 } from 'lucide-react';

export default function EstudianteSesionPage() {
  const params = useParams();
  const sesionId = params?.id as string;
  const [bloqueado, setBloqueado] = useState<boolean | null>(null);
  const [alumnos, setAlumnos] = useState<{ id: string; nombre: string; dni: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sesionId) return;

    const validarAcceso = async () => {
      try {
        const token = localStorage.getItem(`asistencia_${sesionId}`);
        if (token) {
          setBloqueado(true);
          return;
        }

        const { data: sesion, error: sesionError } = await supabase
          .from('sesiones')
          .select('estado, materia_id')
          .eq('id', sesionId)
          .single();

        if (sesionError) throw sesionError;
        if (sesion.estado !== 'activa') throw new Error('Sesión finalizada o inválida.');

        // Todos los alumnos de la materia
        const { data: listaAlumnos, error: alumnosError } = await supabase
          .from('alumnos')
          .select('id, nombre, dni')
          .eq('materia_id', sesion.materia_id!);

        if (alumnosError) throw alumnosError;

        // Alumnos que ya registraron asistencia en esta sesión
        const { data: asistenciasExistentes, error: asistError } = await supabase
          .from('asistencias')
          .select('alumno_id')
          .eq('sesion_id', sesionId);

        if (asistError) throw asistError;

        const yaRegistrados = new Set((asistenciasExistentes ?? []).map(a => a.alumno_id));
        const pendientes = (listaAlumnos ?? []).filter(al => !yaRegistrados.has(al.id));

        setAlumnos(pendientes);
        setBloqueado(false);
      } catch (err: any) {
        setError(err.message || 'Fallo de validación');
      }
    };

    validarAcceso();
  }, [sesionId]);

  const marcarAsistencia = async (alumnoId: string) => {
    try {
      const { error: insertError } = await supabase
        .from('asistencias')
        .insert({ sesion_id: sesionId, alumno_id: alumnoId });

      if (insertError) {
        if (insertError.code === '23505') throw new Error('Ya registraste asistencia.');
        throw insertError;
      }

      localStorage.setItem(`asistencia_${sesionId}`, 'registrada');
      setBloqueado(true);
    } catch (err: any) {
      setError(err.message || 'Error al procesar asistencia.');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-surface p-6 rounded-[2rem] shadow-sm max-w-sm w-full text-center text-[#FF3B30] font-medium">
          {error}
        </div>
      </div>
    );
  }

  if (bloqueado === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-muted animate-pulse">
        Verificando...
      </div>
    );
  }

  if (bloqueado) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="bg-surface p-10 flex flex-col items-center rounded-[2rem] shadow-sm max-w-[320px] w-full text-center">
          <CheckCircle2 size={56} className="text-[#34C759] mb-4" />
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-2">Completado</h2>
          <p className="text-muted">Asistencia registrada exitosamente. Ya podés cerrar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="pt-16 pb-4 px-6 bg-background sticky top-0 z-10 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Lista de Alumnos</h1>
          <p className="text-muted mt-1">Seleccioná tu nombre para registrarte.</p>
        </div>
        <ThemeToggle />
      </header>

      <main className="px-4 pb-12 w-full max-w-md mx-auto">
        <ul className="bg-surface rounded-2xl shadow-sm border border-subtle overflow-hidden divide-y divide-subtle">
          {alumnos.map(al => (
            <li key={al.id}>
              <button
                onClick={() => marcarAsistencia(al.id)}
                className="flex items-center w-full px-5 py-4 bg-surface hover:bg-surface-hover/80 active:bg-surface-active transition-colors focus:outline-none"
              >
                <div className="w-10 h-10 rounded-full bg-surface-hover text-muted flex items-center justify-center mr-4 border border-subtle shrink-0">
                  <User size={20} />
                </div>
                <div className="flex-1 text-left flex items-center justify-between">
                  <span className="text-lg text-foreground font-medium">{al.nombre}</span>
                  {al.dni ? (
                    <span className="text-sm font-medium text-muted bg-surface-hover px-2.5 py-1 rounded-lg border border-subtle shrink-0">
                      {al.dni}
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
          {alumnos.length === 0 && (
            <div className="p-8 text-center text-muted">Todos los alumnos ya registraron asistencia.</div>
          )}
        </ul>
      </main>
    </div>
  );
}
