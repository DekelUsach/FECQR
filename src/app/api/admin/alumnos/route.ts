import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const materiaId = searchParams.get('materia_id');

  let query = supabaseAdmin
    .from('alumnos')
    .select('id, nombre, dni, telefono, materia_id, materias(nombre)');

  if (materiaId) query = query.eq('materia_id', materiaId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const payload = await req.json();

  if (Array.isArray(payload)) {
    // Bulk insert
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
    // Single insert
    const { nombre, dni, telefono, materiaId } = payload;
    if (!nombre || !materiaId)
      return NextResponse.json({ error: 'Nombre y materia requeridos.' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('alumnos')
      .insert({ nombre, dni, telefono, materia_id: materiaId })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from('alumnos').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
