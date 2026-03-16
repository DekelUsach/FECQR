'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import { QRGenerator } from '@/components/QRGenerator';
import { exportarAsistenciaExcel, type FilaAsistencia, type MetadatosSesion } from '@/lib/exportarExcel';
import { Download } from 'lucide-react';

// Minutos de gracia antes de marcar "Tarde"
const MINUTOS_GRACIA = 15;

interface SesionData {
  estado: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  materia_id: string | null;
  materias: { nombre: string } | null;
}

export default function ProfesorSesionPage() {
  const params = useParams();
  const router = useRouter();
  const sesionId = params?.id as string;
  const [sesion, setSesion] = useState<SesionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    if (!sesionId) return;

    const fetchSesion = async () => {
      try {
        const { data, error: sesionError } = await supabase
          .from('sesiones')
          .select('estado, hora_inicio, hora_fin, materia_id, materias(nombre)')
          .eq('id', sesionId)
          .single();

        if (sesionError) throw sesionError;
        setSesion(data as unknown as SesionData);
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchSesion();
  }, [sesionId]);

  const finalizarClase = async () => {
    try {
      const { error } = await supabase
        .from('sesiones')
        .update({ estado: 'inactiva', hora_fin: new Date().toISOString() })
        .eq('id', sesionId);

      if (error) throw error;

      // Re-fetch para actualizar hora_fin en estado local antes de mostrar botón de descarga
      const { data } = await supabase
        .from('sesiones')
        .select('estado, hora_inicio, hora_fin, materia_id, materias(nombre)')
        .eq('id', sesionId)
        .single();

      setSesion(data as unknown as SesionData);
    } catch (err: any) {
      alert('Error al finalizar clase: ' + err.message);
    }
  };

  const descargarExcel = async () => {
    if (!sesion || !sesion.materia_id) return;
    setExportando(true);

    try {
      // 1. Todos los alumnos de la materia
      const { data: alumnos, error: alumnosError } = await supabase
        .from('alumnos')
        .select('id, nombre')
        .eq('materia_id', sesion.materia_id);

      if (alumnosError) throw alumnosError;

      // 2. Registros de asistencia para esta sesión
      const { data: asistencias, error: asistError } = await supabase
        .from('asistencias')
        .select('alumno_id, hora_escaneo')
        .eq('sesion_id', sesionId);

      if (asistError) throw asistError;

      const mapaAsistencias = new Map(
        (asistencias ?? []).map(a => [a.alumno_id, a.hora_escaneo])
      );

      const horaInicio = sesion.hora_inicio ? new Date(sesion.hora_inicio) : null;

      // 3. Calcular estado de cada alumno
      const filas: FilaAsistencia[] = (alumnos ?? []).map(al => {
        const horaEscaneoStr = mapaAsistencias.get(al.id);

        if (!horaEscaneoStr) {
          return { nombre: al.nombre, estado: 'Ausente', horaEscaneo: '—' };
        }

        const horaEscaneo = new Date(horaEscaneoStr);
        const minutosDelay = horaInicio
          ? (horaEscaneo.getTime() - horaInicio.getTime()) / 60000
          : 0;

        const estado: FilaAsistencia['estado'] =
          minutosDelay <= MINUTOS_GRACIA ? 'Presente' : 'Tarde';

        return {
          nombre: al.nombre,
          estado,
          horaEscaneo: horaEscaneo.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        };
      });

      const nombreMateria = sesion.materias?.nombre ?? 'Materia';
      const fechaSesion = horaInicio
        ? horaInicio.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : '—';

      const meta: MetadatosSesion = {
        materia: nombreMateria,
        fecha: fechaSesion,
        horaInicio: horaInicio
          ? horaInicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
          : '—',
        horaFin: sesion.hora_fin
          ? new Date(sesion.hora_fin).toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
      };

      exportarAsistenciaExcel(filas, meta);
    } catch (err: any) {
      alert('Error al generar Excel: ' + err.message);
    } finally {
      setExportando(false);
    }
  };

  if (error) return (
    <div className="p-6 text-[#FF3B30] text-center font-medium bg-[#F2F2F7] min-h-screen flex items-center justify-center">
      {error}
    </div>
  );

  if (!sesion) return (
    <div className="p-6 text-[#8E8E93] animate-pulse text-center bg-[#F2F2F7] min-h-screen flex items-center justify-center">
      Cargando sesión...
    </div>
  );

  // --- Vista: clase finalizada ---
  if (sesion.estado === 'inactiva') {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center p-6 gap-6">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm max-w-sm w-full text-center">
          <p className="text-lg font-semibold text-[#1C1C1E] mb-1">Clase finalizada</p>
          <p className="text-[#8E8E93] text-sm mb-6">
            {sesion.materias?.nombre ?? 'Materia desconocida'}
          </p>

          <button
            onClick={descargarExcel}
            disabled={exportando}
            className="w-full flex items-center justify-center gap-2 bg-[#34C759] hover:bg-[#34C759]/90 text-white font-semibold py-4 rounded-2xl transition-all disabled:opacity-50 active:scale-[0.98] mb-3"
          >
            <Download size={20} />
            {exportando ? 'Generando...' : 'Descargar Lista (.xlsx)'}
          </button>

          <button
            onClick={() => router.push('/profesor/dashboard')}
            className="w-full text-[#007AFF] font-medium py-3"
          >
            Volver al panel
          </button>
        </div>
      </div>
    );
  }

  // --- Vista: clase activa ---
  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-[400px] flex flex-col items-center">
        <QRGenerator sesionId={sesionId} />

        <button
          onClick={finalizarClase}
          className="mt-8 w-full max-w-[300px] bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white font-semibold py-4 rounded-2xl shadow-sm transition-all focus:ring-4 focus:ring-[#FF3B30]/30 active:scale-[0.98]"
        >
          Finalizar Clase
        </button>
      </div>
    </div>
  );
}
