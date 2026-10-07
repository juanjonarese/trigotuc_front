import { escapeHtml } from "./escapeHtml";
import { formatearFechaLocal } from "./dateUtils";
import { imprimirHtml } from "./imprimirHtml";

/**
 * Remito imprimible del envío de alimento, en A4 y POR TRIPLICADO.
 *
 * Replica el formulario que usa Trigotuc (ver `remito envio alimento.jpeg` en la
 * raíz del proyecto): encabezado con los datos de la planta, número y fecha,
 * destinatario, quién retira con su patente, la tabla Cantidad · Detalle y el pie
 * de firma.
 *
 * ⚠️ NO lleva CAI ni código de barras, a propósito. Esos son datos del talonario
 * fiscal habilitado por AFIP y generarlos acá sería fabricar un comprobante. Por
 * eso cada hoja dice "Documento no válido como factura — Remito interno", que es
 * lo que el cliente definió que es por ahora (2026-09-28). Si más adelante se
 * emite como comprobante fiscal, hay que sumar CAI, vencimiento y código de
 * barras reales, y el número dejaría de tipearse a mano.
 *
 * El número sí se copia del talonario de papel: lo tipea quien carga el envío.
 */

// Datos de la planta. Salen del remito de papel y no cambian; si cambian, se
// tocan solo acá.
const EMISOR = {
  razonSocial: "Molino Trigotuc S.A",
  subtitulo:   "Planta Industrial",
  direccion:   "Ruta 9 km 1285",
  localidad:   "4109 - Banda Río Salí - Cruz Alta",
  provincia:   "Tucumán - Argentina",
  email:       "ventas@molinotrigotuc.com.ar",
  condicionIva:"RESPONSABLE INSCRIPTO",
  cuit:        "30-70871547-2",
  inicioAct:   "20 de enero de 2004",
  ingBrutos:   "9248336982",
};

// Cuando el dato no se cargó, va una línea de puntos para completar a mano: el
// remito viaja con el camión y el chofer puede no estar cargado en el sistema.
const PUNTEADO = "&middot;".repeat(30);

// Las tres copias del remito, en orden.
const COPIAS = ["ORIGINAL", "DUPLICADO", "TRIPLICADO"];

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    .format(Number(n || 0));

/**
 * El renglón del detalle, con el mismo estilo que el remito de papel:
 * "ALIMENTO BALANCEADO <TIPO> A GRANEL   KGS".
 *
 * El nombre lo arma el back () y viaja en las constantes,
 * porque no siempre es "ALIMENTO BALANCEADO " + etiqueta: el del gallo ya trae
 * el "AB" en el nombre y quedaría repetido.
 *
 * La cantidad va siempre en KG —es la unidad común de la bolsa y el granel— y la
 * presentación se dice en el texto, que es donde el del camión la lee.
 */
const detalleDeLinea = (l, detalleTipo) => {
  const base = detalleTipo(l.tipo);
  if (l.presentacion === "bolsa") {
    const bolsas = fmt(l.bolsas);
    const porBolsa = fmt(l.kgPorBolsa);
    return `${base} EN ${bolsas} BOLSAS DE ${porBolsa} KG&nbsp;&nbsp;&nbsp;KGS`;
  }
  return `${base} A GRANEL&nbsp;&nbsp;&nbsp;KGS`;
};

