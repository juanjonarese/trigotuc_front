import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import BuscadorCliente from "../../components/BuscadorCliente";
import { especieDe, etiquetaEspecie } from "../../utils/especies";
import { obtenerFechaHoy, formatearFechaLocal } from "../../utils/dateUtils";
import { escapeHtml } from "../../utils/escapeHtml";
import { clienteDeEmpresa } from "../../utils/empresas";
import { imprimirPresupuestoForratuc } from "../../utils/forratuc/imprimirForratuc";
import {
  obtenerCuentaClienteForratuc,
  obtenerStockCamaraMostrador,
  obtenerStockHuevosMostrador,
  obtenerStockPollitosMostrador,
  obtenerClientes,
  obtenerConstantesPresupuesto,
  obtenerStockForratuc,
  obtenerListasPreciosForratuc,
  obtenerPresupuestosForratuc,
  crearPresupuestoForratuc,
  anularPresupuestoForratuc,
} from "../../services/api";

/**
 * Mostrador de Forratuc (2026-10-21): el presupuesto, que es su "factura".
 *
 * Forratuc no factura: emite un presupuesto con fecha, cliente, renglones con
 * precio y total, que se imprime por duplicado y con el que el cliente retira.
 * El stock de la avícola (pollo de la cámara Trigotuc, huevo de venta y
 * pollitos del mostrador) sale AL EMITIR, con la misma mecánica que la Salida de
 * Mostrador; anular lo devuelve. El alimento balanceado (2026-10-29) sale del
 * stock de Forratuc, del Depósito Forrajería, por bolsa; el "otro" escrito a
 * mano, sin stock.
 *
 * Precios: pollo entero y trozado por KG, huevo por maple, pollitos por unidad,
 * alimento por bolsa (el "otro", por bolsa o kg). Los PROPONE la lista de
 * precios elegida en la venta (arranca en "Precio de lista") y se pueden corregir.
 *
 * Forma de pago (2026-10-29, pedido del cliente): tres botones fijos —
 * Efectivo (por defecto), Mercado Pago o Cuenta corriente — para que no haya
 * equivocaciones.
 */

// La clave del artículo en la lista de precios. ⚠️ Tiene que coincidir con el
// catálogo del back (services/forratuc/listaPrecioForratuc.services.js).
const itemDeOpcion = (op) => {
  if (!op) return null;
  if (op.clase === "entero") return `entero:${op.especie}`;
  if (op.clase === "trozado") return `trozado:${op.tipo}:${op.claseTrozado}`;
  if (op.clase === "huevo") return `huevo:${op.tipo}`;
  if (op.clase === "pollito") return "pollito";
  if (op.clase === "alimento" && op.producto !== "otro") return `alimento:${op.producto}`;
  return null;
};

const fmt = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(n || 0));
const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));
const redondear = (n) => Math.round(n * 100) / 100;

const UNIDAD_PRECIO = { kg: "kg", maple: "maple", pollito: "pollito", bolsa: "bolsa" };

let siguienteId = 1;
const renglonVacio = () => ({ id: siguienteId++, producto: "", cantidad: "", kg: "", kgTocado: false, precio: "", precioTocado: false, descripcion: "", unidad: "bolsa" });

