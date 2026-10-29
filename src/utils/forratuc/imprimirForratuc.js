import { escapeHtml } from "../escapeHtml";
import { formatearFechaLocal } from "../dateUtils";
import { imprimirHtml } from "../imprimirHtml";

/**
 * Papeles de Forratuc (2026-10-21):
 *   · el PRESUPUESTO, con el que el cliente retira la mercadería;
 *   · el RECIBO del cobro de cuenta corriente;
 *   · la RENDICIÓN Y CIERRE DE CAJA (2026-10-29), que se entrega con la plata.
 *
 * Presupuesto y recibo van POR DUPLICADO y, desde el 2026-10-29 (observaciones
 * del cliente), las DOS COPIAS EN UNA SOLA HOJA A4: media hoja cada una, con
 * una línea de corte. Si los renglones no entran en media hoja, cada copia va
 * en su hoja (mejor eso que cortar el detalle).
 *
 * Observaciones del cliente sobre el presupuesto (2026-10-29): sin "Orden de
 * retiro", sin "Original — Cliente" y sin "Presentar presupuesto para retirar
 * mercadería"; sin recuadro de condición de pago, en su lugar la línea
 * "Condiciones de pago: …" y la leyenda de validez; con el OPERADOR y el
 * DEPÓSITO del que sale el alimento.
 *
 * ⚠️ Forratuc NO factura (decisión del usuario, 2026-10-16): por eso cada copia
 * dice "Documento no válido como factura" y no lleva CAI, ni código de barras,
 * ni tipo de comprobante. Generar esos datos acá sería fabricar un comprobante
 * fiscal.
 */

// Datos del local. ⚠️ PENDIENTE: dirección, teléfono y CUIT de Forratuc —
// todavía no los tenemos; se completan solo acá. Lo que esté vacío no se imprime.
const EMISOR = {
  razonSocial: "FORRATUC",
  subtitulo:   "Local de venta al público",
  direccion:   "",
  localidad:   "",
  telefono:    "",
  cuit:        "",
};

// Hasta cuántos renglones entran en media hoja.
const RENGLONES_MEDIA_HOJA = 8;

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n || 0));
const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));

const UNIDAD_PRECIO = { kg: "kg", maple: "maple", pollito: "u.", bolsa: "bolsa" };
const DEPOSITOS = { forrajeria: "Depósito Forrajería", trigotuc: "Depósito Trigotuc" };

// "Mercado Pago — op. 123"
const detallePago = (p, medios) => {
  const nombre = medios.find((m) => m.key === p.medio)?.etiqueta || p.medio;
  const partes = [];
  if (p.banco) partes.push(p.banco);
  if (p.numero) partes.push(`N° ${p.numero}`);
  if (p.fechaCobro) partes.push(`cobro ${formatearFechaLocal(p.fechaCobro)}`);
  if (p.librador) partes.push(`librador ${p.librador}`);
  if (p.cuotas) partes.push(`${p.cuotas} ${p.cuotas === 1 ? "cuota" : "cuotas"}`);
  if (p.operacion) partes.push(`op. ${p.operacion}`);
  return `${escapeHtml(nombre)}${partes.length ? ` <span class="gris">— ${escapeHtml(partes.join(", "))}</span>` : ""}`;
};

const tablaPagos = (pagos, medios) => `
  <table class="pagos">
    ${pagos.map((p) => `<tr><td>${detallePago(p, medios)}</td><td class="num">${pesos(p.importe)}</td></tr>`).join("")}
  </table>`;

const operadorDe = (d) => d.registradoPor?.nombreUsuario || "";

const encabezado = (titulo, subtitulo, d) => {
  const datosEmisor = [EMISOR.direccion, EMISOR.localidad, EMISOR.telefono && `Tel. ${EMISOR.telefono}`]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");
  const operador = operadorDe(d);
  return `
    <header>
      <div class="emisor">
        <div class="marca">${escapeHtml(EMISOR.razonSocial)}</div>
        <div class="sub">${escapeHtml(EMISOR.subtitulo)}</div>
        ${datosEmisor ? `<div class="dir">${datosEmisor}</div>` : ""}
        ${EMISOR.cuit ? `<div class="dir">CUIT ${escapeHtml(EMISOR.cuit)}</div>` : ""}
      </div>
      <div class="doc">
        <div class="titulo">${titulo}</div>
        <div class="noval">Documento no válido como factura</div>
        ${subtitulo ? `<div class="interno">${subtitulo}</div>` : ""}
        <div class="numero">N° ${escapeHtml(d.numero)}</div>
        <div class="fecha"><span>Fecha</span> ${escapeHtml(formatearFechaLocal(d.fecha))}</div>
        ${operador ? `<div class="fecha"><span>Operador</span> ${escapeHtml(operador)}</div>` : ""}
      </div>
    </header>`;
};

