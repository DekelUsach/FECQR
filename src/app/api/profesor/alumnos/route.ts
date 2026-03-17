import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

// Helper: verifica que el profesor logueado sea el dueño de la materia
async function getProfesorYMateria(req: NextRequest) {
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

  const { data: materias } = await supabaseAdmin
    .from('materias')
    .select('id')
    .eq('profesor_id', user.id);

  const materiaIds = (materias ?? []).map(m => m.id);
  return { user, materiaIds };
}

// GET: listar alumnos del profesor (con filtro opcional de materia)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const materiaId = searchParams.get('materia_id');

  const result = await getProfesorYMateria(req);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { materiaIds } = result;
  if (!materiaIds.length) return NextResponse.json([]);

  // Si se pide una materia específica, verificar que le pertenece al profesor
  if (materiaId && !materiaIds.includes(materiaId))
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });

  const ids = materiaId ? [materiaId] : materiaIds;

  const { data, error } = await supabaseAdmin
    .from('alumnos')
    .select('id, nombre, dni, telefono, materia_id, materias(nombre)')
    .in('materia_id', ids)
    .order('nombre');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST: agregar alumno a la materia del profesor
export async function POST(req: NextRequest) {
  const payload = await req.json();

  const result = await getProfesorYMateria(req);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  if (Array.isArray(payload)) {
    // Bulk
    for (const p of payload) {
      if (!p.nombre || !p.materiaId || !result.materiaIds.includes(p.materiaId)) {
        return NextResponse.json({ error: 'Materia denegada o nombre faltante en listado.' }, { status: 403 });
      }
    }
    const rows = payload.map(p => ({
      nombre: p.nombre,
      dni: p.dni,
      telefono: p.telefono,
      materia_id: p.materiaId
    }));
    const { data, error } = await supabaseAdmin.from('alumnos').insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  } else {
    // Single
    const { nombre, dni, telefono, materiaId } = payload;
    if (!nombre || !materiaId)
      return NextResponse.json({ error: 'Nombre y materiaId requeridos.' }, { status: 400 });

    if (!result.materiaIds.includes(materiaId))
      return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from('alumnos')
      .insert({ nombre, dni, telefono, materia_id: materiaId })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  }
}

// PATCH: renombrar alumno o cambiarlo de materia (solo a materias del profesor)
export async function PATCH(req: NextRequest) {
  const { alumnoId, nombre, dni, telefono, materiaId } = await req.json();
  if (!alumnoId)
    return NextResponse.json({ error: 'alumnoId requerido.' }, { status: 400 });

  const result = await getProfesorYMateria(req);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { data: alumno } = await supabaseAdmin
    .from('alumnos')
    .select('materia_id')
    .eq('id', alumnoId)
    .single();

  if (!alumno || !result.materiaIds.includes(alumno.materia_id!))
    return NextResponse.json({ error: 'Acceso denegado a este alumno.' }, { status: 403 });

  if (materiaId && !result.materiaIds.includes(materiaId))
    return NextResponse.json({ error: 'Materia destino denegada.' }, { status: 403 });

  const updates: any = {};
  if (nombre) updates.nombre = nombre;
  if (dni !== undefined) updates.dni = dni;
  if (telefono !== undefined) updates.telefono = telefono;
  if (materiaId) updates.materia_id = materiaId;

  const { error } = await supabaseAdmin.from('alumnos').update(updates).eq('id', alumnoId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE: eliminar alumno (solo si es del profesor)
export async function DELETE(req: NextRequest) {
  const { alumnoId } = await req.json();
  if (!alumnoId) return NextResponse.json({ error: 'alumnoId requerido.' }, { status: 400 });

  const result = await getProfesorYMateria(req);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { data: alumno } = await supabaseAdmin
    .from('alumnos')
    .select('materia_id')
    .eq('id', alumnoId)
    .single();

  if (!alumno || !result.materiaIds.includes(alumno.materia_id!))
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });

  const { error } = await supabaseAdmin.from('alumnos').delete().eq('id', alumnoId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
