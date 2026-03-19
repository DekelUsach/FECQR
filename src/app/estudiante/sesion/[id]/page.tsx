'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { User, CheckCircle2, AlertCircle } from 'lucide-react';

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function EstudianteSesionPage() {
  const params = useParams();
  const router = useRouter();
  const sesionId = params?.id as string;
  const [bloqueado, setBloqueado] = useState<boolean | null>(null);
  const [alumnos, setAlumnos] = useState<{ id: string; nombre: string; dni: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<boolean>(false);
  const [modoAutomatico, setModoAutomatico] = useState<boolean>(false);
  const [alumnoDetectado, setAlumnoDetectado] = useState<{ nombre: string } | null>(null);
  const [sesionFinalizada, setSesionFinalizada] = useState<boolean>(false);
  const [yaRegistrado, setYaRegistrado] = useState<boolean>(false);

  useEffect(() => {
    if (!sesionId) return;

    const validarAcceso = async () => {
      try {
        // Primero verificar que la sesión es válida y está activa
        const { data: sesion, error: sesionError } = await supabase
          .from('sesiones')
          .select('estado, materia_id')
          .eq('id', sesionId)
          .maybeSingle();

        if (sesionError) throw sesionError;
        
        if (!sesion || sesion.estado !== 'activa') {
          setSesionFinalizada(true);
          return;
        }

        // Si la sesión está activa, verificamos si ya se registró localmente
        const tokenLista = localStorage.getItem(`asistencia_${sesionId}`);
        if (tokenLista) {
          setYaRegistrado(true);
          return;
        }

        const deviceTrustToken = localStorage.getItem('device_trust_token');

        if (deviceTrustToken) {
          // Fase 1: Intentar Auto-Detección
          const resp = await fetch(`/api/estudiante/verificar-token`, {
            method: 'POST',
            body: JSON.stringify({ token: deviceTrustToken, sesionId })
          });
          
          if (resp.ok) {
            const data = await resp.json();
            if (data.status === 'valid') {
              setModoAutomatico(true);
              setAlumnoDetectado({ nombre: data.alumno.nombre });
              // Automatizar el registro instantáneamente
              await registrarAsistencia(data.alumno.id, deviceTrustToken, true);
              return;
            } else {
              // Token inválido, purgar
              localStorage.removeItem('device_trust_token');
            }
          }
        }

        // Fase 2: Flujo Clásico
        const { data: listaAlumnos, error: alumnosError } = await supabase
          .from('alumnos')
          .select('id, nombre, dni')
          .eq('materia_id', sesion.materia_id!);

        if (alumnosError) throw alumnosError;

        const { data: asistenciasExistentes, error: asistError } = await supabase
          .from('asistencias')
          .select('alumno_id')
          .eq('sesion_id', sesionId);

        if (asistError) throw asistError;

        const yaRegistrados = new Set((asistenciasExistentes ?? []).map(a => a.alumno_id));
        const pendientes = (listaAlumnos ?? []).filter(al => !yaRegistrados.has(al.id));

        setAlumnos(pendientes);
        setBloqueado(false);
      } catch (err: any) {
        setError(err.message || 'Fallo de validación');
      }
    };

    validarAcceso();
  }, [sesionId]);

  const registrarAsistencia = async (alumnoId: string, currentToken: string | null = null, esAutomatico = false) => {
    try {
      setProcesando(true);
      const { error: insertError } = await supabase
        .from('asistencias')
        .insert({ sesion_id: sesionId, alumno_id: alumnoId });

      if (insertError) {
        if (insertError.code === '23505') throw new Error('Ya registraste asistencia en esta sesión.');
        throw insertError;
      }

      let deviceTrustToken = localStorage.getItem('device_trust_token');
      if (!deviceTrustToken) {
        deviceTrustToken = generateUUID();
        localStorage.setItem('device_trust_token', deviceTrustToken);
      }

      // Disparar silent background update solo si fue manual o si no había token
      if (!esAutomatico) {
        fetch('/api/estudiante/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alumnoId, sesionId, deviceTrustToken })
        }).catch(e => console.error('Token re-enrollment err:', e));
      }

      localStorage.setItem(`asistencia_${sesionId}`, 'registrada');
      
      if (esAutomatico) {
        // Pausa calmada (estilo iOS) para que el estado de auto-validación sea comprensible
        setTimeout(() => setBloqueado(true), 1200);
      } else {
        setBloqueado(true);
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar asistencia.');
      setModoAutomatico(false);
    } finally {
      if (!esAutomatico) setProcesando(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-black/5 dark:bg-black/60 flex flex-col items-center justify-center p-6 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]">
        <div className="bg-surface/80 backdrop-blur-2xl p-10 flex flex-col items-center rounded-[2.5rem] shadow-xl max-w-[320px] w-full text-center border border-black/5 dark:border-white/10 animate-in fade-in zoom-in-[0.98] duration-700">
          
          <div className="w-16 h-16 bg-[#FF3B30] rounded-full flex items-center justify-center shadow-sm mb-6">
            <AlertCircle size={36} className="text-white" strokeWidth={2.5} />
          </div>
          
          <h2 className="text-[22px] font-semibold tracking-tight text-foreground mb-3">Algo salió mal</h2>
          
          <p className="text-[15px] leading-relaxed text-muted px-2">
            Tuvimos un error de nuestro lado. Por favor, comunícate con el profesor si lo necesitas.
          </p>

          <button 
            onClick={() => router.push('/')}
            className="mt-8 text-[15px] font-semibold text-[#007AFF] hover:opacity-70 transition-opacity"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // Vista de Éxito Estilo Apple (iOS) - Calma, fluidez y jerarquía tipográfica SF Pro
  if (bloqueado || modoAutomatico) {
    return (
      <div className="min-h-screen bg-black/5 dark:bg-black/60 flex flex-col items-center justify-center p-6 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]">
        <div className="bg-surface/80 backdrop-blur-2xl p-10 flex flex-col items-center rounded-[2.5rem] shadow-xl max-w-[320px] w-full text-center border border-black/5 dark:border-white/10 animate-in fade-in slide-in-from-bottom-2 zoom-in-[0.98] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]">
          
          <div className="w-16 h-16 bg-[#34C759] rounded-full flex items-center justify-center shadow-sm mb-6 animate-in fade-in zoom-in duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] delay-150">
            <CheckCircle2 size={36} className="text-white" strokeWidth={2.5} />
          </div>
          
          <h2 className="text-[22px] font-semibold tracking-tight text-foreground mb-2">Asistencia Confirmada</h2>
          
          {alumnoDetectado ? (
            <p className="text-[15px] leading-relaxed text-muted px-2">
              <span className="text-foreground font-medium">{alumnoDetectado.nombre}</span>, tu dispositivo fue reconocido automáticamente.
            </p>
          ) : (
            <p className="text-[15px] leading-relaxed text-muted px-2">
              Tu presencia fue registrada en el sistema exitosamente.
            </p>
          )}

        </div>
      </div>
    );
  }

  // Vista de Ya Registrado Estilo Apple (iOS)
  if (yaRegistrado) {
    return (
      <div className="min-h-screen bg-black/5 dark:bg-black/60 flex flex-col items-center justify-center p-6 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]">
        <div className="bg-surface/80 backdrop-blur-2xl p-10 flex flex-col items-center rounded-[2.5rem] shadow-xl max-w-[320px] w-full text-center border border-black/5 dark:border-white/10 animate-in fade-in slide-in-from-bottom-2 zoom-in-[0.98] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]">
          
          <div className="w-16 h-16 bg-[#007AFF] rounded-full flex items-center justify-center shadow-sm mb-6 animate-in fade-in zoom-in duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] delay-150">
            <CheckCircle2 size={36} className="text-white" strokeWidth={2.5} />
          </div>
          
          <h2 className="text-[22px] font-semibold tracking-tight text-foreground mb-2">Ya estabas registrado</h2>
          
          <p className="text-[15px] leading-relaxed text-muted px-2">
            Tu asistencia ya fue registrada previamente en esta clase.
          </p>
        </div>
      </div>
    );
  }

  // Vista de Sesión Finalizada Estilo Apple (iOS)
  if (sesionFinalizada) {
    return (
      <div className="min-h-screen bg-black/5 dark:bg-black/60 flex flex-col items-center justify-center p-6 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]">
        <div className="bg-surface/80 backdrop-blur-2xl p-10 flex flex-col items-center rounded-[2.5rem] shadow-xl max-w-[320px] w-full text-center border border-black/5 dark:border-white/10 animate-in fade-in slide-in-from-bottom-2 zoom-in-[0.98] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]">
          
          <div className="w-16 h-16 bg-[#FF3B30] rounded-full flex items-center justify-center shadow-sm mb-6 animate-in fade-in zoom-in duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] delay-150">
            <AlertCircle size={36} className="text-white" strokeWidth={2.5} />
          </div>
          
          <h2 className="text-[22px] font-semibold tracking-tight text-foreground mb-3">Clase Finalizada</h2>
          
          <p className="text-[15px] leading-relaxed text-muted px-2">
            La clase ya terminó, está cerrada y ya no se aceptan registros de asistencia.
          </p>

          <button 
            onClick={() => window.location.reload()}
            className="mt-8 text-[15px] font-semibold text-[#007AFF] hover:opacity-70 transition-opacity"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (bloqueado === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-muted font-medium tracking-wide">
        <div className="animate-pulse">Sincronizando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-black/10">
      <header className="pt-16 pb-4 px-6 bg-background/80 backdrop-blur-md sticky top-0 z-10 flex justify-between items-start border-b border-subtle/50 transition-colors duration-300">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Lista de Alumnos</h1>
          <p className="text-muted mt-1 text-[15px]">Seleccioná tu nombre para registrarte.</p>
        </div>
        <ThemeToggle />
      </header>

      <main className="px-4 pb-12 w-full max-w-md mx-auto pt-6">
        <ul className="bg-surface rounded-[2rem] shadow-sm border border-subtle overflow-hidden divide-y divide-subtle">
          {alumnos.map(al => (
            <li key={al.id}>
              <button
                disabled={procesando}
                onClick={() => registrarAsistencia(al.id, null, false)}
                className="flex items-center w-full px-5 py-4 bg-surface hover:bg-surface-hover/80 active:bg-surface-hover active:scale-[0.98] transition-all duration-200 ease-out focus:outline-none disabled:opacity-50"
              >
                <div className="w-11 h-11 rounded-full bg-black/5 dark:bg-white/10 text-foreground/70 flex items-center justify-center mr-4 shrink-0">
                  <User size={22} strokeWidth={2} />
                </div>
                <div className="flex-1 text-left flex items-center justify-between">
                  <span className="text-[17px] text-foreground font-medium tracking-tight truncate pr-4">{al.nombre}</span>
                  {al.dni ? (
                    <span className="text-[13px] font-semibold tracking-wide text-muted bg-black/5 dark:bg-white/10 px-3 py-1.5 rounded-full shrink-0">
                      {al.dni}
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
          {alumnos.length === 0 && (
            <div className="p-10 text-center text-muted font-medium text-[15px]">
              Todos los alumnos ya registraron asistencia.
            </div>
          )}
        </ul>
      </main>
    </div>
  );
}
