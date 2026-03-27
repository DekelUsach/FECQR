import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/admin/sesiones
 * Returns ALL currently active sessions (any subject, any professor) — admin only.
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('sesiones')
    .select(`
      id,
      hora_inicio,
      materia_id,
      materias ( nombre, profesor_id )
    `)
    .eq('estado', 'activa')
    .order('hora_inicio', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Enrich with professor email via auth.users (admin client has access)
  const profesorIds = new Set<string>();
  (data ?? []).forEach((s: any) => {
    const materia = Array.isArray(s.materias) ? s.materias[0] : s.materias;
    if (materia?.profesor_id) profesorIds.add(materia.profesor_id);
  });

  const emailMap = new Map<string, string>();
  await Promise.all(
    Array.from(profesorIds).map(async (id) => {
      const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(id);
      if (!error && user?.email) {
        emailMap.set(id, user.email);
      }
    })
  );

  const enriched = (data ?? []).map((s: any) => {
    const materia = Array.isArray(s.materias) ? s.materias[0] : s.materias;
    return {
      id: s.id,
      hora_inicio: s.hora_inicio,
      materia_id: s.materia_id,
      materia_nombre: materia?.nombre ?? 'Sin nombre',
      profesor_email: materia?.profesor_id ? (emailMap.get(materia.profesor_id) ?? null) : null,
    };
  });

  return NextResponse.json(enriched);
}

/**
 * PATCH /api/admin/sesiones
 * Allows an admin to close (finalize) ANY session via service role, bypassing RLS.
 */
export async function PATCH(req: NextRequest) {
  const { sesionId } = await req.json();

  if (!sesionId)
    return NextResponse.json({ error: 'sesionId requerido.' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('sesiones')
    .update({ estado: 'inactiva', hora_fin: new Date().toISOString() })
    .eq('id', sesionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const { materiaId } = await req.json();

  if (!materiaId)
    return NextResponse.json({ error: 'materiaId requerido.' }, { status: 400 });

  // Chequear si existe alguna
  const { data: activa } = await supabaseAdmin
    .from('sesiones')
    .select('id')
    .eq('materia_id', materiaId)
    .eq('estado', 'activa')
    .maybeSingle();

  if (activa) {
    return NextResponse.json(activa, { status: 200 });
  }

  // Insertar nueva
  const { data, error } = await supabaseAdmin
    .from('sesiones')
    .insert([{ materia_id: materiaId, estado: 'activa' }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
