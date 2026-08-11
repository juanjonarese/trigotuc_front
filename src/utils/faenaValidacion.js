import Swal from "sweetalert2";

const fmt = (n) => new Intl.NumberFormat("es-AR").format(Number(n) || 0);

// Causas habituales de cada desvío, en orden de probabilidad. La idea es que el
// operario no tenga que adivinar: casi siempre es uno de estos cuatro.
const REVISAR_FALTAN = [
  "¿Cargaste los <strong>decomisados</strong>? Los pollos decomisados en faena también son un destino.",
  "¿Están las <strong>unidades trozadas</strong>? Es común cargar los kg de trozado y olvidar las unidades.",
  "¿Falta algún <strong>calibre</strong> en la tabla, o quedó una fila sin darle <em>Aceptar</em>?",
  "Si fue <strong>faena parcial</strong>, ¿cargaste los pollos que volvieron a granja?",
];

const REVISAR_SOBRAN = [
  "¿Las <strong>unidades recibidas</strong> quedaron cortas? Es todo lo que bajó del camión.",
  "¿Algún <strong>calibre</strong> quedó cargado dos veces en la tabla?",
  "¿Los <strong>muertos</strong> se contaron también como decomisados? Son cosas distintas.",
  "¿Las <strong>unidades trozadas</strong> están en pollos y no en kg o en cajas?",
];

/**
 * La resta que el operario ya no tiene que hacer a mano.
 *
 * Se carga lo que bajó del camión (`unidadesRecibidas`, el número del papel) y de
 * ahí salen las que entraron a la línea: los muertos llegaron sin vida y los
 * `pollosSinFaenar` de una faena parcial se vuelven a granja, así que ninguno de
 * los dos puede tener destino.
 *
 *   recibidas − muertos − sin faenar = a faenar = enteros + trozados + decomisados
 *
 * El backend hace exactamente la misma cuenta en `lotes.services.js`
 * (`derivarUnidadesFaenadas` + `validarDestinoFaena`); lo que se persiste sigue
 * siendo `unidadesFaenadas`, no las recibidas.
 */
export const calcularDesgloseFaena = ({
  unidadesRecibidas,
  muertos = 0,
  pollosSinFaenar = 0,
  pollosCalibres = 0,
  unidadesTrozadas = 0,
  unidadesDecomisadas = 0,
}) => {
  const recibidas   = Number(unidadesRecibidas) || 0;
  const muertas     = Number(muertos) || 0;
  const sinFaenar   = Number(pollosSinFaenar) || 0;
  const aFaenar     = recibidas - muertas - sinFaenar;

  const enteros     = Number(pollosCalibres) || 0;
  const trozadas    = Number(unidadesTrozadas) || 0;
  const decomisadas = Number(unidadesDecomisadas) || 0;
  const asignadas   = enteros + trozadas + decomisadas;

  return {
    recibidas, muertos: muertas, sinFaenar, aFaenar,
    enteros, trozadas, decomisadas, asignadas,
    diferencia: aFaenar - asignadas,
    negativa:   aFaenar < 0,
    cuadra:     recibidas > 0 && aFaenar >= 0 && aFaenar === asignadas,
  };
};

const fila = (etiqueta, valor, fuerte = false) =>
  `<div class="d-flex justify-content-between border-bottom py-1">` +
  `<span>${etiqueta}</span>` +
  `<${fuerte ? "strong" : "span"}>${fmt(valor)}</${fuerte ? "strong" : "span"}>` +
  `</div>`;

/**
 * Regla de cierre de faena: todo pollo que entra a la línea tiene que salir con un
 * destino. Se carga lo que bajó del camión y el sistema hace la resta (ver
 * `calcularDesgloseFaena`).
 *
 *   recibidas − muertos − sin faenar = enteros + trozados (u) + decomisados (u)
 *
 * Es BLOQUEANTE y sin tolerancia. Antes era un aviso con margen (0,5%, mínimo 5)
 * y botón "crear igual", y por eso se colaban faltantes: auditoría 2026-08-10,
 * 17 de 36 lotes cerraron con pollos sin destino (de 1 a 142 unidades), siempre
 * para el mismo lado. El backend aplica la misma regla en `validarDestinoFaena`
 * (lotes.services.js); esto es para explicarla antes de mandar.
 *
 * @returns {Promise<boolean>} true si cuadra y se puede continuar.
 */
