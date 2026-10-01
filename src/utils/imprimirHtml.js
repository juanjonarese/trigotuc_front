/**
 * Imprime un documento HTML sin abrir ninguna pestaña ni ventana.
 *
 * Lo escribe en un <iframe> invisible dentro de la misma página y le pide la
 * impresión a ese marco: el usuario ve directamente el diálogo de la impresora
 * (con su vista previa) y, al cerrarlo, el marco se borra. Es lo que pidió el
 * usuario el 2026-09-30 para el remito: "que levante la ventana de la impresora
 * pero que no me abra el archivo en el navegador".
 *
 * Además, a diferencia de `window.open`, no lo puede bloquear el navegador como
 * ventana emergente.
 *
 * ⚠️ El HTML tiene que traer sus estilos inline (en un <style>): el marco no
 * hereda los CSS de la aplicación.
 */
export const imprimirHtml = (html) => {
  const marco = document.createElement("iframe");
  marco.setAttribute("aria-hidden", "true");
  marco.setAttribute("title", "Impresión");
  // Fuera de la vista pero NO con display:none ni visibility:hidden: con eso
  // algunos navegadores imprimen la hoja en blanco.
  Object.assign(marco.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
  });
  document.body.appendChild(marco);

  const doc = marco.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  let borrado = false;
  const borrar = () => {
    if (borrado) return;
    borrado = true;
    marco.remove();
  };

  // Un instante para que el marco termine de armar la hoja antes de imprimir
  // (sin esto Chrome a veces abre el diálogo con la vista previa vacía).
  setTimeout(() => {
    const ventana = marco.contentWindow;
    ventana.onafterprint = () => setTimeout(borrar, 500);
    ventana.focus();
    ventana.print();
    // Por si el navegador no avisa el fin de la impresión.
    setTimeout(borrar, 60000);
  }, 300);

  return true;
};
