import React, { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { escapeHtml } from "../../utils/escapeHtml";
import { grupoDeposito, vaEnDeposito } from "../../utils/forratuc/conteoStock";
import { imprimirPedidoProduccion } from "../../utils/forratuc/imprimirForratuc";
import {
  obtenerDepositoProduccion, listarPedidosProduccion, crearPedidoProduccion,
  enviarPedidoProduccion, recibirPedidoProduccion, anularPedidoProduccion,
} from "../../services/api";

/**
 * Pedidos de mercadería de Forratuc a Producción (2026-11-20, pedido del
 * usuario: "Forratuc le hace un pedido a Producción; cuando lo recibe y está
 * todo ok se descuenta del depósito de Producción").
 *
 *   Forratuc PIDE → Producción ENVÍA (carga lo que manda, imprime el remito) →
 *   Forratuc RECIBE (carga lo que llegó; si no coincide, el motivo) y recién
 *   ahí sale del Depósito Producción y entra a la Forrajería.
 *
 * El mismo componente en las dos puntas: `lado="forratuc"` (pantalla Pedidos a
 * Producción: pedir, recibir, anular) y `lado="produccion"` (solapa de la
 * pantalla Producción: ver y enviar).
 */
const UNIDAD = { bolsa: ["bolsa", "bolsas"], unidad: ["unidad", "unidades"], caja: ["caja", "cajas"], maple: ["maple", "maples"] };
const cant = (n, unidad) => {
  if (n == null) return "—";
  const [uno, varios] = UNIDAD[unidad] || [unidad || "", unidad || ""];
  return `${Number(n).toLocaleString("es-AR")} ${n === 1 ? uno : varios}`;
};
const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
const dia = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");

const ESTADO = {
  pendiente: { texto: "Pedido", clase: "bg-warning text-dark" },
  enviado: { texto: "En camino", clase: "bg-info text-dark" },
  recibido: { texto: "Recibido", clase: "bg-success" },
  anulado: { texto: "Anulado", clase: "bg-secondary" },
};

let siguiente = 1;
const renglonVacio = () => ({ id: siguiente++, producto: "", cantidad: "" });

// ── Modal: pedir (Forratuc), enviar (Producción) o recibir (Forratuc) ───────
const PedidoModal = ({ modo, pedido, productos, onClose, onListo }) => {
  const hay = Object.fromEntries((productos || []).map((p) => [p.alimento, p.cantidad]));
  const [renglones, setRenglones] = useState([renglonVacio()]);
  // Recibir directo (25/11): Forratuc recibe un pedido que Producción no puso en
  // camino (el camión llegó igual). Arranca en lo pedido y no pide motivo.
  const directo = modo === "recibir" && pedido?.estado === "pendiente";
  // Enviar y recibir directo: arrancan en lo pedido. Recibir: en lo enviado.
  const [cantidades, setCantidades] = useState(() =>
    Object.fromEntries((pedido?.lineas || []).map((l) => [l.producto, String(modo === "enviar" || directo ? l.pedido : l.enviado ?? 0)]))
  );
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);

  const grupos = [];
  // Lo pedido entra a la Forrajería: solo lo que va ahí (25/11).
  for (const p of (productos || []).filter((x) => x.activo && vaEnDeposito(x, "forrajeria"))) {
    const titulo = grupoDeposito(p);
    const g = grupos.find((x) => x.titulo === titulo) || (grupos.push({ titulo, items: [] }), grupos[grupos.length - 1]);
    g.items.push(p);
  }
  const porKey = Object.fromEntries((productos || []).map((p) => [p.alimento, p]));
  const set = (id, cambios) => setRenglones((prev) => prev.map((r) => (r.id === id ? { ...r, ...cambios } : r)));
  const entero = (v, min) => v !== "" && Number.isInteger(Number(v)) && Number(v) >= min;
  const conDiferencia = modo === "recibir" && !directo && (pedido?.lineas || []).some((l) => Number(cantidades[l.producto]) !== (l.enviado ?? 0));

  const guardar = async (e) => {
    e.preventDefault();
    let accion;
    let confirmar;
    if (modo === "pedir") {
      const usados = renglones.filter((r) => r.producto || r.cantidad);
      if (usados.length === 0) return Swal.fire("Sin productos", "Cargá al menos un producto.", "warning");
      for (const [i, r] of usados.entries()) {
        if (!r.producto) return Swal.fire("Falta el producto", `Renglón ${i + 1}: elegí el producto.`, "warning");
        if (!entero(r.cantidad, 1)) return Swal.fire("Cantidad", `Renglón ${i + 1}: de 1 en adelante, sin decimales.`, "warning");
      }
      confirmar = `Le pedís a Producción:<br>${usados.map((r) => `${escapeHtml(cant(Number(r.cantidad), porKey[r.producto]?.unidad))} ${escapeHtml(porKey[r.producto]?.etiqueta || "")}`).join("<br>")}`;
      accion = () => crearPedidoProduccion({ observaciones: texto.trim(), lineas: usados.map((r) => ({ producto: r.producto, cantidad: Number(r.cantidad) })) });
    } else {
      const campo = modo === "enviar" ? "enviado" : "recibido";
      for (const l of pedido.lineas) {
        if (!entero(cantidades[l.producto], 0)) return Swal.fire("Cantidad", `${l.nombre}: de 0 en adelante, sin decimales.`, "warning");
        if ((modo === "enviar" || directo) && Number(cantidades[l.producto]) > (hay[l.producto] ?? 0))
          return Swal.fire("No alcanza", `De ${l.nombre} hay ${cant(hay[l.producto] ?? 0, l.unidad)} en Producción.`, "warning");
      }
      if (!pedido.lineas.some((l) => Number(cantidades[l.producto]) > 0))
        return Swal.fire("Nada", modo === "enviar" ? "No mandás nada: si no hay, que Forratuc anule el pedido." : "No llegó nada: si no se recibe, anulá el pedido.", "warning");
      if (conDiferencia && !texto.trim()) return Swal.fire("Falta el motivo", "Lo que llegó no es lo que mandó Producción: escribí qué pasó.", "warning");
      const lineas = pedido.lineas.map((l) => ({ producto: l.producto, [campo]: Number(cantidades[l.producto]) }));
      confirmar = modo === "enviar"
        ? `Mandás a la Forrajería:<br>${pedido.lineas.map((l) => `${escapeHtml(cant(Number(cantidades[l.producto]), l.unidad))} ${escapeHtml(l.nombre)}`).join("<br>")}<br><br>Se imprime el remito para que viaje con la mercadería.`
        : `Recibís:<br>${pedido.lineas.map((l) => `${escapeHtml(cant(Number(cantidades[l.producto]), l.unidad))} ${escapeHtml(l.nombre)}`).join("<br>")}<br><br>Sale del Depósito Producción y entra a la Forrajería.${directo ? "<br><br>Producción no lo puso en camino: queda como enviado y recibido con esto." : ""}`;
      accion = () => modo === "enviar"
        ? enviarPedidoProduccion(pedido.id, { observaciones: texto.trim(), lineas })
        : recibirPedidoProduccion(pedido.id, { motivoDiferencia: texto.trim(), lineas });
    }
    const { isConfirmed } = await Swal.fire({
      title: { pedir: "¿Hacer el pedido?", enviar: `¿Enviar el ${pedido?.numero}?`, recibir: `¿Recibir el ${pedido?.numero}?` }[modo],
      html: confirmar, icon: "question", showCancelButton: true, confirmButtonText: "Sí", cancelButtonText: "Volver",
    });
    if (!isConfirmed) return;
    setSaving(true);
    try {
      const p = await accion();
      if (modo === "enviar") imprimirPedidoProduccion(p);
      Swal.fire({ icon: "success", title: { pedir: `Pedido ${p.numero} hecho`, enviar: `${p.numero} enviado`, recibir: `${p.numero} recibido` }[modo], timer: 1600, showConfirmButton: false });
      onListo?.(p);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const titulo = {
    pedir: <><i className="bi bi-cart-plus me-2 text-primary"></i>Pedido a Producción</>,
    enviar: <><i className="bi bi-truck me-2 text-info"></i>Enviar {pedido?.numero}</>,
    recibir: <><i className="bi bi-box-arrow-in-down me-2 text-success"></i>Recibir {pedido?.numero}</>,
  }[modo];

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-lg" role="document">
          <form className="modal-content" onSubmit={guardar}>
            <div className="modal-header">
              <h5 className="modal-title">{titulo}</h5>
              <button type="button" className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              {modo === "pedir" ? (
                <>
                  <p className="small text-muted mb-2">Va para el <strong>Depósito Forrajería</strong>. "En Producción" es lo que tienen hoy (se puede pedir más: lo preparan).</p>
                  <table className="table table-sm align-middle mb-2">
                    <thead className="table-light">
                      <tr><th>Producto</th><th className="text-end" style={{ width: 130 }}>En Producción</th><th style={{ width: 150 }}>Cantidad</th><th style={{ width: 40 }}></th></tr>
                    </thead>
                    <tbody>
                      {renglones.map((r) => {
                        const p = porKey[r.producto];
                        return (
                          <tr key={r.id}>
                            <td>
                              <select className="form-select form-select-sm" value={r.producto} onChange={(e) => set(r.id, { producto: e.target.value })}>
                                <option value="">Elegí un producto…</option>
                                {grupos.map((g) => (
                                  <optgroup key={g.titulo} label={g.titulo}>
                                    {g.items.map((x) => <option key={x.alimento} value={x.alimento}>{x.codigo} · {x.etiqueta}</option>)}
                                  </optgroup>
                                ))}
                              </select>
                            </td>
                            <td className={`text-end small ${p && !(p.cantidad > 0) ? "text-danger" : "text-muted"}`}>{p ? cant(p.cantidad, p.unidad) : ""}</td>
                            <td>
                              <input type="number" min="1" step="1" className="form-control form-control-sm" value={r.cantidad}
                                onChange={(e) => set(r.id, { cantidad: e.target.value })} />
                            </td>
                            <td>
                              {renglones.length > 1 && (
                                <button type="button" className="btn btn-sm btn-outline-danger border-0" onClick={() => setRenglones((x) => x.filter((y) => y.id !== r.id))}>
                                  <i className="bi bi-x-lg"></i>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <button type="button" className="btn btn-sm btn-outline-primary mb-3" onClick={() => setRenglones((x) => [...x, renglonVacio()])}>
                    <i className="bi bi-plus-lg me-1"></i>Otro producto
                  </button>
                </>
              ) : (
                <>
                {directo && (
                  <div className="alert alert-info small py-2 mb-2">
                    <i className="bi bi-info-circle me-1"></i>Producción todavía no lo puso <strong>en camino</strong>. Si la mercadería ya llegó, cargá lo que llegó y se recibe directo: sale del Depósito Producción y entra a la Forrajería.
                  </div>
                )}
                <table className="table table-sm align-middle mb-3">
                  <thead className="table-light">
                    <tr>
                      <th>Producto</th>
                      <th className="text-end">Pedido</th>
                      {(modo === "enviar" || directo) && <th className="text-end">En Producción</th>}
                      {modo === "recibir" && !directo && <th className="text-end">Enviado</th>}
                      <th style={{ width: 150 }}>{modo === "enviar" ? "Mandás" : "Llegó"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedido.lineas.map((l) => {
                      const v = cantidades[l.producto];
                      const distinto = modo === "recibir" && !directo ? Number(v) !== (l.enviado ?? 0) : Number(v) !== l.pedido;
                      return (
                        <tr key={l.producto}>
                          <td>{l.codigo ? `${l.codigo} · ` : ""}{l.nombre}</td>
                          <td className="text-end text-nowrap">{cant(l.pedido, l.unidad)}</td>
                          {(modo === "enviar" || directo) && <td className={`text-end text-nowrap small ${(hay[l.producto] ?? 0) < l.pedido ? "text-danger" : "text-muted"}`}>{cant(hay[l.producto] ?? 0, l.unidad)}</td>}
                          {modo === "recibir" && !directo && <td className="text-end text-nowrap">{cant(l.enviado, l.unidad)}</td>}
                          <td>
                            <input type="number" min="0" step="1" className={`form-control form-control-sm ${distinto ? "border-warning" : ""}`}
                              value={v ?? ""} onChange={(e) => setCantidades((c) => ({ ...c, [l.producto]: e.target.value }))} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </>
              )}

              {pedido?.observaciones && <div className="small mb-2"><strong>Pedido:</strong> {pedido.observaciones}</div>}
              {modo === "recibir" && pedido?.observacionesEnvio && <div className="small mb-2"><strong>Producción:</strong> {pedido.observacionesEnvio}</div>}
              <label className="form-label fw-semibold small mb-1">
                {modo === "recibir" ? <>Qué pasó {conDiferencia ? <span className="text-danger">* (no llegó lo enviado)</span> : <span className="text-muted fw-normal">(si algo no llegó bien)</span>}</> :
                  <>Observaciones <span className="text-muted fw-normal">(opcional)</span></>}
              </label>
              <input className="form-control" maxLength={250} value={texto} onChange={(e) => setTexto(e.target.value)}
                placeholder={{ pedir: "Ej.: para el sábado", enviar: "Ej.: faltó una bolsa, se manda el lunes", recibir: "Ej.: una bolsa llegó rota" }[modo]} />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                {{ pedir: "Hacer el pedido", enviar: "Enviar e imprimir remito", recibir: "Recibir" }[modo]}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── La lista ───────────────────────────────────────────────────────────────
const PedidosProduccion = ({ lado = "forratuc" }) => {
  const esForratuc = lado === "forratuc";
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [verTodos, setVerTodos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { modo, pedido }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [lista, dep] = await Promise.all([
        listarPedidosProduccion(verTodos ? {} : { abiertos: true }),
        obtenerDepositoProduccion().catch(() => null),
      ]);
      setPedidos(lista);
      setProductos(dep?.productos || []);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron leer los pedidos.", "error");
    } finally {
      setLoading(false);
    }
  }, [verTodos]);
  useEffect(() => { cargar(); }, [cargar]);

  const anular = async (p) => {
    const { value: motivo, isConfirmed } = await Swal.fire({
      title: `¿Anular el ${escapeHtml(p.numero)}?`,
      html: p.estado === "recibido" ? "La mercadería vuelve al Depósito Producción (si la Forrajería todavía la tiene)." : "El stock no se tocó todavía.",
      input: "text", inputPlaceholder: "Motivo (opcional)", icon: "warning",
      showCancelButton: true, confirmButtonText: "Anular", cancelButtonText: "Volver", confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      await anularPedidoProduccion(p.id, { motivo });
      cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo anular.", "error");
    }
  };

  const pendientes = pedidos.filter((p) => p.estado === "pendiente").length;
  const enCamino = pedidos.filter((p) => p.estado === "enviado").length;

  return (
    <>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <span className="badge bg-warning text-dark">{pendientes} por preparar</span>
        <span className="badge bg-info text-dark">{enCamino} en camino</span>
        <div className="form-check form-switch ms-2 mb-0">
          <input className="form-check-input" type="checkbox" id={`verTodos-${lado}`} checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} />
          <label className="form-check-label small" htmlFor={`verTodos-${lado}`}>Ver también los recibidos y anulados</label>
        </div>
        <div className="ms-auto d-flex gap-2">
          {esForratuc && (
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ modo: "pedir" })}>
              <i className="bi bi-cart-plus me-1"></i>Nuevo pedido
            </button>
          )}
          <button className="btn btn-outline-secondary btn-sm" onClick={cargar} title="Refrescar" disabled={loading}>
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>

      {loading && pedidos.length === 0 ? (
        <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
      ) : pedidos.length === 0 ? (
        <div className="card border-0 shadow-sm"><div className="card-body text-center text-muted py-4">
          {verTodos ? "Todavía no hay pedidos." : esForratuc ? "No hay pedidos abiertos. Con «Nuevo pedido» le pedís mercadería a Producción." : "No hay pedidos de Forratuc para preparar."}
        </div></div>
      ) : (
        <div className="row g-3">
          {pedidos.map((p) => {
            const e = ESTADO[p.estado] || ESTADO.pendiente;
            return (
              <div key={p.id} className="col-12 col-xl-6">
                <div className={`card border-0 shadow-sm h-100 ${p.estado === "anulado" ? "opacity-75" : ""}`}>
                  <div className="card-header bg-white d-flex flex-wrap gap-2 align-items-center">
                    <strong>{p.numero}</strong>
                    <span className={`badge ${e.clase}`}>{e.texto}</span>
                    {p.recibidoDirecto && <span className="badge bg-light text-dark border">recibido directo</span>}
                    {p.conDiferencia && <span className="badge bg-danger-subtle text-danger-emphasis">con diferencia</span>}
                    <span className="small text-muted ms-auto">{dia(p.fecha)} · pidió {p.pedidoPorNombre || "—"}</span>
                  </div>
                  <div className="card-body py-2">
                    <table className="table table-sm small mb-2">
                      <thead><tr><th>Producto</th><th className="text-end">Pedido</th><th className="text-end">Enviado</th><th className="text-end">Recibido</th></tr></thead>
                      <tbody>
                        {p.lineas.map((l) => (
                          <tr key={l.producto}>
                            <td>{l.codigo ? `${l.codigo} · ` : ""}{l.nombre}</td>
                            <td className="text-end text-nowrap">{cant(l.pedido, l.unidad)}</td>
                            <td className={`text-end text-nowrap ${l.enviado != null && l.enviado !== l.pedido ? "text-warning-emphasis fw-semibold" : ""}`}>{cant(l.enviado, l.unidad)}</td>
                            <td className={`text-end text-nowrap ${l.recibido != null && l.recibido !== l.enviado ? "text-danger fw-semibold" : ""}`}>{cant(l.recibido, l.unidad)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="small text-muted">
                      {p.observaciones && <div><strong>Pedido:</strong> {p.observaciones}</div>}
                      {p.enviadoEn && <div>Enviado {fechaHora(p.enviadoEn)} por {p.enviadoPorNombre}{p.observacionesEnvio ? ` — ${p.observacionesEnvio}` : ""}</div>}
                      {p.recibidoEn && <div>Recibido {fechaHora(p.recibidoEn)} por {p.recibidoPorNombre}{p.motivoDiferencia ? ` — ${p.motivoDiferencia}` : ""}</div>}
                      {p.anuladoEn && <div>Anulado {fechaHora(p.anuladoEn)} por {p.anuladoPorNombre}{p.motivoAnulacion ? ` — ${p.motivoAnulacion}` : ""}</div>}
                    </div>
                  </div>
                  <div className="card-footer bg-white d-flex flex-wrap gap-2 justify-content-end">
                    {!esForratuc && p.estado === "pendiente" && (
                      <button className="btn btn-info btn-sm" onClick={() => setModal({ modo: "enviar", pedido: p })}>
                        <i className="bi bi-truck me-1"></i>Enviar
                      </button>
                    )}
                    {esForratuc && (p.estado === "enviado" || p.estado === "pendiente") && (
                      <button className={`btn btn-sm ${p.estado === "enviado" ? "btn-success" : "btn-outline-success"}`} onClick={() => setModal({ modo: "recibir", pedido: p })}
                        title={p.estado === "pendiente" ? "Producción no lo puso en camino: si ya llegó, recibilo directo" : undefined}>
                        <i className="bi bi-box-arrow-in-down me-1"></i>{p.estado === "pendiente" ? "Ya llegó: recibir" : "Recibir"}
                      </button>
                    )}
                    <button className="btn btn-outline-dark btn-sm" onClick={() => imprimirPedidoProduccion(p)}>
                      <i className="bi bi-printer me-1"></i>{p.estado === "pendiente" ? "Imprimir pedido" : "Remito"}
                    </button>
                    {esForratuc && p.estado !== "anulado" && (
                      <button className="btn btn-outline-danger btn-sm" onClick={() => anular(p)}>Anular</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <PedidoModal
          modo={modal.modo}
          pedido={modal.pedido}
          productos={productos}
          onClose={() => setModal(null)}
          onListo={() => { setModal(null); cargar(); }}
        />
      )}
    </>
  );
};

export default PedidosProduccion;
