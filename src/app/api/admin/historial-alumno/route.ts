import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const alumnoId = searchParams.get('alumno_id');

  if (!alumnoId)
    return NextResponse.json({ error: 'alumno_id requerido.' }, { status: 400 });

  // 1. Materia actual del alumno
  const { data: alumno, error: alumnoError } = await supabaseAdmin
    .from('alumnos')
    .select('materia_id, created_at')
    .eq('id', alumnoId)
    .single();

  if (alumnoError) return NextResponse.json({ error: alumnoError.message }, { status: 500 });
  if (!alumno?.materia_id) return NextResponse.json([]);

  // 2. Todas las sesiones de esa materia (desc)
  const { data: sesiones, error: sesionesError } = await supabaseAdmin
    .from('sesiones')
    .select('id, fecha, hora_inicio, hora_fin, estado, materias(nombre)')
    .eq('materia_id', alumno.materia_id)
    .order('hora_inicio', { ascending: false });

  if (sesionesError) return NextResponse.json({ error: sesionesError.message }, { status: 500 });
  if (!sesiones?.length) return NextResponse.json([]);

  // 3. Registros de asistencia del alumno en esta materia
  //    (filtramos por los IDs de sesión de esta materia para no traer otras)
  const sesionIds = sesiones.map(s => s.id);
  const { data: asistencias, error: asistError } = await supabaseAdmin
    .from('asistencias')
    .select('sesion_id, hora_escaneo, estado')
    .eq('alumno_id', alumnoId)
    .in('sesion_id', sesionIds);

  if (asistError) return NextResponse.json({ error: asistError.message }, { status: 500 });

  const mapaAsistencias = new Map(
    (asistencias ?? []).map(a => [a.sesion_id, { hora_escaneo: a.hora_escaneo, estado: a.estado }])
  );

  // 4. Fecha de "inicio efectivo" del alumno en esta materia:
  //    Usar la fecha de creación del alumno como punto de partida.
  const timeRef = alumno.created_at ? new Date(alumno.created_at).getTime() : 0;

  // 5. Construir historial
  //    - Si hay una asistencia registrada → siempre incluir (presente/tarde).
  //    - Si NO hay asistencia → incluir como "ausente" solo si la sesión
  //      ocurrió DESPUÉS (o igual) de la primera asistencia del alumno en la materia.
  const historial = (sesiones ?? [])
    .map(s => {
      const registro = mapaAsistencias.get(s.id);
      const sesionTs = s.hora_inicio ? new Date(s.hora_inicio).getTime() : null;

      if (registro) {
        // Estaba presente o tarde → siempre mostrar
        return {
          sesion_id: s.id,
          hora_escaneo: registro.hora_escaneo,
          estado: registro.estado,
          sesiones: { fecha: s.fecha, hora_inicio: s.hora_inicio, materias: s.materias },
        };
      }

      // No hay registro:
      // Solo marcar ausente si tenemos una referencia temporal Y
      // la sesión NO es anterior a la primera asistencia registrada.
      if (sesionTs !== null && sesionTs >= timeRef) {
        return {
          sesion_id: s.id,
          hora_escaneo: null,
          estado: 'ausente',
          sesiones: { fecha: s.fecha, hora_inicio: s.hora_inicio, materias: s.materias },
        };
      }

      // Sesión anterior a la primera asistencia → el alumno no estaba inscripto
      return null;
    })
    .filter(Boolean);

  return NextResponse.json(historial);
}
