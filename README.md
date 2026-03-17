# FECQR — Sistema de Control de Asistencia por QR

Sistema web de control de asistencia académica en tiempo real, orientado a instituciones educativas. Los profesores generan un QR dinámico por clase; los alumnos lo escanean y su asistencia queda registrada de forma instantánea sin necesidad de crear cuentas.

---

## Tabla de Contenidos

- [Demo](#demo)
- [Arquitectura General](#arquitectura-general)  
- [Stack Tecnológico](#stack-tecnológico)  
- [Estructura del Proyecto](#estructura-del-proyecto)  
- [Base de Datos](#base-de-datos)  
- [Roles y Permisos](#roles-y-permisos)  
- [Flujo Completo de una Clase](#flujo-completo-de-una-clase)  
- [API Routes](#api-routes)  
- [Sistema de Temas (Dark Mode)](#sistema-de-temas-dark-mode)  
- [Configuración y Variables de Entorno](#configuración-y-variables-de-entorno)  
- [Instalación Local](#instalación-local)  
- [Deploy en Vercel](#deploy-en-vercel)  
- [Decisiones de Diseño](#decisiones-de-diseño)

---

## Demo

**Producción:** https://fecoqr.vercel.app

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js 16 App                       │
│  ┌─────────────────┐          ┌────────────────────────┐   │
│  │  Client Pages    │          │   API Routes (server)  │   │
│  │  (React, 'use    │◄────────►│   /api/**              │   │
│  │   client')       │  fetch   │   Uses Service Role Key│   │
│  └─────────────────┘          └────────────┬───────────┘   │
└─────────────────────────────────────────────┼───────────────┘
                                              │ supabaseAdmin
                                              ▼
                                    ┌─────────────────┐
                                    │    Supabase      │
                                    │  ┌────────────┐  │
                                    │  │  Postgres  │  │
                                    │  │  Auth      │  │
                                    │  │  Storage   │  │
                                    │  │  Realtime  │  │
                                    │  └────────────┘  │
                                    └─────────────────┘
```

El proyecto sigue un patrón **BFF (Backend for Frontend)**:

- Las páginas del cliente hacen `fetch` a las **API Routes de Next.js** que corren en el servidor Node.js de Vercel.
- Las API Routes usan el **Supabase Service Role Key** (clave de servicio que ignora RLS), permitiendo operaciones administrativas seguras.  
- Las páginas públicas (escaneo de QR del alumno) interactúan directamente con el cliente Supabase usando la **Anon Key**, sujeto a las políticas RLS.

---

## Stack Tecnológico

| Capa | Tecnología | Versión | Rol |
|---|---|---|---|
| Framework | **Next.js** | 16.1.6 | App Router, SSR, API Routes |
| UI | **React** | 19.2.3 | Componentes cliente |
| Estilos | **Tailwind CSS v4** | ^4.0.0 | Utility classes |
| Estilos | **CSS custom properties** | — | Tokens de diseño & dark mode |
| Iconos | **Lucide React** | ^0.477.0 | Iconografía SF-style |
| Temas | **next-themes** | ^0.4.6 | Persistencia dark/light mode |
| QR | **qrcode.react** | ^4.2.0 | Generación de QR en canvas |
| Excel | **xlsx** | ^0.18.5 | Export de asistencia (.xlsx) |
| BaaS | **Supabase** | — | Auth, PostgreSQL, Realtime, Storage |
| Supabase Client | **@supabase/supabase-js** | ^2.99.2 | SDK de browser/server |
| Supabase SSR | **@supabase/ssr** | ^0.9.0 | Cookies-based auth en API Routes |
| TypeScript | **TypeScript** | ^5.8.2 | Tipado estático |
| Deploy | **Vercel** | — | Hosting serverless |

---

## Estructura del Proyecto

```
src/
├── app/
│   ├── layout.tsx                  # Root layout: ThemeProvider, fuentes
│   ├── page.tsx                    # Página raíz; redirige al dashboard si hay sesión
│   ├── globals.css                 # Design tokens, dark mode, animaciones
│   │
│   ├── login/
│   │   └── page.tsx                # Formulario de login (profesor/admin)
│   │
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts            # Callback de Supabase Auth (cambio de email, etc.)
│   │
│   ├── admin/
│   │   └── page.tsx                # Panel de administración (3 tabs)
│   │
│   ├── profesor/
│   │   ├── dashboard/page.tsx      # Vista de materias del profesor + admin
│   │   ├── curso/page.tsx          # Gestión de alumnos del curso
│   │   ├── sesion/[id]/page.tsx    # Vista en vivo de la clase activa
│   │   └── perfil/page.tsx         # Perfil personal del profesor
│   │
│   ├── estudiante/
│   │   └── sesion/[id]/page.tsx    # Pantalla de escaneo para alumnos
│   │
│   └── api/
│       ├── admin/
│       │   ├── alumnos/route.ts        # CRUD alumnos (admin, bulk insert)
│       │   ├── editar/route.ts         # Reasignaciones y renombres
│       │   ├── historial-alumno/       # Historial de asistencia (admin)
│       │   ├── materias/route.ts       # CRUD de materias
│       │   ├── profesores/route.ts     # Crear/editar profesores (Auth users)
│       │   ├── profesores-list/route.ts# Listar profesores con metadata
│       │   └── sesiones/route.ts       # Iniciar/cerrar clases (bypass RLS)
│       │
│       └── profesor/
│           ├── alumnos/route.ts        # CRUD alumnos (scoped al profesor)
│           ├── asistencia/route.ts     # Lista de asistencia + cambios de estado
│           ├── historial-alumno/       # Historial de asistencia (profesor)
│           └── materias/route.ts       # Materias del profesor autenticado
│
├── components/
│   ├── QRGenerator.tsx             # Renderiza el QR con la URL dinámica
│   └── ThemeToggle.tsx             # Switch light/dark mode
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Supabase browser client (Anon Key)
│   │   └── admin.ts                # Supabase server client (Service Role Key)
│   └── exportarExcel.ts            # Genera .xlsx estilizado con xlsx
│
└── types/
    └── database.types.ts           # Tipos TypeScript generados del schema de Supabase
```

---

## Base de Datos

Todas las tablas están en el schema `public` de PostgreSQL gestionado por Supabase.

### `materias`
Representa una asignatura académica.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` (PK) | Generado automáticamente |
| `nombre` | `text` | Nombre de la materia |
| `profesor_id` | `uuid` (FK → `auth.users`) | Profesor titular |
| `created_at` | `timestamptz` | Fecha de creación |

### `alumnos`
Estudiantes inscritos en una materia.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` (PK) | Generado automáticamente |
| `nombre` | `text` | Nombre completo |
| `dni` | `text` | DNI del alumno (identificador único) |
| `telefono` | `text` | Teléfono de contacto |
| `materia_id` | `uuid` (FK → `materias`) | Materia a la que pertenece |
| `created_at` | `timestamptz` | Fecha de inscripción (usada para calcular ausencias) |

### `sesiones`
Una instancia de clase para una materia.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` (PK) | ID que se embebe en el QR |
| `materia_id` | `uuid` (FK → `materias`) | Materia correspondiente |
| `fecha` | `date` | Fecha de la clase (`CURRENT_DATE` por defecto) |
| `hora_inicio` | `timestamptz` | Timestamp exacto de inicio |
| `hora_fin` | `timestamptz` | Timestamp de cierre (null = activa) |
| `estado` | `text` | `'activa'` o `'inactiva'` |
| `created_at` | `timestamptz` | — |

### `asistencias`
Un registro por alumno por sesión.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` (PK) | — |
| `sesion_id` | `uuid` (FK → `sesiones`) | Sesión a la que corresponde |
| `alumno_id` | `uuid` (FK → `alumnos`) | Alumno registrado |
| `estado` | `text` | `'presente'`, `'tarde'` o `'ausente'` |
| `hora_escaneo` | `timestamptz` | Momento exacto del registro |
| `validador_token` | `uuid` | Token único por registro (evita duplicados) |

---

## Roles y Permisos

El sistema tiene dos roles diferenciados:

### Profesor Regular
- Autenticado mediante Supabase Auth (email + contraseña)
- Solo puede acceder y modificar su(s) materia(s) asignada(s)
- Puede gestionar alumnos de sus materias (agregar, renombrar, cambiar materia dentro de las suyas, importar Excel/CSV)
- Puede iniciar y cerrar clases solo de sus materias
- Puede modificar estados de asistencia durante y después de la clase
- Puede editar su perfil (nombre, DNI, email, contraseña, foto)

### Administrador
- Identificado por email = `NEXT_PUBLIC_ADMIN_EMAIL` (variable de entorno)
- Hereda todas las capacidades del Profesor Regular
- Adicionalmente puede:
  - Ver **todas** las materias (propias en "Mis Materias", las demás en "Materias Generales")
  - Iniciar y cerrar clases de **cualquier** materia (vía `/api/admin/sesiones` con service role)
  - Gestionar profesores: crear, editar datos (nombre, DNI, email, contraseña)
  - Gestionar alumnos de todas las materias desde el panel `/admin`
  - Crear y eliminar materias

### Implementación del rol Admin
No hay una columna `rol` en la base de datos. El admin se detecta comparando el email del usuario autenticado con el valor de `NEXT_PUBLIC_ADMIN_EMAIL` tanto en el cliente como en las API Routes. Las políticas RLS de Supabase tienen un bypass adicional:

```sql
CREATE POLICY "admin_all_materias" ON public.materias
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'admin@example.com');
```

Este patrón se repite para `sesiones`, `alumnos` y `asistencias`.

---

## Flujo Completo de una Clase

```
1. Profesor inicia sesión → /login
   └── supabase.auth.signInWithPassword()
   └── Redirect → /profesor/dashboard

2. Dashboard muestra materias
   └── Para "Mis Materias": Supabase client con RLS
   └── Para "Materias Generales" (admin): fetch /api/admin/materias

3. Profesor hace clic en "Iniciar clase"
   └── Si es materia propia: INSERT en sesiones via Supabase client
   └── Si es admin en materia ajena: POST /api/admin/sesiones (service role, sin RLS)
   └── Redirect → /profesor/sesion/[id]

4. Página de sesión muestra:
   ├── QR Code: window.location.origin + /estudiante/sesion/[id]
   ├── Lista en tiempo real de alumnos (Realtime subscription vía Supabase channel)
   └── Contadores: Presentes / Tardes / Ausentes

5. Alumno escanea el QR con su teléfono
   └── Accede a /estudiante/sesion/[id]
   └── Ve lista de alumnos de la materia con DNI al lado del nombre
   └── Toca su nombre → INSERT en asistencias
   └── Marca en localStorage que ya registró (evita doble registro en mismo browser)
   └── localStorage key: `asistencia_${sesionId}`

6. El Realtime subscription del profesor detecta el INSERT
   └── Re-fetch de /api/profesor/asistencia → actualiza lista sin recargar

7. Profesor puede cambiar estados manualmente (PATCH /api/profesor/asistencia)
   └── Funciona tanto con la clase abierta como cerrada
   └── Desde historial o desde la vista en vivo

8. Profesor finaliza la clase
   └── UPDATE sesiones SET estado='inactiva', hora_fin=now()
   └── El botón de "Iniciar clase" del QR desaparece del lado del estudiante

9. Exportar Excel
   └── GET /api/profesor/asistencia → datos con estados actuales (post-edición)
   └── exportarAsistenciaExcel() genera .xlsx con estilos (verde/rojo/naranja)
```

---

## Historial de Asistencia

El historial de un alumno se calcula dinámicamente en el servidor (`/api/profesor/historial-alumno` y `/api/admin/historial-alumno`):

1. Se obtienen todas las **sesiones** de la materia actual del alumno, ordenadas por `hora_inicio DESC`.
2. Se obtienen los registros de **asistencias** del alumno para esas sesiones.
3. Se usa la **fecha de creación del alumno** (`alumnos.created_at`) como punto de referencia. Las sesiones anteriores a esa fecha no se incluyen (el alumno no estaba inscripto).
4. Si existe registro de asistencia → se muestra con su estado (`presente`, `tarde`, `ausente`).
5. Si **no** existe registro pero la sesión es posterior a la inscripción → se marca como `ausente` implícito.

Esto evita el problema de marcar ausentes en materias que el alumno aún no integraba cuando fue transferido de otra.

---

## Importación Masiva de Alumnos (Excel/CSV)

Tanto admins como profesores pueden subir un archivo `.xlsx`, `.xls` o `.csv` con el siguiente formato:

| Columna A | Columna B | Columna C |
|---|---|---|
| Nombre del Alumno | DNI | Teléfono |

La primera fila (encabezado) es ignorada. El archivo es procesado **en el browser** con la librería `xlsx`, luego se envía el array resultante a `POST /api/admin/alumnos` o `POST /api/profesor/alumnos`. El endpoint acepta tanto un objeto simple como un array (bulk insert).

---

## API Routes

Todas las rutas bajo `/api/admin/**` usan `supabaseAdmin` (service role key), por lo que saltean RLS. Las rutas bajo `/api/profesor/**` verifican la autenticación del usuario mediante cookies y luego usan el admin client solo para las operaciones de base de datos.

### Admin

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/admin/alumnos` | Lista alumnos (con filtro por `materia_id`) |
| `POST` | `/api/admin/alumnos` | Crea alumno(s) (singular o array para bulk) |
| `DELETE` | `/api/admin/alumnos` | Elimina alumno por `id` |
| `GET` | `/api/admin/materias` | Lista todas las materias con email del profesor |
| `POST` | `/api/admin/materias` | Crea materia |
| `DELETE` | `/api/admin/materias` | Elimina materia |
| `PATCH` | `/api/admin/editar` | Reasigna materia a profesor / alumno, o renombra |
| `GET` | `/api/admin/profesores-list` | Lista profesores con nombre y DNI de metadata |
| `POST` | `/api/admin/profesores` | Crea usuario-profesor en Supabase Auth |
| `PATCH` | `/api/admin/profesores` | Actualiza email/contraseña/metadata de un profesor |
| `GET` | `/api/admin/historial-alumno` | Historial de asistencia de un alumno |
| `POST` | `/api/admin/sesiones` | Inicia clase para cualquier materia (sin RLS) |
| `PATCH` | `/api/admin/sesiones` | Cierra clase para cualquier sesión (sin RLS) |

### Profesor

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/profesor/materias` | Materias asignadas al prof. autenticado |
| `GET` | `/api/profesor/alumnos` | Alumnos de las materias del prof. |
| `POST` | `/api/profesor/alumnos` | Crea alumno(s) en sus materias |
| `PATCH` | `/api/profesor/alumnos` | Edita nombre, DNI, teléfono o materia |
| `DELETE` | `/api/profesor/alumnos` | Elimina alumno de sus materias |
| `GET` | `/api/profesor/asistencia` | Lista alumnos + estado para una sesión |
| `PATCH` | `/api/profesor/asistencia` | Upsert estado de asistencia de un alumno |
| `GET` | `/api/profesor/historial-alumno` | Historial de asistencia de un alumno |

### Auth

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/auth/callback` | Callback de Supabase Auth para confirmaciones de email |

---

## Sistema de Temas (Dark Mode)

El sistema de temas está implementado con CSS custom properties + `next-themes`.

### Design Tokens (`globals.css`)

```css
:root {                              /* Light mode */
  --background: #F2F2F7;
  --foreground: #1C1C1E;
  --surface: #ffffff;
  --surface-hover: #f9fafb;
  --border-subtle: #f9fafb;
  --border-strong: #e5e7eb;
  --text-muted: #8E8E93;
}

.dark {                              /* Dark mode */
  --background: #000000;            /* Jet Black */
  --foreground: #f1f5f9;
  --surface: #1C1C1E;               /* Space Gray */
  --surface-hover: #2C2C2E;
  --border-subtle: rgba(255,255,255,0.05);
}
```

Tailwind v4 los mapea mediante `@theme`:
```css
@theme {
  --color-background: var(--background);
  --color-surface: var(--surface);
  /* ... */
}
```

Esto permite usar clases como `bg-background`, `text-foreground`, `border-subtle` directamente en JSX, y el color cambia automáticamente al activar dark mode.

### Persistencia

`next-themes` guarda la preferencia en `localStorage` y aplica la clase `.dark` al `<html>` antes de que React hidrate, evitando el flash de contenido incorrecto (FOUC).

```tsx
// layout.tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="fecqr-theme">
```

---

## Configuración y Variables de Entorno

Crear `.env.local` en la raíz del proyecto:

```env
# URL pública de Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co

# Anon Key (segura para el browser)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Service Role Key (SOLO server-side, nunca NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Email del administrador del sistema
NEXT_PUBLIC_ADMIN_EMAIL=admin@example.com
ADMIN_EMAIL=admin@example.com

# URL base del sitio (usado para algunos redirects de auth)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> **Importante:** `SUPABASE_SERVICE_ROLE_KEY` tiene acceso completo a tu base de datos sin restricciones. Nunca la expongas en el cliente.

---

## Instalación Local

### Prerrequisitos

- Node.js 18+
- Una cuenta de Supabase con el proyecto configurado

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/FECQR.git
cd FECQR

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 4. Ejecutar en desarrollo
npm run dev
```

La app estará disponible en http://localhost:3000

### Configuración inicial de Supabase

1. Crear las tablas (`materias`, `alumnos`, `sesiones`, `asistencias`) con el schema definido en [Base de Datos](#base-de-datos).
2. Habilitar **Realtime** para la tabla `asistencias` en Supabase Dashboard → Database → Replication.
3. Configurar las **políticas RLS** para cada tabla.
4. Crear el bucket **avatars** en Storage con acceso público para las fotos de perfil.
5. En Authentication → URL Configuration, asegurarse de que `Site URL` apunte a tu dominio.

---

## Deploy en Vercel

### Variables de entorno en Vercel

En **Project Settings → Environment Variables**, agregar:

| Variable | Entorno |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All |
| `SUPABASE_SERVICE_ROLE_KEY` | All |
| `NEXT_PUBLIC_ADMIN_EMAIL` | All |
| `ADMIN_EMAIL` | All |
| `NEXT_PUBLIC_SITE_URL` | Production (tu dominio de Vercel) |

### Configuración de Supabase para producción

En el dashboard de Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://tu-proyecto.vercel.app`
- **Redirect URLs:** agregar `https://tu-proyecto.vercel.app/auth/callback`

Esto es necesario para que los emails de confirmación (cambio de email, recuperación de contraseña) redirijan al dominio correcto y no a `localhost`.

### El QR

El QR se genera con `window.location.origin`, lo que hace que automáticamente apunte al dominio correcto en producción sin configuración adicional.

---

## Decisiones de Diseño

### Por qué API Routes y no RLS puro

Las RLS de Supabase son ideales para acceso directo desde el cliente, pero se vuelven complejas para operaciones donde el servidor necesita actuar en nombre de múltiples usuarios (como un admin que cambia datos de estudiantes de otro profesor). Las API Routes actúan como un proxy de confianza que verifica la identidad del usuario con cookies y luego usa el service role para la operación en la base de datos.

### Por qué xlsx se carga en el cliente para el upload pero en el servidor para el export

- **Import (upload):** el usuario elige un archivo desde su dispositivo. Para parsearlo no hay razón para enviarlo al servidor; se procesa en el browser con `xlsx` y se envía el JSON resultante a la API. Esto reduce el tamaño del request y mantiene la privacidad de los datos.
- **Export:** el `.xlsx` se genera en la página del profesor con `XLSX.writeFile()` que dispara una descarga directamente en el browser. `serverExternalPackages: ['xlsx']` en `next.config.ts` evita que `xlsx` sea bundleado en el edge runtime pero permite su uso en el contexto Node.js del servidor.

### Cálculo de ausencias sin columna de estado explícita

Los alumnos ausentes **no tienen fila en la tabla `asistencias`**. El estado "ausente" se calcula al vuelo en el servidor al servir el historial y la lista de asistencia:

```
Si alumno está en la materia Y hay sesión Y no hay registro → ausente
```

El punto de corte temporal es `alumnos.created_at`, resolviendo el problema de alumnos transferidos entre materias que aparecían como "ausentes" en clases donde todavía estaban en otra materia.

### Dark Mode sin flash (FOUC)

`next-themes` inyecta un script inline en el `<head>` antes del primer render que lee `localStorage` y aplica la clase `.dark` al `<html>`, garantizando que el tema correcto se aplique antes de que el CSS se procese. Esto elimina el parpadeo blanco característico de implementaciones de dark mode basadas en `useEffect`.
