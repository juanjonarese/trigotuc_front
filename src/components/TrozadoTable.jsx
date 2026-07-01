import React from "react";

const fmtNum = (n) =>
  n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";

// Tipos de trozado y su kg/caja por defecto. carcaza permite editar kg/caja.
// `clases: true` → el tipo se separa por calidad A y B ya en la faena.
export const TROZADO_TIPOS = [
  { tipo: "menudo",  label: "Menudo",  kgCajaDefault: 10, editableKg: false, clases: false },
  { tipo: "filet",   label: "Filet",   kgCajaDefault: 15, editableKg: false, clases: true  },
  { tipo: "pata",    label: "Pata",    kgCajaDefault: 15, editableKg: false, clases: true  },
  { tipo: "alita",   label: "Alita",   kgCajaDefault: 15, editableKg: false, clases: true  },
  { tipo: "carcaza", label: "Carcaza", kgCajaDefault: 12, editableKg: true,  clases: false },
];

// Identidad de una fila/línea de trozado: tipo + clase ("-" si no tiene).
export const trozadoKey = (t) => `${t.tipo}|${t.clase || "-"}`;

// Filas visibles de la tabla: los tipos con clases:true generan una fila A y una B.
export const TROZADO_FILAS = TROZADO_TIPOS.flatMap((t) =>
  t.clases
    ? ["A", "B"].map((clase) => ({ ...t, clase, label: `${t.label} ${clase}` }))
    : [{ ...t, clase: null }]
);

// Estado inicial de la tabla de trozados (todas las líneas en 0 cajas).
export const trozadosVacios = () =>
  TROZADO_FILAS.map((t) => ({ ...t, kgCaja: t.kgCajaDefault, cajas: "" }));

// Estado de la tabla a partir de los trozados guardados de un lote (match por tipo+clase).
export const trozadosDesdeLote = (trozadosLote = []) =>
  TROZADO_FILAS.map((t) => {
    const guardado = trozadosLote.find(
      (x) => x.tipo === t.tipo && (x.clase || null) === (t.clase || null)
    );
    return {
      ...t,
      kgCaja: guardado?.kgCaja ?? t.kgCajaDefault,
      cajas:  guardado?.cajas != null ? String(guardado.cajas) : "",
    };
  });

// Convierte el estado de la tabla en el payload de trozados (solo líneas con cajas).
export const trozadosAPayload = (lineas) =>
  lineas
    .filter((t) => Number(t.cajas) > 0)
    .map((t) => ({
      tipo:    t.tipo,
      clase:   t.clase || undefined,
      kgCaja:  Number(t.kgCaja),
      cajas:   Number(t.cajas),
      kgTotal: Number(t.cajas) * Number(t.kgCaja),
    }));

// ── Tabla de carga de trozados por tipo ──────────────────────────────────────
export const TrozadoTable = ({ lineas, onChange, kgTrozadosTotal }) => {
  const set = (key, campo, valor) => {
    onChange(lineas.map((l) => (trozadoKey(l) === key ? { ...l, [campo]: valor } : l)));
  };

  const totalCajas = lineas.reduce((s, l) => s + (Number(l.cajas) || 0), 0);
  const totalKg    = lineas.reduce((s, l) => s + (Number(l.cajas) || 0) * (Number(l.kgCaja) || 1), 0);

  const kgRef      = Number(kgTrozadosTotal) || 0;
  const diferencia = kgRef > 0 ? +(totalKg - kgRef).toFixed(2) : null;

  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th style={{ width: 110 }}>Tipo</th>
            <th style={{ width: 90 }} className="text-center">Kg/caja</th>
            <th style={{ width: 130 }}>Cajas</th>
            <th className="text-end">Kg calculados</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => {
            const key   = trozadoKey(l);
            const cajas = Number(l.cajas) || 0;
            const kgCaj = Number(l.kgCaja) || 1;
            const kg    = cajas * kgCaj;
            return (
              <tr key={key}>
                <td className="fw-semibold small">{l.label}</td>
                <td className="text-center">
                  {l.editableKg ? (
                    <input
                      type="number"
                      className="form-control form-control-sm text-center"
                      value={l.kgCaja}
                      onChange={(e) => set(key, "kgCaja", e.target.value)}
                      min="1" max="20" step="0.5"
                      style={{ width: 70 }}
                    />
                  ) : (
                    <span className="text-muted">{l.kgCaja} kg</span>
                  )}
                </td>
                <td>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={l.cajas}
                    onChange={(e) => set(key, "cajas", e.target.value)}
                    min="0" step="1" placeholder="0"
                  />
                </td>
                <td className="text-end fw-semibold">
                  {kg > 0
                    ? <span className="text-success">{fmtNum(kg)} kg</span>
                    : <span className="text-muted">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="table-light">
          <tr>
            <td colSpan={2} className="fw-semibold small">Total</td>
            <td className="fw-semibold text-primary">
              {totalCajas > 0 ? `${totalCajas} cajas` : "—"}
            </td>
            <td className="text-end fw-semibold">
              {totalKg > 0 ? `${fmtNum(totalKg)} kg` : "—"}
              {diferencia !== null && (
                <span className={`ms-2 small ${Math.abs(diferencia) > 0.1 ? "text-danger" : "text-success"}`}>
                  {diferencia === 0 ? "✓" : `(${diferencia > 0 ? "+" : ""}${diferencia} kg)`}
                </span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

// ── Selector de destino por grupo ─────────────────────────────────────────────
// destino: null (sin elegir) | "camara" | "pendiente". Sin color por opción:
// el botón elegido se marca en oscuro; ninguno viene marcado por defecto.
export const DestinoGrupo = ({ titulo, kg, destino, onChange }) => (
  <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-2">
    <div style={{ minWidth: 140 }}>
      <span className="fw-semibold">{titulo}</span>
      <span className="text-muted small ms-1">({fmtNum(kg)} kg)</span>
    </div>
    <div className="d-flex gap-2">
      <button type="button"
        className={`btn btn-sm ${destino === "camara" ? "btn-dark" : "btn-outline-secondary"}`}
        onClick={() => onChange("camara")}>
        <i className="bi bi-snow me-1"></i>A cámara ahora
      </button>
      <button type="button"
        className={`btn btn-sm ${destino === "pendiente" ? "btn-dark" : "btn-outline-secondary"}`}
        onClick={() => onChange("pendiente")}>
        <i className="bi bi-hourglass-split me-1"></i>Queda pendiente
      </button>
    </div>
  </div>
);

export default TrozadoTable;
