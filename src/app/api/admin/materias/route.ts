import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('materias')
    .select('id, nombre, profesor_id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const emailMap = new Map(users.users.map(u => [u.id, u.email]));

  const result = (data ?? []).map(m => ({
    ...m,
    profesorEmail: emailMap.get(m.profesor_id ?? '') ?? '—',
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { nombre, profesorId } = await req.json();

  if (!nombre || !profesorId)
    return NextResponse.json({ error: 'Nombre y profesor requeridos.' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('materias')
    .insert({ nombre, profesor_id: profesorId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from('materias').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
