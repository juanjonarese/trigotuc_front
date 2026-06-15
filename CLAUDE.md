# CLAUDE.md — Frontend (trigotuc_front)

React 19 + Vite SPA for Trigotuc Avícola. Connects to the Node.js/Express backend at `VITE_API_URL`.

## Development Commands

```bash
npm run dev      # Vite dev server (default port 5173)
npm run build    # Production build
npm run lint     # ESLint
```

There are no automated tests.

## Architecture

### Routing (`src/App.jsx`)

**Public:**
- `/login`

**Protected (all wrapped in `<ProtectedRoute>`):**

| Route | Page | Área |
|-------|------|------|
| `/dashboard` | `DashboarPage` (typo intencional) | General |
| `/clientes` | `ClientesPage` | Altas |
| `/personal` | `PersonalPage` (gestión de usuarios) | Altas |
| `/camiones` | `CamionesPage` (camiones + choferes inline) | Altas |
| `/frigorifico` | `GranjaDashboardPage` (stock cámara) | Frigorífico |
| `/frigorifico/lotes/nuevo` | `LoteCreatePage` (faenar) | Frigorífico |
| `/frigorifico/pedidos-granja` | `PedidosGranjaPage` | Frigorífico |
| `/frigorifico/envios` | `EnvioCamaraPage` | Frigorífico |
| `/frigorifico/decomisados` | `DecomisadosPage` | Frigorífico |
| `/frigorifico/stock-empaque` | `StockEmpaquePage` | Frigorífico |
| `/frigorifico/ordenes-carga` | `DespachoFrigorificoPage` | Frigorífico |
| `/frigorifico/recepcion` | `RecepcionFrigorificoPage` | Frigorífico |
| `/frigorifico/recepcion-remitos` | `RecepcionRemitosPage` | Frigorífico |
| `/frigorifico/historial-accesos` | `HistorialAccesosPage` (audit log) | Frigorífico |
| `/granja/galpones` | `GranjaLotesPage` | Granja (crianza) |
| `/granja/galpones/nuevo` | `GranjaLoteNuevoPage` (ingreso pollitos) | Granja |
| `/granja/cargar-datos` | `GranjaCargaDatosPage` (datos semanales) | Granja |
| `/granja/historial` | `GranjaHistorialPage` | Granja |
| `/granja/ordenes-carga` | `OrdenCargaListPage` | Granja |
| `/granja/ordenes-carga/:id` | `OrdenCargaDetallePage` | Granja |
| `/granja/recepcion-ordenes` | `RecepcionOrdenCargaPage` | Granja |
| `/granja/ventas` | `VentasGranjaPage` | Granja |
| `/granja/remitos` | `GranjaRemitosPage` | Granja |
| `/chofer` | `ChoferPage` (Cargas Camión) | Chofer |

Default redirect: `/` y rutas desconocidas → `/login`.

### Roles (`localStorage.rolUsuario`)

`superadmin`, `administracion_frigorifico`, `administracion_granja`, `frigorifico`, `camaras`, `granja`, `chofer`.

> El gateo por rol en el frontend es **cosmético** (oculta secciones del sidebar). La autorización real la aplica el backend con JWT + middleware. No confiar en el front para seguridad.

### Authentication Flow

1. Login con `emailUsuario` + `contraseniaUsuario` → `POST /api/usuarios/login`.
   - Los choferes pueden loguearse con **teléfono** en lugar de email.
2. En éxito se guarda en `localStorage`: `isAuthenticated`, `token`, `rolUsuario`, `emailUsuario`, `nombreUsuario`.
3. Toda llamada manda `Authorization: Bearer <token>` (helper `getAuthHeaders()` en `api.js`).
4. `ProtectedRoute` chequea `localStorage.isAuthenticated === "true"`.
5. Logout: `localStorage.clear()` → `/login`.

### Sidebar (`src/components/Layout.jsx`)

Secciones colapsables, fondo oscuro, auto-expande según la ruta activa. Visibilidad por rol:

- **Panel Principal** (`/dashboard`) — oculto para `frigorifico`, `granja`, `chofer`.
- **Altas** (colapsable) — `superadmin` / `administracion_frigorifico` / `administracion_granja`:
  - Clientes; Usuarios (solo `superadmin`); Camiones.
