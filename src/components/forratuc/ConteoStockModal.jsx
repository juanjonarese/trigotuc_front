import React, { useMemo, useState } from "react";
import Swal from "sweetalert2";

/**
 * Planilla de conteo de Forratuc: qué se va a controlar (2026-11-25, pedido del
 * usuario: "quiero elegir depósito y después el rubro, el cual puedo tildar
 * varios"). Primero el depósito (o todos, uno por hoja) y después los rubros de
 * ese depósito — las mismas secciones de la planilla (`seccionesDe`, que sale de
 * `seccionesConteo`): el alimento por categoría, Otros y, en la Forrajería, los
 * huevos, los pollitos y la cámara. Arrancan todos tildados.
 *
 * `onGenerar({ elegidos, rubros, excel })`: los depósitos y los títulos tildados.
 */
const ConteoStockModal = ({ depositos = [], seccionesDe, onClose, onGenerar }) => {
  const inicial = depositos.some((d) => d.key === "forrajeria") ? "forrajeria" : depositos[0]?.key || "todos";
  const [deposito, setDeposito] = useState(inicial);

  const elegidos = useMemo(
    () => (deposito === "todos" ? depositos : depositos.filter((d) => d.key === deposito)),
    [deposito, depositos],
  );
  // Los rubros del depósito elegido (con todos, la unión, en el orden en que aparecen).
  const rubros = useMemo(() => {
    const vistos = [];
    for (const d of elegidos) {
      for (const s of seccionesDe(d)) {
        let r = vistos.find((x) => x.titulo === s.titulo);
        if (!r) vistos.push((r = { titulo: s.titulo, productos: 0 }));
        r.productos += s.filas.length;
      }
    }
    return vistos;
  }, [elegidos, seccionesDe]);

  const [tildados, setTildados] = useState(null); // null = todos
  const marcados = tildados ?? rubros.map((r) => r.titulo);
  const estaTildado = (t) => marcados.includes(t);
  const alternar = (t) => setTildados(estaTildado(t) ? marcados.filter((x) => x !== t) : [...marcados, t]);
  const todosTildados = rubros.length > 0 && rubros.every((r) => estaTildado(r.titulo));

  const cambiarDeposito = (key) => {
    setDeposito(key);
    setTildados(null); // los rubros cambian con el depósito: vuelven a estar todos
  };

  const generar = (excel) => {
    const elegidosRubros = rubros.map((r) => r.titulo).filter(estaTildado);
    if (!elegidosRubros.length) return Swal.fire("Sin rubros", "Tildá al menos un rubro para controlar.", "warning");
    onGenerar({ elegidos, rubros: todosTildados ? null : elegidosRubros, excel });
  };

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="bi bi-clipboard-check me-2"></i>Planilla de conteo</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <label className="form-label fw-semibold small mb-1">1. Depósito</label>
              <select className="form-select mb-3" value={deposito} onChange={(e) => cambiarDeposito(e.target.value)}>
                {depositos.map((d) => <option key={d.key} value={d.key}>{d.etiqueta}</option>)}
                <option value="todos">Todos los depósitos (uno por hoja)</option>
              </select>

              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label fw-semibold small mb-0">2. Rubros a controlar</label>
                {rubros.length > 0 && (
                  <button type="button" className="btn btn-link btn-sm p-0"
                    onClick={() => setTildados(todosTildados ? [] : null)}>
                    {todosTildados ? "Destildar todos" : "Tildar todos"}
                  </button>
                )}
              </div>
              {rubros.length === 0 ? (
                <p className="text-muted small mb-0">Este depósito no tiene productos para contar.</p>
              ) : (
                <div className="list-group">
                  {rubros.map((r) => (
                    <label key={r.titulo} className="list-group-item d-flex align-items-center gap-2" style={{ cursor: "pointer" }}>
                      <input type="checkbox" className="form-check-input m-0" checked={estaTildado(r.titulo)}
                        onChange={() => alternar(r.titulo)} />
                      <span className="flex-grow-1">{r.titulo}</span>
                      <span className="badge bg-light text-secondary border">
                        {r.productos} {r.productos === 1 ? "producto" : "productos"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="button" className="btn btn-success" onClick={() => generar(true)} disabled={!rubros.length}>
                <i className="bi bi-file-earmark-excel me-1"></i>Excel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => generar(false)} disabled={!rubros.length}>
                <i className="bi bi-printer me-1"></i>Imprimir
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

export default ConteoStockModal;
