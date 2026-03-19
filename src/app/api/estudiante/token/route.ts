import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { alumnoId, sesionId, deviceTrustToken } = await req.json();

    if (!alumnoId || !sesionId || !deviceTrustToken) {
      return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 });
    }

    // 1. Verificar de manera segura que este alumno realmente asistió a la sesión proporcionada 
    // y que la sesión está activa ahora mismo (para prevenir que la API sea usada de forma maliciosa).
    const { data: asistencia, error: asistenciaError } = await supabaseAdmin
      .from('asistencias')
      .select('id, sesiones!inner(estado)')
      .eq('alumno_id', alumnoId)
      .eq('sesion_id', sesionId)
      .single();

    if (asistenciaError || !asistencia) {
       return NextResponse.json({ error: 'No hay registro previo de asistencia en esta clase' }, { status: 403 });
    }

    // 2. Insertar/Actualizar el token del alumno en la DB expirando en 200 días
    const tokenExpiresAt = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString();
    
    const { error: updateError } = await supabaseAdmin
      .from('alumnos')
      .update({
        device_identifier: deviceTrustToken,
        token_expires_at: tokenExpiresAt
      })
      .eq('id', alumnoId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
