import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { token, sesionId } = await req.json();

    if (!token || !sesionId) {
      return NextResponse.json({ status: 'invalid' });
    }

    // Asegurarse de que la sesión sigue abierta
    const { data: sesion } = await supabaseAdmin
      .from('sesiones')
      .select('materia_id, estado')
      .eq('id', sesionId)
      .single();

    if (!sesion || sesion.estado !== 'activa') {
      return NextResponse.json({ status: 'invalid' });
    }

    // Buscar si un alumno de esa materia tiene el token asignado y vigente
    const { data: alumno } = await supabaseAdmin
      .from('alumnos')
      .select('id, nombre')
      .eq('materia_id', sesion.materia_id)
      .eq('device_identifier', token)
      .gt('token_expires_at', new Date().toISOString())
      .single();

    if (!alumno) {
      return NextResponse.json({ status: 'invalid' });
    }

    return NextResponse.json({ status: 'valid', alumno });
  } catch (err: any) {
    return NextResponse.json({ status: 'invalid' });
  }
}
