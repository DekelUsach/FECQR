import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// PATCH: update subject assignment or alumno name
export async function PATCH(req: NextRequest) {
  const body = await req.json();

  // Reasignar materia a profesor
  if (body.type === 'reasignar-materia') {
    const { materiaId, profesorId } = body;
    const { error } = await supabaseAdmin
      .from('materias')
      .update({ profesor_id: profesorId })
      .eq('id', materiaId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // Cambiar materia de un alumno
  if (body.type === 'reasignar-alumno') {
    const { alumnoId, materiaId } = body;
    const { error } = await supabaseAdmin
      .from('alumnos')
      .update({ materia_id: materiaId })
      .eq('id', alumnoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // Renombrar alumno
  if (body.type === 'renombrar-alumno') {
    const { alumnoId, nombre } = body;
    const { error } = await supabaseAdmin
      .from('alumnos')
      .update({ nombre })
      .eq('id', alumnoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Tipo de operación desconocido.' }, { status: 400 });
}
