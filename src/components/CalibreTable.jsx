import React, { useState, useEffect, useRef } from "react";
import SelectDropdown from "./SelectDropdown";

const CALIBRES = [5, 6, 7, 8, 9, 10, 11];

const calcularCajones = (pollos, calibre) =>
  pollos && calibre ? Math.floor(Number(pollos) / Number(calibre)) : 0;

/**
 * Tabla de calibres con flujo "aceptar ítem".
 *
 * Props:
 *   lineas:           [{ calibre, pollos }] o [{ calibre, cajones, pollos, precioPorCajon }]
 *   onChange:         (nuevasLineas) => void
 *   showTotals:       bool  (default true)
 *   showPrecio:       bool  (default false) — agrega campo $/cajón y columna subtotal
 *   inputCajones:     bool  (default false)
 *     false → el usuario ingresa POLLOS (ingreso/actualización de lote)
 *     true  → el usuario ingresa CAJONES (ventas y envíos)
 *   stockCalibres:    [{ calibre, cajones }] | null
 *     Muestra el stock disponible por calibre en el selector y deshabilita los que no tienen stock.
 *   preciosPorCalibre: { [calibre]: number } | null
 *     Precio sugerido por calibre (de la lista del cliente). Se autocarga al cambiar el calibre.
 */