const hoja = (envio, copia, detalleTipo, etiquetaDestino) => {
  const numero = envio.numeroRemito ? escapeHtml(envio.numeroRemito) : "—";
  // Con el helper del proyecto: las fechas se guardan a las 12:00 UTC
  // (ajustarFechaParaGuardar) para que en Argentina no se corran un día.
  const fecha  = formatearFechaLocal(envio.fechaEnvio);

  const retira = envio.chofer?.nombreUsuario ? escapeHtml(envio.chofer.nombreUsuario) : "";
  const patente = envio.camion?.patente ? escapeHtml(envio.camion.patente) : "";
  const camionMarca = envio.camion?.marca ? escapeHtml(envio.camion.marca) : "";

  const filas = (envio.lineas || [])
    .map(
      (l) => `
      <tr>
        <td class="cant">${fmt(l.kg)}</td>
        <td class="det">${detalleDeLinea(l, detalleTipo)}</td>
      </tr>`
    )
    .join("");

  return `
  <div class="hoja">
    <div class="copia-fila"><div class="copia">${copia}</div></div>

    <header>
      <div class="emisor">
        <div class="marca">${escapeHtml(EMISOR.razonSocial)}</div>
        <div class="sub">${escapeHtml(EMISOR.subtitulo)}</div>
        <div class="dir">
          ${escapeHtml(EMISOR.direccion)}<br/>
          ${escapeHtml(EMISOR.localidad)}<br/>
          ${escapeHtml(EMISOR.provincia)}<br/>
          ${escapeHtml(EMISOR.email)}
        </div>
        <div class="iva">${escapeHtml(EMISOR.condicionIva)}</div>
      </div>

      <div class="doc">
        <div class="titulo">REMITO</div>
        <div class="noval">Documento no válido como factura</div>
        <div class="interno">REMITO INTERNO</div>
        <div class="numero">N° ${numero}</div>
        <div class="fiscales">
          CUIT ${escapeHtml(EMISOR.cuit)}<br/>
          Inicio Act. ${escapeHtml(EMISOR.inicioAct)}<br/>
          Ing. Brutos ${escapeHtml(EMISOR.ingBrutos)}
        </div>
        <div class="fecha"><span>Fecha</span> ${escapeHtml(fecha)}</div>
      </div>
    </header>

    <section class="destinatario">
      <div><strong>Destino:</strong> ${escapeHtml(etiquetaDestino)}</div>
      <div><strong>Remitente:</strong> ${escapeHtml(EMISOR.razonSocial)} — ${escapeHtml(EMISOR.direccion)}</div>
    </section>

    <section class="transporte">
      <div><strong>Retira:</strong> ${retira || PUNTEADO}</div>
      <div><strong>Patente:</strong> ${patente || PUNTEADO}${camionMarca ? ` <span class="gris">(${camionMarca})</span>` : ""}</div>
    </section>

    <table class="detalle">
      <thead>
        <tr><th class="cant">CANTIDAD</th><th class="det">DETALLE</th></tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>

    <div class="total">
      <span>Total</span> <strong>${fmt(envio.kgTotales)} KGS</strong>
    </div>

    ${envio.observaciones ? `<div class="obs"><strong>Observaciones:</strong> ${escapeHtml(envio.observaciones)}</div>` : ""}

    <footer>
      <div class="firma">Firma&nbsp;: &hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;</div>
      <div class="firma">Aclaración&nbsp;: &hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;</div>
    </footer>
  </div>`;
};

/**
 * Abre el diálogo de la impresora con las tres copias, una por hoja, sin abrir
 * el remito en otra pestaña.
 *
 * `etiquetaTipo` y `etiquetaDestino` vienen de las constantes del módulo, para no
 * duplicar acá los nombres de los alimentos (viven en utils/alimentos.js del back).
 */
