import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const alumnoId = searchParams.get('alumno_id');

  if (!alumnoId)
    return NextResponse.json({ error: 'alumno_id requerido.' }, { status: 400 });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  // 1. Materia actual del alumno
  const { data: alumno, error: alumnoError } = await supabaseAdmin
    .from('alumnos')
    .select('materia_id, created_at')
    .eq('id', alumnoId)
    .single();

  if (alumnoError) return NextResponse.json({ error: alumnoError.message }, { status: 500 });
  if (!alumno?.materia_id) return NextResponse.json([]);

  // 2. Verificar que la materia pertenezca al profesor
  const { data: materiaPropia } = await supabaseAdmin
    .from('materias')
    .select('id')
    .eq('id', alumno.materia_id)
    .eq('profesor_id', user.id)
    .single();

  if (!materiaPropia) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });

  // 3. Obtener historial (misma lógica que admin)
  const { data: sesiones } = await supabaseAdmin
    .from('sesiones')
    .select('id, fecha, hora_inicio, hora_fin, estado, materias(nombre)')
    .eq('materia_id', alumno.materia_id)
    .order('hora_inicio', { ascending: false });

  if (!sesiones?.length) return NextResponse.json([]);

  const sesionIds = sesiones.map(s => s.id);
  const { data: asistencias } = await supabaseAdmin
    .from('asistencias')
    .select('sesion_id, hora_escaneo, estado')
    .eq('alumno_id', alumnoId)
    .in('sesion_id', sesionIds);

  const mapaAsistencias = new Map(
    (asistencias ?? []).map(a => [a.sesion_id, { hora_escaneo: a.hora_escaneo, estado: a.estado }])
  );

  const timeRef = alumno.created_at ? new Date(alumno.created_at).getTime() : 0;

  const historial = (sesiones ?? []).map(s => {
    const registro = mapaAsistencias.get(s.id);
    const sesionTs = s.hora_inicio ? new Date(s.hora_inicio).getTime() : null;

    if (registro) {
      return {
        sesion_id: s.id,
        hora_escaneo: registro.hora_escaneo,
        estado: registro.estado,
        sesiones: { fecha: s.fecha, hora_inicio: s.hora_inicio, materias: s.materias },
      };
    }

    if (sesionTs !== null && sesionTs >= timeRef) {
      return {
        sesion_id: s.id,
        hora_escaneo: null,
        estado: 'ausente',
        sesiones: { fecha: s.fecha, hora_inicio: s.hora_inicio, materias: s.materias },
      };
    }

    return null;
  }).filter(Boolean);

  return NextResponse.json(historial);
}