const bloqueCliente = (d) => {
  const extra = [
    d.clienteCuit && `<span><strong>CUIT:</strong> ${escapeHtml(d.clienteCuit)}</span>`,
    d.clienteDomicilio && `<span><strong>Domicilio:</strong> ${escapeHtml(d.clienteDomicilio)}</span>`,
    d.clienteTelefono && `<span><strong>Tel.:</strong> ${escapeHtml(d.clienteTelefono)}</span>`,
  ].filter(Boolean).join("");
  return `<section class="cliente"><div><strong>Cliente:</strong> ${escapeHtml(d.clienteNombre)}</div>${extra ? `<div class="extra">${extra}</div>` : ""}</section>`;
};

const ESTILOS = `
  /* Margen en la hoja, no en @page: ver imprimirRemitoAlimento.js. */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; font-size: 10pt; }
  .hoja { page-break-after: always; }
  .hoja:last-child { page-break-after: auto; }
  table tr { break-inside: avoid; }

  /* Una copia: media hoja A4 (297 / 2), o la hoja entera si no entra. */
  .copia { position: relative; padding: 9mm 13mm 7mm; overflow: hidden; }
  .media .copia { height: 148.5mm; }
  .media .copia + .copia { border-top: 1px dashed #777; }

  header { display: flex; justify-content: space-between; gap: 8mm;
           border-bottom: 2px solid #000; padding-bottom: 2.5mm; margin-bottom: 2.5mm; }
  .marca { font-size: 17pt; font-weight: bold; letter-spacing: 1px; }
  .sub { font-size: 8.5pt; margin-bottom: 1mm; }
  .dir { font-size: 8pt; line-height: 1.3; }
  .doc { text-align: right; }
  .titulo { font-size: 14pt; font-weight: bold; letter-spacing: 2px; }
  .noval { font-size: 7.5pt; font-style: italic; }
  .interno { font-size: 8pt; font-weight: bold; margin-top: .5mm; }
  .numero { font-size: 12pt; font-weight: bold; margin: 1mm 0; }
  .fecha { font-size: 9.5pt; }
  .fecha span { font-size: 8pt; margin-right: 2mm; }

  .cliente { border: 1px solid #000; padding: 1.8mm 2.5mm; margin-bottom: 2.5mm; line-height: 1.4; }
  .cliente .extra { font-size: 8.5pt; display: flex; flex-wrap: wrap; gap: 0 5mm; }

  table.detalle { width: 100%; border-collapse: collapse; }
  table.detalle th { border-bottom: 1.5px solid #000; font-size: 8pt; padding: 1.2mm 1.5mm; text-align: left; }
  table.detalle td { border-bottom: 1px solid #bbb; padding: 1.2mm 1.5mm; vertical-align: top; }
  .cant { width: 24mm; }
  .num { text-align: right !important; white-space: nowrap; width: 30mm; }
  .gris { color: #555; font-size: 8pt; }

  .total { text-align: right; font-size: 12pt; margin-top: 2mm; padding-top: 1.5mm; border-top: 2px solid #000; }
  .total span { font-size: 9pt; margin-right: 4mm; letter-spacing: 1px; }

  .condicion { margin-top: 2mm; font-size: 10pt; }
  .pago { margin-top: 2.5mm; border: 1px solid #000; padding: 2mm 2.5mm; font-size: 9.5pt; }
  table.pagos { width: 100%; border-collapse: collapse; }
  table.pagos td { padding: .8mm 0; border-bottom: 1px dotted #999; }
  table.pagos tr:last-child td { border-bottom: 0; }

  .obs { margin-top: 2mm; font-size: 9pt; }
  footer { margin-top: 5mm; }
  .leyenda { font-size: 8.5pt; font-style: italic; margin-bottom: 9mm; }
  .firmas { display: flex; justify-content: space-between; gap: 15mm; }
  .firma { flex: 1; border-top: 1px solid #000; padding-top: 1mm; text-align: center; font-size: 8pt; }

  .sello { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-20deg);
           font-size: 48pt; font-weight: bold; color: rgba(200, 0, 0, .25);
           border: 5px solid rgba(200, 0, 0, .25); padding: 1mm 6mm; pointer-events: none; }
`;