export const validarDestinoFaena = async (args) => {
  const d = calcularDesgloseFaena(args);

  // Sin recibidas declaradas no hay base para comparar.
  if (d.recibidas <= 0) return true;

  if (d.negativa) {
    await Swal.fire({
      icon: "error",
      width: 560,
      title: "Los descuentos superan lo recibido",
      html:
        `<div class="text-start">` +
        `<div class="small border rounded p-2 mb-2 bg-light">` +
          fila("Unidades recibidas", d.recibidas, true) +
          fila("− Muertos", d.muertos) +
          (d.sinFaenar ? fila("− Sin faenar (vuelven a granja)", d.sinFaenar) : "") +
          `<div class="d-flex justify-content-between text-danger pt-1">` +
            `<strong>= A faenar</strong><strong>${fmt(d.aFaenar)}</strong>` +
          `</div>` +
        `</div>` +
        `<p class="small mb-0">No puede faenarse una cantidad negativa. Revisá los tres ` +
        `números: las <strong>recibidas</strong> son todo lo que bajó del camión, muertos ` +
        `y sin faenar salen de ahí.</p>` +
        `</div>`,
      confirmButtonText: "Revisar",
      confirmButtonColor: "#dc3545",
    });
    return false;
  }

  if (d.diferencia === 0) return true;

  const faltan  = d.diferencia > 0;
  const revisar = faltan ? REVISAR_FALTAN : REVISAR_SOBRAN;

  await Swal.fire({
    icon: "error",
    width: 620,
    title: faltan
      ? `Faltan ${fmt(d.diferencia)} pollos por asignar`
      : `Sobran ${fmt(-d.diferencia)} pollos asignados`,
    html:
      `<div class="text-start">` +

      `<p class="mb-2">Todo pollo que entra a la faena tiene que salir por alguno de ` +
      `estos tres destinos: <strong>entero</strong> (clasificado por calibre), ` +
      `<strong>trozado</strong> o <strong>decomisado</strong>. Hoy la cuenta no cierra:</p>` +

      `<div class="small border rounded p-2 mb-2 bg-light">` +
        fila("Unidades recibidas", d.recibidas, true) +
        fila("− Muertos", d.muertos) +
        (d.sinFaenar ? fila("− Sin faenar (vuelven a granja)", d.sinFaenar) : "") +
        `<div class="d-flex justify-content-between border-bottom py-1">` +
          `<strong>= A faenar</strong><strong>${fmt(d.aFaenar)}</strong>` +
        `</div>` +

        `<div class="text-muted mt-2 mb-1" style="font-size:.85em">Destinos cargados</div>` +
        fila("Enteros (calibres)", d.enteros) +
        fila("Trozados", d.trozadas) +
        fila("Decomisados", d.decomisadas) +
        `<div class="d-flex justify-content-between pt-1">` +
          `<strong>Total asignado</strong><strong>${fmt(d.asignadas)}</strong>` +
        `</div>` +
        `<div class="d-flex justify-content-between text-danger pt-1">` +
          `<strong>${faltan ? "Sin destino" : "De más"}</strong>` +
          `<strong>${fmt(Math.abs(d.diferencia))}</strong>` +
        `</div>` +
      `</div>` +

      `<p class="mb-1 fw-semibold" style="font-size:.9em">Qué revisar</p>` +
      `<ul class="small ps-3 mb-2">${revisar.map((r) => `<li class="mb-1">${r}</li>`).join("")}</ul>` +

      `<p class="text-muted small mb-0">` +
      `Los <strong>muertos</strong> ya se descontaron de las recibidas: llegaron sin vida, ` +
      `nunca entraron a la línea y por eso no cuentan como destino.</p>` +

      `</div>`,
    confirmButtonText: "Revisar",
    confirmButtonColor: "#dc3545",
  });
  return false;
};

/**
 * Advertencia (NO bloqueante) por pollos que no llegan a completar un cajón.
 *
 * Un calibre cargado en un número que no es múltiplo del calibre deja un resto
 * que queda como stock imposible de encajonar: no se puede despachar solo, y en
 * cada descuento FIFO se muda de lote arrastrándose para siempre. Caso real: la
 * faena del lote #38 declaró 579 pollos de calibre 9 (64 cajones + 3 sueltos);
 * esos 3 anduvieron dando vueltas dos semanas hasta que hubo que ajustarlos a
 * mano porque físicamente no existían.
 *
 * Se avisa y se deja seguir: puede ser correcto (a veces sobran pollos de verdad).
 *
 * @returns {Promise<boolean>} true si se puede continuar.
 */
export const advertirRestosDeCajon = async ({ calibres = [], confirmText = "Continuar igual" }) => {
  const restos = calibres
    .map((c) => {
      const calibre = Number(c.calibre) || 0;
      const pollos  = Number(c.pollos) || 0;
      return { calibre, pollos, cajones: Math.floor(pollos / calibre), resto: pollos % calibre };
    })
    .filter((c) => c.calibre > 0 && c.resto > 0);

  if (restos.length === 0) return true;

  const totalResto = restos.reduce((a, c) => a + c.resto, 0);

  const res = await Swal.fire({
    icon: "warning",
    width: 600,
    title: `Quedan ${fmt(totalResto)} pollos sin completar cajón`,
    html:
      `<div class="text-start">` +

      `<p class="mb-2">Estos calibres no dan cajones enteros:</p>` +

      `<div class="small border rounded p-2 mb-2 bg-light">` +
        restos.map((c) =>
          `<div class="d-flex justify-content-between border-bottom py-1">` +
          `<span>Calibre <strong>${c.calibre}</strong></span>` +
          `<span>${fmt(c.pollos)} pollos = ${fmt(c.cajones)} cajones ` +
          `<span class="text-danger">+ ${fmt(c.resto)} sueltos</span></span>` +
          `</div>`
        ).join("") +
      `</div>` +

      `<p class="small mb-2">Los pollos sueltos quedan como stock que <strong>no se puede ` +
      `despachar</strong>: no completan un cajón, así que se van arrastrando de lote en lote ` +
      `en cada venta y nunca salen solos.</p>` +

      `<p class="small mb-0 text-muted">Si esos pollos no van a quedar realmente en cámara, ` +
      `conviene mandarlos a <strong>trozado</strong> en vez de dejarlos como enteros. Si de ` +
      `verdad sobran, podés continuar.</p>` +

      `</div>`,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Revisar",
    confirmButtonColor: "#198754",
  });
  return res.isConfirmed;
};
