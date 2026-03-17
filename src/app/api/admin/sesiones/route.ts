import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

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