const documento = (titulo, cuerpo, estilos = ESTILOS) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(titulo)}</title>
  <style>${estilos}</style>
</head>
<body>${cuerpo}</body>
</html>`;

// Las dos copias: en una sola hoja si entran, si no una por hoja.
const duplicado = (copia, entraEnMedia) =>
  entraEnMedia
    ? `<div class="hoja media">${copia}${copia}</div>`
    : `<div class="hoja">${copia}</div><div class="hoja">${copia}</div>`;

// ── Presupuesto ─────────────────────────────────────────────────────────────

// "2 cajones · 40 kg" para el pollo; "3 maples", "5 bolsas", etc. para el resto.
const cantidadDeLinea = (l) =>
  l.kg != null
    ? `${fmt(l.cantidad)} ${escapeHtml(l.unidad)}<br/><span class="gris">${fmt(l.kg)} kg</span>`
    : `${fmt(l.cantidad)} ${escapeHtml(l.unidad)}`;

// "Condiciones de pago: Contado" (o "Contado — Mercado Pago", o "Cuenta corriente").
const condicionPresupuesto = (p, medios) => {
  if (!p.condicionPago) return "";
  if (p.condicionPago === "cuenta_corriente")
    return `<div class="condicion"><strong>Condiciones de pago:</strong> Cuenta corriente</div>`;
  const pagos = p.pagos || [];
  // Lo de siempre (un solo pago en efectivo) es "Contado" a secas.
  if (pagos.length === 1 && pagos[0].medio === "efectivo")
    return `<div class="condicion"><strong>Condiciones de pago:</strong> Contado</div>`;
  if (pagos.length === 1)
    return `<div class="condicion"><strong>Condiciones de pago:</strong> Contado — ${detallePago(pagos[0], medios)}</div>`;
  return `<div class="condicion"><strong>Condiciones de pago:</strong> Contado</div>${tablaPagos(pagos, medios)}`;
};

const copiaPresupuesto = (p, { medios, validezDias, depositos }) => {
  const filas = (p.lineas || [])
    .map(
      (l) => `
      <tr>
        <td class="cant">${cantidadDeLinea(l)}</td>
        <td class="det">${escapeHtml(l.descripcion)}${
          l.deposito ? `<br/><span class="gris">Sale de: ${escapeHtml(depositos[l.deposito] || l.deposito)}</span>` : ""
        }</td>
        <td class="num">${pesos(l.precioUnitario)} <span class="gris">/ ${UNIDAD_PRECIO[l.unidadPrecio] || escapeHtml(l.unidadPrecio)}</span></td>
        <td class="num">${pesos(l.importe)}</td>
      </tr>`
    )
    .join("");

  return `
  <div class="copia">
    ${p.estado === "anulado" ? `<div class="sello">ANULADO</div>` : ""}
    ${encabezado("PRESUPUESTO", "", p)}
    ${bloqueCliente(p)}

    <table class="detalle">
      <thead>
        <tr>
          <th class="cant">CANTIDAD</th>
          <th class="det">DETALLE</th>
          <th class="num">PRECIO UNIT.</th>
          <th class="num">IMPORTE</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>

    <div class="total"><span>TOTAL</span> <strong>${pesos(p.total)}</strong></div>
    ${condicionPresupuesto(p, medios)}
    ${p.observaciones ? `<div class="obs"><strong>Observaciones:</strong> ${escapeHtml(p.observaciones)}</div>` : ""}

    <footer>
      <div class="leyenda">El presupuesto tiene una validez de ${validezDias} días.</div>
      <div class="firmas">
        <div class="firma">Retiró conforme</div>
        <div class="firma">Aclaración y DNI</div>
      </div>
    </footer>
  </div>`;
};

// `medios` = constantes.mediosPago; `validezDias` y `depositosAlimento` también
// vienen de las constantes del back (con estos valores por si faltan).
export const imprimirPresupuestoForratuc = (presupuesto, { medios = [], validezDias = 5, depositosAlimento } = {}) => {
  const depositos = depositosAlimento
    ? Object.fromEntries(depositosAlimento.map((d) => [d.key, d.etiqueta]))
    : DEPOSITOS;
  const copia = copiaPresupuesto(presupuesto, { medios, validezDias, depositos });
  const entra = (presupuesto.lineas || []).length <= RENGLONES_MEDIA_HOJA;
  imprimirHtml(documento(`Presupuesto ${presupuesto.numero || ""}`, duplicado(copia, entra)));
};

// ── Recibo de cuenta corriente ──────────────────────────────────────────────

const copiaRecibo = (r, medios, cliente) => `
  <div class="copia">
    ${r.estado === "anulado" ? `<div class="sello">ANULADO</div>` : ""}
    ${encabezado("RECIBO", "COBRO DE CUENTA CORRIENTE", r)}
    ${bloqueCliente({
      clienteNombre: r.clienteNombre,
      clienteCuit: cliente?.cuit,
      clienteDomicilio: [cliente?.direccion, cliente?.localidad].filter(Boolean).join(", "),
      clienteTelefono: cliente?.telefono,
    })}

    <div>Recibimos la suma de <strong>${pesos(r.total)}</strong> a cuenta del saldo de su cuenta corriente, en:</div>
    <div class="pago">${tablaPagos(r.pagos || [], medios)}</div>

    <div class="total"><span>TOTAL RECIBIDO</span> <strong>${pesos(r.total)}</strong></div>
    ${r.observaciones ? `<div class="obs"><strong>Observaciones:</strong> ${escapeHtml(r.observaciones)}</div>` : ""}

    <footer>
      <div class="firmas">
        <div class="firma">Firma Forratuc</div>
        <div class="firma">Aclaración</div>
      </div>
    </footer>
  </div>`;

// `cliente` (opcional) completa CUIT, domicilio y teléfono en el papel.
export const imprimirReciboForratuc = (recibo, { medios = [], cliente = null } = {}) => {
  const copia = copiaRecibo(recibo, medios, cliente);
  imprimirHtml(documento(`Recibo ${recibo.numero || ""}`, duplicado(copia, (recibo.pagos || []).length <= 4)));
};

// ── Rendición y cierre de caja (2026-10-29) ─────────────────────────────────
// El formato de la planilla del cliente (Forratuc Ssitema.xlsx, punto 9): los
// tres conteos de billetes lado a lado, ventas por rubro, cobranza, efectivo,
// Mercado Pago, cuenta corriente, el detalle de comprobantes y el control.

const ESTILOS_CAJA = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; font-size: 9.5pt; }
  .hoja { padding: 11mm 13mm; }
  header { display: flex; justify-content: space-between; align-items: flex-end;
           border-bottom: 2px solid #000; padding-bottom: 2mm; margin-bottom: 4mm; }
  .marca { font-size: 16pt; font-weight: bold; letter-spacing: 1px; }
  .titulo { font-size: 13pt; font-weight: bold; letter-spacing: 1px; }
  .datos { text-align: right; font-size: 9.5pt; line-height: 1.4; }
  h2 { font-size: 10pt; margin: 4mm 0 1.5mm; letter-spacing: 1px; }
  .conteos { display: flex; gap: 4mm; }
  .conteos > div { flex: 1; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 1mm 1.5mm; }
  th { font-size: 8pt; background: #eee; }
  .num { text-align: right; white-space: nowrap; }
  .sub th { text-align: center; }
  tfoot td { font-weight: bold; }
  .resumen td:first-child { width: 60%; }
  .formula { font-size: 8pt; color: #444; }
  .control-ok { font-weight: bold; }
  .control-mal { font-weight: bold; color: #b00; }
  .anulado td { color: #888; text-decoration: line-through; }
  .firmas { display: flex; gap: 15mm; margin-top: 16mm; }
  .firma { flex: 1; border-top: 1px solid #000; padding-top: 1mm; text-align: center; font-size: 8.5pt; }
`;

