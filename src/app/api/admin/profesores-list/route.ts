import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profesores = (data.users ?? [])
    .filter(u => u.email)
    .map(u => ({ 
      id: u.id, 
      email: u.email,
      nombre: u.user_metadata?.nombre ?? '',
      dni: u.user_metadata?.dni ?? ''
    }));

  return NextResponse.json(profesores);
}
