'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  UserPlus, GraduationCap, BookOpen,
  ChevronLeft, ChevronRight, Search,
  Pencil, ArrowRightLeft, Clock,
  CheckCircle2, XCircle, AlertCircle,
  X, Plus
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Profesor { id: string; email: string }
interface Materia { id: string; nombre: string; profesor_id: string | null; profesorEmail: string }
interface Alumno {
  id: string; nombre: string; materia_id: string | null;
  materias: { nombre: string } | null
}
interface HistorialEntry {
  id: string; hora_escaneo: string | null; estado: string | null;
  sesiones: {
    fecha: string | null; hora_inicio: string | null;
    materias: { nombre: string } | null
  } | null
}

type Tab = 'profesores' | 'alumnos' | 'materias';
type AlumnoView = 'lista' | 'detalle';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Error desconocido');
  return json;
}

// ─── Micro-components ────────────────────────────────────────────────────────

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C1C1E] text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-fade-in">
      <CheckCircle2 size={15} className="text-[#34C759] shrink-0" /> {msg}
      <button onClick={onClose}><X size={14} className="opacity-40 ml-1" /></button>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold text-[#1C1C1E] tracking-tight">{title}</h2>
      <p className="text-[#8E8E93] text-sm mt-0.5">{subtitle}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 divide-y divide-gray-100">
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, label }: { icon: React.FC<any>; label: string }) {
  return (
    <div className="py-12 flex flex-col items-center gap-3 text-[#8E8E93]">
      <Icon size={30} className="opacity-25" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function SearchBar({ value, onChange, placeholder = 'Buscar...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="relative mb-3">
      <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C7C7CC]" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm text-[#1C1C1E] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 placeholder:text-[#C7C7CC]"
      />
    </div>
  );
}

// ─── Tab 1: Profesores ────────────────────────────────────────────────────────

function ProfesoresTab({ onToast }: { onToast: (m: string) => void }) {
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { setProfesores(await apiFetch('/api/admin/profesores-list')); }
    catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => {
    if (!email || !password) { setError('Completá email y contraseña.'); return; }
    setLoading(true); setError(null);
    try {
      await apiFetch('/api/admin/profesores', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onToast(`Profesor ${email} creado.`);
      setEmail(''); setPassword('');
      cargar();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const eliminar = async (id: string, correo: string) => {
    if (!confirm(`¿Eliminar al profesor ${correo}?`)) return;
    try {
      await apiFetch('/api/admin/profesores', {
        method: 'DELETE',
        body: JSON.stringify({ userId: id }),
      });
      onToast('Profesor eliminado.');
      cargar();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div>
      <SectionHeader title="Profesores" subtitle="Creá una cuenta para un nuevo docente." />

      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-100 text-[#FF3B30] text-sm font-medium px-4 py-3 rounded-xl mb-4">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={15} /></button>
        </div>
      )}

      {/* Form */}
      <Card>
        <div className="px-5 pt-4 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8E8E93]">Nuevo Profesor</p>
        </div>
        <input
          type="email"
          placeholder="Email institucional"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-5 py-4 bg-transparent text-[#1C1C1E] focus:outline-none placeholder:text-[#C7C7CC]"
        />
        <input
          type="password"
          placeholder="Contraseña temporal"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && crear()}
          className="w-full px-5 py-4 bg-transparent text-[#1C1C1E] focus:outline-none placeholder:text-[#C7C7CC]"
        />
        <div className="px-5 py-4">
          <button
            onClick={crear}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            <Plus size={18} />
            {loading ? 'Creando...' : 'Crear Profesor'}
          </button>
        </div>
      </Card>

      {/* List */}
      <div className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8E8E93] px-1 mb-2">
          Profesores Registrados ({profesores.length})
        </p>
        <Card>
          {profesores.length === 0
            ? <EmptyState icon={UserPlus} label="No hay profesores." />
            : profesores.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4">
                <p className="text-[#1C1C1E] font-medium text-sm">{p.email}</p>
                <button
                  onClick={() => eliminar(p.id, p.email)}
                  className="text-xs text-[#FF3B30] font-medium px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            ))}
        </Card>
      </div>
    </div>
  );
}

// ─── Tab 2: Alumnos con drill-down ────────────────────────────────────────────

function AlumnosTab({ materias, onToast }: { materias: Materia[]; onToast: (m: string) => void }) {
  const [view, setView] = useState<AlumnoView>('lista');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [alumnoSel, setAlumnoSel] = useState<Alumno | null>(null);
  const [filtroMateria, setFiltroMateria] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Detalle state
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nuevaMateria, setNuevaMateria] = useState('');
  const [editandoMateria, setEditandoMateria] = useState(false);
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [cargandoHist, setCargandoHist] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const qs = filtroMateria ? `?materia_id=${filtroMateria}` : '';
    try { setAlumnos(await apiFetch(`/api/admin/alumnos${qs}`)); }
    catch (e: any) { alert(e.message); }
  }, [filtroMateria]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirAlumno = async (a: Alumno) => {
    setAlumnoSel(a);
    setNuevoNombre(a.nombre);
    setNuevaMateria(a.materia_id ?? '');
    setEditandoNombre(false);
    setEditandoMateria(false);
    setCargandoHist(true);
    setView('detalle');
    try {
      setHistorial(await apiFetch(`/api/admin/historial-alumno?alumno_id=${a.id}`));
    } catch { }
    finally { setCargandoHist(false); }
  };

  const renombrar = async () => {
    if (!alumnoSel || !nuevoNombre.trim()) return;
    try {
      await apiFetch('/api/admin/editar', {
        method: 'PATCH',
        body: JSON.stringify({ type: 'renombrar-alumno', alumnoId: alumnoSel.id, nombre: nuevoNombre.trim() }),
      });
      onToast('Nombre actualizado.');
      setEditandoNombre(false);
      setAlumnoSel(prev => prev ? { ...prev, nombre: nuevoNombre.trim() } : prev);
      cargar();
    } catch (e: any) { alert(e.message); }
  };

  const reasignarMateria = async () => {
    if (!alumnoSel || !nuevaMateria) return;
    try {
      await apiFetch('/api/admin/editar', {
        method: 'PATCH',
        body: JSON.stringify({ type: 'reasignar-alumno', alumnoId: alumnoSel.id, materiaId: nuevaMateria }),
      });
      const mat = materias.find(m => m.id === nuevaMateria);
      onToast(`Alumno movido a ${mat?.nombre ?? 'nueva materia'}.`);
      setEditandoMateria(false);
      setAlumnoSel(prev => prev ? { ...prev, materia_id: nuevaMateria, materias: { nombre: mat?.nombre ?? '' } } : prev);
      cargar();
    } catch (e: any) { alert(e.message); }
  };

  const filtrados = alumnos.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  // ── Vista Detalle ──────────────────────────────────────────────────────────
  if (view === 'detalle' && alumnoSel) {
    const materiaActual = materias.find(m => m.id === alumnoSel.materia_id);

    return (
      <div>
        <button
          onClick={() => { setView('lista'); setAlumnoSel(null); }}
          className="flex items-center gap-1 text-[#007AFF] font-medium mb-5 active:opacity-70 transition-opacity text-sm"
        >
          <ChevronLeft size={19} /> Alumnos
        </button>

        {/* Header alumno */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] font-bold text-xl shrink-0">
            {alumnoSel.nombre[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#1C1C1E]">{alumnoSel.nombre}</h2>
            <p className="text-sm text-[#8E8E93]">{(alumnoSel.materias as any)?.nombre ?? '—'}</p>
          </div>
        </div>

        {/* --- Acciones --- */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8E8E93] px-1 mb-2">Editar</p>
        <Card>
          {/* Renombrar */}
          <div className="px-5 py-4">
            <div className="flex justify-between items-center">
              <span className="text-[#1C1C1E] font-medium">Nombre</span>
              <button
                onClick={() => { setEditandoNombre(!editandoNombre); setTimeout(() => inputRef.current?.focus(), 50); }}
                className="flex items-center gap-1 text-[#007AFF] text-sm font-medium"
              >
                <Pencil size={14} /> Editar
              </button>
            </div>
            {editandoNombre && (
              <div className="mt-3 flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={nuevoNombre}
                  onChange={e => setNuevoNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && renombrar()}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                />
                <button
                  onClick={renombrar}
                  className="px-4 py-2 bg-[#007AFF] text-white text-sm font-semibold rounded-xl active:scale-[0.97]"
                >
                  OK
                </button>
              </div>
            )}
          </div>

          {/* Cambiar materia */}
          <div className="px-5 py-4">
            <div className="flex justify-between items-center">
              <span className="text-[#1C1C1E] font-medium">Materia</span>
              <button
                onClick={() => setEditandoMateria(!editandoMateria)}
                className="flex items-center gap-1 text-[#007AFF] text-sm font-medium"
              >
                <ArrowRightLeft size={14} /> Cambiar
              </button>
            </div>
            <p className="text-sm text-[#8E8E93] mt-1">{materiaActual?.nombre ?? '—'}</p>
            {editandoMateria && (
              <div className="mt-3 flex gap-2">
                <select
                  value={nuevaMateria}
                  onChange={e => setNuevaMateria(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                >
                  <option value="">— Elegir materia —</option>
                  {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                <button
                  onClick={reasignarMateria}
                  className="px-4 py-2 bg-[#007AFF] text-white text-sm font-semibold rounded-xl active:scale-[0.97]"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* --- Historial --- */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#8E8E93] px-1 mt-6 mb-2">
          Historial de Asistencia
        </p>
        {cargandoHist ? (
          <p className="text-[#8E8E93] text-sm animate-pulse px-1">Cargando...</p>
        ) : historial.length === 0 ? (
          <Card><EmptyState icon={Clock} label="Sin registros de asistencia." /></Card>
        ) : (
          <Card>
            {historial.map(h => {
              const horaEscaneo = h.hora_escaneo
                ? new Date(h.hora_escaneo).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                : '—';
              const fecha = h.sesiones?.fecha
                ? new Date(h.sesiones.fecha + 'T00:00:00').toLocaleDateString('es-AR', {
                    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
                  })
                : h.hora_escaneo
                ? new Date(h.hora_escaneo).toLocaleDateString('es-AR', {
                    weekday: 'short', day: '2-digit', month: 'short',
                  })
                : '—';
              const estadoLabel = h.estado === 'presente' ? 'Presente'
                : h.estado === 'ausente' ? 'Ausente' : 'Tarde';
              const colors = {
                presente: 'text-[#34C759]', ausente: 'text-[#FF3B30]', tarde: 'text-[#FF9500]'
              };
              const Icons = {
                presente: CheckCircle2, ausente: XCircle, tarde: AlertCircle
              };
              const EstIcon = Icons[(h.estado ?? 'presente') as keyof typeof Icons] ?? CheckCircle2;
              const color = colors[(h.estado ?? 'presente') as keyof typeof colors] ?? 'text-[#8E8E93]';

              return (
                <div key={h.id} className="flex items-start gap-3 px-5 py-4">
                  <EstIcon size={18} className={`mt-0.5 shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1C1C1E] text-sm">{h.sesiones?.materias?.nombre ?? '—'}</p>
                    <p className="text-xs text-[#8E8E93] mt-0.5 capitalize">{fecha} · {horaEscaneo}</p>
                  </div>
                  <span className={`text-xs font-semibold ${color}`}>{estadoLabel}</span>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    );
  }

  // ── Vista Lista ────────────────────────────────────────────────────────────
  return (
    <div>
      <SectionHeader title="Alumnos" subtitle="Tocá un alumno para editar o ver su historial." />

      <SearchBar value={busqueda} onChange={setBusqueda} placeholder="Buscar alumno..." />

      <select
        value={filtroMateria}
        onChange={e => setFiltroMateria(e.target.value)}
        className="w-full px-4 py-3 mb-4 bg-white border border-gray-100 rounded-2xl text-sm text-[#1C1C1E] shadow-sm focus:outline-none appearance-none"
      >
        <option value="">Todas las materias</option>
        {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>

      <Card>
        {filtrados.length === 0
          ? <EmptyState icon={GraduationCap} label="Sin resultados." />
          : filtrados.map(a => (
            <button
              key={a.id}
              onClick={() => abrirAlumno(a)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/80 active:bg-gray-100 transition-colors focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] font-bold text-base shrink-0">
                  {a.nombre[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-[#1C1C1E] text-sm">{a.nombre}</p>
                  <p className="text-xs text-[#8E8E93]">{(a.materias as any)?.nombre ?? '—'}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-[#C7C7CC] shrink-0" />
            </button>
          ))}
      </Card>
    </div>
  );
}

// ─── Tab 3: Materias ──────────────────────────────────────────────────────────

function MateriasTab({ profesores, materias, onRefresh, onToast }: {
  profesores: Profesor[]; materias: Materia[];
  onRefresh: () => void; onToast: (m: string) => void
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [nuevoProf, setNuevoProf] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const reasignar = async (materiaId: string) => {
    if (!nuevoProf) return;
    try {
      await apiFetch('/api/admin/editar', {
        method: 'PATCH',
        body: JSON.stringify({ type: 'reasignar-materia', materiaId, profesorId: nuevoProf }),
      });
      onToast('Materia reasignada.');
      setEditando(null); setNuevoProf('');
      onRefresh();
    } catch (e: any) { alert(e.message); }
  };

  const filtradas = materias.filter(m =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    m.profesorEmail.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <SectionHeader title="Materias" subtitle="Reasigná cada materia a un profesor." />
      <SearchBar value={busqueda} onChange={setBusqueda} placeholder="Buscar materia o profesor..." />
      <Card>
        {filtradas.length === 0
          ? <EmptyState icon={BookOpen} label="No hay materias." />
          : filtradas.map(m => (
            <div key={m.id} className="px-5 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-[#1C1C1E]">{m.nombre}</p>
                  <p className="text-xs text-[#8E8E93] mt-0.5">{m.profesorEmail}</p>
                </div>
                <button
                  onClick={() => { setEditando(editando === m.id ? null : m.id); setNuevoProf(m.profesor_id ?? ''); }}
                  className="flex items-center gap-1 text-[#007AFF] text-sm font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <Pencil size={14} /> Editar
                </button>
              </div>
              {editando === m.id && (
                <div className="mt-3 flex gap-2">
                  <select
                    value={nuevoProf}
                    onChange={e => setNuevoProf(e.target.value)}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                  >
                    <option value="">— Elegir profesor —</option>
                    {profesores.map(p => <option key={p.id} value={p.id}>{p.email}</option>)}
                  </select>
                  <button
                    onClick={() => reasignar(m.id)}
                    className="px-4 py-2 bg-[#007AFF] text-white text-sm font-semibold rounded-xl active:scale-[0.97]"
                  >
                    OK
                  </button>
                </div>
              )}
            </div>
          ))}
      </Card>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; Icon: React.FC<any> }[] = [
  { key: 'profesores', label: 'Profesores', Icon: UserPlus },
  { key: 'alumnos',   label: 'Alumnos',    Icon: GraduationCap },
  { key: 'materias',  label: 'Materias',   Icon: BookOpen },
];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('profesores');
  const [toast, setToast] = useState<string | null>(null);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);

  const cargarBase = useCallback(async () => {
    try {
      const [profs, mats] = await Promise.all([
        apiFetch('/api/admin/profesores-list'),
        apiFetch('/api/admin/materias'),
      ]);
      setProfesores(profs);
      setMaterias(mats);
    } catch (e: any) { console.error(e); }
  }, []);

  useEffect(() => { cargarBase(); }, [cargarBase]);

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      <header className="pt-16 pb-4 px-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#1C1C1E]">Administración</h1>
        <p className="text-[#8E8E93] text-sm mt-1">Panel de control académico.</p>
      </header>

      {/* Tab Bar */}
      <div className="sticky top-0 z-10 bg-[#F2F2F7]/95 backdrop-blur-sm border-b border-gray-200">
        <div className="flex max-w-2xl mx-auto px-2">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${
                tab === key
                  ? 'text-[#007AFF] border-[#007AFF]'
                  : 'text-[#8E8E93] border-transparent'
              }`}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4 py-6 max-w-2xl mx-auto pb-20">
        {tab === 'profesores' && <ProfesoresTab onToast={setToast} />}
        {tab === 'alumnos'   && <AlumnosTab materias={materias} onToast={setToast} />}
        {tab === 'materias'  && <MateriasTab profesores={profesores} materias={materias} onRefresh={cargarBase} onToast={setToast} />}
      </main>
    </div>
  );
}
