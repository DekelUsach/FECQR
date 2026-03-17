import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('materias')
    .select('id, nombre, profesor_id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch professor emails from auth
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const emailMap = new Map(users.users.map(u => [u.id, u.email]));

  const result = (data ?? []).map(m => ({
    ...m,
    profesorEmail: emailMap.get(m.profesor_id ?? '') ?? '—',
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { email, password, nombre, dni } = await req.json();

  if (!email || !password)
    return NextResponse.json({ error: 'Email y contraseña requeridos.' }, { status: 400 });

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, dni }
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ user: data.user }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { userId, email, password, nombre, dni } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });

  const updates: any = {};
  if (email) updates.email = email;
  if (password) updates.password = password;
  if (nombre !== undefined || dni !== undefined) {
    updates.user_metadata = {};
    if (nombre !== undefined) updates.user_metadata.nombre = nombre;
    if (dni !== undefined) updates.user_metadata.dni = dni;
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await req.json();
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