const CalibreTable = ({
  lineas,
  onChange,
  showTotals = true,
  showPrecio = false,
  inputCajones = false,
  stockCalibres = null,
  preciosPorCalibre = null,
}) => {
  const calibresUsados = lineas.map((l) => Number(l.calibre));

  // Primer calibre con stock disponible (o simplemente el primero libre)
  const primerCalibreDisponible = () =>
    CALIBRES.find((c) => {
      if (calibresUsados.includes(c)) return false;
      if (!stockCalibres) return true;
      return (stockCalibres.find((s) => s.calibre === c)?.cajones ?? 0) > 0;
    }) ?? CALIBRES.find((c) => !calibresUsados.includes(c)) ?? CALIBRES[0];

  const [draft, setDraft] = useState({
    calibre: primerCalibreDisponible(),
    valor: "",
    precioPorCajon: 0,
  });
  const [errorDraft, setErrorDraft] = useState("");
  const inputRef = useRef(null);

  // ── Cuando cambia stockCalibres (lote/cámara cambia): saltar al primer calibre con stock ──
  useEffect(() => {
    if (!stockCalibres) return;
    const stockActual = stockCalibres.find((s) => s.calibre === draft.calibre)?.cajones ?? 0;
    if (stockActual <= 0) {
      const primero = primerCalibreDisponible();
      setDraft((prev) => ({ ...prev, calibre: primero, valor: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockCalibres]);

  // ── Cuando cambia la lista de precios (cliente cambia): actualizar precio del draft ──
  useEffect(() => {
    if (!preciosPorCalibre || !showPrecio) return;
    const precio = preciosPorCalibre[draft.calibre];
    if (precio !== undefined) {
      setDraft((prev) => ({ ...prev, precioPorCajon: precio }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preciosPorCalibre]);

  // ── Valores derivados del draft ──────────────────────────────────────
  const draftNum     = Number(draft.valor) || 0;
  const draftCajones = inputCajones ? draftNum : calcularCajones(draftNum, draft.calibre);
  const draftPollos  = inputCajones ? draftNum * Number(draft.calibre) : draftNum;

  // Stock disponible del calibre seleccionado en el draft
  const stockDraftCalibre = stockCalibres
    ? (stockCalibres.find((s) => s.calibre === draft.calibre)?.cajones ?? 0)
    : null;

  // ── Cambiar calibre en el draft ──────────────────────────────────────
  const handleCalibreChange = (nuevoCalib) => {
    const updates = { calibre: nuevoCalib, valor: "" };
    if (showPrecio && preciosPorCalibre?.[nuevoCalib] !== undefined) {
      updates.precioPorCajon = preciosPorCalibre[nuevoCalib];
    }
    setDraft((prev) => ({ ...prev, ...updates }));
    setErrorDraft("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ── Aceptar ítem ─────────────────────────────────────────────────────
  const aceptar = () => {
    if (!draft.valor || draftNum <= 0) {
      setErrorDraft(`Ingresá la cantidad de ${inputCajones ? "cajones" : "pollos"}`);
      inputRef.current?.focus();
      return;
    }
    if (calibresUsados.includes(Number(draft.calibre))) {
      setErrorDraft(`El calibre ${draft.calibre} ya fue ingresado`);
      return;
    }
    if (stockCalibres && draftCajones > (stockDraftCalibre ?? Infinity)) {
      setErrorDraft(
        `Stock insuficiente. Disponible: ${stockDraftCalibre} cajones`
      );
      return;
    }

    const nuevaLinea = {
      calibre: Number(draft.calibre),
      pollos:  draftPollos,
      cajones: draftCajones,
      ...(showPrecio ? { precioPorCajon: Number(draft.precioPorCajon || 0) } : {}),
    };
    onChange([...lineas, nuevaLinea]);

    // Avanzar al siguiente calibre con stock disponible
    const nuevosUsados = [...calibresUsados, Number(draft.calibre)];
    const siguiente = CALIBRES.find((c) => {
      if (nuevosUsados.includes(c)) return false;
      if (!stockCalibres) return true;
      return (stockCalibres.find((s) => s.calibre === c)?.cajones ?? 0) > 0;
    });
    setDraft({
      calibre: siguiente ?? CALIBRES.find((c) => !nuevosUsados.includes(c)) ?? CALIBRES[0],
      valor: "",
      precioPorCajon: siguiente && preciosPorCalibre?.[siguiente] !== undefined
        ? preciosPorCalibre[siguiente]
        : 0,
    });
    setErrorDraft("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ── Eliminar ítem ────────────────────────────────────────────────────
  const eliminar = (index) => {
    const removida = lineas[index];
    onChange(lineas.filter((_, i) => i !== index));
    const restantes = calibresUsados.filter((c) => c !== Number(removida.calibre));
    if (restantes.includes(Number(draft.calibre))) {
      setDraft((prev) => ({ ...prev, calibre: Number(removida.calibre) }));
    }
  };

  // ── Edición inline de precio en tabla ────────────────────────────────
  const handlePrecioLinea = (index, value) => {
    onChange(lineas.map((l, i) => i === index ? { ...l, precioPorCajon: value } : l));
  };

  // ── Totales ──────────────────────────────────────────────────────────
  const lineasComp = lineas.map((l) => {
    const cajones = l.cajones !== undefined
      ? Number(l.cajones)
      : calcularCajones(l.pollos, l.calibre);
    const pollos = l.pollos !== undefined ? Number(l.pollos) : cajones * Number(l.calibre);
    const precio = Number(l.precioPorCajon || 0);
    return { ...l, cajones, pollos, subtotal: cajones * precio };
  });

  const totalPollos   = lineasComp.reduce((acc, l) => acc + l.pollos, 0);
  const totalCajones  = lineasComp.reduce((acc, l) => acc + l.cajones, 0);
  const totalKg       = totalCajones * 20;
  const subtotalBruto = lineasComp.reduce((acc, l) => acc + l.subtotal, 0);

  const todosUsados  = calibresUsados.length >= CALIBRES.length;
  const sinStockTotal = stockCalibres !== null &&
    CALIBRES.every((c) =>
      calibresUsados.includes(c) ||
      (stockCalibres.find((s) => s.calibre === c)?.cajones ?? 0) === 0
    );

  const formatNum = (n) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
  const formatARS = (n) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency", currency: "ARS", maximumFractionDigits: 0,
    }).format(n);

  const mostrarFormulario = !todosUsados && !sinStockTotal;

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div style={{ overflowX: "hidden" }}>
      {/* ══ FORMULARIO DE ENTRADA ══════════════════════════════════════ */}
      {mostrarFormulario && (
        <div className="border rounded p-3 mb-3 bg-light">
          <div className="row gy-2 gx-2 align-items-end">

            {/* Calibre */}
            <div className={showPrecio ? "col-12 col-sm-5 col-md-3" : "col-12 col-sm-5 col-md-4"}>
              <label className="form-label form-label-sm mb-1 fw-semibold">Calibre</label>
              <SelectDropdown
                value={draft.calibre}
                onChange={(v) => handleCalibreChange(Number(v))}
                options={CALIBRES.map((c) => {
                  const yaUsado   = calibresUsados.includes(c);
                  const stockItem = stockCalibres?.find((s) => s.calibre === c);
                  const cajDisp   = stockItem?.cajones ?? null;
                  const sinStock  = stockCalibres !== null && (cajDisp === null || cajDisp === 0);
                  let label = `Cal. ${c}`;
                  if (stockCalibres && cajDisp !== null) {
                    label += ` — ${cajDisp} caj`;
                  }
                  if (yaUsado)       label += " ✓";
                  else if (sinStock) label += " (sin stock)";
                  return { value: c, label, disabled: yaUsado || sinStock };
                })}
              />
            </div>

            {/* Campo principal: cajones o pollos */}
            <div className={showPrecio ? "col-12 col-sm-3 col-md-2" : "col-12 col-sm-4 col-md-4"}>
              <label className="form-label form-label-sm mb-1 fw-semibold">
                {inputCajones ? "Cajones" : "Pollos"}
              </label>
              <input
                ref={inputRef}
                type="number"
                className={`form-control${errorDraft ? " is-invalid" : ""}`}
                value={draft.valor}
                onChange={(e) => {
                  setDraft((prev) => ({ ...prev, valor: e.target.value }));
                  setErrorDraft("");
                }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aceptar(); } }}
                min="1"
                step="1"
                max={inputCajones && stockDraftCalibre !== null ? stockDraftCalibre : undefined}
                placeholder={inputCajones ? "Cant. cajones" : "Cant. pollos"}
                inputMode="numeric"
                autoFocus
              />
              {errorDraft && <div className="invalid-feedback">{errorDraft}</div>}
            </div>

            {/* Preview del valor derivado — oculto en mobile */}
            <div className={showPrecio ? "d-none d-sm-block col-sm-2 col-md-1" : "d-none d-sm-block col-sm-3 col-md-2"}>
              <label className="form-label form-label-sm mb-1 text-muted">
                {inputCajones ? "Pollos" : "Cajones"}
              </label>
              <div
                className="form-control text-center fw-bold bg-white"
                style={{
                  color: (inputCajones ? draftPollos : draftCajones) > 0
                    ? "#0d6efd"
                    : "#adb5bd",
                }}
              >
                {inputCajones
                  ? (draftPollos > 0 ? formatNum(draftPollos) : "—")
                  : (draftCajones > 0 ? formatNum(draftCajones) : "—")}
              </div>
            </div>

            {/* Precio por cajón (solo showPrecio) */}
            {showPrecio && (
              <div className="col-12 col-sm-4 col-md-3">
                <label className="form-label form-label-sm mb-1 fw-semibold">
                  $/cajón
                  {preciosPorCalibre?.[draft.calibre] !== undefined && (
                    <span className="text-muted fw-normal ms-1" style={{ fontSize: "0.78rem" }}>
                      (lista)
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={draft.precioPorCajon}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, precioPorCajon: e.target.value }))
                  }
                  min="0"
                  step="1"
                  placeholder="0"
                  inputMode="numeric"
                />
              </div>
            )}

            {/* Botón Aceptar */}
            <div className={showPrecio ? "col-12 col-md-3" : "col-12 col-sm-12 col-md-2"}>
              <button
                type="button"
                className="btn btn-success w-100"
                onClick={aceptar}
                disabled={!draft.valor || draftNum <= 0}
              >
                <i className="bi bi-check-lg me-1"></i>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TABLA DE ÍTEMS ACEPTADOS ═══════════════════════════════════ */}
      {lineasComp.length > 0 && (
        <div className="table-responsive">
          <table className="table table-bordered table-sm align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Calibre</th>
                {inputCajones ? (
                  <>
                    <th className="text-end">Cajones</th>
                    <th className="text-end d-none d-md-table-cell">Pollos</th>
                  </>
                ) : (
                  <>
                    <th className="text-end d-none d-md-table-cell">Pollos</th>
                    <th className="text-end">Cajones</th>
                  </>
                )}
                {showPrecio ? (
                  <>
                    <th className="text-end">$/cajón</th>
                    <th className="text-end">Subtotal</th>
                  </>
                ) : (
                  <th className="text-end">Kg</th>
                )}
                <th style={{ width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {lineasComp.map((l, idx) => (
                <tr key={l.calibre}>
                  <td>
                    <span className="badge bg-primary">Cal. {l.calibre}</span>
                    <span className="text-muted small ms-2">{l.calibre} pol/cajón</span>
                  </td>
                  {inputCajones ? (
                    <>
                      <td className="text-end fw-semibold">{formatNum(l.cajones)}</td>
                      <td className="text-end text-muted d-none d-md-table-cell">{formatNum(l.pollos)}</td>
                    </>
                  ) : (
                    <>
                      <td className="text-end d-none d-md-table-cell">{formatNum(l.pollos)}</td>
                      <td className="text-end fw-semibold">{formatNum(l.cajones)}</td>
                    </>
                  )}
                  {showPrecio ? (
                    <>
                      <td style={{ minWidth: 110 }}>
                        <input
                          type="number"
                          className="form-control form-control-sm text-end"
                          value={l.precioPorCajon ?? 0}
                          onChange={(e) => handlePrecioLinea(idx, e.target.value)}
                          min="0"
                          step="1"
                        />
                      </td>
                      <td className="text-end fw-semibold text-success">
                        {l.subtotal > 0 ? formatARS(l.subtotal) : "—"}
                      </td>
                    </>
                  ) : (
                    <td className="text-end text-muted">{formatNum(l.cajones * 20)} kg</td>
                  )}
                  <td className="text-center">
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => eliminar(idx)}
                      title="Quitar"
                    >
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {showTotals && totalCajones > 0 && (
              <tfoot className="table-secondary fw-semibold">
                <tr>
                  <td>TOTAL</td>
                  {inputCajones ? (
                    <>
                      <td className="text-end">{formatNum(totalCajones)} caj</td>
                      <td className="text-end d-none d-md-table-cell">{formatNum(totalPollos)} pollos</td>
                    </>
                  ) : (
                    <>
                      <td className="text-end d-none d-md-table-cell">{formatNum(totalPollos)} pollos</td>
                      <td className="text-end">{formatNum(totalCajones)} caj</td>
                    </>
                  )}
                  {showPrecio ? (
                    <>
                      <td></td>
                      <td className="text-end text-success">{formatARS(subtotalBruto)}</td>
                    </>
                  ) : (
                    <td className="text-end">{formatNum(totalKg)} kg</td>
                  )}
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {(todosUsados || sinStockTotal) && (
        <p className="text-muted small mt-2 mb-0">
          <i className="bi bi-check-all me-1"></i>
          {todosUsados
            ? "Todos los calibres fueron ingresados."
            : "Sin stock disponible para los calibres restantes."}
        </p>
      )}
    </div>
  );
};

export { calcularCajones, CALIBRES };
export default CalibreTable;
