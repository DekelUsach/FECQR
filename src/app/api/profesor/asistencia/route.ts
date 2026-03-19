import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
export const dynamic = 'force-dynamic';

// Helper: verifica que la sesión pertenezca al profesor logueado
async function getProfesorAndVerify(req: NextRequest, sesionId: string) {
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
  if (!user) return { error: 'No autenticado.', status: 401 };

  // Verificar que la sesión pertenece a una materia del profesor
  const { data: sesion } = await supabaseAdmin
    .from('sesiones')
    .select('id, estado, materia_id, materias(profesor_id)')
    .eq('id', sesionId)
    .single();

  if (!sesion) return { error: 'Sesión no encontrada.', status: 404 };

  const profesorId = (sesion.materias as any)?.profesor_id;

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';
  const isAdmin = user.email === adminEmail;

  if (profesorId !== user.id && !isAdmin) return { error: 'Acceso denegado.', status: 403 };

  return { sesion, user };
}

// GET: lista todos los alumnos de la sesión con su estado de asistencia
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sesionId = searchParams.get('sesion_id');
  if (!sesionId) return NextResponse.json({ error: 'sesion_id requerido.' }, { status: 400 });

  const result = await getProfesorAndVerify(req, sesionId);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { sesion } = result;

  // Todos los alumnos de la materia
  const { data: alumnos } = await supabaseAdmin
    .from('alumnos')
    .select('id, nombre')
    .eq('materia_id', sesion.materia_id!);

  // Asistencias ya registradas
  const { data: asistencias } = await supabaseAdmin
    .from('asistencias')
    .select('alumno_id, estado, hora_escaneo, id')
    .eq('sesion_id', sesionId);

  const mapaAsist = new Map(
    (asistencias ?? []).map(a => [a.alumno_id, a])
  );

  const lista = (alumnos ?? []).map(al => {
    const reg = mapaAsist.get(al.id);
    return {
      id: al.id,
      nombre: al.nombre,
      estado: reg?.estado ?? 'ausente',
      hora_escaneo: reg?.hora_escaneo ?? null,
      asistencia_id: reg?.id ?? null,
    };
  });

  return NextResponse.json({ lista, sesionEstado: sesion.estado });
}

// PATCH: upsert estado de asistencia de un alumno en una sesión
export async function PATCH(req: NextRequest) {
  const { sesionId, alumnoId, estado } = await req.json();
  if (!sesionId || !alumnoId || !estado)
    return NextResponse.json({ error: 'Faltan campos.' }, { status: 400 });

  const result = await getProfesorAndVerify(req, sesionId);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  // Intentar actualizar si ya existe, si no insertar
  const { data: existente } = await supabaseAdmin
    .from('asistencias')
    .select('id')
    .eq('sesion_id', sesionId)
    .eq('alumno_id', alumnoId)
    .single();

  if (existente) {
    const { error } = await supabaseAdmin
      .from('asistencias')
      .update({ estado })
      .eq('id', existente.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { error } = await supabaseAdmin
      .from('asistencias')
      .insert({ sesion_id: sesionId, alumno_id: alumnoId, estado });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
