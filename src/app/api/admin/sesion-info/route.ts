import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/admin/sesion-info?sesion_id=...
 * Permite al Admin obtener los metadatos de una sesión (incluyendo relación materias)
 * sin las restricciones de RLS del cliente.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sesionId = searchParams.get('sesion_id');

  if (!sesionId)
    return NextResponse.json({ error: 'sesionId requerido.' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('sesiones')
    .select('estado, hora_inicio, hora_fin, materia_id, materias(nombre)')
    .eq('id', sesionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 });

  return NextResponse.json(data);
}
