'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  UserPlus, GraduationCap, BookOpen,
  ChevronLeft, ChevronRight, Search,
  Pencil, ArrowRightLeft, Clock,
  CheckCircle2, XCircle, AlertCircle,
  X, Plus, Trash2, Download
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import * as XLSX from 'xlsx';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Profesor {
  id: string; email: string; nombre?: string; dni?: string;
}
interface Materia { id: string; nombre: string; profesor_id: string | null; profesorEmail: string }
interface Alumno {
  id: string; nombre: string; materia_id: string | null; dni?: string | null; telefono?: string | null;
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C1C1E] text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-slide-up">
      <CheckCircle2 size={15} className="text-[#34C759] shrink-0" /> {msg}
      <button onClick={onClose}><X size={14} className="opacity-40 ml-1" /></button>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold text-foreground tracking-tight">{title}</h2>
      <p className="text-muted text-sm mt-0.5">{subtitle}</p>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-surface rounded-2xl overflow-hidden shadow-sm border border-subtle divide-y divide-subtle ${className}`}>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, label }: { icon: React.FC<any>; label: string }) {
  return (
    <div className="py-12 flex flex-col items-center gap-3 text-muted">
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
      <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-placeholder" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-3 bg-surface border border-subtle rounded-2xl text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 placeholder:text-placeholder"
      />
    </div>
  );
}

// ─── Tab 1: Profesores ────────────────────────────────────────────────────────

function ProfesoresTab({ materias, onRefresh, onToast }: { materias: Materia[]; onRefresh: () => void; onToast: (m: string) => void }) {
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit states
  const [editando, setEditando] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editDni, setEditDni] = useState('');

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
        body: JSON.stringify({ email, password, nombre, dni }),
      });
      onToast(`Profesor ${email} creado.`);
      setEmail(''); setPassword('');
      setNombre(''); setDni('');
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

  const guardarEdicion = async (id: string) => {
    try {
      await apiFetch('/api/admin/profesores', {
        method: 'PATCH',
        body: JSON.stringify({ userId: id, email: editEmail || undefined, password: editPassword || undefined, nombre: editNombre, dni: editDni })
      });
      onToast('Profesor editado.');
      setEditando(null);
      cargar();
    } catch (e: any) { setError(e.message); }
  };

  const iniciarEdicion = (p: Profesor) => {
    setEditando(p.id);
    setEditEmail(p.email);
    setEditPassword('');
    setEditNombre(p.nombre ?? '');
    setEditDni(p.dni ?? '');
  };

  return (
    <div className="animate-fade-in">
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
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Nuevo Profesor</p>
        </div>
        <div className="flex flex-col border-b border-subtle">
          <input
            type="text"
            placeholder="Nombre completo"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full px-5 py-4 bg-transparent border-b border-subtle text-foreground focus:outline-none placeholder:text-placeholder"
          />
          <input
            type="text"
            placeholder="DNI"
            value={dni}
            onChange={e => setDni(e.target.value)}
            className="w-full px-5 py-4 bg-transparent border-b border-subtle text-foreground focus:outline-none placeholder:text-placeholder"
          />
          <input
            type="email"
            placeholder="Email institucional"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-5 py-4 bg-transparent border-b border-subtle text-foreground focus:outline-none placeholder:text-placeholder"
          />
          <input
            type="password"
            placeholder="Contraseña temporal"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && crear()}
            className="w-full px-5 py-4 bg-transparent text-foreground focus:outline-none placeholder:text-placeholder"
          />
        </div>
        <div className="px-5 py-4">
          <button
            onClick={crear}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 tap-scale"
          >
            <Plus size={18} />
            {loading ? 'Creando...' : 'Crear Profesor'}
          </button>
        </div>
      </Card>

      {/* List */}
      <div className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-1 mb-2">
          Profesores Registrados ({profesores.length})
        </p>
        <Card>
          {profesores.length === 0
            ? <EmptyState icon={UserPlus} label="No hay profesores." />
            : profesores.map((p, i) => (
              <div key={p.id} className="border-b border-subtle last:border-0">
                <div
                  className="flex items-center justify-between px-5 py-4 animate-slide-up"
                  style={{ animationDelay: `${i * 30}ms`, opacity: 0, animationFillMode: 'forwards' }}
                >
                  <div>
                    <p className="text-foreground font-medium text-sm">{p.nombre || p.email}</p>
                    <p className="text-muted text-xs">{p.nombre ? p.email : 'Sin nombre'} • DNI: {p.dni || '—'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => editando === p.id ? setEditando(null) : iniciarEdicion(p)}
                      className="text-xs text-[#007AFF] font-medium px-3 py-1.5 rounded-xl hover:bg-surface-hover tap-scale"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminar(p.id, p.email)}
                      className="text-xs text-[#FF3B30] font-medium px-3 py-1.5 rounded-xl hover:bg-red-50 tap-scale"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
                {editando === p.id && (
                  <div className="px-5 pb-4 space-y-3 bg-surface-hover animate-fade-in pt-3 border-t border-subtle">
                    <input className="w-full px-3 py-2 bg-background border border-strong rounded-xl text-sm" placeholder="Nombre" value={editNombre} onChange={e => setEditNombre(e.target.value)} />
                    <input className="w-full px-3 py-2 bg-background border border-strong rounded-xl text-sm" placeholder="DNI" value={editDni} onChange={e => setEditDni(e.target.value)} />
                    <input className="w-full px-3 py-2 bg-background border border-strong rounded-xl text-sm" placeholder="Email (modificar email)" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                    <input className="w-full px-3 py-2 bg-background border border-strong rounded-xl text-sm" type="password" placeholder="Nueva Contraseña (dejar en blanco para no cambiar)" value={editPassword} onChange={e => setEditPassword(e.target.value)} />
                    <button onClick={() => guardarEdicion(p.id)} className="w-full bg-[#007AFF] text-white py-2 rounded-xl text-sm font-semibold tap-scale">Guardar Cambios Personales</button>

                    <div className="pt-2 mt-2 border-t border-subtle">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#007AFF] mb-2">Asignar Materias Rápidamente</p>
                      <div className="space-y-1">
                        {materias.map(m => {
                          const isAssigned = m.profesor_id === p.id;
                          return (
                            <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={async (e) => {
                                  const profId = e.target.checked ? p.id : null;
                                  try {
                                    await apiFetch('/api/admin/editar', {
                                      method: 'PATCH',
                                      body: JSON.stringify({ type: 'reasignar-materia', materiaId: m.id, profesorId: profId }),
                                    });
                                    onRefresh();
                                  } catch (err: any) { alert(err.message); }
                                }}
                                className="rounded border-strong text-[#007AFF] focus:ring-[#007AFF]"
                              />
                              <span className="text-foreground">{m.nombre}</span>
                            </label>
                          );
                        })}
                        {materias.length === 0 && <span className="text-xs text-muted">No hay materias creadas.</span>}
                      </div>
                    </div>
                  </div>
                )}
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

  // Creación state
  const [crearNombre, setCrearNombre] = useState('');
  const [crearDni, setCrearDni] = useState('');
  const [crearTelefono, setCrearTelefono] = useState('');
  const [crearMateria, setCrearMateria] = useState('');
  const [creando, setCreando] = useState(false);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detalle state
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoDni, setNuevoDni] = useState('');
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [editandoDni, setEditandoDni] = useState(false);
  const [nuevaMateria, setNuevaMateria] = useState('');
  const [editandoMateria, setEditandoMateria] = useState(false);
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [cargandoHist, setCargandoHist] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dniRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const qs = filtroMateria ? `?materia_id=${filtroMateria}` : '';
    try { setAlumnos(await apiFetch(`/api/admin/alumnos${qs}`)); }
    catch (e: any) { alert(e.message); }
  }, [filtroMateria]);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminarAlumno = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar al alumno "${nombre}" permanentemente?`)) return;
    try {
      await apiFetch('/api/admin/alumnos', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      onToast(`Alumno ${nombre} eliminado.`);
      cargar();
    } catch (e: any) { alert(e.message); }
  };

  const abrirAlumno = async (a: Alumno) => {
    setAlumnoSel(a);
    setNuevoNombre(a.nombre);
    setNuevoDni(a.dni ?? '');
    setNuevaMateria(a.materia_id ?? '');
    setEditandoNombre(false);
    setEditandoDni(false);
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

  const modificarDni = async () => {
    if (!alumnoSel || (nuevoDni.trim() === (alumnoSel.dni ?? ''))) return;
    try {
      await apiFetch('/api/admin/editar', {
        method: 'PATCH',
        body: JSON.stringify({ type: 'editar-dni-alumno', alumnoId: alumnoSel.id, dni: nuevoDni.trim() }),
      });
      onToast('DNI actualizado.');
      setEditandoDni(false);
      setAlumnoSel(prev => prev ? { ...prev, dni: nuevoDni.trim() } : prev);
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

  const agregarAlumno = async () => {
    if (!crearNombre.trim() || !crearMateria) { alert('Completá el nombre y la materia.'); return; }
    setCreando(true);
    try {
      await apiFetch('/api/admin/alumnos', {
        method: 'POST',
        body: JSON.stringify({ nombre: crearNombre.trim(), dni: crearDni.trim(), telefono: crearTelefono.trim(), materiaId: crearMateria }),
      });
      onToast(`${crearNombre.trim()} agregado.`);
      setCrearNombre('');
      setCrearDni('');
      setCrearTelefono('');
      cargar();
    } catch (e: any) { alert(e.message); }
    finally { setCreando(false); }
  };

  const procesarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!crearMateria) {
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
      const alumnos = json.slice(1) // omit headers
        .filter(row => row[0]) // debe tener nombre
        .map(row => ({
          nombre: String(row[0] || '').trim(),
          dni: String(row[1] || '').trim(),
          telefono: String(row[2] || '').trim(),
          materiaId: crearMateria
        }));

      if (alumnos.length === 0) {
        alert('El archivo está vacío o no tiene el formato correcto.');
        return;
      }

      await apiFetch('/api/admin/alumnos', {
        method: 'POST',
        body: JSON.stringify(alumnos),
      });

      onToast(`${alumnos.length} alumnos agregados.`);
      cargar();
    } catch (err: any) {
      alert(`Error al procesar archivo: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSubiendoArchivo(false);
    }
  };

  const filtrados = alumnos.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  // ── Vista Detalle ──────────────────────────────────────────────────────────
  if (view === 'detalle' && alumnoSel) {
    const materiaActual = materias.find(m => m.id === alumnoSel.materia_id);

    return (
      <div className="animate-slide-right">
        <button
          onClick={() => { setView('lista'); setAlumnoSel(null); }}
          className="flex items-center gap-1 text-[#007AFF] font-medium mb-5 active:opacity-70 transition-opacity text-sm hover-scale"
        >
          <ChevronLeft size={19} /> Alumnos
        </button>

        {/* Header alumno */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] font-bold text-xl shrink-0">
            {alumnoSel.nombre[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{alumnoSel.nombre}</h2>
            <p className="text-sm text-muted">
              {alumnoSel.dni ? `DNI: ${alumnoSel.dni} • ` : ''}
              {(alumnoSel.materias as any)?.nombre ?? '—'}
            </p>
          </div>
        </div>

        {/* --- Acciones --- */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-1 mb-2">Editar</p>
        <Card>
          {/* Renombrar */}
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
            {editandoNombre && (
              <div className="mt-3 flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={nuevoNombre}
                  onChange={e => setNuevoNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && renombrar()}
                  className="flex-1 rounded-xl border border-strong px-3 py-2 text-sm bg-surface-hover focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
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
            <p className="text-sm text-muted mt-1">{alumnoSel.dni ?? '—'}</p>
            {editandoDni && (
              <div className="mt-3 flex gap-2">
                <input
                  ref={dniRef}
                  type="text"
                  value={nuevoDni}
                  onChange={e => setNuevoDni(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && modificarDni()}
                  placeholder="DNI del alumno"
                  className="flex-1 rounded-xl border border-strong px-3 py-2 text-sm bg-surface-hover focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                />
                <button
                  onClick={modificarDni}
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
              <span className="text-foreground font-medium">Materia</span>
              <button
                onClick={() => setEditandoMateria(!editandoMateria)}
                className="flex items-center gap-1 text-[#007AFF] text-sm font-medium"
              >
                <ArrowRightLeft size={14} /> Cambiar
              </button>
            </div>
            <p className="text-sm text-muted mt-1">{materiaActual?.nombre ?? '—'}</p>
            {editandoMateria && (
              <div className="mt-3 flex gap-2">
                <select
                  value={nuevaMateria}
                  onChange={e => setNuevaMateria(e.target.value)}
                  className="flex-1 rounded-xl border border-strong px-3 py-2 text-sm bg-surface-hover focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
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
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-1 mt-6 mb-2">
          Historial de Asistencia
        </p>
        {cargandoHist ? (
          <p className="text-muted text-sm animate-pulse px-1">Cargando...</p>
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
              const color = colors[(h.estado ?? 'presente') as keyof typeof colors] ?? 'text-muted';

              return (
                <div key={h.id} className="flex items-start gap-3 px-5 py-4">
                  <EstIcon size={18} className={`mt-0.5 shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{h.sesiones?.materias?.nombre ?? '—'}</p>
                    <p className="text-xs text-muted mt-0.5 capitalize">{fecha} · {horaEscaneo}</p>
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
    <div className="animate-fade-in">
      <SectionHeader title="Alumnos" subtitle="Crear y explorar alumnos." />

      {/* Creación */}
      <Card>
        <div className="px-5 pt-4 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Nuevo Alumno</p>
        </div>
        <div className="flex flex-col border-b border-subtle">
          <input
            type="text"
            placeholder="Nombre completo"
            value={crearNombre}
            onChange={e => setCrearNombre(e.target.value)}
            className="w-full px-5 py-4 bg-transparent border-b border-subtle text-foreground focus:outline-none placeholder:text-placeholder"
          />
          <input
            type="text"
            placeholder="DNI (opcional)"
            value={crearDni}
            onChange={e => setCrearDni(e.target.value)}
            className="w-full px-5 py-4 bg-transparent border-b border-subtle text-foreground focus:outline-none placeholder:text-placeholder"
          />
          <input
            type="text"
            placeholder="Teléfono (opcional)"
            value={crearTelefono}
            onChange={e => setCrearTelefono(e.target.value)}
            className="w-full px-5 py-4 bg-transparent border-b border-subtle text-foreground focus:outline-none placeholder:text-placeholder"
          />
          <select
            value={crearMateria}
            onChange={e => setCrearMateria(e.target.value)}
            className="w-full px-5 py-4 bg-transparent text-foreground focus:outline-none appearance-none"
          >
            <option value="" disabled>— Seleccioná la materia —</option>
            {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </div>
        <div className="px-5 py-4">
          <button
            onClick={agregarAlumno}
            disabled={creando || subiendoArchivo}
            className="w-full flex items-center justify-center gap-2 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 tap-scale mb-3"
          >
            <Plus size={18} />
            {creando ? 'Creando...' : 'Crear Alumno'}
          </button>

          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={procesarArchivo}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={subiendoArchivo || !crearMateria}
            />
            <button
              disabled={subiendoArchivo || !crearMateria}
              className="w-full flex items-center justify-center gap-2 bg-surface hover:bg-surface-hover text-[#007AFF] font-semibold py-3.5 rounded-xl border border-subtle disabled:opacity-50 tap-scale"
            >
              <Download size={18} className="rotate-180" />
              {subiendoArchivo ? 'Procesando...' : (!crearMateria ? 'Seleccioná materia para subir Excel/CSV' : 'Subir listado (.xlsx, .csv)')}
            </button>
            <p className="text-[10px] text-muted text-center mt-2 font-medium">Formato: Alumno | DNI | Teléfono</p>
          </div>
        </div>
      </Card>

      <div className="mt-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-1 mb-3">Buscar</p>
        <SearchBar value={busqueda} onChange={setBusqueda} placeholder="Buscar alumno..." />
        <select
          value={filtroMateria}
          onChange={e => setFiltroMateria(e.target.value)}
          className="w-full px-4 py-3 mb-4 bg-surface border border-subtle rounded-2xl text-sm text-foreground shadow-sm focus:outline-none appearance-none"
        >
          <option value="">Todas las materias</option>
          {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
      </div>

      <Card>
        {filtrados.length === 0
          ? <EmptyState icon={GraduationCap} label="Sin resultados." />
          : filtrados.map((a, i) => (
            <div
              key={a.id}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-hover/80 active:bg-surface-active transition-colors animate-slide-up border-b border-subtle last:border-0"
              style={{ animationDelay: `${i * 30}ms`, opacity: 0, animationFillMode: 'forwards' }}
            >
              <button
                onClick={() => abrirAlumno(a)}
                className="flex-1 flex items-center gap-3 focus:outline-none"
              >
                <div className="w-10 h-10 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] font-bold text-base shrink-0">
                  {a.nombre[0].toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-foreground text-sm">{a.nombre}</p>
                  <p className="text-xs text-muted">{(a.materias as any)?.nombre ?? '—'}</p>
                </div>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => abrirAlumno(a)}
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
  const [editNombreMateria, setEditNombreMateria] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Create state
  const [nombreNueva, setNombreNueva] = useState('');
  const [profesorNueva, setProfesorNueva] = useState('');
  const [loading, setLoading] = useState(false);

  const crearMateria = async () => {
    if (!nombreNueva || !profesorNueva) return;
    setLoading(true);
    try {
      await apiFetch('/api/admin/materias', {
        method: 'POST',
        body: JSON.stringify({ nombre: nombreNueva, profesorId: profesorNueva }),
      });
      onToast(`Materia "${nombreNueva}" creada.`);
      setNombreNueva('');
      setProfesorNueva('');
      onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

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

  const renombrarMateria = async (materiaId: string) => {
    if (!editNombreMateria) return;
    try {
      await apiFetch('/api/admin/editar', {
        method: 'PATCH',
        body: JSON.stringify({ type: 'renombrar-materia', materiaId, nombre: editNombreMateria.trim() }),
      });
      onToast('Materia renombrada.');
      setEditando(null); setEditNombreMateria('');
      onRefresh();
    } catch (e: any) { alert(e.message); }
  };

  const eliminarMateria = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar la materia "${nombre}"?`)) return;
    try {
      await apiFetch('/api/admin/materias', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      onToast('Materia eliminada.');
      onRefresh();
    } catch (e: any) { alert(e.message); }
  };

  const filtradas = materias.filter(m =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    m.profesorEmail.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <SectionHeader title="Materias" subtitle="Creá y administrá las materias." />

      {/* Form Crear */}
      <Card>
        <div className="px-5 pt-4 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Nueva Materia</p>
        </div>
        <input
          type="text"
          placeholder="Nombre de la materia"
          value={nombreNueva}
          onChange={e => setNombreNueva(e.target.value)}
          className="w-full px-5 py-4 bg-transparent text-foreground focus:outline-none placeholder:text-placeholder"
        />
        <div className="px-5 py-1">
          <select
            value={profesorNueva}
            onChange={e => setProfesorNueva(e.target.value)}
            className="w-full py-3 bg-transparent text-foreground focus:outline-none appearance-none border-b border-subtle mb-2 text-sm"
          >
            <option value="">— Asignar a profesor —</option>
            {profesores.map(p => <option key={p.id} value={p.id}>{p.email}</option>)}
          </select>
        </div>
        <div className="px-5 py-4">
          <button
            onClick={crearMateria}
            disabled={loading || !nombreNueva || !profesorNueva}
            className="w-full flex items-center justify-center gap-2 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 tap-scale"
          >
            <Plus size={18} />
            {loading ? 'Creando...' : 'Crear Materia'}
          </button>
        </div>
      </Card>

      <div className="mt-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-1 mb-2">
          Lista de Materias
        </p>
        <SearchBar value={busqueda} onChange={setBusqueda} placeholder="Buscar materia o profesor..." />
        <Card>
          {filtradas.length === 0
            ? <EmptyState icon={BookOpen} label="No hay materias." />
            : filtradas.map((m, i) => (
              <div
                key={m.id}
                className="px-5 py-4 animate-slide-up"
                style={{ animationDelay: `${i * 30}ms`, opacity: 0, animationFillMode: 'forwards' }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="font-semibold text-foreground truncate">{m.nombre}</p>
                    <p className="text-xs text-muted mt-0.5 truncate">{m.profesorEmail}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditando(editando === m.id ? null : m.id); setNuevoProf(m.profesor_id ?? ''); setEditNombreMateria(m.nombre); }}
                      className="flex items-center gap-1 text-[#007AFF] text-sm font-medium px-2 py-1 rounded-lg hover:bg-blue-50 tap-scale"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => eliminarMateria(m.id, m.nombre)}
                      className="flex items-center gap-1 text-[#FF3B30] text-sm font-medium px-2 py-1 rounded-lg hover:bg-red-50 tap-scale"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {editando === m.id && (
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editNombreMateria}
                        onChange={e => setEditNombreMateria(e.target.value)}
                        className="flex-1 rounded-xl border border-strong px-3 py-2 text-sm bg-surface-hover focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                        placeholder="Nuevo nombre"
                      />
                      <button
                        onClick={() => renombrarMateria(m.id)}
                        className="px-4 py-2 bg-[#007AFF] text-white text-sm font-semibold rounded-xl active:scale-[0.97]"
                      >
                        Renombrar
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={nuevoProf}
                        onChange={e => setNuevoProf(e.target.value)}
                        className="flex-1 rounded-xl border border-strong px-3 py-2 text-sm bg-surface-hover focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                      >
                        <option value="">— Reasignar profesor —</option>
                        {profesores.map(p => <option key={p.id} value={p.id}>{p.email}</option>)}
                      </select>
                      <button
                        onClick={() => reasignar(m.id)}
                        className="px-4 py-2 bg-[#007AFF] text-white text-sm font-semibold rounded-xl active:scale-[0.97]"
                      >
                        Reasignar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </Card>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; Icon: React.FC<any> }[] = [
  { key: 'profesores', label: 'Profesores', Icon: UserPlus },
  { key: 'alumnos', label: 'Alumnos', Icon: GraduationCap },
  { key: 'materias', label: 'Materias', Icon: BookOpen },
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
    <div className="min-h-screen bg-background">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      <header className="pt-16 pb-4 px-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Administración</h1>
          <p className="text-muted text-sm mt-1">Panel de control académico.</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <ThemeToggle />
          <button
            onClick={() => window.location.href = '/profesor/dashboard'}
            className="text-sm font-medium text-[#007AFF] bg-[#007AFF]/10 px-3 py-1.5 rounded-lg tap-scale"
          >
            Volver
          </button>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-strong">
        <div className="flex max-w-2xl mx-auto px-2 relative">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold uppercase tracking-widest relative ${tab === key ? 'text-[#007AFF]' : 'text-muted'
                }`}
              style={{ transition: 'color 200ms var(--ease-out-quint)' }}
            >
              <Icon size={19} className="tap-scale" />
              {label}
              {tab === key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007AFF] animate-fade-in" />
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4 py-6 max-w-2xl mx-auto pb-20">
        {tab === 'profesores' && <ProfesoresTab materias={materias} onRefresh={cargarBase} onToast={setToast} />}
        {tab === 'alumnos' && <AlumnosTab materias={materias} onToast={setToast} />}
        {tab === 'materias' && <MateriasTab profesores={profesores} materias={materias} onRefresh={cargarBase} onToast={setToast} />}
      </main>
    </div>
  );
}
