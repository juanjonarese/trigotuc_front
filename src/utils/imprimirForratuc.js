import { escapeHtml } from "./escapeHtml";
import { formatearFechaLocal } from "./dateUtils";
import { imprimirHtml } from "./imprimirHtml";

/**
 * Papeles de Forratuc (2026-10-21), en A4 y POR DUPLICADO (original para el
 * cliente, duplicado para el local):
 *   · el PRESUPUESTO, con el que el cliente retira la mercadería;
 *   · el RECIBO del cobro de cuenta corriente.
 *
 * ⚠️ Forratuc NO factura (decisión del usuario, 2026-10-16): por eso cada hoja
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

const COPIAS = ["ORIGINAL — CLIENTE", "DUPLICADO — LOCAL"];

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n || 0));
const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));

const UNIDAD_PRECIO = { kg: "kg", maple: "maple", pollito: "u.", bolsa: "bolsa" };
const CONDICION = { contado: "Contado", cuenta_corriente: "Cuenta corriente" };

// "Cheque Macro N° 000123, cobro 15/11/2026, librador Don Pepe SRL"
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

const encabezado = (titulo, subtitulo, numero, fecha) => {
  const datosEmisor = [EMISOR.direccion, EMISOR.localidad, EMISOR.telefono && `Tel. ${EMISOR.telefono}`]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br/>");
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
        <div class="interno">${subtitulo}</div>
        <div class="numero">N° ${escapeHtml(numero)}</div>
        <div class="fecha"><span>Fecha</span> ${escapeHtml(formatearFechaLocal(fecha))}</div>
      </div>
    </header>`;
};

const bloqueCliente = (d) => {
  const extra = [
    d.clienteCuit && `<div><strong>CUIT:</strong> ${escapeHtml(d.clienteCuit)}</div>`,
    d.clienteDomicilio && `<div><strong>Domicilio:</strong> ${escapeHtml(d.clienteDomicilio)}</div>`,
    d.clienteTelefono && `<div><strong>Teléfono:</strong> ${escapeHtml(d.clienteTelefono)}</div>`,
  ].filter(Boolean).join("");
  return `<section class="cliente"><div><strong>Cliente:</strong> ${escapeHtml(d.clienteNombre)}</div>${extra}</section>`;
};

const ESTILOS = `
  /* Margen en la hoja, no en @page: ver imprimirRemitoAlimento.js. */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; font-size: 11pt; }
  .hoja { page-break-after: always; position: relative; padding: 14mm 15mm 16mm;
          -webkit-box-decoration-break: clone; box-decoration-break: clone; }
  .hoja:last-child { page-break-after: auto; }
  table tr { break-inside: avoid; }

  .copia-fila { display: flex; justify-content: flex-end; margin-bottom: 2mm; }
  .copia { font-size: 9pt; letter-spacing: 2px; font-weight: bold; border: 1px solid #000; padding: 2px 8px; }

  header { display: flex; justify-content: space-between; gap: 10mm;
           border-bottom: 2px solid #000; padding-bottom: 4mm; margin-bottom: 4mm; }
  .marca { font-size: 22pt; font-weight: bold; letter-spacing: 1px; }
  .sub { font-size: 10pt; margin-bottom: 2mm; }
  .dir { font-size: 9pt; line-height: 1.35; }
  .doc { text-align: right; }
  .titulo { font-size: 18pt; font-weight: bold; letter-spacing: 2px; }
  .noval { font-size: 8.5pt; font-style: italic; }
  .interno { font-size: 9pt; font-weight: bold; margin-top: 1mm; }
  .numero { font-size: 14pt; font-weight: bold; margin: 2mm 0; }
  .fecha span { font-size: 9pt; margin-right: 2mm; }

  .cliente { border: 1px solid #000; padding: 3mm; margin-bottom: 4mm; line-height: 1.5; }

  table.detalle { width: 100%; border-collapse: collapse; }
  table.detalle th { border-bottom: 1.5px solid #000; font-size: 9pt; padding: 2mm 1.5mm; text-align: left; }
  table.detalle td { border-bottom: 1px solid #bbb; padding: 2mm 1.5mm; vertical-align: top; }
  .cant { width: 26mm; }
  .num { text-align: right !important; white-space: nowrap; width: 32mm; }
  .gris { color: #555; font-size: 9pt; }

  .total { text-align: right; font-size: 14pt; margin-top: 4mm; padding-top: 2mm; border-top: 2px solid #000; }
  .total span { font-size: 10pt; margin-right: 4mm; letter-spacing: 1px; }

  .pago { margin-top: 4mm; border: 1px solid #000; padding: 2.5mm 3mm; font-size: 10pt; }
  .pago .cond { font-weight: bold; margin-bottom: 1.5mm; }
  table.pagos { width: 100%; border-collapse: collapse; }
  table.pagos td { padding: 1mm 0; border-bottom: 1px dotted #999; }
  table.pagos tr:last-child td { border-bottom: 0; }

  .obs { margin-top: 4mm; font-size: 10pt; }
  footer { margin-top: 14mm; }
  .leyenda { font-size: 9pt; font-style: italic; margin-bottom: 14mm; }
  .firmas { display: flex; justify-content: space-between; gap: 15mm; }
  .firma { flex: 1; border-top: 1px solid #000; padding-top: 1.5mm; text-align: center; font-size: 9pt; }

  .sello { position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg);
           font-size: 70pt; font-weight: bold; color: rgba(200, 0, 0, .25);
           border: 6px solid rgba(200, 0, 0, .25); padding: 2mm 8mm; pointer-events: none; }
`;

const documento = (titulo, hojas) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(titulo)}</title>
  <style>${ESTILOS}</style>
</head>
<body>${hojas}</body>
</html>`;

// ── Presupuesto ─────────────────────────────────────────────────────────────

// "2 cajones · 40 kg" para el pollo; "3 maples", "5 bolsas", etc. para el resto.
const cantidadDeLinea = (l) =>
  l.kg != null
    ? `${fmt(l.cantidad)} ${escapeHtml(l.unidad)}<br/><span class="gris">${fmt(l.kg)} kg</span>`
    : `${fmt(l.cantidad)} ${escapeHtml(l.unidad)}`;

const bloquePagoPresupuesto = (p, medios) => {
  if (!p.condicionPago) return "";
  if (p.condicionPago === "cuenta_corriente")
    return `<div class="pago"><div class="cond">Condición de pago: Cuenta corriente</div>
      <div class="gris">El importe se carga en la cuenta corriente del cliente.</div></div>`;
  return `<div class="pago"><div class="cond">Condición de pago: ${CONDICION[p.condicionPago]}</div>
    ${tablaPagos(p.pagos || [], medios)}</div>`;
};

const hojaPresupuesto = (p, copia, medios) => {
  const filas = (p.lineas || [])
    .map(
      (l) => `
      <tr>
        <td class="cant">${cantidadDeLinea(l)}</td>
        <td class="det">${escapeHtml(l.descripcion)}</td>
        <td class="num">${pesos(l.precioUnitario)} <span class="gris">/ ${UNIDAD_PRECIO[l.unidadPrecio] || escapeHtml(l.unidadPrecio)}</span></td>
        <td class="num">${pesos(l.importe)}</td>
      </tr>`
    )
    .join("");

  return `
  <div class="hoja">
    ${p.estado === "anulado" ? `<div class="sello">ANULADO</div>` : ""}
    <div class="copia-fila"><div class="copia">${copia}</div></div>
    ${encabezado("PRESUPUESTO", "ORDEN DE RETIRO", p.numero, p.fecha)}
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
    ${bloquePagoPresupuesto(p, medios)}
    ${p.observaciones ? `<div class="obs"><strong>Observaciones:</strong> ${escapeHtml(p.observaciones)}</div>` : ""}

    <footer>
      <div class="leyenda">Presentar este presupuesto para retirar la mercadería.</div>
      <div class="firmas">
        <div class="firma">Retiró conforme</div>
        <div class="firma">Aclaración y DNI</div>
      </div>
    </footer>
  </div>`;
};

// `medios` = constantes.mediosPago, para nombrar cada medio en el papel.
export const imprimirPresupuestoForratuc = (presupuesto, { medios = [] } = {}) => {
  const hojas = COPIAS.map((c) => hojaPresupuesto(presupuesto, c, medios)).join("");
  imprimirHtml(documento(`Presupuesto ${presupuesto.numero || ""}`, hojas));
};

// ── Recibo de cuenta corriente ──────────────────────────────────────────────

const hojaRecibo = (r, copia, medios, cliente) => `
  <div class="hoja">
    ${r.estado === "anulado" ? `<div class="sello">ANULADO</div>` : ""}
    <div class="copia-fila"><div class="copia">${copia}</div></div>
    ${encabezado("RECIBO", "COBRO DE CUENTA CORRIENTE", r.numero, r.fecha)}
    ${bloqueCliente({
      clienteNombre: r.clienteNombre,
      clienteCuit: cliente?.cuit,
      clienteDomicilio: [cliente?.direccion, cliente?.localidad].filter(Boolean).join(", "),
      clienteTelefono: cliente?.telefono,
    })}

    <p>Recibimos la suma de <strong>${pesos(r.total)}</strong> a cuenta del saldo de su cuenta corriente, en:</p>
    <div class="pago">${tablaPagos(r.pagos || [], medios)}</div>

    <div class="total"><span>TOTAL RECIBIDO</span> <strong>${pesos(r.total)}</strong></div>
    ${r.observaciones ? `<div class="obs"><strong>Observaciones:</strong> ${escapeHtml(r.observaciones)}</div>` : ""}

    <footer>
      <div class="leyenda">Los cheques se reciben salvo buen cobro.</div>
      <div class="firmas">
        <div class="firma">Firma Forratuc</div>
        <div class="firma">Aclaración</div>
      </div>
    </footer>
  </div>`;

// `cliente` (opcional) completa CUIT, domicilio y teléfono en el papel.
export const imprimirReciboForratuc = (recibo, { medios = [], cliente = null } = {}) => {
  const hojas = COPIAS.map((c) => hojaRecibo(recibo, c, medios, cliente)).join("");
  imprimirHtml(documento(`Recibo ${recibo.numero || ""}`, hojas));
};
