'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import { QRGenerator } from '@/components/QRGenerator';
import { exportarAsistenciaExcel, type FilaAsistencia, type MetadatosSesion } from '@/lib/exportarExcel';
import { Download, RefreshCw, CheckCircle2, Clock, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ThemeToggle } from '@/components/ThemeToggle';

const MINUTOS_GRACIA = 15;

interface SesionData {
  estado: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  materia_id: string | null;
  materias: { nombre: string } | null;
}

interface AlumnoAsistencia {
  id: string;
  nombre: string;
  estado: 'presente' | 'tarde' | 'ausente';
  hora_escaneo: string | null;
  asistencia_id: string | null;
}

const ESTADO_CONFIG = {
  presente: { label: 'Presente', icon: CheckCircle2, color: 'text-[#34C759]', bg: 'bg-[#34C759]/10' },
  tarde:    { label: 'Tarde',    icon: Clock,         color: 'text-[#FF9500]', bg: 'bg-[#FF9500]/10' },
  ausente:  { label: 'Ausente', icon: XCircle,        color: 'text-[#FF3B30]', bg: 'bg-[#FF3B30]/10' },
};
const ESTADOS = ['presente', 'tarde', 'ausente'] as const;

export default function ProfesorSesionPage() {
  const params = useParams();
  const router = useRouter();
  const sesionId = params?.id as string;

  const [sesion, setSesion] = useState<SesionData | null>(null);
  const [alumnos, setAlumnos] = useState<AlumnoAsistencia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [cambiando, setCambiando] = useState<string | null>(null); // alumnoId en proceso

  // ── Fetch sesión ──────────────────────────────────────────────────────────
  const fetchSesion = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('sesiones')
      .select('estado, hora_inicio, hora_fin, materia_id, materias(nombre)')
      .eq('id', sesionId)
      .single();
    if (e) { setError(e.message); return; }
    setSesion(data as unknown as SesionData);
  }, [sesionId]);

  // ── Fetch lista de asistencia ─────────────────────────────────────────────
  const fetchAsistencia = useCallback(async () => {
    const res = await fetch(`/api/profesor/asistencia?sesion_id=${sesionId}&t=${Date.now()}`);
    const json = await res.json();
    if (!res.ok) { setError(json.error); return; }
    setAlumnos(json.lista as AlumnoAsistencia[]);
  }, [sesionId]);

  useEffect(() => {
    if (!sesionId) return;
    
    console.log('Iniciando suscripción Realtime para sesión:', sesionId);
    fetchSesion();
    fetchAsistencia();

    const channel = supabase
      .channel(`asistencias_${sesionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asistencias',
          filter: `sesion_id=eq.${sesionId}`
        },
        (payload) => {
          console.log('🔔 Cambio en asistencia detected:', payload);
          fetchAsistencia();
        }
      )
      .subscribe((status) => {
        console.log('📡 Estado conexión Realtime:', status);
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error de canal Realtime. Verifique RLS y publicación.');
        }
      });

    return () => {
      console.log('Cerrando suscripción Realtime');
      supabase.removeChannel(channel);
    };
  }, [sesionId, fetchSesion, fetchAsistencia]);

  // ── Cambiar estado individual ─────────────────────────────────────────────
  const cambiarEstado = async (alumnoId: string, nuevoEstado: typeof ESTADOS[number]) => {
    setCambiando(alumnoId);
    try {
      const res = await fetch('/api/profesor/asistencia', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesionId, alumnoId, estado: nuevoEstado }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      // Actualizar local sin refetch completo
      setAlumnos(prev => prev.map(a =>
        a.id === alumnoId ? { ...a, estado: nuevoEstado } : a
      ));
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setCambiando(null);
    }
  };

  // ── Finalizar clase ───────────────────────────────────────────────────────
  const finalizarClase = async () => {
    const { error: e } = await supabase
      .from('sesiones')
      .update({ estado: 'inactiva', hora_fin: new Date().toISOString() })
      .eq('id', sesionId);
    if (e) { alert('Error al finalizar: ' + e.message); return; }
    await fetchSesion();
  };

  // ── Descargar Excel ───────────────────────────────────────────────────────
  const descargarExcel = async () => {
    if (!sesion) return;
    setExportando(true);
    try {
      const horaInicio = sesion.hora_inicio ? new Date(sesion.hora_inicio) : null;
      const filas: FilaAsistencia[] = alumnos.map(al => {
        const estadoCapitalized = al.estado.charAt(0).toUpperCase() + al.estado.slice(1);
        if (!al.hora_escaneo) return { nombre: al.nombre, estado: estadoCapitalized as any, horaEscaneo: '—' };
        const ts = new Date(al.hora_escaneo);
        return {
          nombre: al.nombre,
          estado: estadoCapitalized as any,
          horaEscaneo: ts.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
      });

      const meta: MetadatosSesion = {
        materia: sesion.materias?.nombre ?? 'Materia',
        fecha: horaInicio ? horaInicio.toLocaleDateString('es-AR') : '—',
        horaInicio: horaInicio ? horaInicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—',
        horaFin: sesion.hora_fin ? new Date(sesion.hora_fin).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—',
      };
      exportarAsistenciaExcel(filas, meta);
    } catch (e: any) {
      alert('Error al generar Excel: ' + e.message);
    } finally {
      setExportando(false);
    }
  };

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 text-[#FF3B30] font-medium text-center">
      {error}
    </div>
  );
  if (!sesion) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 text-muted animate-pulse">
      Cargando...
    </div>
  );

  const activa = sesion.estado === 'activa';
  const stats = {
    presentes: alumnos.filter(a => a.estado === 'presente').length,
    tardes:    alumnos.filter(a => a.estado === 'tarde').length,
    ausentes:  alumnos.filter(a => a.estado === 'ausente').length,
  };

  return (
    <div className="min-h-screen bg-background pb-20 animate-fade-in">
      {/* Header */}
      <header className="pt-14 pb-4 px-6 flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted mb-1">
            {activa ? '🟢 Clase activa' : '🔴 Clase finalizada'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {sesion.materias?.nombre ?? 'Sesión'}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-3">
          <ThemeToggle />
          <button onClick={fetchAsistencia} className="p-2 text-[#007AFF] hover:bg-surface-hover rounded-xl transition-colors">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <main className="px-4 max-w-2xl mx-auto space-y-4">
        {/* QR — solo clase activa */}
        {activa && (
          <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle p-4 flex justify-center animate-slide-up" style={{ animationDelay: '50ms', opacity: 0, animationFillMode: 'forwards' }}>
            <QRGenerator sesionId={sesionId} />
          </div>
        )}

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 gap-2 animate-slide-up" style={{ animationDelay: '100ms', opacity: 0, animationFillMode: 'forwards' }}>
          {(['presentes', 'tardes', 'ausentes'] as const).map((k, i) => {
            const labels = ['Presentes', 'Tardes', 'Ausentes'];
            const colors = ['text-[#34C759]', 'text-[#FF9500]', 'text-[#FF3B30]'];
            return (
              <div key={k} className="bg-surface rounded-2xl p-3 text-center shadow-sm border border-subtle">
                <p className={`text-2xl font-bold ${colors[i]}`}>{stats[k]}</p>
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wide mt-0.5">{labels[i]}</p>
              </div>
            );
          })}
        </div>

        {/* Lista de alumnos */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-1 mb-2">
            Asistencia ({alumnos.length} alumnos)
          </p>
          <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle divide-y divide-subtle">
            {alumnos.length === 0 && (
              <p className="p-6 text-center text-muted text-sm">Sin alumnos en este curso.</p>
            )}
            {alumnos.map((al, i) => {
              const cfg = ESTADO_CONFIG[al.estado];
              const Icon = cfg.icon;
              const enCambio = cambiando === al.id;
              return (
                <div key={al.id} className="px-5 py-3 animate-slide-up" style={{ animationDelay: `${150 + i * 30}ms`, opacity: 0, animationFillMode: 'forwards' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <Icon size={18} className={cfg.color} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{al.nombre}</p>
                        {al.hora_escaneo && (
                          <p className="text-xs text-muted">
                            {new Date(al.hora_escaneo).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Selector de estado — siempre visible (activa o historial) */}
                    <div className="flex gap-1 shrink-0">
                      {ESTADOS.map(estado => {
                        const c = ESTADO_CONFIG[estado];
                        const activo = al.estado === estado;
                        return (
                          <button
                            key={estado}
                            disabled={enCambio}
                            onClick={() => cambiarEstado(al.id, estado)}
                            title={c.label}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 tap-scale ${
                              activo ? c.bg + ' ring-1 ring-inset ' + c.color : 'bg-surface-hover text-placeholder hover:bg-gray-100'
                            }`}
                          >
                            <c.icon size={15} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Acciones */}
        <div className="space-y-2 pt-2 animate-slide-up" style={{ animationDelay: '200ms', opacity: 0, animationFillMode: 'forwards' }}>
          <button
            onClick={descargarExcel}
            disabled={exportando}
            className="w-full flex items-center justify-center gap-2 bg-[#34C759] hover:bg-[#34C759]/90 text-white font-semibold py-4 rounded-2xl disabled:opacity-50 tap-scale hover-scale"
          >
            <Download size={19} />
            {exportando ? 'Generando...' : 'Descargar Lista (.xlsx)'}
          </button>

          {activa && (
            <button
              onClick={finalizarClase}
              className="w-full bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white font-semibold py-4 rounded-2xl tap-scale hover-scale"
            >
              Finalizar Clase
            </button>
          )}

          <button
            onClick={() => router.push('/profesor/dashboard')}
            className="w-full text-[#007AFF] font-medium py-3 rounded-xl hover:bg-[#007AFF]/5 transition-colors tap-scale"
          >
            Volver al panel
          </button>
        </div>
      </main>
    </div>
  );
}
