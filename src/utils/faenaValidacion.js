import Swal from "sweetalert2";

const fmt = (n) => new Intl.NumberFormat("es-AR").format(Number(n) || 0);

// Causas habituales de cada desvío, en orden de probabilidad. La idea es que el
// operario no tenga que adivinar: casi siempre es uno de estos cuatro.
const REVISAR_FALTAN = [
  "¿Cargaste los <strong>decomisados</strong>? Los pollos decomisados en faena también son un destino.",
  "¿Están las <strong>unidades trozadas</strong>? Es común cargar los kg de trozado y olvidar las unidades.",
  "¿Falta algún <strong>calibre</strong> en la tabla, o quedó una fila sin darle <em>Aceptar</em>?",
  "Si fue <strong>faena parcial</strong>, los pollos que volvieron a granja no van en “unidades faenadas”.",
];

const REVISAR_SOBRAN = [
  "¿Las <strong>unidades faenadas</strong> quedaron cortas? Es el total que entró a la línea.",
  "¿Algún <strong>calibre</strong> quedó cargado dos veces en la tabla?",
  "¿Los <strong>muertos</strong> se contaron también como decomisados? Son cosas distintas.",
  "¿Las <strong>unidades trozadas</strong> están en pollos y no en kg o en cajas?",
];

const fila = (etiqueta, valor, fuerte = false) =>
  `<div class="d-flex justify-content-between border-bottom py-1">` +
  `<span>${etiqueta}</span>` +
  `<${fuerte ? "strong" : "span"}>${fmt(valor)}</${fuerte ? "strong" : "span"}>` +
  `</div>`;

/**
 * Regla de cierre de faena: todo pollo que entra tiene que salir con un destino.
 *
 *   unidadesFaenadas = pollos en calibres + trozados (u) + decomisados (u)
 *
 * Los MUERTOS no entran en la suma porque ya están descontados del otro lado:
 * el sistema reconstruye lo recibido como `unidadesFaenadas + muertos`, así que
 * un pollo muerto en transporte nunca entró a la línea y no puede tener destino.
 *
 * Es BLOQUEANTE y sin tolerancia. Antes era un aviso con margen (0,5%, mínimo 5)
 * y botón "crear igual", y por eso se colaban faltantes: auditoría 2026-08-10,
 * 17 de 36 lotes cerraron con pollos sin destino (de 1 a 142 unidades), siempre
 * para el mismo lado. El backend aplica la misma regla en `validarDestinoFaena`
 * (lotes.services.js); esto es para explicarla antes de mandar.
 *
 * @returns {Promise<boolean>} true si cuadra y se puede continuar.
 */
export const validarDestinoFaena = async ({
  unidadesFaenadas,
  pollosCalibres = 0,
  unidadesTrozadas = 0,
  unidadesDecomisadas = 0,
}) => {
  const faenados = Number(unidadesFaenadas) || 0;
  // Sin faenados declarados no hay base para comparar.
  if (faenados <= 0) return true;

  const enteros     = Number(pollosCalibres) || 0;
  const trozadas    = Number(unidadesTrozadas) || 0;
  const decomisadas = Number(unidadesDecomisadas) || 0;
  const asignadas   = enteros + trozadas + decomisadas;
  const diferencia  = faenados - asignadas;

  if (diferencia === 0) return true;

  const faltan = diferencia > 0;
  const revisar = faltan ? REVISAR_FALTAN : REVISAR_SOBRAN;

  await Swal.fire({
    icon: "error",
    width: 620,
    title: faltan
      ? `Faltan ${fmt(diferencia)} pollos por asignar`
      : `Sobran ${fmt(-diferencia)} pollos asignados`,
    html:
      `<div class="text-start">` +

      `<p class="mb-2">Todo pollo que entra a la faena tiene que salir por alguno de ` +
      `estos tres destinos: <strong>entero</strong> (clasificado por calibre), ` +
      `<strong>trozado</strong> o <strong>decomisado</strong>. Hoy la cuenta no cierra:</p>` +

      `<div class="small border rounded p-2 mb-2 bg-light">` +
        fila("Unidades faenadas", faenados, true) +
        `<div class="text-muted mt-2 mb-1" style="font-size:.85em">Destinos cargados</div>` +
        fila("Enteros (calibres)", enteros) +
        fila("Trozados", trozadas) +
        fila("Decomisados", decomisadas) +
        `<div class="d-flex justify-content-between pt-1">` +
          `<strong>Total asignado</strong><strong>${fmt(asignadas)}</strong>` +
        `</div>` +
        `<div class="d-flex justify-content-between text-danger pt-1">` +
          `<strong>${faltan ? "Sin destino" : "De más"}</strong>` +
          `<strong>${fmt(Math.abs(diferencia))}</strong>` +
        `</div>` +
      `</div>` +

      `<p class="mb-1 fw-semibold" style="font-size:.9em">Qué revisar</p>` +
      `<ul class="small ps-3 mb-2">${revisar.map((r) => `<li class="mb-1">${r}</li>`).join("")}</ul>` +

      `<p class="text-muted small mb-0">` +
      `Los <strong>muertos en transporte</strong> no se cargan acá: murieron antes de la ` +
      `faena, así que no van en “unidades faenadas” ni cuentan como destino. Tienen su ` +
      `propio campo.</p>` +

      `</div>`,
    confirmButtonText: "Revisar",
    confirmButtonColor: "#dc3545",
  });
  return false;
};
