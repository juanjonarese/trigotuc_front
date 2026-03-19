# CLAUDE.md — Frontend (trigotuc_front)

React 19 + Vite SPA for Trigotuc Avícola. Connects to the Node.js/Express backend at `VITE_API_URL`.

## Development Commands

```bash
npm run dev      # Vite dev server
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

### Routing (`src/App.jsx`)

**Public:**
- `/login`

**Protected (all via `<ProtectedRoute>`):**
- `/dashboard` — Main dashboard
- `/clientes` — Clients CRUD
- `/personal` — Staff management (admin only)
- `/facturacion` — Invoices list
- `/facturacion/crear` — Create invoice
- `/cobros` — Collections list
- `/cobros/registrar` — Register collection
- `/cta-cte-clientes` — Client current account
- `/caja` — Cash box
- `/granja` — Farm dashboard (stock overview)
- `/granja/lotes/nuevo` — Create batch
- `/granja/lotes/actualizar` — Update batch
- `/granja/ventas` — Poultry sales
- `/listas-precios` — Price lists (admin only)

Default redirect: unknown routes → `/login`

### Authentication Flow

1. Login with `emailUsuario` + `contraseniaUsuario` → `POST /api/usuarios/login`
2. On success, stores in `localStorage`: `isAuthenticated`, `token`, `rolUsuario`, `emailUsuario`
3. All API calls send `Authorization: Bearer <token>`
4. 401 response → clear localStorage → redirect to login

### Key Pages

| File | Purpose |
|------|---------|
| `LoginScreen.jsx` | Login form |
| `DashboarPage.jsx` | Dashboard (note: typo in filename) |
| `ClientesPage.jsx` | Clients CRUD + listaPrecios select in modal |
| `PersonalPage.jsx` | User management (admin only) |
| `FacturasListPage.jsx` | Invoice list with filters |
| `FacturacionPage.jsx` | Create invoice |
| `CobrosListPage.jsx` | Collections list |
| `CobrosCreatePage.jsx` | Register collection |
| `CtaCteClientesPage.jsx` | Client current account + Excel export |
| `CajaPage.jsx` | Cash box management |
| `GranjaDashboardPage.jsx` | Farm stock overview |
| `LoteCreatePage.jsx` | Create new batch |
| `ActualizarLotePage.jsx` | Update existing batch |
| `VentasPolloPage.jsx` | Register/list poultry sales (per-calibre pricing + discount) |
| `ListasPreciosPage.jsx` | CRUD for price lists (admin only) |

### Key Components

| File | Purpose |
|------|---------|
| `Layout.jsx` | Sidebar + header wrapper |
| `ProtectedRoute.jsx` | Auth guard (checks localStorage) |
| `CalibreTable.jsx` | Reusable calibre input table. Props: `lineas`, `onChange`, `showTotals`, `showPrecio` |
| `Pagination.jsx` | Generic pagination |

#### CalibreTable prop `showPrecio`
When `showPrecio={true}` (used in VentasPolloPage):
- Lineas have shape `{ calibre, pollos, precioPorCajon }`
- Shows $/cajón input and Subtotal column per line
- When false (default, LoteCreate/ActualizarLote): lineas = `{ calibre, pollos }`, shows Kg column

### API Service (`src/services/api.js`)

All functions follow the pattern `apiMethod(endpoint, data?)` and throw on non-OK responses.

**Sections:**
- `USUARIOS` — login, CRUD
- `CLIENTES` — CRUD + buscar (all responses include `listaPrecios` populated)
- `FACTURAS` — CRUD + numero-factura-x
- `COBROS` — CRUD + forzar + recibo
- `CUENTA CORRIENTE` — ctacte + resumen IVA
- `CAJA` — movimientos + transferencias
- `LOTES (GRANJA)` — CRUD lotes + historial + resumen stock
- `VENTAS POLLO (GRANJA)` — obtener, crear, eliminar
- `LISTAS DE PRECIOS` — `obtenerListasPrecios`, `obtenerListaPrecioPorId`, `crearListaPrecio`, `actualizarListaPrecio`, `eliminarListaPrecio`

### Sidebar Structure (`Layout.jsx`)

Collapsible sections, dark background:
1. **Panel Principal** — `/dashboard`
2. **Altas** (collapsible) — Clientes, Usuarios (admin only)
3. **Contable Clientes** (collapsible) — Facturas, Cobros, Cta Cte (hidden for `personal`)
4. **Caja** — hidden for `personal`
5. **Granja** (collapsible) — Stock, Nuevo Lote, Actualizar Lote (admin+granja), Envío Cámara (admin+granja)
6. **Comercial** (collapsible, admin only) — Listas de Precios

Auto-expands section based on active route.

### Styling

- Bootstrap 5.3.8 + Bootstrap Icons
- Custom CSS in `src/css/`
- Responsive: mobile cards / desktop tables pattern used throughout
- `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })` for ARS formatting
- SweetAlert2 for modals/confirmations
- xlsx for Excel export (CtaCteClientesPage)

### Environment Variables

```
VITE_API_URL=http://localhost:3001/api
```

## Important Notes

- `DashboarPage.jsx` — typo in filename, don't rename (would break imports)
- `._id` always, never `.id` for MongoDB documents
- `rolUsuario` values: `admin`, `personal`, `contable`, `granja`, `compras`, `usuario`
- Bootstrap grid: mobile-first, `d-md-none` for mobile cards, `d-none d-md-block` for desktop tables