- **Actividad** (`/frigorifico/historial-accesos`) — solo `superadmin`.
- **Granja** (colapsable) — `superadmin` / `administracion_granja` / `granja`:
  - Ingreso de pollitos, Galpones, Datos Semanales (solo `superadmin`/`granja`), Órdenes de Carga (Venta) (solo `superadmin`/`administracion_granja`), Recepción de Órdenes.
- **Frigorífico** (colapsable) — todos menos `granja` y `chofer`:
  - Pedidos a Granja, Faenar, Stock, Órdenes de Carga (Venta), Recepción de Órdenes, Envío Cámara, Stock Empaque (solo `superadmin`). Decomisados está comentado.
- **Chofer** (`/chofer`, "Cargas Camión") — `chofer` / `superadmin`.

### API Service (`src/services/api.js`)

Todas las funciones siguen el patrón `apiMethod(endpoint, data?)`, usan `getAuthHeaders()` y `handleResponse()` (lanza error en respuestas no-OK; en 401 limpia sesión).

Secciones: `USUARIOS`, `CLIENTES`, `LOTES (FAENA)`, `ENVÍOS CÁMARA`, `DESPACHOS FRIGORIFICO`, `AUDIT LOG`, `ÓRDENES DE RETIRO` (solo `obtenerOrdenesRetiro`, legacy — la usa el KPI del Dashboard), `DECOMISADOS`, `CAMIONES`, `GRANJA (CRIANZA)`, `PEDIDOS INGRESO POLLITOS`, `VENTAS GRANJA (GORDOS)`, `ÓRDENES DE CARGA`, `REMITOS GRANJA`, `STOCK EMPAQUE`, `PUSH NOTIFICATIONS`.

### Components

| File | Purpose |
|------|---------|
| `Layout.jsx` | Sidebar + header wrapper |
| `ProtectedRoute.jsx` | Guard de auth (chequea `localStorage`) |
| `CalibreTable.jsx` | Tabla reutilizable de carga por calibre. Props: `lineas`, `onChange`, `showTotals`, `showPrecio` |
| `SelectDropdown.jsx` | Dropdown custom (usado por `CalibreTable`) |
| `Pagination.jsx` | Paginación genérica |
| `Footer.jsx` | Footer (login + algunas páginas) |

### Hooks / Utils

- `hooks/usePushNotification.js` — suscripción a push (VAPID); expone `estado`, `activar`, `rolHabilitado`.
- `utils/dateUtils.js`, `utils/numeroALetras.js`, `utils/whatsappUtils.js`.

### Styling

- Bootstrap 5 + Bootstrap Icons.
- CSS custom en `src/css/` (`DashboardPage.css`, `Login.css`, `Tablas.css`, `ComprobantePago.css`).
- Patrón responsive: cards en mobile (`d-md-none`) / tablas en desktop (`d-none d-md-block`).
- `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })` para montos.
- SweetAlert2 para modales/confirmaciones; `xlsx` para export Excel.
- PWA: `public/manifest.json` + `public/sw.js`.

## Important Notes

- `DashboarPage.jsx` — typo en el nombre, **no renombrar** (rompería imports).
- `._id` siempre, nunca `.id` para documentos MongoDB.
- Las funciones de impresión arman HTML con `document.write`. Interpolar SIEMPRE
  los datos de texto del usuario (razón social, observaciones, etc.) con
  `escapeHtml()` de `utils/escapeHtml.js` para evitar XSS.

## Notas de seguridad (riesgos aceptados)

- `xlsx` (SheetJS) tiene vulnerabilidades sin fix en npm (prototype pollution /
  ReDoS). Se acepta el riesgo porque solo se usa para **exportar** (escribir
  Excel), nunca para parsear archivos subidos por el usuario, que es el único
  vector explotable. Si en el futuro se importan archivos `.xlsx` de usuarios,
  reemplazar por `exceljs` o migrar a la versión parcheada del CDN de SheetJS.

## Environment Variables

```
VITE_API_URL=http://localhost:4000/api
VITE_BACKEND_URL=https://trigotuc-back.vercel.app
```
