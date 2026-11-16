import React from "react";
import { pagoVacio, sumaPagos } from "../../utils/forratuc/pagosForratuc";

/**
 * Editor de pagos de Forratuc (2026-10-21): uno o varios medios, cada uno con su
 * importe y el detalle que pide (cheque: banco, serie, número, fecha de
 * emisión, fecha de cobro, librador; crédito: cuotas; transferencia / Mercado Pago: n° de operación).
 * Los medios y sus campos vienen del back (`constantes.mediosPago`).
 *
 * Lo usan el presupuesto de contado (con `total`: muestra cuánto falta y ofrece
 * completar) y el cobro de cuenta corriente (sin `total`: el cobro vale lo que
 * sumen los pagos).
 */

const ETIQUETA_CAMPO = {
  cuotas: "Cuotas",
  banco: "Banco",
  numero: "N° de cheque",
  serie: "Serie",
  fechaEmision: "Fecha de emisión",
  fechaCobro: "Fecha de cobro",
  librador: "Librador",
  operacion: "N° de operación",
};

// Cheque (2026-11-12): entre la emisión y el cobro, como mucho 365 días (el back lo controla igual).
const DIAS_MAX_CHEQUE = 365;
const diasCheque = (p) =>
  p.fechaEmision && p.fechaCobro
    ? Math.round((new Date(`${p.fechaCobro}T12:00:00Z`) - new Date(`${p.fechaEmision}T12:00:00Z`)) / 86400000)
    : null;
const FECHAS = ["fechaCobro", "fechaEmision"];

const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));

const PagosForratuc = ({ medios = [], pagos, onChange, total = null }) => {
  const suma = sumaPagos(pagos);
  const falta = total != null ? Math.round((total - suma) * 100) / 100 : 0;

  const set = (id, cambios) => onChange(pagos.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
  const quitar = (id) => onChange(pagos.length === 1 ? [pagoVacio()] : pagos.filter((p) => p.id !== id));
  const agregar = () => onChange([...pagos, pagoVacio("efectivo", falta > 0 ? falta : "")]);

  return (
    <div>
      {pagos.map((p) => {
        const medio = medios.find((m) => m.key === p.medio);
        return (
          <div key={p.id} className="border rounded p-2 mb-2 bg-light">
            <div className="row g-2 align-items-end">
              <div className="col-12 col-sm-5 col-lg-3">
                <label className="form-label small mb-1">Medio</label>
                <select className="form-select form-select-sm" value={p.medio} onChange={(e) => set(p.id, { medio: e.target.value })}>
                  {medios.map((m) => (
                    <option key={m.key} value={m.key}>{m.etiqueta}</option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-sm-4 col-lg-2">
                <label className="form-label small mb-1">Importe</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text">$</span>
                  <input type="number" min="0" step="0.01" className="form-control" value={p.importe}
                    onChange={(e) => set(p.id, { importe: e.target.value })} />
                </div>
              </div>
              {(medio?.campos || []).map((c) => (
                <div key={c} className={c === "cuotas" ? "col-6 col-sm-3 col-lg-1" : "col-6 col-sm-4 col-lg-2"}>
                  <label className="form-label small mb-1">
                    {ETIQUETA_CAMPO[c] || c}
                    {(medio.obligatorios || []).includes(c) ? " *" : ""}
                  </label>
                  <input
                    type={FECHAS.includes(c) ? "date" : c === "cuotas" ? "number" : "text"}
                    min={c === "cuotas" ? 1 : undefined}
                    step={c === "cuotas" ? 1 : undefined}
                    className="form-control form-control-sm"
                    value={p[c] ?? ""}
                    onChange={(e) => set(p.id, { [c]: e.target.value })}
                  />
                </div>
              ))}
              {(() => {
                const dias = diasCheque(p);
                if (dias == null || !(medio?.campos || []).includes("fechaEmision")) return null;
                const mal = dias < 0 || dias > DIAS_MAX_CHEQUE;
                return (
                  <div className={`col-12 small ${mal ? "text-danger" : "text-muted"}`}>
                    {dias < 0
                      ? "La fecha de cobro no puede ser anterior a la de emisión."
                      : `${dias} días entre la emisión y el cobro${dias > DIAS_MAX_CHEQUE ? ` — no puede pasar de ${DIAS_MAX_CHEQUE}.` : "."}`}
                  </div>
                );
              })()}
              <div className="col-auto ms-auto">
                <button type="button" className="btn btn-sm btn-outline-danger border-0" title="Quitar" onClick={() => quitar(p.id)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <div className="d-flex flex-wrap align-items-center gap-2">
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={agregar}>
          <i className="bi bi-plus-lg me-1"></i>Otro medio de pago
        </button>
        <span className="ms-auto small">
          Pagos: <strong>{pesos(suma)}</strong>
          {total != null && falta !== 0 && (
            <span className={`ms-2 fw-semibold ${falta > 0 ? "text-danger" : "text-warning"}`}>
              {falta > 0 ? `Falta ${pesos(falta)}` : `Sobra ${pesos(-falta)}`}
            </span>
          )}
          {total != null && falta === 0 && suma > 0 && <span className="ms-2 text-success fw-semibold">Cubre el total</span>}
        </span>
      </div>
    </div>
  );
};

export default PagosForratuc;
