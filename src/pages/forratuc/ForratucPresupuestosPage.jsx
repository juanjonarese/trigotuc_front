import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import BuscadorCliente from "../../components/BuscadorCliente";
import { especieDe } from "../../utils/especies";
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
  obtenerProductosForratuc,
  obtenerPresupuestosForratuc,
  crearPresupuestoForratuc,
  anularPresupuestoForratuc,
} from "../../services/api";

/**
 * Mostrador de Forratuc (2026-10-21): el presupuesto, que es su "factura".
 *
 * Desde el 2026-11-02 cada renglón es un PRODUCTO del alta (se elige por código
 * o por nombre) y la venta entera sale de UN DEPÓSITO, que se elige antes de
 * cargar los renglones (pedido del usuario): si se lleva de los dos, son dos
 * presupuestos. Forrajería = pollo (la cámara "trigotuc" está en la forrajería),
 * huevo, pollitos y su depósito; Trigotuc = solo su depósito. Cambiar el depósito deja los renglones y
 * muestra lo que hay en el nuevo.
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

const fmt = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(n || 0));
const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));
const redondear = (n) => Math.round(n * 100) / 100;

// Cómo se cuenta cada producto en el renglón (la cantidad) según su rubro / unidad.
const UNIDAD_CANTIDAD = { pollo: "cajones", trozado: "cajas" };
const UNIDAD_PLURAL = { maple: "maples", pollito: "pollitos", bolsa: "bolsas", unidad: "unidades", caja: "cajas" };
const unidadCantidad = (p) => UNIDAD_CANTIDAD[p?.rubro] || UNIDAD_PLURAL[p?.unidadVenta] || p?.unidadVenta || "";

let siguienteId = 1;
// producto = clave del producto (el entero ya es por calibre y el trozado por
// especie, corte y clase: no hay nada más que elegir).
const renglonVacio = () => ({ id: siguienteId++, codigo: "", producto: "", cantidad: "", kg: "", kgTocado: false, precio: "", precioTocado: false });

const ForratucPresupuestosPage = () => {
  const navigate = useNavigate();

  // 2026-11-06 (pedido del usuario): la pantalla es el listado de emitidos y
  // el presupuesto nuevo se arma en un modal.
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [resumen, setResumen] = useState(null);
  const [stockHuevos, setStockHuevos] = useState(null);
  const [stockPollitos, setStockPollitos] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [constantes, setConstantes] = useState(null);
  const [stockAlimento, setStockAlimento] = useState(null);
  const [listas, setListas] = useState([]);
  const [productos, setProductos] = useState([]);

  // ── Formulario ──
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  // De qué depósito sale TODA la venta: se elige antes de cargar renglones.
  const [deposito, setDeposito] = useState("");
  const [modoCliente, setModoCliente] = useState("padron"); // padron | final
  const [clienteId, setClienteId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [renglones, setRenglones] = useState([renglonVacio()]);
  const [observaciones, setObservaciones] = useState("");
  // Forma de pago (2026-10-29): uno de los tres botones. Cuenta corriente,
  // solo clientes del padrón.
  // "combinado" (2026-11-02): parte en efectivo y parte por Mercado Pago, con
  // los dos botones prendidos y el importe de cada uno.
  const [formaPago, setFormaPago] = useState("efectivo");
  const [importeEfectivo, setImporteEfectivo] = useState("");
  const [importeMP, setImporteMP] = useState("");
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
      const [stock, huevos, pollitos, cls, ctes, stockForratuc, lts, prods] = await Promise.all([
        obtenerStockCamaraMostrador(),
        obtenerStockHuevosMostrador().catch(() => null),
        obtenerStockPollitosMostrador().catch(() => null),
        obtenerClientes().catch(() => []),
        obtenerConstantesPresupuesto(),
        obtenerStockForratuc().catch(() => null),
        obtenerListasPreciosForratuc().catch(() => []),
        obtenerProductosForratuc({ soloActivos: true }),
      ]);
      setProductos(Array.isArray(prods) ? prods : []);
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
    cargarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta]);

  // Al abrir el modal se relee el stock: entre una venta y otra pudo cambiar.
  const abrirNuevo = () => {
    setNuevoAbierto(true);
    cargar();
  };

  const kgPorCajon = constantes?.kgPorCajon ?? 20;
  const huevosPorMaple = constantes?.huevosPorMaple ?? stockHuevos?.huevosPorMaple ?? 30;

  // Los productos activos del alta, por clave y por código, y agrupados por rubro.
  const productoPorClave = useMemo(() => Object.fromEntries(productos.map((p) => [p.clave, p])), [productos]);
  const productoPorCodigo = useMemo(
    () => Object.fromEntries(productos.map((p) => [String(p.codigo).trim().toLowerCase(), p])),
    [productos]
  );
  const gruposProductos = useMemo(() => {
    const titulo = {
      pollo: "Pollo entero (precio por kg)", trozado: "Trozado (precio por kg)",
      huevo: `Huevo (maple de ${huevosPorMaple})`, pollito: "Pollitos", alimento: "Alimento balanceado", otros: "Otros",
    };
    const porRubro = new Map();
    for (const p of productos) porRubro.set(p.rubro, [...(porRubro.get(p.rubro) || []), p]);
    return [...porRubro].map(([rubro, items]) => ({ titulo: titulo[rubro] || rubro, items }));
  }, [productos, huevosPorMaple]);

  // Qué hay en cada depósito de la venta (por origen del producto: ver el back).
  const depositos = constantes?.depositosAlimento || [];
  const etiquetaDeposito = depositos.find((d) => d.key === deposito)?.etiqueta || "";
  const hayEnDeposito = (prod) => Boolean(prod && (constantes?.origenesPorDeposito?.[deposito] || []).includes(prod.origen));

  // Cada producto de cámara es UN stock (2026-11-02): el entero por especie y
  // calibre, el trozado por especie, corte y clase. Las cajas de trozado son de
  // 15 kg; si conviven tamaños, el kg de la caja es el de la primera con stock.
  const trozadoDe = (prod) =>
    (resumen?.trozadosTrigotucDetalle || []).filter(
      (t) => especieDe(t) === prod?.especie && t.tipo === prod?.tipo && (t.clase || "A") === prod?.claseTrozado && t.cajas > 0
    );
  const kgCajaDe = (prod) => Number(trozadoDe(prod)[0]?.kgCaja) || 0;

  // Lo que hay de lo que pide el renglón en el depósito de la venta. null = el
  // producto no está en ese depósito.
  const disponibleDe = (r) => {
    const prod = productoPorClave[r.producto];
    if (!prod || !hayEnDeposito(prod)) return null;
    if (prod.rubro === "pollo")
      return (resumen?.stockTrigotuc || []).find((e) => especieDe(e) === prod.especie && e.calibre === prod.calibre)?.cajones || 0;
    if (prod.rubro === "trozado") return trozadoDe(prod).reduce((a, t) => a + t.cajas, 0);
    if (prod.origen === "huevo") {
      // El común junta varios tipos del stock (consumo, API pasado a venta,
      // descarte de inoculación): se suman en huevos y recién ahí se pasa a maples.
      const tipos = prod.tiposStock || [prod.tipo];
      const huevos = (stockHuevos?.porTipo || []).filter((h) => tipos.includes(h.tipo)).reduce((a, h) => a + h.huevos, 0);
      return Math.floor(huevos / huevosPorMaple);
    }
    if (prod.origen === "pollito") return stockPollitos?.total || 0;
    return stockAlimento?.productos?.find((x) => x.alimento === prod.stockKey)?.porDeposito?.[deposito] || 0;
  };
  // Los renglones que salen del mismo stock se suman entre sí.
  const claveStock = (r) => r.producto;

  // Kg que se cobran en un renglón de pollo. Entero: 20 por cajón hasta que se
  // tipee el peso real. Trozado: cajas × kg de la caja.
  const kgDe = (r) => {
    const p = productoPorClave[r.producto];
    const cant = Number(r.cantidad) || 0;
    if (p?.rubro === "pollo") return r.kgTocado ? Number(r.kg) || 0 : cant * kgPorCajon;
    if (p?.rubro === "trozado") return redondear(cant * kgCajaDe(p));
    return 0;
  };
  const porKg = (p) => p?.rubro === "pollo" || p?.rubro === "trozado";
  const importeDe = (r) => {
    const p = productoPorClave[r.producto];
    if (!p) return 0;
    const precio = Number(r.precio) || 0;
    return redondear((porKg(p) ? kgDe(r) : Number(r.cantidad) || 0) * precio);
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
    const contado = ["efectivo", "mercado_pago"];
    if (contado.includes(f) && contado.includes(formaPago) && f !== formaPago) {
      setFormaPago("combinado");
      setImporteEfectivo("");
      setImporteMP("");
      return;
    }
    if (formaPago === "combinado" && contado.includes(f)) {
      setFormaPago(contado.find((x) => x !== f));
      return;
    }
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
  const precioDeLista = (clave) => {
    const p = clave ? lista?.preciosResueltos?.[clave] : undefined;
    return p == null ? "" : String(p);
  };
  // Al cambiar de lista se re-proponen los precios que no se tocaron a mano.
  useEffect(() => {
    setRenglones((prev) =>
      prev.map((r) => (r.producto && !r.precioTocado ? { ...r, precio: precioDeLista(r.producto) } : r))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaId, listas]);

  const setRenglon = (id, cambios) =>
    setRenglones((prev) => prev.map((r) => (r.id === id ? { ...r, ...cambios } : r)));
  // Elegir el producto (por nombre o por código): arranca en su lugar por
  // defecto.
  const elegirProducto = (id, clave, codigoTipeado) => {
    const prod = productoPorClave[clave];
    setRenglon(id, {
      producto: clave,
      codigo: codigoTipeado ?? prod?.codigo ?? "",
      kg: "", kgTocado: false,
      precio: precioDeLista(clave), precioTocado: false,
    });
  };
  const tipearCodigo = (id, texto) => {
    const prod = productoPorCodigo[texto.trim().toLowerCase()];
    if (prod) elegirProducto(id, prod.clave, texto);
    else setRenglon(id, { codigo: texto, producto: "" });
  };
  const quitarRenglon = (id) =>
    setRenglones((prev) => (prev.length === 1 ? [renglonVacio()] : prev.filter((r) => r.id !== id)));

  // Lo pedido de un mismo stock entre todos los renglones, contra lo que hay.
  const pedidoPorStock = renglones.reduce((acc, r) => {
    if (r.producto) acc[claveStock(r)] = (acc[claveStock(r)] || 0) + (Number(r.cantidad) || 0);
    return acc;
  }, {});
  const pasaDeLoQueHay = (r) => r.producto && (pedidoPorStock[claveStock(r)] || 0) > (disponibleDe(r) ?? 0);
  // El alimento balanceado puede quedar en negativo (2026-11-10): se avisa, no se frena.
  const quedaNegativo = (r) => productoPorClave[r.producto]?.rubro === "alimento" && pasaDeLoQueHay(r);
  const excedido = (r) => productoPorClave[r.producto]?.rubro !== "alimento" && pasaDeLoQueHay(r);

  const limpiar = () => {
    setFecha(obtenerFechaHoy());
    setClienteId("");
    setClienteNombre("");
    setRenglones([renglonVacio()]);
    setObservaciones("");
    setFormaPago("efectivo");
    setImporteEfectivo("");
    setImporteMP("");
    setOperacionMP("");
    setListaTocada(false);
  };

  const emitir = async (e) => {
    e.preventDefault();
    if (fecha < obtenerFechaHoy())
      return Swal.fire("Fecha anterior a hoy", "El presupuesto no puede llevar una fecha anterior a hoy.", "warning");
    if (modoCliente === "padron" && !clienteId)
      return Swal.fire("Falta el cliente", "Elegí un cliente del padrón, o pasá a consumidor final.", "warning");
    if (modoCliente === "final" && !clienteNombre.trim())
      return Swal.fire("Falta el cliente", "Escribí el nombre de quien compra.", "warning");

    if (!deposito) return Swal.fire("Falta el depósito", "Elegí de qué depósito sale la venta.", "warning");
    const usados = renglones.filter((r) => r.producto || r.codigo.trim());
    if (usados.length === 0) return Swal.fire("Sin renglones", "Agregá al menos un producto.", "warning");

    for (const [i, r] of usados.entries()) {
      const p = productoPorClave[r.producto];
      const n = `Renglón ${i + 1}`;
      if (!p) return Swal.fire("Producto", `${n}: no hay un producto con el código "${r.codigo}".`, "warning");
      if (!hayEnDeposito(p))
        return Swal.fire("No está en este depósito", `${n}: ${p.nombre} no está en el ${etiquetaDeposito}. Si se lleva de los dos depósitos, hacé dos presupuestos.`, "warning");
      if (p.rubro === "trozado" && !kgCajaDe(p))
        return Swal.fire("Sin stock", `${n}: no hay ${p.nombre} en la cámara.`, "warning");
      if (!(Number(r.cantidad) > 0)) return Swal.fire("Falta la cantidad", `${n}: ${p.nombre}.`, "warning");
      if (r.precio === "" || Number(r.precio) < 0) return Swal.fire("Falta el precio", `${n}: ${p.nombre}.`, "warning");
      if (excedido(r))
        return Swal.fire("Stock insuficiente", `${p.nombre}: hay ${fmt(disponibleDe(r))} ${unidadCantidad(p)}.`, "error");
    }

    if (formaPago === "cuenta_corriente" && modoCliente !== "padron")
      return Swal.fire("Cuenta corriente", "La cuenta corriente es solo para clientes del padrón.", "warning");
    if (formaPago === "combinado") {
      if (!(Number(importeEfectivo) > 0) || !(Number(importeMP) > 0))
        return Swal.fire("Pago combinado", "Poné cuánto paga en efectivo y cuánto por Mercado Pago.", "warning");
      if (redondear(Number(importeEfectivo) + Number(importeMP)) !== total)
        return Swal.fire("Pago combinado", `Efectivo + Mercado Pago tienen que sumar ${pesos(total)}.`, "warning");
    }

    const lineas = usados.map((r) => {
      const p = productoPorClave[r.producto];
      const linea = { producto: p.clave, cantidad: Number(r.cantidad), precioUnitario: Number(r.precio) };
      if (p.rubro === "pollo") linea.kg = kgDe(r);
      if (p.rubro === "trozado") linea.kgCaja = kgCajaDe(p);
      return linea;
    });

    setSaving(true);
    try {
      const presupuesto = await crearPresupuestoForratuc({
        fecha,
        ...(modoCliente === "padron" ? { cliente: clienteId } : { clienteNombre: clienteNombre.trim() }),
        deposito,
        lineas,
        ...(formaPago === "combinado"
          ? {
              condicionPago: "contado",
              pagos: [
                { medio: "efectivo", importe: Number(importeEfectivo) },
                { medio: "mercado_pago", importe: Number(importeMP), operacion: operacionMP.trim() || undefined },
              ],
            }
          : {
              formaPago,
              operacion: formaPago === "mercado_pago" ? operacionMP.trim() || undefined : undefined,
            }),
        listaPrecio: listaId || undefined,
        observaciones: observaciones.trim() || undefined,
      });
      limpiar();
      setNuevoAbierto(false);
      cargar();
      cargarLista();
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
        <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/forratuc")}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">
            <i className="bi bi-receipt me-2 text-secondary"></i>
            Presupuestos
          </h1>
          <button className="btn btn-primary ms-auto" onClick={abrirNuevo}>
            <i className="bi bi-plus-lg me-1"></i>Nuevo presupuesto
          </button>
        </div>

        {/* ══════════ NUEVO (modal) ══════════ */}
        {/* Sin modal-dialog-scrollable: le cortaría el desplegable al BuscadorCliente;
            el que scrollea es el .modal entero. */}
        {nuevoAbierto && (
          <>
          <div className="modal d-block" tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-xl" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title"><i className="bi bi-plus-circle me-2"></i>Nuevo presupuesto</h5>
                  <button type="button" className="btn-close" onClick={() => setNuevoAbierto(false)} disabled={saving}
                    title="Cerrar (lo cargado queda para cuando lo vuelvas a abrir)"></button>
                </div>
                <div className="modal-body bg-light">
          {loading ? (
          <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
        ) : (
          <form onSubmit={emitir}>
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-12 col-sm-6 col-lg-3">
                    <label className="form-label fw-semibold small mb-1">Depósito</label>
                    <select className={`form-select ${deposito ? "" : "border-primary"}`} value={deposito}
                      onChange={(e) => setDeposito(e.target.value)}>
                      <option value="">Elegí de dónde sale…</option>
                      {depositos.map((d) => <option key={d.key} value={d.key}>{d.etiqueta}</option>)}
                    </select>
                  </div>
                  <div className="col-12 col-sm-6 col-lg-2">
                    <label className="form-label fw-semibold small mb-1">Fecha</label>
                    {/* No se emite con fecha anterior a hoy (2026-11-02); el back lo controla igual. */}
                    <input type="date" className="form-control" value={fecha} min={obtenerFechaHoy()} onChange={(e) => setFecha(e.target.value)} required />
                  </div>
                  <div className="col-12 col-sm-8 col-lg-4">
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
                  <div className="col-12 col-sm-4 col-lg-3">
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
                        <th style={{ width: 100 }}>Código</th>
                        <th style={{ minWidth: 260 }}>Producto</th>
                        <th style={{ width: 140 }}>Stock</th>
                        <th style={{ width: 150 }}>Cantidad</th>
                        <th style={{ width: 110 }}>Kg</th>
                        <th style={{ width: 170 }}>Precio unitario</th>
                        <th className="text-end" style={{ width: 130 }}>Importe</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {renglones.map((r) => {
                        const p = productoPorClave[r.producto];
                        const hay = disponibleDe(r);
                        // El producto elegido sigue en la lista aunque no esté en este depósito.
                        const enOtroDeposito = p && !hayEnDeposito(p);
                        const codigoMal = r.codigo.trim() && !p;
                        return (
                          <tr key={r.id}>
                            <td>
                              <input className={`form-control form-control-sm ${codigoMal ? "is-invalid" : ""}`}
                                placeholder="Código" value={r.codigo} disabled={!deposito} title={codigoMal ? "No hay un producto con ese código" : undefined}
                                onChange={(e) => tipearCodigo(r.id, e.target.value)} />
                            </td>
                            <td>
                              <select className="form-select form-select-sm" value={r.producto} disabled={!deposito}
                                onChange={(e) => elegirProducto(r.id, e.target.value)}>
                                <option value="">{deposito ? "Elegí un producto…" : "Primero elegí el depósito"}</option>
                                {enOtroDeposito && <option value={p.clave}>{p.codigo} · {p.nombre}</option>}
                                {gruposProductos.map((g) => {
                                  const items = g.items.filter(hayEnDeposito);
                                  return items.length === 0 ? null : (
                                    <optgroup key={g.titulo} label={g.titulo}>
                                      {items.map((it) => (
                                        <option key={it.clave} value={it.clave}>{it.codigo} · {it.nombre}</option>
                                      ))}
                                    </optgroup>
                                  );
                                })}
                              </select>
                              {p && enOtroDeposito && (
                                <div className="small text-danger mt-1">No está en el {etiquetaDeposito}: va en otro presupuesto.</div>
                              )}
                            </td>
                            <td>
                              {/* Lo que hay en el depósito de la venta: solo para ver, no se edita. */}
                              {p && !enOtroDeposito && (
                                <input readOnly tabIndex={-1}
                                  className={`form-control form-control-sm bg-light ${hay > 0 ? "" : "text-danger"}`}
                                  title={`En el ${etiquetaDeposito}`}
                                  value={`${fmt(hay)} ${unidadCantidad(p)}`} />
                              )}
                            </td>
                            <td>
                              <div className="input-group input-group-sm">
                                <input type="number" min="0" step="1"
                                  className={`form-control ${excedido(r) ? "is-invalid" : ""}`}
                                  value={r.cantidad} disabled={!p || enOtroDeposito}
                                  onChange={(e) => setRenglon(r.id, { cantidad: e.target.value })} />
                                {p && <span className="input-group-text">{unidadCantidad(p)}</span>}
                              </div>
                              {quedaNegativo(r) && (
                                <div className="small text-warning-emphasis mt-1">El depósito queda en negativo.</div>
                              )}
                            </td>
                            <td>
                              {p?.rubro === "pollo" ? (
                                <input type="number" min="0" step="0.01" className="form-control form-control-sm"
                                  title={`Se propone ${kgPorCajon} kg por cajón; poné el peso real si lo pesaste.`}
                                  value={r.kgTocado ? r.kg : kgDe(r) || ""}
                                  onChange={(e) => setRenglon(r.id, { kg: e.target.value, kgTocado: true })} />
                              ) : p?.rubro === "trozado" ? (
                                <span className="small">{fmt(kgDe(r))} kg</span>
                              ) : (
                                <span className="text-muted small">—</span>
                              )}
                            </td>
                            <td>
                              <div className="input-group input-group-sm">
                                <span className="input-group-text">$</span>
                                <input type="number" min="0" step="0.01" className="form-control" value={r.precio} disabled={!p}
                                  title={lista && p ? `Lista: ${lista.nombre}` : undefined}
                                  onChange={(e) => setRenglon(r.id, { precio: e.target.value, precioTocado: true })} />
                                {p && <span className="input-group-text">/ {p.unidadVenta}</span>}
                              </div>
                            </td>
                            <td className="text-end fw-semibold">{p ? pesos(importeDe(r)) : ""}</td>
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
                        <td colSpan={6}>
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
                      const elegida = formaPago === f.key || (formaPago === "combinado" && f.key !== "cuenta_corriente");
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
                  {formaPago === "combinado" ? (
                    <div className="d-flex flex-wrap align-items-center gap-2 small">
                      {/* Cada importe se escribe a mano y no toca el otro: abajo se ve si suman el total. */}
                      <div className="input-group input-group-sm" style={{ maxWidth: 210 }}>
                        <span className="input-group-text">Efectivo $</span>
                        <input type="number" min="0" step="0.01" className="form-control text-end sin-flechas" value={importeEfectivo}
                          onChange={(e) => setImporteEfectivo(e.target.value)} />
                      </div>
                      <div className="input-group input-group-sm" style={{ maxWidth: 230 }}>
                        <span className="input-group-text">Mercado Pago $</span>
                        <input type="number" min="0" step="0.01" className="form-control text-end sin-flechas" value={importeMP}
                          onChange={(e) => setImporteMP(e.target.value)} />
                      </div>
                      <input className="form-control form-control-sm" style={{ maxWidth: 200 }}
                        placeholder="N° de operación MP (opcional)" value={operacionMP} onChange={(e) => setOperacionMP(e.target.value)} />
                      {(() => {
                        const dif = redondear(total - (Number(importeEfectivo) || 0) - (Number(importeMP) || 0));
                        return dif === 0 ? (
                          <span className="text-success"><i className="bi bi-check-circle me-1"></i>Suma {pesos(total)}</span>
                        ) : (
                          <span className="text-danger">{dif > 0 ? `Faltan ${pesos(dif)}` : `Sobran ${pesos(-dif)}`}</span>
                        );
                      })()}
                    </div>
                  ) : formaPago === "efectivo" ? (
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
        )}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show"></div>
          </>
        )}

        {/* ══════════ EMITIDOS ══════════ */}
        {(
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
                              {p.deposito && (
                                <span className="badge bg-light text-dark border me-1">
                                  {depositos.find((d) => d.key === p.deposito)?.etiqueta || p.deposito}
                                </span>
                              )}
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
