'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Pencil,
  ArrowRightLeft, Clock, CheckCircle2, XCircle, AlertCircle,
  Search, X, GraduationCap, Download
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alumno {
  id: string; nombre: string; dni: string | null; telefono: string | null;
  materia_id: string | null;
  materias: { nombre: string } | null;
}
interface HistorialEntry {
  sesion_id: string; hora_escaneo: string | null; estado: string | null;
  sesiones: { fecha: string | null; hora_inicio: string | null; materias: { nombre: string } | null } | null;
}
interface Materia { id: string; nombre: string }

type View = 'lista' | 'detalle';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Error desconocido');
  return json;
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C1C1E] text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-slide-up">
      <CheckCircle2 size={15} className="text-[#34C759] shrink-0" /> {msg}
      <button onClick={onClose}><X size={14} className="opacity-40 ml-1" /></button>
    </div>
  );
}

// ─── Vista Detalle Alumno ─────────────────────────────────────────────────────

function DetalleAlumno({
  alumno, onVolver, materias, onToast, onAlumnoActualizado, onAlumnoEliminado
}: {
  alumno: Alumno; onVolver: () => void;
  materias: Materia[]; onToast: (m: string) => void;
  onAlumnoActualizado: (a: Alumno) => void; onAlumnoEliminado: (id: string) => void;
}) {
  const [nuevoNombre, setNuevoNombre] = useState(alumno.nombre);
  const [nuevoDni, setNuevoDni] = useState(alumno.dni ?? '');
  const [nuevoTelefono, setNuevoTelefono] = useState(alumno.telefono ?? '');
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [editandoDni, setEditandoDni] = useState(false);
  const [editandoTelefono, setEditandoTelefono] = useState(false);
  const [nuevaMateria, setNuevaMateria] = useState(alumno.materia_id ?? '');
  const [editandoMateria, setEditandoMateria] = useState(false);
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [cargandoHist, setCargandoHist] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const dniRef = useRef<HTMLInputElement>(null);
  const telefonoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        setHistorial(await apiFetch(`/api/profesor/historial-alumno?alumno_id=${alumno.id}`));
      } catch { }
      finally { setCargandoHist(false); }
    })();
  }, [alumno.id]);

  const renombrar = async () => {
    if (!nuevoNombre.trim() || nuevoNombre === alumno.nombre) return;
    try {
      await apiFetch('/api/profesor/alumnos', {
        method: 'PATCH',
        body: JSON.stringify({ alumnoId: alumno.id, nombre: nuevoNombre.trim() }),
      });
      onToast('Nombre actualizado.');
      setEditandoNombre(false);
      onAlumnoActualizado({ ...alumno, nombre: nuevoNombre.trim() });
    } catch (e: any) { alert(e.message); }
  };

  const modificarDni = async () => {
    if (nuevoDni.trim() === (alumno.dni ?? '')) return;
    try {
      await apiFetch('/api/profesor/alumnos', {
        method: 'PATCH',
        body: JSON.stringify({ alumnoId: alumno.id, dni: nuevoDni.trim() }),
      });
      onToast('DNI actualizado.');
      setEditandoDni(false);
      onAlumnoActualizado({ ...alumno, dni: nuevoDni.trim() });
    } catch (e: any) { alert(e.message); }
  };

  const modificarTelefono = async () => {
    if (nuevoTelefono.trim() === (alumno.telefono ?? '')) return;
    try {
      await apiFetch('/api/profesor/alumnos', {
        method: 'PATCH',
        body: JSON.stringify({ alumnoId: alumno.id, telefono: nuevoTelefono.trim() }),
      });
      onToast('Teléfono actualizado.');
      setEditandoTelefono(false);
      onAlumnoActualizado({ ...alumno, telefono: nuevoTelefono.trim() });
    } catch (e: any) { alert(e.message); }
  };

  const reasignar = async () => {
    if (!nuevaMateria || nuevaMateria === alumno.materia_id) return;
    try {
      await apiFetch('/api/profesor/alumnos', {
        method: 'PATCH',
        body: JSON.stringify({ alumnoId: alumno.id, materiaId: nuevaMateria }),
      });
      const mat = materias.find(m => m.id === nuevaMateria);
      onToast(`Movido a ${mat?.nombre ?? 'nueva materia'}.`);
      setEditandoMateria(false);
      onAlumnoActualizado({ ...alumno, materia_id: nuevaMateria, materias: { nombre: mat?.nombre ?? '' } });
    } catch (e: any) { alert(e.message); }
  };

  const eliminar = async () => {
    if (!confirm(`¿Eliminar a ${alumno.nombre}?`)) return;
    try {
      await apiFetch('/api/profesor/alumnos', {
        method: 'DELETE',
        body: JSON.stringify({ alumnoId: alumno.id }),
      });
      onToast('Alumno eliminado.');
      onAlumnoEliminado(alumno.id);
      onVolver();
    } catch (e: any) { alert(e.message); }
  };

  const materiaActual = materias.find(m => m.id === alumno.materia_id);

  return (
    <div className="animate-slide-right">
      <button
        onClick={onVolver}
        className="flex items-center gap-1 text-[#007AFF] font-medium mb-5 text-sm active:opacity-70 transition-opacity hover-scale"
      >
        <ChevronLeft size={19} /> Alumnos
      </button>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] font-bold text-xl shrink-0">
            {alumno.nombre[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{alumno.nombre}</h2>
            <p className="text-sm text-muted">{(alumno.materias as any)?.nombre ?? '—'}</p>
          </div>
        </div>
        <button
          onClick={eliminar}
          className="p-2.5 text-[#FF3B30] hover:bg-red-50 rounded-xl transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Editar */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-1 mb-2">Editar</p>
      <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle divide-y divide-subtle mb-6">
        {/* Nombre */}
        <div className="px-5 py-4">
          <div className="flex justify-between items-center">
            <span className="text-foreground font-medium">Nombre</span>
            <button
              onClick={() => { setEditandoNombre(!editandoNombre); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="flex items-center gap-1 text-[#007AFF] text-sm font-medium"
            >
              <Pencil size={14} /> Editar
            </button>
          </div>
          <p className="text-sm text-muted mt-0.5">{alumno.nombre}</p>
          {editandoNombre && (
            <div className="mt-3 flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && renombrar()}
                className="flex-1 rounded-xl border border-strong px-3 py-2 text-sm bg-surface-hover focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 animate-fade-in"
              />
              <button onClick={renombrar} className="px-4 py-2 bg-[#007AFF] text-white text-sm font-semibold rounded-xl tap-scale animate-fade-in">OK</button>
            </div>
          )}
        </div>

        {/* DNI */}
        <div className="px-5 py-4">
          <div className="flex justify-between items-center">
            <span className="text-foreground font-medium">DNI</span>
            <button
              onClick={() => { setEditandoDni(!editandoDni); setTimeout(() => dniRef.current?.focus(), 50); }}
              className="flex items-center gap-1 text-[#007AFF] text-sm font-medium"
            >
              <Pencil size={14} /> Editar
            </button>
          </div>
          <p className="text-sm text-muted mt-0.5">{alumno.dni || '—'}</p>
          {editandoDni && (
            <div className="mt-3 flex gap-2">
              <input
                ref={dniRef}
                type="text"
                value={nuevoDni}
                onChange={e => setNuevoDni(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && modificarDni()}
                placeholder="DNI del alumno"
                className="flex-1 rounded-xl border border-strong px-3 py-2 text-sm bg-surface-hover focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 animate-fade-in"
              />
              <button onClick={modificarDni} className="px-4 py-2 bg-[#007AFF] text-white text-sm font-semibold rounded-xl tap-scale animate-fade-in">OK</button>
            </div>
          )}
        </div>

        {/* Teléfono */}
        <div className="px-5 py-4">
          <div className="flex justify-between items-center">
            <span className="text-foreground font-medium">Teléfono</span>
            <button
              onClick={() => { setEditandoTelefono(!editandoTelefono); setTimeout(() => telefonoRef.current?.focus(), 50); }}
              className="flex items-center gap-1 text-[#007AFF] text-sm font-medium"
            >
              <Pencil size={14} /> Editar
            </button>
          </div>
          <p className="text-sm text-muted mt-0.5">{alumno.telefono || '—'}</p>
          {editandoTelefono && (
            <div className="mt-3 flex gap-2">
              <input
                ref={telefonoRef}
                type="text"
                value={nuevoTelefono}
                onChange={e => setNuevoTelefono(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && modificarTelefono()}
                placeholder="Teléfono del alumno"
                className="flex-1 rounded-xl border border-strong px-3 py-2 text-sm bg-surface-hover focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 animate-fade-in"
              />
              <button onClick={modificarTelefono} className="px-4 py-2 bg-[#007AFF] text-white text-sm font-semibold rounded-xl tap-scale animate-fade-in">OK</button>
            </div>
          )}
        </div>

        {/* Materia */}
        <div className="px-5 py-4">
          <div className="flex justify-between items-center">
            <span className="text-foreground font-medium">Materia</span>
            <button
              onClick={() => setEditandoMateria(!editandoMateria)}
              className="flex items-center gap-1 text-[#007AFF] text-sm font-medium"
            >
              <ArrowRightLeft size={14} /> Cambiar
            </button>
          </div>
          <p className="text-sm text-muted mt-0.5">{materiaActual?.nombre ?? '—'}</p>
          {editandoMateria && (
            <div className="mt-3 flex gap-2">
              <select
                value={nuevaMateria}
                onChange={e => setNuevaMateria(e.target.value)}
                className="flex-1 rounded-xl border border-strong px-3 py-2 text-sm bg-surface-hover focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 animate-fade-in"
              >
                <option value="">— Elegir materia —</option>
                {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
              <button onClick={reasignar} className="px-4 py-2 bg-[#007AFF] text-white text-sm font-semibold rounded-xl tap-scale animate-fade-in">OK</button>
            </div>
          )}
        </div>
      </div>

      {/* Historial */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-1 mb-2">Historial de Asistencia</p>
      {cargandoHist ? (
        <p className="text-muted text-sm animate-pulse px-1">Cargando...</p>
      ) : historial.length === 0 ? (
        <div className="bg-surface rounded-2xl p-8 text-center text-muted text-sm shadow-sm border border-subtle">
          Sin registros de asistencia.
        </div>
      ) : (
        <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle divide-y divide-subtle">
          {historial.map(h => {
            const horaStr = h.hora_escaneo
              ? new Date(h.hora_escaneo).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
              : '—';
            const fechaStr = h.sesiones?.fecha
              ? new Date(h.sesiones.fecha + 'T00:00:00').toLocaleDateString('es-AR', {
                weekday: 'short', day: '2-digit', month: 'short',
              })
              : h.hora_escaneo
                ? new Date(h.hora_escaneo).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })
                : '—';

            const cfg = {
              presente: { Icon: CheckCircle2, color: 'text-[#34C759]', label: 'Presente' },
              ausente: { Icon: XCircle, color: 'text-[#FF3B30]', label: 'Ausente' },
              tarde: { Icon: AlertCircle, color: 'text-[#FF9500]', label: 'Tarde' },
            }[h.estado ?? 'ausente'] ?? { Icon: XCircle, color: 'text-[#FF3B30]', label: 'Ausente' };

            return (
              <div key={h.sesion_id} className="flex items-start gap-3 px-5 py-4">
                <cfg.Icon size={18} className={`mt-0.5 shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{h.sesiones?.materias?.nombre ?? '—'}</p>
                  <p className="text-xs text-muted mt-0.5 capitalize">{fechaStr} · {horaStr}</p>
                </div>
                <span className={`text-xs font-semibold shrink-0 ${cfg.color}`}>{cfg.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function CursoPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('lista');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [alumnoSel, setAlumnoSel] = useState<Alumno | null>(null);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [materiaId, setMateriaId] = useState('');
  const [filtroMateria, setFiltroMateria] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoDni, setNuevoDni] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const [alus, mats] = await Promise.all([
        apiFetch('/api/profesor/alumnos'),
        apiFetch('/api/profesor/materias'),
      ]);
      setAlumnos(alus);
      // mats ya contiene solo las materias del profesor
      setMaterias(mats as Materia[]);
      if (mats.length === 1) setMateriaId(mats[0].id);
    } catch (e: any) { alert(e.message); }
    finally { setCargando(false); }
  }, [router]);

  useEffect(() => { cargar(); }, [cargar]);

  const agregar = async () => {
    if (!nuevoNombre.trim() || !materiaId) { alert('Completá el nombre y la materia.'); return; }
    setLoading(true);
    try {
      await apiFetch('/api/profesor/alumnos', {
        method: 'POST',
        body: JSON.stringify({ nombre: nuevoNombre.trim(), dni: nuevoDni.trim(), telefono: nuevoTelefono.trim(), materiaId }),
      });
      setToast(`${nuevoNombre.trim()} agregado.`);
      setNuevoNombre('');
      setNuevoDni('');
      setNuevoTelefono('');
      setAgregando(false);
      cargar();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const eliminarAlumno = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar a ${nombre} permanentemente?`)) return;
    try {
      await apiFetch('/api/profesor/alumnos', {
        method: 'DELETE',
        body: JSON.stringify({ alumnoId: id }),
      });
      setToast(`Alumno ${nombre} eliminado.`);
      cargar();
    } catch (e: any) { alert(e.message); }
  };

  const procesarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!materiaId) {
      alert('Por favor selecciona una materia primero antes de subir el archivo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSubiendoArchivo(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Formato esperado: Alumno | DNI | Telefono
      const alumnosPayload = json.slice(1) // omit headers
        .filter(row => row[0]) // debe tener nombre
        .map(row => ({
          nombre: String(row[0] || '').trim(),
          dni: String(row[1] || '').trim(),
          telefono: String(row[2] || '').trim(),
          materiaId: materiaId
        }));

      if (alumnosPayload.length === 0) {
        alert('El archivo está vacío o no tiene el formato correcto.');
        return;
      }

      await apiFetch('/api/profesor/alumnos', {
        method: 'POST',
        body: JSON.stringify(alumnosPayload),
      });

      setToast(`${alumnosPayload.length} alumnos agregados.`);
      setAgregando(false);
      cargar();
    } catch (err: any) {
      alert(`Error al procesar archivo: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSubiendoArchivo(false);
    }
  };

  const filtrados = alumnos.filter(a => {
    const cumpleBusqueda = a.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const cumpleMateria = filtroMateria ? a.materia_id === filtroMateria : true;
    return cumpleBusqueda && cumpleMateria;
  });

  if (view === 'detalle' && alumnoSel) {
    return (
      <div className="min-h-screen bg-background pb-16">
        {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
        <header className="pt-14 pb-4 px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestión de Curso</h1>
        </header>
        <main className="px-4 max-w-2xl mx-auto">
          <DetalleAlumno
            alumno={alumnoSel}
            materias={materias}
            onVolver={() => { setView('lista'); setAlumnoSel(null); }}
            onToast={setToast}
            onAlumnoActualizado={a => {
              setAlumnos(prev => prev.map(al => al.id === a.id ? a : al));
              setAlumnoSel(a);
            }}
            onAlumnoEliminado={id => setAlumnos(prev => prev.filter(al => al.id !== id))}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 animate-fade-in">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      <header className="pt-14 pb-4 px-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Mi Curso</h1>
          <p className="text-muted text-sm mt-0.5">Gestioná tus alumnos.</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <ThemeToggle />
          <button
            onClick={() => router.push('/profesor/dashboard')}
            className="text-[#007AFF] font-medium text-sm"
          >
            Volver
          </button>
        </div>
      </header>

      <main className="px-4 max-w-2xl mx-auto space-y-4">
        {/* Buscador */}
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-placeholder" />
          <input
            type="text"
            placeholder="Buscar alumno..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-surface border border-subtle rounded-2xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 placeholder:text-placeholder"
          />
        </div>

        {/* Filtro por Materia */}
        {materias.length > 1 && (
          <select
            value={filtroMateria}
            onChange={e => setFiltroMateria(e.target.value)}
            className="w-full px-4 py-3 bg-surface border border-subtle rounded-2xl text-sm shadow-sm focus:outline-none appearance-none"
          >
            <option value="">Todas mis materias</option>
            {materias.map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        )}

        {/* Agregar alumno */}
        <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle animate-slide-up" style={{ animationDelay: '50ms', opacity: 0, animationFillMode: 'forwards' }}>
          <button
            onClick={() => setAgregando(!agregando)}
            className="w-full flex items-center gap-3 px-5 py-4 text-[#007AFF] font-semibold text-sm hover:bg-surface-hover transition-colors tap-scale"
          >
            <Plus size={18} /> Agregar alumno
          </button>
          {agregando && (
            <div className="px-5 pb-4 space-y-2 border-t border-subtle pt-3">
              <input
                type="text"
                placeholder="Nombre completo"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-strong text-sm bg-surface-hover focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 placeholder:text-placeholder"
              />
              <input
                type="text"
                placeholder="DNI (Opcional)"
                value={nuevoDni}
                onChange={e => setNuevoDni(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregar()}
                className="w-full px-4 py-3 rounded-xl border border-strong text-sm bg-surface-hover focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 placeholder:text-placeholder"
              />
              <input
                type="text"
                placeholder="Teléfono (Opcional)"
                value={nuevoTelefono}
                onChange={e => setNuevoTelefono(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregar()}
                className="w-full px-4 py-3 rounded-xl border border-strong text-sm bg-surface-hover focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 placeholder:text-placeholder"
              />
              {materias.length > 1 && (
                <select
                  value={materiaId}
                  onChange={e => setMateriaId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-strong text-sm bg-surface-hover focus:outline-none appearance-none"
                >
                  <option value="">— Elegir materia —</option>
                  {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              )}
              <button
                onClick={agregar}
                disabled={loading || subiendoArchivo}
                className="w-full bg-[#007AFF] text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 active:scale-[0.98] text-sm"
              >
                {loading ? 'Agregando...' : 'Confirmar'}
              </button>

              <div className="relative mt-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls,.csv"
                  onChange={procesarArchivo}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={subiendoArchivo || !materiaId}
                />
                <button
                  disabled={subiendoArchivo || !materiaId}
                  className="w-full flex items-center justify-center gap-2 bg-surface hover:bg-surface-hover text-[#007AFF] font-semibold py-3 rounded-xl border border-subtle disabled:opacity-50 tap-scale text-sm"
                >
                  <Download size={16} className="rotate-180" />
                  {subiendoArchivo ? 'Procesando...' : (!materiaId ? 'Elegir materia primero' : 'Subir excel/csv')}
                </button>
                <p className="text-[10px] text-muted text-center mt-1 font-medium">Formato: Alumno | DNI | Teléfono</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle divide-y divide-subtle animate-slide-up" style={{ animationDelay: '100ms', opacity: 0, animationFillMode: 'forwards' }}>
          {cargando ? (
            <p className="p-6 text-center text-muted animate-pulse text-sm">Cargando...</p>
          ) : filtrados.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-muted">
              <GraduationCap size={28} className="opacity-25" />
              <p className="text-sm">Sin alumnos.</p>
            </div>
          ) : filtrados.map((a, i) => (
            <div
              key={a.id}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-hover active:bg-surface-active transition-colors animate-slide-up group"
              style={{ animationDelay: `${i * 30}ms`, opacity: 0, animationFillMode: 'forwards' }}
            >
              <button
                onClick={() => { setAlumnoSel(a); setView('detalle'); }}
                className="flex-1 flex items-center gap-3 focus:outline-none"
              >
                <div className="w-10 h-10 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] font-bold shrink-0">
                  {a.nombre[0].toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground text-sm">{a.nombre}</p>
                  <p className="text-xs text-muted">
                    {a.dni ? `DNI: ${a.dni} • ` : ''}
                    {(a.materias as any)?.nombre ?? '—'}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setAlumnoSel(a); setView('detalle'); }}
                  className="p-2 text-placeholder hover:text-[#007AFF] transition-colors rounded-full hover:bg-surface-hover tap-scale"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => eliminarAlumno(a.id, a.nombre)}
                  className="p-2 text-placeholder hover:text-[#FF3B30] transition-colors rounded-full hover:bg-red-50 tap-scale"
                >
                  <Trash2 size={18} color="red" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
