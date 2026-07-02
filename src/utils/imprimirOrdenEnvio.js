import { jsPDF } from "jspdf";
import { trozadoLabel } from "../components/TrozadoTable";
import { escapeHtml } from "./escapeHtml";

const camaraNombre = (v) => (v === "cañete" ? "Cañete" : v === "trigotuc" ? "Trigotuc" : v);
const fmtNumOrden  = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(n || 0));

// Orden imprimible de envío entre cámaras. La usa administración (al registrar)
// y frigorifico (al preparar el pedido para el chofer).
export const imprimirOrdenEnvio = (e) => {
  const origen  = escapeHtml(camaraNombre(e.camaraOrigen));
  const destino = escapeHtml(camaraNombre(e.camaraDestino));
  const chofer  = e.chofer?.nombreUsuario ? escapeHtml(e.chofer.nombreUsuario) : "—";
  const camion  = e.camion ? escapeHtml(`${e.camion.marca || ""} ${e.camion.patente ? "— " + e.camion.patente : ""}`.trim()) : "—";
  const fecha   = new Date(e.fecha).toLocaleDateString("es-AR");

  const filasCalibres = (e.calibres || []).map((c) => `
    <tr>
      <td>Calibre ${escapeHtml(String(c.calibre))}</td>
      <td class="num">${fmtNumOrden(c.cajones)}</td>
      <td class="num">${fmtNumOrden(c.pollos)}</td>
      <td class="num">${fmtNumOrden(Number(c.cajones) * 20)}</td>
    </tr>`).join("");

  const filasTrozados = (e.trozados || []).map((t) => `
    <tr>
      <td>${escapeHtml(trozadoLabel(t.tipo))} <span class="clase">Clase ${escapeHtml(t.clase || "A")}</span></td>
      <td class="num">${fmtNumOrden(t.cajas)}</td>
      <td class="num">—</td>
      <td class="num">${fmtNumOrden(t.kgTotal != null ? t.kgTotal : Number(t.cajas) * Number(t.kgCaja))}</td>
    </tr>`).join("");

  const seccionCalibres = filasCalibres
    ? `<h2>Calibres (pollo entero)</h2>
       <table class="detalle">
         <thead><tr><th>Detalle</th><th class="num">Cajones</th><th class="num">Pollos</th><th class="num">Kg</th></tr></thead>
         <tbody>${filasCalibres}</tbody>
       </table>` : "";

  const seccionTrozados = filasTrozados
    ? `<h2>Trozados</h2>
       <table class="detalle">
         <thead><tr><th>Detalle</th><th class="num">Cajas</th><th class="num">Pollos</th><th class="num">Kg</th></tr></thead>
         <tbody>${filasTrozados}</tbody>
       </table>` : "";

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>Orden de Envío ${escapeHtml(e.numeroEnvio)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #222; max-width: 640px; margin: 0 auto; }
      .logo { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
      .logo span { color: #f59e0b; }
      .subtitulo { font-size: 13px; color: #666; margin-bottom: 20px; }
      .ruta { text-align: center; font-size: 20px; font-weight: bold; margin: 18px 0; padding: 12px; border: 2px solid #222; border-radius: 8px; }
      .ruta .flecha { color: #f59e0b; margin: 0 10px; }
      h2 { font-size: 15px; border-bottom: 2px solid #222; padding-bottom: 6px; margin: 20px 0 10px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 12px; }
      .fila { display: flex; flex-direction: column; }
      .lbl { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
      .val { font-size: 14px; font-weight: 600; }
      table.detalle { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 13px; }
      table.detalle th, table.detalle td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      table.detalle th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
      table.detalle .num { text-align: right; }
      .cap { text-transform: capitalize; }
      .clase { font-size: 10px; color: #888; }
      .totales { display: flex; justify-content: flex-end; gap: 24px; margin: 12px 0 20px; font-size: 13px; }
      .totales b { font-size: 16px; }
      .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
      .firma { text-align: center; }
      .firma .linea { border-top: 1px solid #222; margin-bottom: 6px; }
      .firma .rol { font-size: 12px; color: #555; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    <div class="logo">Trigotuc <span>Avícola</span></div>
    <div class="subtitulo">Orden de Envío entre Cámaras — N° ${escapeHtml(e.numeroEnvio)}</div>
    <div class="ruta">${origen}<span class="flecha">&rarr;</span>${destino}</div>
    <div class="grid">
      <div class="fila"><span class="lbl">N° Envío</span><span class="val">${escapeHtml(e.numeroEnvio)}</span></div>
      <div class="fila"><span class="lbl">Fecha</span><span class="val">${fecha}</span></div>
      <div class="fila"><span class="lbl">Chofer</span><span class="val">${chofer}</span></div>
      <div class="fila"><span class="lbl">Camión</span><span class="val">${camion}</span></div>
    </div>
    ${seccionCalibres}
    ${seccionTrozados}
    <div class="totales">
      <span>Total cajones: <b>${fmtNumOrden(e.totalCajones)}</b></span>
      <span>Total pollos: <b>${fmtNumOrden(e.totalPollos)}</b></span>
      <span>Total kg: <b>${fmtNumOrden(Number(e.pesoTotalKg || 0) + Number(e.totalKgTrozados || 0))}</b></span>
    </div>
    ${e.observaciones ? `<p style="font-size:13px;color:#555"><strong>Obs:</strong> ${escapeHtml(e.observaciones)}</p>` : ""}
    <div class="firmas">
      <div class="firma"><div class="linea">&nbsp;</div><div class="rol">Entregó — Cámara ${origen}</div></div>
      <div class="firma"><div class="linea">&nbsp;</div><div class="rol">Recibió — Cámara ${destino}</div></div>
    </div>
    <script>window.onload=()=>{window.print();}</script>
  </body></html>`;
  const win = window.open("", "_blank", "width=760,height=800");
  if (!win) return;
  win.document.write(html);
  win.document.close();
};

// PDF descargable de la orden de envío entre cámaras (mismo contenido que la impresión).
const construirPDFOrdenEnvio = (e) => {
  const doc = new jsPDF();
  const W = 210;
  const origen  = camaraNombre(e.camaraOrigen);
  const destino = camaraNombre(e.camaraDestino);
  const chofer  = e.chofer?.nombreUsuario || "—";
  const camion  = e.camion ? `${e.camion.marca || ""}${e.camion.patente ? " — " + e.camion.patente : ""}`.trim() || "—" : "—";
  const fecha   = new Date(e.fecha).toLocaleDateString("es-AR");

  // ── Header ──
  doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  doc.text("Trigotuc Avícola", 14, 20);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
  doc.text("Orden de Envío entre Cámaras", 14, 27);

  doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(26, 122, 26);
  doc.text(String(e.numeroEnvio || ""), W - 14, 20, { align: "right" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
  doc.text(`Fecha: ${fecha}`, W - 14, 27, { align: "right" });

  doc.setDrawColor(50); doc.setLineWidth(0.5);
  doc.line(14, 31, W - 14, 31);

  let y = 37;

  // ── Ruta origen → destino ──
  doc.setFillColor(30, 30, 30);
  doc.roundedRect(14, y, W - 28, 16, 3, 3, "F");
  const rutaY = y + 8; // centro vertical del recuadro
  doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
  doc.text(origen, 62, rutaY + 1.5, { align: "center" });
  doc.text(destino, 148, rutaY + 1.5, { align: "center" });
  // Flecha vectorial (la fuente estándar de jsPDF no incluye el glifo →)
  doc.setDrawColor(245, 158, 11); doc.setLineWidth(0.9);
  doc.line(99, rutaY, 109, rutaY);
  doc.setFillColor(245, 158, 11);
  doc.triangle(109, rutaY - 2, 109, rutaY + 2, 113, rutaY, "F");
  y += 24;

  // ── Chofer / Camión ──
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
  doc.text("CHOFER", 14, y);
  doc.text("CAMIÓN", W / 2, y);
  doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.setTextColor(0);
  doc.text(chofer, 14, y + 7);
  doc.text(camion, W / 2, y + 7);
  y += 16;

  // ── Calibres ──
  const calibres = (e.calibres || []).filter((c) => Number(c.cajones) > 0);
  if (calibres.length > 0) {
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
    doc.text("CALIBRES (POLLO ENTERO)", 14, y + 4);
    y += 7;
    doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(14, y, W - 14, y); y += 2;

    doc.setFillColor(245, 245, 245); doc.rect(14, y, W - 28, 8, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(80);
    doc.text("Calibre", 16, y + 5.5);
    doc.text("Cajones", W / 2 - 10, y + 5.5, { align: "right" });
    doc.text("Pollos", W / 2 + 30, y + 5.5, { align: "right" });
    doc.text("Kg total", W - 16, y + 5.5, { align: "right" });
    y += 8;

    calibres.forEach((c, i) => {
      if (i % 2 === 1) { doc.setFillColor(250, 250, 250); doc.rect(14, y, W - 28, 7, "F"); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(0);
      doc.text(`Cal. ${c.calibre}`, 16, y + 5);
      doc.text(fmtNumOrden(c.cajones), W / 2 - 10, y + 5, { align: "right" });
      doc.text(fmtNumOrden(c.pollos), W / 2 + 30, y + 5, { align: "right" });
      doc.text(`${fmtNumOrden(Number(c.cajones) * 20)} kg`, W - 16, y + 5, { align: "right" });
      y += 7;
    });
    y += 5;
  }

  // ── Trozados ──
  const trozados = (e.trozados || []).filter((t) => Number(t.cajas) > 0);
  if (trozados.length > 0) {
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
    doc.text("TROZADOS", 14, y + 4);
    y += 7;
    doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(14, y, W - 14, y); y += 2;

    doc.setFillColor(245, 245, 245); doc.rect(14, y, W - 28, 8, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(80);
    doc.text("Tipo", 16, y + 5.5);
    doc.text("Cajas", W / 2, y + 5.5, { align: "right" });
    doc.text("Kg total", W - 16, y + 5.5, { align: "right" });
    y += 8;

    trozados.forEach((t, i) => {
      if (i % 2 === 1) { doc.setFillColor(250, 250, 250); doc.rect(14, y, W - 28, 7, "F"); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(0);
      doc.text(`${trozadoLabel(t.tipo)} (Clase ${t.clase || "A"})`, 16, y + 5);
      doc.text(fmtNumOrden(t.cajas), W / 2, y + 5, { align: "right" });
      doc.text(`${fmtNumOrden(t.kgTotal != null ? t.kgTotal : Number(t.cajas) * Number(t.kgCaja))} kg`, W - 16, y + 5, { align: "right" });
      y += 7;
    });
    y += 5;
  }

  // ── Totales ──
  doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(14, y, W - 14, y); y += 6;
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  const totalKg = Number(e.pesoTotalKg || 0) + Number(e.totalKgTrozados || 0);
  doc.text(
    `Total cajones: ${fmtNumOrden(e.totalCajones)}    Total pollos: ${fmtNumOrden(e.totalPollos)}    Total kg: ${fmtNumOrden(totalKg)}`,
    W - 14, y, { align: "right" }
  );
  y += 10;

  // ── Observaciones ──
  if (e.observaciones) {
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
    doc.text("OBSERVACIONES", 14, y);
    y += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(0);
    const obsLines = doc.splitTextToSize(e.observaciones, W - 28);
    doc.text(obsLines, 14, y);
    y += obsLines.length * 5 + 5;
  }

  // ── Firmas ──
  const firmaY = 255;
  doc.setDrawColor(80); doc.setLineWidth(0.4);
  doc.line(24, firmaY, 96, firmaY);
  doc.line(W - 96, firmaY, W - 24, firmaY);
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(90);
  doc.text(`Entregó — Cámara ${origen}`, 60, firmaY + 6, { align: "center" });
  doc.text(`Recibió — Cámara ${destino}`, W - 60, firmaY + 6, { align: "center" });

  // ── Footer ──
  doc.setFontSize(8); doc.setTextColor(150);
  doc.text(`Trigotuc Avícola — Envío ${e.numeroEnvio || ""} — Emitida: ${fecha}`, W / 2, 285, { align: "center" });

  return doc;
};

export const descargarPDFOrdenEnvio = (e) => {
  construirPDFOrdenEnvio(e).save(`OrdenEnvio_${e.numeroEnvio || "sin-numero"}.pdf`);
};