const ForratucPresupuestosPage = () => {
  const navigate = useNavigate();

  const [tab, setTab] = useState("nuevo");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [resumen, setResumen] = useState(null);
  const [stockHuevos, setStockHuevos] = useState(null);
  const [stockPollitos, setStockPollitos] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [constantes, setConstantes] = useState(null);
  const [stockAlimento, setStockAlimento] = useState(null);
  const [listas, setListas] = useState([]);

  // ── Formulario ──
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [modoCliente, setModoCliente] = useState("padron"); // padron | final
  const [clienteId, setClienteId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [renglones, setRenglones] = useState([renglonVacio()]);
  const [observaciones, setObservaciones] = useState("");
  // Forma de pago (2026-10-29): uno de los tres botones. Cuenta corriente,
  // solo clientes del padrón.
  const [formaPago, setFormaPago] = useState("efectivo");
  const [operacionMP, setOperacionMP] = useState("");
  const [saldoCliente, setSaldoCliente] = useState(null);
  // Lista de precios: la por defecto, hasta que se elija otra.
  const [listaId, setListaId] = useState("");
  const [listaTocada, setListaTocada] = useState(false);

  // ── Emitidos ──
  const [desde, setDesde] = useState(obtenerFechaHoy());
  const [hasta, setHasta] = useState(obtenerFechaHoy());
  const [presupuestos, setPresupuestos] = useState([]);
  const [loadingLista, setLoadingLista] = useState(false);

  const cargar = async () => {
    try {
      // Huevo y pollitos con catch: si fallan, se tiene que poder vender lo demás.
      const [stock, huevos, pollitos, cls, ctes, stockForratuc, lts] = await Promise.all([
        obtenerStockCamaraMostrador(),
        obtenerStockHuevosMostrador().catch(() => null),
        obtenerStockPollitosMostrador().catch(() => null),
        obtenerClientes().catch(() => []),
        obtenerConstantesPresupuesto(),
        obtenerStockForratuc().catch(() => null),
        obtenerListasPreciosForratuc().catch(() => []),
      ]);
      setStockAlimento(stockForratuc?.alimento || null);
      setListas(Array.isArray(lts) ? lts : []);
      setResumen(stock);
      setStockHuevos(huevos);
      setStockPollitos(pollitos);
      setClientes(
        (Array.isArray(cls) ? cls : cls?.clientes || []).filter((c) => clienteDeEmpresa(c, "forratuc")).sort((a, b) =>
          String(a.razonSocial || "").localeCompare(String(b.razonSocial || ""))
        )
      );
      setConstantes(ctes);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar el stock.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  const cargarLista = async () => {
    setLoadingLista(true);
    try {
      setPresupuestos(await obtenerPresupuestosForratuc({ desde, hasta }));
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los presupuestos.", "error");
    } finally {
      setLoadingLista(false);
    }
  };
  useEffect(() => {
    if (tab === "emitidos") cargarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, desde, hasta]);

  const kgPorCajon = constantes?.kgPorCajon ?? 20;
  const huevosPorMaple = constantes?.huevosPorMaple ?? stockHuevos?.huevosPorMaple ?? 30;

  // Todo lo que se puede poner en un renglón, agrupado como en el desplegable.
  // `disponible` = lo que hay en stock (null = sin control de stock: alimento).
  const grupos = useMemo(() => {
    const etTroz = constantes?.etiquetaTrozado || {};
    const enteros = (resumen?.stockTrigotuc || [])
      .filter((e) => e.cajones > 0)
      .sort((a, b) => String(especieDe(a)).localeCompare(String(especieDe(b))) || a.calibre - b.calibre)
      .map((e) => ({
        key: `entero|${especieDe(e)}|${e.calibre}`,
        clase: "entero", especie: especieDe(e), calibre: e.calibre,
        texto: `${etiquetaEspecie(especieDe(e))} entero cal. ${e.calibre}`,
        disponible: e.cajones, unidad: "cajones", unidadPrecio: "kg",
      }));
    const trozados = (resumen?.trozadosTrigotucDetalle || [])
      .filter((t) => t.cajas > 0)
      .map((t) => ({
        key: `trozado|${especieDe(t)}|${t.tipo}|${t.clase || "A"}|${t.kgCaja}`,
        clase: "trozado", especie: especieDe(t), tipo: t.tipo, claseTrozado: t.clase || "A", kgCaja: Number(t.kgCaja),
        texto: `${etiquetaEspecie(especieDe(t))} ${(etTroz[t.tipo] || t.tipo).toLowerCase()} ${t.clase || "A"} (caja ${fmt(t.kgCaja)} kg)`,
        disponible: t.cajas, unidad: "cajas", unidadPrecio: "kg",
      }));
    const huevos = (stockHuevos?.porTipo || [])
      .filter((h) => h.maples > 0)
      .map((h) => ({
        key: `huevo|${h.tipo}`, clase: "huevo", tipo: h.tipo,
        texto: `Huevo ${h.etiqueta.toLowerCase()}`,
        disponible: h.maples, unidad: "maples", unidadPrecio: "maple",
      }));
    const pollitos = (stockPollitos?.total || 0) > 0
      ? [{ key: "pollito", clase: "pollito", texto: "Pollitos BB", disponible: stockPollitos.total, unidad: "pollitos", unidadPrecio: "pollito" }]
      : [];
    // Alimento: lo que hay en el depósito del que vende el presupuesto (la
    // forrajería), por bolsa. El "otro" no tiene stock y va siempre.
    const deposito = constantes?.depositoVentaAlimento || "forrajeria";
    const bolsasDe = (key) =>
      stockAlimento?.productos?.find((p) => p.alimento === key)?.porDeposito?.[deposito] || 0;
    const alimento = (constantes?.productosAlimento || [])
      .map((p) =>
        p.key === "otro"
          ? { key: "alimento|otro", clase: "alimento", producto: "otro", texto: p.etiqueta, disponible: null, unidad: null, unidadPrecio: null }
          : {
              key: `alimento|${p.key}`, clase: "alimento", producto: p.key, texto: p.etiqueta,
              disponible: bolsasDe(p.key), unidad: "bolsas", unidadPrecio: "bolsa",
            }
      )
      .filter((o) => o.disponible == null || o.disponible > 0);
    const etiquetaDeposito = (constantes?.depositosAlimento || []).find((d) => d.key === deposito)?.etiqueta || deposito;
    return [
      { titulo: "Pollo entero (precio por kg)", opciones: enteros },
      { titulo: "Trozado (precio por kg)", opciones: trozados },
      { titulo: `Huevo (maple de ${huevosPorMaple})`, opciones: huevos },
      { titulo: "Pollitos", opciones: pollitos },
      { titulo: `Alimento balanceado (${etiquetaDeposito}, por bolsa)`, opciones: alimento },
    ];
  }, [resumen, stockHuevos, stockPollitos, constantes, huevosPorMaple, stockAlimento]);

  const opcionPorKey = useMemo(
    () => Object.fromEntries(grupos.flatMap((g) => g.opciones).map((o) => [o.key, o])),
    [grupos]
  );

  // Kg que se cobran en un renglón de pollo. Entero: 20 por cajón hasta que se
  // tipee el peso real. Trozado: cajas × kg de la caja.
  const kgDe = (r, op) => {
    if (!op) return 0;
    const cant = Number(r.cantidad) || 0;
    if (op.clase === "entero") return r.kgTocado ? Number(r.kg) || 0 : cant * kgPorCajon;
    if (op.clase === "trozado") return redondear(cant * op.kgCaja);
    return 0;
  };
  const importeDe = (r) => {
    const op = opcionPorKey[r.producto];
    if (!op) return 0;
    const precio = Number(r.precio) || 0;
    const base = op.clase === "entero" || op.clase === "trozado" ? kgDe(r, op) : Number(r.cantidad) || 0;
    return redondear(base * precio);
  };
  const total = redondear(renglones.reduce((a, r) => a + importeDe(r), 0));

  const mediosPago = constantes?.mediosPago || [];
  const formasPago = constantes?.formasPago || [];
  const opcionesImpresion = {
    medios: mediosPago,
    validezDias: constantes?.validezDias,
    depositosAlimento: constantes?.depositosAlimento,
  };

  // En cuenta corriente se muestra cuánto debe ya el cliente.
  useEffect(() => {
    setSaldoCliente(null);
    if (formaPago !== "cuenta_corriente" || modoCliente !== "padron" || !clienteId) return;
    let vigente = true;
    obtenerCuentaClienteForratuc(clienteId)
      .then((c) => vigente && setSaldoCliente(c.saldo))
      .catch(() => {});
    return () => { vigente = false; };
  }, [formaPago, modoCliente, clienteId]);

  const elegirFormaPago = (f) => {
    setFormaPago(f);
    // Al consumidor final no se le fía.
    if (f === "cuenta_corriente") setModoCliente("padron");
  };

  // Arranca en el "Precio de lista" (la por defecto); la lista se elige a mano en
  // cada venta, no va atada al cliente (pedido del usuario, 2026-10-30).
  const listaPorDefecto = listas.find((l) => l.porDefecto) || null;
  useEffect(() => {
    if (!listaTocada) setListaId(listaPorDefecto?._id || "");
  }, [listaPorDefecto, listaTocada]);
  const lista = listas.find((l) => l._id === listaId) || null;
  const precioDeLista = (op) => {
    const item = itemDeOpcion(op);
    const p = item ? lista?.preciosResueltos?.[item] : undefined;
    return p == null ? "" : String(p);
  };
  // Al cambiar de lista se re-proponen los precios que no se tocaron a mano.
  useEffect(() => {
    setRenglones((prev) =>
      prev.map((r) => (r.producto && !r.precioTocado ? { ...r, precio: precioDeLista(opcionPorKey[r.producto]) } : r))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaId, listas]);

  const setRenglon = (id, cambios) =>
    setRenglones((prev) => prev.map((r) => (r.id === id ? { ...r, ...cambios } : r)));
  const elegirProducto = (id, key) => {
    const op = opcionPorKey[key];
    setRenglon(id, {
      producto: key, kg: "", kgTocado: false, descripcion: "",
      precio: precioDeLista(op), precioTocado: false,
      // El alimento con stock va por bolsa; el "otro" arranca en bolsa.
      unidad: "bolsa",
    });
  };
  const quitarRenglon = (id) =>
    setRenglones((prev) => (prev.length === 1 ? [renglonVacio()] : prev.filter((r) => r.id !== id)));

  // Lo pedido de un mismo producto entre todos los renglones, contra su stock.
  const pedidoPorKey = renglones.reduce((acc, r) => {
    if (r.producto) acc[r.producto] = (acc[r.producto] || 0) + (Number(r.cantidad) || 0);
    return acc;
  }, {});
  const excedido = (key) => {
    const op = opcionPorKey[key];
    return op?.disponible != null && (pedidoPorKey[key] || 0) > op.disponible;
  };

  const limpiar = () => {
    setFecha(obtenerFechaHoy());
    setClienteId("");
    setClienteNombre("");
    setRenglones([renglonVacio()]);
    setObservaciones("");
    setFormaPago("efectivo");
    setOperacionMP("");
    setListaTocada(false);
  };

  const emitir = async (e) => {
    e.preventDefault();
    if (modoCliente === "padron" && !clienteId)
      return Swal.fire("Falta el cliente", "Elegí un cliente del padrón, o pasá a consumidor final.", "warning");
    if (modoCliente === "final" && !clienteNombre.trim())
      return Swal.fire("Falta el cliente", "Escribí el nombre de quien compra.", "warning");

    const usados = renglones.filter((r) => r.producto);
    if (usados.length === 0) return Swal.fire("Sin renglones", "Agregá al menos un producto.", "warning");

    for (const [i, r] of usados.entries()) {
      const op = opcionPorKey[r.producto];
      const n = `Renglón ${i + 1}`;
      if (!op) return Swal.fire("Producto sin stock", `${n}: ese producto ya no tiene stock. Elegí otro.`, "warning");
      if (!(Number(r.cantidad) > 0)) return Swal.fire("Falta la cantidad", `${n}: ${op.texto}.`, "warning");
      if (r.precio === "" || Number(r.precio) < 0) return Swal.fire("Falta el precio", `${n}: ${op.texto}.`, "warning");
      if (op.clase === "alimento" && op.producto === "otro" && !r.descripcion.trim())
        return Swal.fire("Falta el detalle", `${n}: escribí qué alimento es.`, "warning");
      if (excedido(r.producto))
        return Swal.fire("Stock insuficiente", `${op.texto}: hay ${fmt(op.disponible)} ${op.unidad}.`, "error");
    }

    if (formaPago === "cuenta_corriente" && modoCliente !== "padron")
      return Swal.fire("Cuenta corriente", "La cuenta corriente es solo para clientes del padrón.", "warning");

    const lineas = usados.map((r) => {
      const op = opcionPorKey[r.producto];
      const base = { clase: op.clase, cantidad: Number(r.cantidad), precioUnitario: Number(r.precio) };
      if (op.clase === "entero") return { ...base, especie: op.especie, calibre: op.calibre, kg: kgDe(r, op) };
      if (op.clase === "trozado")
        return { ...base, especie: op.especie, tipo: op.tipo, claseTrozado: op.claseTrozado, kgCaja: op.kgCaja };
      if (op.clase === "huevo") return { ...base, tipo: op.tipo };
      if (op.clase === "alimento")
        return { ...base, producto: op.producto, unidad: r.unidad, descripcion: r.descripcion.trim() || undefined };
      return base;
    });

    setSaving(true);
    try {
      const presupuesto = await crearPresupuestoForratuc({
        fecha,
        ...(modoCliente === "padron" ? { cliente: clienteId } : { clienteNombre: clienteNombre.trim() }),
        lineas,
        formaPago,
        operacion: formaPago === "mercado_pago" ? operacionMP.trim() || undefined : undefined,
        listaPrecio: listaId || undefined,
        observaciones: observaciones.trim() || undefined,
      });
      limpiar();
      cargar();
      // Se imprime apenas se emite: es el papel con el que el cliente retira.
      imprimirPresupuestoForratuc(presupuesto, opcionesImpresion);
      Swal.fire({
        icon: "success",
        title: `Presupuesto ${presupuesto.numero}`,
        html: `Total ${pesos(presupuesto.total)}.<br/><span class="text-muted">Se abrió la impresión (original y duplicado).</span>`,
        timer: 3500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo emitir el presupuesto.", "error");
    } finally {
      setSaving(false);
    }
  };

  const anular = async (p) => {
    const { value: motivo, isConfirmed } = await Swal.fire({
      title: `¿Anular el presupuesto ${escapeHtml(p.numero)}?`,
      html:
        (p.movimiento
          ? "Se <strong>devuelve el stock</strong> de lo que salió (pollo, huevo, pollitos, alimento)."
          : "No tocó stock: solo queda anulado.") +
        (p.condicionPago === "cuenta_corriente" ? "<br/>Sale de la <strong>cuenta corriente</strong> del cliente." : ""),
      input: "text",
      inputPlaceholder: "Por qué se anula",
      inputValidator: (v) => (!v?.trim() ? "Escribí el motivo." : undefined),
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      confirmButtonColor: "#dc3545",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;
    try {
      await anularPresupuestoForratuc(p._id, motivo.trim());
      await Swal.fire({ icon: "success", title: "Anulado", timer: 1400, showConfirmButton: false });
      cargarLista();
      cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo anular.", "error");
    }
  };

  const emitidos = presupuestos.filter((p) => p.estado === "emitido");
  const totalEmitidos = emitidos.reduce((a, p) => a + p.total, 0);

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex align-items-center gap-2 mb-4">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/forratuc")}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">
            <i className="bi bi-receipt me-2 text-secondary"></i>
            Ventas
          </h1>
        </div>

        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button className={`nav-link ${tab === "nuevo" ? "active" : ""}`} onClick={() => setTab("nuevo")}>
              <i className="bi bi-plus-circle me-1"></i> Nuevo presupuesto
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${tab === "emitidos" ? "active" : ""}`} onClick={() => setTab("emitidos")}>
              <i className="bi bi-list-ul me-1"></i> Emitidos
            </button>
          </li>
        </ul>

        {/* ══════════ NUEVO ══════════ */}
        {tab === "nuevo" && (loading ? (
          <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
        ) : (
          <form onSubmit={emitir}>
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-12 col-sm-4 col-lg-2">
                    <label className="form-label fw-semibold small mb-1">Fecha</label>
                    <input type="date" className="form-control" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
                  </div>
                  <div className="col-12 col-sm-8 col-lg-6">
                    <div className="d-flex justify-content-between align-items-end mb-1">
                      <label className="form-label fw-semibold small mb-0">Cliente</label>
                      <div className="btn-group btn-group-sm">
                        <button type="button" className={`btn ${modoCliente === "padron" ? "btn-dark" : "btn-outline-secondary"}`} onClick={() => setModoCliente("padron")}>
                          Del padrón
                        </button>
                        <button type="button" className={`btn ${modoCliente === "final" ? "btn-dark" : "btn-outline-secondary"}`} onClick={() => setModoCliente("final")}
                          disabled={formaPago === "cuenta_corriente"} title={formaPago === "cuenta_corriente" ? "Al consumidor final no se le fía" : undefined}>
                          Consumidor final
                        </button>
                      </div>
                    </div>
                    {modoCliente === "padron" ? (
                      <BuscadorCliente clientes={clientes} value={clienteId} onChange={setClienteId} placeholder="Buscá por nombre, CUIT o teléfono..." />
                    ) : (
                      <input className="form-control" placeholder="Nombre de quien compra" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
                    )}
                  </div>
                  <div className="col-12 col-lg-4">
                    <label className="form-label fw-semibold small mb-1">Lista de precios</label>
                    <select className="form-select" value={listaId}
                      onChange={(e) => { setListaId(e.target.value); setListaTocada(true); }}>
                      <option value="">Sin lista (precios a mano)</option>
                      {listas.map((l) => (
                        <option key={l._id} value={l._id}>
                          {l.nombre}{l.tipo === "descuento" ? ` (${fmt(l.porcentaje)}% menos)` : ""}{l.porDefecto ? " — por defecto" : ""}
                        </option>
                      ))}
                    </select>
                    {listas.length === 0 && (
                      <div className="form-text">Todavía no hay listas: se arman en <em>Listas de precios</em>.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-2">
                    <thead className="table-light">
                      <tr>
                        <th style={{ minWidth: 260 }}>Producto</th>
                        <th style={{ width: 150 }}>Cantidad</th>
                        <th style={{ width: 120 }}>Kg</th>
                        <th style={{ width: 170 }}>Precio unitario</th>
                        <th className="text-end" style={{ width: 140 }}>Importe</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {renglones.map((r) => {
                        const op = opcionPorKey[r.producto];
                        const esAlimento = op?.clase === "alimento";
                        const esOtro = esAlimento && op.producto === "otro";
                        const unidadCant = esAlimento ? (r.unidad === "kg" ? "kg" : "bolsas") : op?.unidad;
                        const unidadPrecio = esAlimento ? r.unidad : op?.unidadPrecio;
                        return (
                          <tr key={r.id}>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={r.producto}
                                onChange={(e) => elegirProducto(r.id, e.target.value)}
                              >
                                <option value="">Elegí un producto…</option>
                                {grupos.filter((g) => g.opciones.length > 0).map((g) => (
                                  <optgroup key={g.titulo} label={g.titulo}>
                                    {g.opciones.map((o) => (
                                      <option key={o.key} value={o.key}>
                                        {o.texto}{o.disponible != null ? ` — hay ${fmt(o.disponible)} ${o.unidad}` : ""}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                              {esAlimento && op.producto === "otro" && (
                                <input className="form-control form-control-sm mt-1" placeholder="Qué alimento (ej. maíz partido 25 kg)"
                                  value={r.descripcion} onChange={(e) => setRenglon(r.id, { descripcion: e.target.value })} />
                              )}
                            </td>
                            <td>
                              <div className="input-group input-group-sm">
                                <input type="number" min="0" step={esAlimento && r.unidad === "kg" ? "0.01" : "1"}
                                  className={`form-control ${r.producto && excedido(r.producto) ? "is-invalid" : ""}`}
                                  value={r.cantidad} disabled={!op}
                                  onChange={(e) => setRenglon(r.id, { cantidad: e.target.value })} />
                                {esOtro ? (
                                  <select className="form-select" style={{ maxWidth: 80 }} value={r.unidad}
                                    onChange={(e) => setRenglon(r.id, { unidad: e.target.value })}>
                                    {(constantes?.unidadesAlimento || []).map((u) => (
                                      <option key={u.key} value={u.key}>{u.etiqueta}</option>
                                    ))}
                                  </select>
                                ) : op ? (
                                  <span className="input-group-text">{unidadCant}</span>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              {op?.clase === "entero" ? (
                                <input type="number" min="0" step="0.01" className="form-control form-control-sm"
                                  title={`Se propone ${kgPorCajon} kg por cajón; poné el peso real si lo pesaste.`}
                                  value={r.kgTocado ? r.kg : kgDe(r, op) || ""}
                                  onChange={(e) => setRenglon(r.id, { kg: e.target.value, kgTocado: true })} />
                              ) : op?.clase === "trozado" ? (
                                <span className="small">{fmt(kgDe(r, op))} kg</span>
                              ) : (
                                <span className="text-muted small">—</span>
                              )}
                            </td>
                            <td>
                              <div className="input-group input-group-sm">
                                <span className="input-group-text">$</span>
                                <input type="number" min="0" step="0.01" className="form-control" value={r.precio} disabled={!op}
                                  title={lista && itemDeOpcion(op) ? `Lista: ${lista.nombre}` : undefined}
                                  onChange={(e) => setRenglon(r.id, { precio: e.target.value, precioTocado: true })} />
                                {op && <span className="input-group-text">/ {UNIDAD_PRECIO[unidadPrecio] || unidadPrecio}</span>}
                              </div>
                            </td>
                            <td className="text-end fw-semibold">{op ? pesos(importeDe(r)) : ""}</td>
                            <td>
                              <button type="button" className="btn btn-sm btn-outline-danger border-0" title="Quitar" onClick={() => quitarRenglon(r.id)}>
                                <i className="bi bi-x-lg"></i>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4}>
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setRenglones((p) => [...p, renglonVacio()])}>
                            <i className="bi bi-plus-lg me-1"></i>Agregar renglón
                          </button>
                        </td>
                        <td className="text-end">
                          <div className="small text-muted">TOTAL</div>
                          <div className="fs-5 fw-bold">{pesos(total)}</div>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* ── Forma de pago: tres botones fijos (pedido del cliente, 2026-10-29) ── */}
                <div className="border-top pt-3 mb-3">
                  <div className="fw-semibold small mb-2">Forma de pago</div>
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    {formasPago.map((f) => {
                      const elegida = formaPago === f.key;
                      const icono = { efectivo: "bi-cash-coin", mercado_pago: "bi-phone", cuenta_corriente: "bi-journal-text" }[f.key];
                      return (
                        <button key={f.key} type="button"
                          className={`btn btn-sm px-3 ${elegida ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => elegirFormaPago(f.key)}>
                          <i className={`bi ${icono || "bi-wallet2"} me-2`}></i>
                          {f.etiqueta}
                          {elegida && <i className="bi bi-check-circle-fill ms-2"></i>}
                        </button>
                      );
                    })}
                  </div>
                  {formaPago === "efectivo" ? (
                    <div className="small text-muted">Contado en efectivo: {pesos(total)}.</div>
                  ) : formaPago === "mercado_pago" ? (
                    <div className="d-flex flex-wrap align-items-center gap-2 small">
                      <span className="text-muted">Contado por Mercado Pago: {pesos(total)}.</span>
                      <input className="form-control form-control-sm" style={{ maxWidth: 220 }}
                        placeholder="N° de operación (opcional)" value={operacionMP} onChange={(e) => setOperacionMP(e.target.value)} />
                    </div>
                  ) : (
                    <div className="alert alert-warning py-2 small mb-0">
                      <i className="bi bi-journal-text me-1"></i>
                      Va a la <strong>cuenta corriente</strong> del cliente: {pesos(total)} al debe.
                      {saldoCliente != null && (
                        <> Hoy debe <strong>{pesos(saldoCliente)}</strong>; queda en <strong>{pesos(saldoCliente + total)}</strong>.</>
                      )}
                      {!clienteId && " Elegí el cliente del padrón."}
                    </div>
                  )}
                </div>

                <label className="form-label fw-semibold small mb-1">Observaciones</label>
                <textarea className="form-control mb-3" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />

                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <span className="text-muted small">
                    <i className="bi bi-info-circle me-1"></i>
                    Al emitir se descuenta el stock: pollo, huevo y pollitos de la avícola, y el alimento de la forrajería.
                  </span>
                  <button type="submit" className="btn btn-success" disabled={saving}>
                    {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-printer me-1"></i>}
                    Emitir e imprimir
                  </button>
                </div>
              </div>
            </div>
          </form>
        ))}

        {/* ══════════ EMITIDOS ══════════ */}
        {tab === "emitidos" && (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                <div>
                  <label className="form-label small mb-1">Desde</label>
                  <input type="date" className="form-control form-control-sm" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </div>
                <div>
                  <label className="form-label small mb-1">Hasta</label>
                  <input type="date" className="form-control form-control-sm" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </div>
                <div className="ms-auto text-end">
                  <div className="small text-muted">{emitidos.length} emitidos (sin anulados)</div>
                  <div className="fw-bold">{pesos(totalEmitidos)}</div>
                </div>
              </div>

              {loadingLista ? (
                <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
              ) : presupuestos.length === 0 ? (
                <div className="text-muted text-center py-4">No hay presupuestos en esas fechas.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>N°</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Detalle</th>
                        <th className="text-end">Total</th>
                        <th>Pago</th>
                        <th>Registró</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {presupuestos.map((p) => {
                        const anulado = p.estado === "anulado";
                        return (
                          <tr key={p._id} className={anulado ? "text-muted" : ""}>
                            <td className="fw-semibold text-nowrap">
                              {p.numero}
                              {anulado && <span className="badge bg-danger ms-1">Anulado</span>}
                            </td>
                            <td className="text-nowrap">{formatearFechaLocal(p.fecha)}</td>
                            <td>
                              {p.clienteNombre}
                              {!p.cliente && <span className="badge bg-light text-secondary border ms-1">cons. final</span>}
                            </td>
                            <td className="small" style={{ maxWidth: 380 }}>
                              {p.lineas.map((l) => `${fmt(l.cantidad)} ${l.unidad} ${l.descripcion}`).join(" · ")}
                              {anulado && p.motivoAnulacion && (
                                <div className="text-danger">Motivo: {p.motivoAnulacion}</div>
                              )}
                            </td>
                            <td className={`text-end fw-semibold text-nowrap ${anulado ? "text-decoration-line-through" : ""}`}>{pesos(p.total)}</td>
                            <td className="small">
                              {p.condicionPago === "cuenta_corriente" ? (
                                <span className="badge bg-warning text-dark">Cta. cte.</span>
                              ) : p.condicionPago === "contado" ? (
                                (p.pagos || []).map((pg) => mediosPago.find((m) => m.key === pg.medio)?.etiqueta || pg.medio).join(" + ") || "Contado"
                              ) : "—"}
                            </td>
                            <td className="small">{p.registradoPor?.nombreUsuario || "—"}</td>
                            <td className="text-nowrap text-end">
                              <button className="btn btn-sm btn-outline-secondary me-1" title="Reimprimir" onClick={() => imprimirPresupuestoForratuc(p, opcionesImpresion)}>
                                <i className="bi bi-printer"></i>
                              </button>
                              {!anulado && (
                                <button className="btn btn-sm btn-outline-danger" title="Anular" onClick={() => anular(p)}>
                                  <i className="bi bi-x-circle"></i>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ForratucPresupuestosPage;