export const imprimirRemitoAlimento = (envio, { detalleTipo, etiquetaDestino }) => {
  // Se acepta el nombre o la función que lo busca: pasar la función sin llamarla
  // imprimía su código en "Destino:" (2026-09-30).
  const destino =
    typeof etiquetaDestino === "function" ? etiquetaDestino(envio.destino) : etiquetaDestino;
  const hojas = COPIAS.map((c) => hoja(envio, c, detalleTipo, destino || envio.destino || "")).join("");

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Remito ${escapeHtml(envio.numeroRemito || envio.numero || "")}</title>
  <style>
    /* El margen lo pone la HOJA (padding), no @page. Con el margen en @page el
       remito dependía del diálogo de impresión: con "Márgenes: ninguno" (que
       Chrome y Edge recuerdan de la última vez) el texto quedaba pegado al borde
       del papel y la impresora le comía la primera letra (foto del cliente,
       2026-10-07). Con margin: 0 además el navegador no imprime su
       encabezado y pie (fecha, URL). */
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; font-size: 11pt; }

    /* Una copia por hoja. La última no fuerza salto, para no dejar una en blanco.
       box-decoration-break: si una copia con muchas líneas pasa a una segunda
       hoja, esa también lleva margen. */
    .hoja { page-break-after: always; position: relative; padding: 14mm 15mm 16mm;
            -webkit-box-decoration-break: clone; box-decoration-break: clone; }
    table.detalle tr { break-inside: avoid; }
    .hoja:last-child { page-break-after: auto; }

    /* La copia va en su propio renglón, arriba del encabezado. Estuvo flotando
       (position: absolute) en la esquina y se montaba sobre "REMITO". */
    .copia-fila { display: flex; justify-content: flex-end; margin-bottom: 2mm; }
    .copia {
      font-size: 9pt; letter-spacing: 2px; font-weight: bold;
      border: 1px solid #000; padding: 2px 8px;
    }

    header { display: flex; justify-content: space-between; gap: 10mm;
             border-bottom: 2px solid #000; padding-bottom: 4mm; margin-bottom: 4mm; }
    .emisor { max-width: 95mm; }
    .marca { font-size: 17pt; font-weight: bold; line-height: 1.1; }
    .sub   { font-weight: bold; font-size: 10pt; margin-bottom: 2mm; }
    .dir   { font-size: 8.5pt; line-height: 1.35; }
    .iva   { font-size: 8.5pt; font-weight: bold; margin-top: 2mm; }

    /* Como en el papel: "REMITO", el número y los datos fiscales van alineados
       a la izquierda de su columna. */
    .doc { text-align: left; min-width: 70mm; }
    .titulo { font-size: 20pt; font-weight: bold; letter-spacing: 1px; }
    .noval  { font-size: 8pt; }
    /* Se dice en cada copia: este documento NO es el comprobante fiscal. */
    .interno { font-size: 8pt; font-weight: bold; border: 1px solid #000;
               display: inline-block; padding: 1px 6px; margin: 1mm 0; }
    .numero { font-size: 13pt; font-weight: bold; margin: 1mm 0 2mm; }
    .fiscales { font-size: 8.5pt; line-height: 1.35; }
    .fecha { margin-top: 2mm; font-size: 10pt; }
    .fecha span { font-size: 8pt; color: #444; margin-right: 3mm; }

    .destinatario, .transporte { font-size: 10pt; line-height: 1.6; margin-bottom: 3mm; }
    .transporte { display: flex; gap: 18mm; margin-bottom: 6mm; }
    .gris { color: #555; }

    table.detalle { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
    table.detalle thead th { background: #e8e8e8; border-top: 1px solid #000;
                             border-bottom: 1px solid #000; font-size: 9pt;
                             text-align: left; padding: 2mm 3mm; letter-spacing: .5px; }
    table.detalle th.cant, table.detalle td.cant { width: 32mm; text-align: right; }
    table.detalle td { padding: 2mm 3mm; font-size: 10pt; vertical-align: top; }
    table.detalle td.det { letter-spacing: .3px; }

    .total { text-align: right; font-size: 11pt; border-top: 1px solid #000;
             padding-top: 2mm; }
    .total span { font-size: 9pt; color: #444; margin-right: 3mm; }

    .obs { font-size: 9.5pt; margin-top: 4mm; }

    footer { display: flex; justify-content: space-between; gap: 10mm;
             margin-top: 22mm; font-size: 10pt; }
    .firma { flex: 1; }

    @media print { .copia { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>${hojas}</body>
</html>`;

  // Directo al diálogo de la impresora, sin abrir el remito en otra pestaña
  // (2026-09-30). Ver utils/imprimirHtml.js.
  return imprimirHtml(html);
};