const tablaConteo = (titulo, conteo, contado) => `
  <div>
    <table class="sub">
      <thead>
        <tr><th colspan="3">${escapeHtml(titulo)}</th></tr>
        <tr><th>Billetes</th><th>Cantidades</th><th>Subtotal</th></tr>
      </thead>
      <tbody>
        ${conteo.filas
          .map(
            (f) => `<tr><td class="num">${fmt(f.billete)}</td><td class="num">${contado ? fmt(f.cantidad) : ""}</td><td class="num">${
              contado ? pesos(f.subtotal) : ""
            }</td></tr>`
          )
          .join("")}
      </tbody>
      <tfoot><tr><td colspan="2">Total</td><td class="num">${contado ? pesos(conteo.total) : ""}</td></tr></tfoot>
    </table>
  </div>`;

// `caja` = respuesta de GET /caja-forratuc/:fecha
export const imprimirCierreCajaForratuc = (caja, { operador = "" } = {}) => {
  const contado = caja.guardado;
  const fila = (texto, importe, extra = "") =>
    `<tr><td>${texto}${extra ? ` <span class="formula">${extra}</span>` : ""}</td><td class="num">${importe == null ? "" : pesos(importe)}</td></tr>`;
  const control =
    caja.control == null
      ? ""
      : caja.control === 0
      ? `<span class="control-ok">Cierra: ${pesos(0)}</span>`
      : `<span class="control-mal">${caja.control > 0 ? "Sobran" : "Faltan"} ${pesos(Math.abs(caja.control))}</span>`;

  const cuerpo = `
  <div class="hoja">
    <header>
      <div>
        <div class="marca">${escapeHtml(EMISOR.razonSocial)}</div>
        <div class="titulo">RENDICIÓN Y CIERRE DE CAJA</div>
      </div>
      <div class="datos">
        <div><strong>Fecha:</strong> ${escapeHtml(formatearFechaLocal(`${caja.fecha}T12:00:00.000Z`))}</div>
        <div><strong>Operador:</strong> ${escapeHtml(caja.cerradoPor || operador || "")}</div>
      </div>
    </header>

    <div class="conteos">
      ${caja.tiposConteo.map((t) => tablaConteo(t.etiqueta, caja.conteos[t.key], contado)).join("")}
    </div>

    <h2>VENTAS</h2>
    <table class="resumen">
      ${caja.ventas.map((v) => fila(escapeHtml(v.etiqueta), v.importe)).join("")}
      <tfoot>${fila("Total ventas", caja.totalVentas)}</tfoot>
    </table>

    <h2>COBRANZA</h2>
    <table class="resumen">
      ${fila("Cobros de cuenta corriente", caja.totalCobranza)}
    </table>

    <h2>RENDICIÓN</h2>
    <table class="resumen">
      ${fila("Efectivo", contado ? caja.efectivoPlanilla : null, "(Caja inicio + Bolsa − Caja cierre)")}
      ${fila("Efectivo según comprobantes", caja.medios.efectivo.total, `(ventas ${pesos(caja.medios.efectivo.ventas)} + cobranza ${pesos(caja.medios.efectivo.cobranza)})`)}
      ${fila("Mercado Pago", caja.medios.mercadoPago.total, `(ventas ${pesos(caja.medios.mercadoPago.ventas)} + cobranza ${pesos(caja.medios.mercadoPago.cobranza)})`)}
      ${caja.otros ? fila("Otros medios (anteriores)", caja.otros) : ""}
      ${fila("Cuenta corriente", caja.cuentaCorriente)}
      <tr><td><strong>Control</strong> <span class="formula">(efectivo contado − efectivo según comprobantes)</span></td><td class="num">${control}</td></tr>
    </table>

    <h2>DETALLE DE COMPROBANTES</h2>
    <table>
      <thead><tr><th>Comprobante</th><th>Cliente</th><th>Forma de pago</th><th>Operador</th><th>Importe</th></tr></thead>
      <tbody>
        ${
          caja.detalle.length
            ? caja.detalle
                .map(
                  (d) => `<tr class="${d.anulado ? "anulado" : ""}">
                    <td>${d.tipo === "cobro" ? "Recibo" : "Presupuesto"} ${escapeHtml(d.numero)}${d.anulado ? " (anulado)" : ""}</td>
                    <td>${escapeHtml(d.cliente)}</td>
                    <td>${escapeHtml(d.forma)}</td>
                    <td>${escapeHtml(d.operador || "")}</td>
                    <td class="num">${pesos(d.importe)}</td>
                  </tr>`
                )
                .join("")
            : `<tr><td colspan="5">Sin comprobantes en el día.</td></tr>`
        }
      </tbody>
    </table>

    ${caja.observaciones ? `<p><strong>Observaciones:</strong> ${escapeHtml(caja.observaciones)}</p>` : ""}

    <div class="firmas">
      <div class="firma">Entregó</div>
      <div class="firma">Recibió</div>
    </div>
  </div>`;

  imprimirHtml(documento(`Cierre de caja ${caja.fecha}`, cuerpo, ESTILOS_CAJA));
};
