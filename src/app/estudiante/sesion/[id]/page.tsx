'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';
import { User, CheckCircle2 } from 'lucide-react';

export default function EstudianteSesionPage() {
  const params = useParams();
  const sesionId = params?.id as string;
  const [bloqueado, setBloqueado] = useState<boolean | null>(null);
  const [alumnos, setAlumnos] = useState<{ id: string; nombre: string }[]>([]);
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
          .select('id, nombre')
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
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm max-w-sm w-full text-center text-[#FF3B30] font-medium">
          {error}
        </div>
      </div>
    );
  }

  if (bloqueado === null) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center p-6 text-[#8E8E93] animate-pulse">
        Verificando...
      </div>
    );
  }

  if (bloqueado) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center p-6">
        <div className="bg-white p-10 flex flex-col items-center rounded-[2rem] shadow-sm max-w-[320px] w-full text-center">
          <CheckCircle2 size={56} className="text-[#34C759] mb-4" />
          <h2 className="text-2xl font-semibold tracking-tight text-[#1C1C1E] mb-2">Completado</h2>
          <p className="text-[#8E8E93]">Asistencia registrada exitosamente. Ya podés cerrar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F2F7]">
      <header className="pt-16 pb-4 px-6 bg-[#F2F2F7] sticky top-0 z-10">
        <h1 className="text-3xl font-bold tracking-tight text-[#1C1C1E]">Lista de Alumnos</h1>
        <p className="text-[#8E8E93] mt-1">Seleccioná tu nombre para registrarte.</p>
      </header>

      <main className="px-4 pb-12 w-full max-w-md mx-auto">
        <ul className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {alumnos.map(al => (
            <li key={al.id}>
              <button
                onClick={() => marcarAsistencia(al.id)}
                className="flex items-center w-full px-5 py-4 bg-white hover:bg-gray-50/80 active:bg-gray-100 transition-colors focus:outline-none"
              >
                <div className="w-10 h-10 rounded-full bg-gray-50 text-[#8E8E93] flex items-center justify-center mr-4 border border-gray-100">
                  <User size={20} />
                </div>
                <span className="text-lg text-[#1C1C1E] font-medium text-left flex-1">{al.nombre}</span>
              </button>
            </li>
          ))}
          {alumnos.length === 0 && (
            <div className="p-8 text-center text-[#8E8E93]">Todos los alumnos ya registraron asistencia.</div>
          )}
        </ul>
      </main>
    </div>
  );
}
