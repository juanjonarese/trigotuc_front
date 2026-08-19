import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { formatearNumero, labelGranja } from "../utils/reproductoresUtils";

// Almanaque: el rediseño acordado con el cliente.
//
// Son DOS tarjetas separadas sobre el mismo eje de días, con el scroll
// sincronizado: arriba los galpones (con el carril de nacimientos), abajo la
// faena. Separarlas es a pedido del usuario — son dos lecturas distintas
// ("¿dónde meto los pollitos?" y "¿tengo con qué faenar?") y mezclarlas en un
// solo bloque obligaba a saltar con la vista.
//
// Todo se posiciona por la clave "AAAA-MM-DD" que manda el backend, NUNCA
// parseando la fecha ISO: el server corre en UTC y el navegador en Argentina
// está en UTC−3, así que `new Date(iso).getDate()` corre el almanaque un día
// para atrás. La clave ya viene resuelta y no se reinterpreta.

// 56px por día. Antes eran 34 y la pastilla de nacimiento medía 100, así que una
// tanda se dibujaba pisando tres días y no se sabía en cuál de los tres nacía.
// A pedido del usuario (2026-08-12) la pastilla ocupa UN día y el día se ensancha
// lo necesario para que entre el número adentro.
const ANCHO_DIA = 56;
const ANCHO_LABEL = 118;
const ALTO_FILA = 30;
const ALTO_ENCABEZADO = 42;
const ALTO_FAENA = 78;
const ALTO_HUEVOS = 150;

// Un color por plantel. Son pocos a la vez (4 galpones de postura), así que
// alcanza con una paleta corta y bien separada entre sí.
const COLORES_PLANTEL = ["#0d6efd", "#d63384", "#fd7e14", "#6f42c1", "#0dcaf0", "#495057"];

// La pastilla es exactamente un día. Los 4px de menos son aire para que dos
// pastillas de días consecutivos no queden pegadas.
const ANCHO_PILL = ANCHO_DIA;
const INSET_PILL = 2;
const ALTO_PILL = 22;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const partesClave = (clave) => {
  const [anio, mes, dia] = clave.split("-").map(Number);
  return { anio, mes, dia };
};

const etiquetaLarga = (clave) => {
  const { anio, mes, dia } = partesClave(clave);
  return `${dia}/${mes}/${anio}`;
};

// Los pesajes se cargan en gramos; en pantalla el peso de un pollo se lee en kg.
const kg = (gramos) =>
  gramos == null ? "—" : `${(gramos / 1000).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;

// ── Suavizado de la curva de postura ────────────────────────────────────────
//
// La curva de la planilla es SEMANAL: los siete días de una semana valen lo
// mismo. Dibujados día por día eso da una escalera —tramos planos con saltos—,
// que es lo contrario de lo que pasa en el galpón: la gallina no cambia de
// rendimiento de golpe un lunes, sube y baja de a poco.
//
// Se resuelve en dos pasos:
//   1. `colapsarEscalones` deja un punto por tramo plano, en el centro del tramo
//      (o sea: un punto por semana, con el valor REAL de esa semana).
//   2. `caminoSuave` los une con un spline cúbico monótono (Fritsch-Carlson).
//
// El spline monótono es la clave: un spline común (Catmull-Rom) se pasa de
// largo en los quiebres e inventa picos que no existen. Este no puede — entre
// dos puntos nunca sube más que ellos. Así el máximo que se ve en pantalla es
// el mejor rendimiento de verdad, y la caída es la caída de verdad.

// Un punto por tramo de valor constante, ubicado en el medio del tramo. Los
// extremos se anclan al borde real para que la curva cubra todo el período.
const colapsarEscalones = (puntos) => {
  if (puntos.length < 2) return puntos;
  const salida = [];
  let inicio = 0;
  for (let i = 1; i <= puntos.length; i++) {
    if (i === puntos.length || puntos[i].y !== puntos[inicio].y) {
      salida.push({ x: (puntos[inicio].x + puntos[i - 1].x) / 2, y: puntos[inicio].y });
      inicio = i;
    }
  }
  salida[0] = { ...salida[0], x: puntos[0].x };
  salida[salida.length - 1] = { ...salida[salida.length - 1], x: puntos[puntos.length - 1].x };
  return salida;
};

// Spline cúbico monótono. Devuelve el `d` de un <path> que pasa exactamente por
// cada punto y no se pasa de largo en ningún tramo.
const caminoSuave = (pts) => {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M ${pts[0].x},${pts[0].y}`;
  if (n === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;

  const dx = [];
  const pendiente = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    pendiente[i] = dx[i] === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx[i];
  }

  // Tangente en cada punto: el promedio de las pendientes vecinas, y CERO en los
  // quiebres (donde la curva cambia de sentido). Ese cero es el que aplana el
  // pico en vez de dispararlo.
  const t = new Array(n);
  t[0] = pendiente[0];
  t[n - 1] = pendiente[n - 2];
  for (let i = 1; i < n - 1; i++) {
    t[i] =
      pendiente[i - 1] * pendiente[i] <= 0 ? 0 : (pendiente[i - 1] + pendiente[i]) / 2;
  }

  // Recorte de Fritsch-Carlson: mantiene la curva dentro del rectángulo de cada
  // tramo, que es lo que garantiza que no invente máximos.
  for (let i = 0; i < n - 1; i++) {
    if (pendiente[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / pendiente[i];
    const b = t[i + 1] / pendiente[i];
    const norma = Math.hypot(a, b);
    if (norma > 3) {
      t[i] = ((3 / norma) * a) * pendiente[i];
      t[i + 1] = ((3 / norma) * b) * pendiente[i];
    }
  }

  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d +=
      ` C ${pts[i].x + h},${pts[i].y + t[i] * h} ` +
      `${pts[i + 1].x - h},${pts[i + 1].y - t[i + 1] * h} ` +
      `${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
};

// ── Fondo: un día por columna, pintado según trabaje o no la planta ──────────
const CapaDias = ({ dias, indices, hoyClave, alto }) => (
  <div
    className="position-absolute top-0"
    style={{ left: ANCHO_LABEL, height: alto, pointerEvents: "none" }}
  >
    {dias.map((d, i) => {
      const { dia } = partesClave(d.clave);
      // Domingo y feriado no son huecos: la planta no trabaja y punto.
      const fondo = !d.esFaena
        ? d.cerradoPor === "feriado"
          ? "#fff8e1"
          : "#f1f3f5"
        : dia === 1
        ? "#fafbfc"
        : "transparent";
      return (
        <div
          key={d.clave}
          className="position-absolute top-0"
          style={{
            left: i * ANCHO_DIA,
            width: ANCHO_DIA,
            height: alto,
            background: fondo,
            borderLeft: dia === 1 ? "1px solid #ced4da" : "1px solid #f1f3f5",
          }}
        />
      );
    })}
    {indices.has(hoyClave) && (
      <div
        className="position-absolute top-0"
        style={{
          left: indices.get(hoyClave) * ANCHO_DIA,
          width: ANCHO_DIA,
          height: alto,
          background: "rgba(13,110,253,.10)",
          borderLeft: "2px solid #0d6efd",
          borderRight: "2px solid #0d6efd",
        }}
      />
    )}
  </div>
);

// Hueco de la columna de etiquetas dentro del encabezado. Va sticky y opaco,
// igual que `Etiqueta`: si no, al scrollear los números de los días pasan por
// debajo y quedan a la vista arriba de "Pollos/día" o "Huevos/día".
const HuecoEtiqueta = ({ alto }) => (
  <div
    className="position-sticky bg-white"
    style={{
      width: ANCHO_LABEL,
      flex: "0 0 auto",
      left: 0,
      zIndex: 4,
      height: alto,
      borderRight: "1px solid #dee2e6",
    }}
  />
);

// ── Encabezado: banda de meses + número de día ──────────────────────────────
const Encabezado = ({ dias }) => {
  const meses = [];
  for (const d of dias) {
    const { anio, mes } = partesClave(d.clave);
    const ultimo = meses[meses.length - 1];
    if (ultimo && ultimo.anio === anio && ultimo.mes === mes) ultimo.dias += 1;
    else meses.push({ anio, mes, dias: 1 });
  }

  return (
    <>
      <div className="d-flex" style={{ height: 22 }}>
        <HuecoEtiqueta alto={22} />
        {meses.map((m) => (
          <div
            key={`${m.anio}-${m.mes}`}
            className="small fw-semibold text-muted text-truncate px-1"
            style={{
              width: m.dias * ANCHO_DIA,
              flex: "0 0 auto",
              borderLeft: "1px solid #ced4da",
              fontSize: ".7rem",
            }}
          >
            {MESES[m.mes - 1]} {m.anio}
          </div>
        ))}
      </div>
      <div className="d-flex" style={{ height: 20 }}>
        <HuecoEtiqueta alto={20} />
        {dias.map((d) => {
          const { dia } = partesClave(d.clave);
          return (
            <div
              key={d.clave}
              className="text-center text-muted"
              style={{
                width: ANCHO_DIA,
                flex: "0 0 auto",
                fontSize: ".6rem",
                lineHeight: "20px",
                fontWeight: dia === 1 ? 700 : 400,
              }}
              title={d.feriado || undefined}
            >
              {d.feriado ? "★" : dia}
            </div>
          );
        })}
      </div>
    </>
  );
};

// Etiqueta fija de la izquierda, común a todos los carriles.
const Etiqueta = ({ alto, children, className = "" }) => (
  <div
    className={`position-sticky bg-white px-2 ${className}`}
    style={{
      width: ANCHO_LABEL,
      flex: "0 0 auto",
      left: 0,
      zIndex: 3,
      height: alto,
      borderRight: "1px solid #dee2e6",
    }}
  >
    {children}
  </div>
);

// ── La cinta de un galpón ───────────────────────────────────────────────────
const FilaGalpon = ({ galpon, indices, totalDias }) => {
  const tramoEstilo = (t) => {
    if (t.tipo === "estancado")
      // Rojo rayado: el lote se pasó del ciclo y sigue adentro. El galpón no está
      // ni ocupado normalmente ni libre — excede tiempo.
      return {
        background: "repeating-linear-gradient(45deg,#f1aeb5,#f1aeb5 5px,#f8d7da 5px,#f8d7da 10px)",
        border: "1px solid #dc3545",
        color: "#58151c",
      };
    if (t.tipo === "saneamiento")
      // Rayado: el galpón está vacío pero NO disponible. Es la mitad del
      // problema y por eso se dibuja, no se deja en blanco.
      return {
        background: "repeating-linear-gradient(45deg,#ffe08a,#ffe08a 5px,#fff3cd 5px,#fff3cd 10px)",
        border: "1px solid #ffc107",
        color: "#664d03",
      };
    if (t.origen === "proyectado")
      return {
        background: "rgba(25,135,84,.18)",
        border: "1px dashed #198754",
        color: "#0f5132",
      };
    return { background: "#198754", border: "1px solid #146c43", color: "#fff" };
  };

  // Un galpón fuera de servicio con un lote todavía adentro es un caso raro pero
  // real (lo marcan sin haberlo vaciado). Se le siguen dibujando las cintas: los
  // pollos existen, se van a faenar, y taparlos con el cartel gris los hacía
  // desaparecer de la pantalla mientras el plan de faena sí los contaba.
  const vacioYFuera = galpon.fueraDeServicio && !galpon.ocupado;

  return (
    <div className="d-flex align-items-center" style={{ height: ALTO_FILA }}>
      <Etiqueta alto={ALTO_FILA} className="d-flex align-items-center gap-1">
        <span className="fw-bold small">{galpon.etiqueta}</span>
        {galpon.fueraDeServicio ? (
          <span
            className={`badge ${galpon.ocupado ? "bg-warning text-dark" : "bg-secondary"}`}
            style={{ fontSize: ".6rem" }}
            title={
              galpon.ocupado
                ? "Fuera de servicio pero con un lote adentro — hay que vaciarlo"
                : "Fuera de servicio: no recibe pollitos"
            }
          >
            fuera
          </span>
        ) : galpon.atrasado ? (
          <span
            className="badge bg-danger"
            style={{ fontSize: ".6rem" }}
            title={`Se pasó ${galpon.diasAtraso} días del ciclo y el lote sigue adentro`}
          >
            +{galpon.diasAtraso}d
          </span>
        ) : null}
        <span className="ms-auto text-muted" style={{ fontSize: ".62rem" }}>
          {galpon.capacidad ? `${Math.round(galpon.capacidad / 1000)}k` : "—"}
        </span>
      </Etiqueta>

      <div
        className="position-relative"
        style={{ width: totalDias * ANCHO_DIA, flex: "0 0 auto", height: ALTO_FILA }}
      >
        {vacioYFuera ? (
          <div
            className="position-absolute d-flex align-items-center justify-content-center text-muted"
            style={{ left: 0, right: 0, top: 6, height: ALTO_FILA - 12, fontSize: ".65rem" }}
          >
            fuera de servicio
          </div>
        ) : (
          galpon.tramos.map((t, i) => {
            // Un tramo puede empezar antes de la ventana: se recorta al borde.
            const desde = indices.has(t.desdeClave) ? indices.get(t.desdeClave) : 0;
            const hasta = indices.has(t.hastaClave) ? indices.get(t.hastaClave) : totalDias - 1;
            if (!indices.has(t.desdeClave) && !indices.has(t.hastaClave)) return null;
            const ancho = Math.max(ANCHO_DIA, (hasta - desde) * ANCHO_DIA);
            const est = tramoEstilo(t);

            // Lo que se lee en la barra: cuántos pollitos hay y cuánto pesan.
            // El número de lote no aporta a la decisión y ocupaba el lugar del
            // dato que sí — a pedido del usuario.
            // Sin pesaje cargado se dice justamente eso. No se estima con la
            // tabla de referencia: un peso inventado se lee igual que uno medido.
            const textoPeso = t.pesoPromedio == null ? "sin carga de peso" : kg(t.pesoPromedio);

            const rotulo =
              t.tipo === "crianza"
                ? ancho > 150
                  ? `${formatearNumero(t.pollitos)} · ${textoPeso}`
                  : formatearNumero(t.pollitos)
                : t.tipo === "estancado"
                ? // Los tramos de atraso son cortos por definición (P6 son 3 días
                  // = 78px), así que el texto se acorta por tramos en vez de
                  // caer en un símbolo suelto que no dice nada.
                  ancho > 130
                  ? `excede tiempo ${t.dias}d`
                  : ancho > 70
                  ? `excede ${t.dias}d`
                  : `${t.dias}d`
                : "saneamiento";

            return (
              <div
                key={i}
                className="position-absolute d-flex align-items-center rounded-1"
                style={{
                  left: desde * ANCHO_DIA,
                  width: ancho,
                  top: 4,
                  height: ALTO_FILA - 8,
                  fontSize: ".62rem",
                  whiteSpace: "nowrap",
                  // Sin overflow oculto a propósito: `overflow` distinto de
                  // visible crea un contenedor de scroll y rompe el `sticky` del
                  // texto de adentro. El ancho del texto lo controla el rótulo.
                  ...est,
                }}
                title={
                  t.tipo === "crianza"
                    ? `${formatearNumero(t.pollitos)} pollitos · ` +
                      (t.pesoPromedio == null
                        ? "sin carga de peso"
                        : `${kg(t.pesoPromedio)} promedio (último pesaje${
                            t.pesoSemana ? ` semana ${t.pesoSemana}` : ""
                          })`) +
                      `\nEntra ${etiquetaLarga(t.desdeClave)} · sale ${etiquetaLarga(t.hastaClave)}` +
                      `\nA la salida: ${formatearNumero(t.pollosSalida)} pollos` +
                      (t.kgSalida ? ` · ${formatearNumero(t.kgSalida)} kg` : "") +
                      (t.origen === "proyectado" ? "\nPROYECTADO (reserva sin nacer)" : "") +
                      `\n${t.ref.tipo === "lote" ? "Lote" : "Tanda"} ${t.ref.numero ?? "?"}`
                    : t.tipo === "estancado"
                    ? `EXCEDE TIEMPO · tenía que salir el ${etiquetaLarga(t.desdeClave)} y sigue adentro ` +
                      `hace ${t.dias} días.\n${formatearNumero(t.pollitos)} pollos · ` +
                      (t.pesoPromedio == null ? "sin carga de peso." : `${kg(t.pesoPromedio)} promedio.`) +
                      `\nEl saneamiento no puede empezar hasta que lo saquen.`
                    : `Saneamiento ${etiquetaLarga(t.desdeClave)} → ${etiquetaLarga(t.hastaClave)} · ` +
                      `${t.dias} días · el galpón NO está disponible` +
                      (t.origen === "proyectado" ? " · estimado" : "")
                }
              >
                {/* El rótulo va pegado al borde izquierdo VISIBLE, no al arranque
                    de la barra: una crianza dura 50 días (1.300 px) y al
                    desplazar el calendario el dato se iba de pantalla y quedaba
                    una cinta verde sin decir nada. Con `sticky` acompaña el
                    scroll y se frena solo cuando la barra se termina. */}
                {ancho > (t.tipo === "estancado" ? 34 : 52) && (
                  <span
                    className="position-sticky d-inline-block px-1"
                    style={{
                      left: ANCHO_LABEL + 2,
                      maxWidth: ancho - 6,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {rotulo}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ── Componente ──────────────────────────────────────────────────────────────
const Almanaque = ({ data }) => {
  const refGalpones = useRef(null);
  const refFaena = useRef(null);
  const refHuevos = useRef(null);
  // Mover un scroll dispara el evento del otro: sin este candado se quedan
  // rebotando entre sí.
  const sincronizando = useRef(false);

  const dias = useMemo(() => data?.faena || [], [data]);
  const indices = useMemo(() => new Map(dias.map((d, i) => [d.clave, i])), [dias]);

  // Apilado de las pastillas de nacimiento en carriles.
  //
  // Ahora que la pastilla mide un día exacto, dos tandas de días distintos no se
  // pisan nunca. El apilado queda igual porque sigue haciendo falta para el caso
  // que sí se pisa: dos tandas que nacen el MISMO día. Ahí la segunda baja a un
  // carril nuevo en vez de taparse con la primera.
  const carrilesNacimientos = useMemo(() => {
    const items = (data?.nacimientos || [])
      .filter((n) => indices.has(n.fechaClave))
      .sort((a, b) => indices.get(a.fechaClave) - indices.get(b.fechaClave));

    const finPorCarril = [];
    const ubicados = items.map((n) => {
      const izq = indices.get(n.fechaClave) * ANCHO_DIA;
      let carril = finPorCarril.findIndex((fin) => fin <= izq);
      if (carril === -1) carril = finPorCarril.length;
      // Sin margen extra: una pastilla del día siguiente arranca justo donde
      // termina esta, así que entra en el mismo carril.
      finPorCarril[carril] = izq + ANCHO_PILL;
      return { n, izq, carril };
    });

    return { ubicados, cantidad: Math.max(1, finPorCarril.length) };
  }, [data, indices]);

  // Huevos por día, indexados por clave. Se dibujan contra el MISMO array de
  // días que los otros carriles (`dias`), no contra el array propio: si algún
  // día el back devolviera otro rango, el carril seguiría alineado en vez de
  // correrse un día respecto de la faena.
  const huevosPorClave = useMemo(
    () => new Map((data?.huevos?.dias || []).map((d) => [d.clave, d])),
    [data]
  );

  // Una serie por plantel, con su valor de cada día. Es lo que convierte el
  // carril en un gráfico de curvas: cada plantel dibuja su propia campana
  // —sube hasta el pico de postura y después cae— en vez de fundirse en una
  // barra total donde no se ve de quién es cada huevo.
  const seriesHuevos = useMemo(() => {
    const porPlantel = new Map();
    for (const d of data?.huevos?.dias || []) {
      for (const pl of d.porPlantel || []) {
        const k = String(pl._id);
        if (!porPlantel.has(k)) {
          porPlantel.set(k, {
            _id: k,
            numeroLote: pl.numeroLote,
            etiqueta: pl.etiqueta,
            hembras: pl.hembras,
            valores: new Map(),
          });
        }
        porPlantel.get(k).valores.set(d.clave, pl);
      }
    }
    return [...porPlantel.values()]
      .sort((a, b) => (a.numeroLote ?? 0) - (b.numeroLote ?? 0))
      .map((serie, i) => ({ ...serie, color: COLORES_PLANTEL[i % COLORES_PLANTEL.length] }));
  }, [data]);

  const grupos = useMemo(() => {
    const porGranja = new Map();
    for (const g of data?.galpones || []) {
      if (!porGranja.has(g.granja)) porGranja.set(g.granja, []);
      porGranja.get(g.granja).push(g);
    }
    return [...porGranja.entries()];
  }, [data]);

  // Handlers estables en vez de una fábrica: las refs se leen adentro del
  // callback, nunca durante el render. Los tres carriles comparten el eje de
  // días, así que mover uno mueve los otros dos.
  const sincronizarDesde = (origen) => {
    if (sincronizando.current || !origen) return;
    sincronizando.current = true;
    for (const r of [refGalpones, refFaena, refHuevos]) {
      if (r.current && r.current !== origen) r.current.scrollLeft = origen.scrollLeft;
    }
    requestAnimationFrame(() => {
      sincronizando.current = false;
    });
  };

  const alScrollearGalpones = useCallback(() => sincronizarDesde(refGalpones.current), []);
  const alScrollearFaena = useCallback(() => sincronizarDesde(refFaena.current), []);
  const alScrollearHuevos = useCallback(() => sincronizarDesde(refHuevos.current), []);

  // Arranca mostrando hoy, no el borde izquierdo: la decisión que corre es la
  // de esta semana, no la de la semana pasada.
  useEffect(() => {
    const hoyClave = data?.parametros?.hoyClave;
    if (!indices.has(hoyClave)) return;
    const x = Math.max(0, indices.get(hoyClave) * ANCHO_DIA - 80);
    if (refGalpones.current) refGalpones.current.scrollLeft = x;
    if (refFaena.current) refFaena.current.scrollLeft = x;
    if (refHuevos.current) refHuevos.current.scrollLeft = x;
  }, [indices, data]);

  if (!data || !dias.length) return null;

  const { parametros, resumen } = data;
  const totalDias = dias.length;
  const anchoTotal = ANCHO_LABEL + totalDias * ANCHO_DIA;
  // El carril de nacimientos crece con la cantidad de filas que hicieron falta.
  const altoNacimientos = 10 + carrilesNacimientos.cantidad * (ALTO_PILL + 3);
  const altoGalpones =
    ALTO_ENCABEZADO +
    altoNacimientos +
    grupos.reduce((a, [, gs]) => a + gs.length * ALTO_FILA + 22, 0);
  const altoFaena = ALTO_ENCABEZADO + ALTO_FAENA;
  const maxPollos = Math.max(parametros.objetivoDiario, ...dias.map((d) => d.pollos));

  // ── Escala del carril de huevos ──
  // Entra el objetivo de incubación para que la línea punteada nunca quede
  // fuera del cuadro, aunque la producción esté muy por debajo.
  // La ventana se explica en dos lados (la tarjeta de huevos y el Gantt), así
  // que el texto se arma una sola vez. Sin esto el "en 131 días" queda como un
  // número sin origen, y en realidad es una decisión: dos ciclos de galpón.
  const v = parametros.ventana;
  const explicaVentana = v
    ? `Son ${v.proyectados} días: hoy más ${v.dias}. ` +
      `Esos ${v.dias} son ${v.ciclosGalpon} ciclos completos de galpón de engorde — ` +
      `${parametros.diasCrianza} días de crianza + ${parametros.diasVaciamiento} de saneamiento = ` +
      `${v.diasCicloGalpon} por ciclo. Con dos ciclos se ve el próximo hueco de faena y el siguiente.\n\n` +
      `El gráfico además muestra ${v.contextoPrevio} días antes de hoy para ver de dónde vienen las ` +
      `cintas de los galpones ocupados, pero esos días NO suman en los totales.` +
      (v.porDefecto ? "" : "\n\n⚠️ Ventana cambiada a mano: los totales no son comparables con el largo por defecto.")
    : "";

  const huevos = data.huevos;
  const paramHuevos = huevos?.parametros;
  const resumenHuevos = huevos?.resumen;
  const maxHuevos = huevos
    ? Math.max(
        paramHuevos.objetivoIncubablesDiario,
        ...huevos.dias.map((d) => Math.max(d.incubables, d.real?.incubables || 0))
      )
    : 0;

  // El punto del día va en el centro de su columna, no en el borde: así la
  // curva pasa por arriba del número del día en el encabezado.
  const xDia = (i) => i * ANCHO_DIA + ANCHO_DIA / 2;
  // El 38 de abajo es el margen superior: ahí va el número del día, escrito
  // arriba de la línea del total.
  const yHuevos = (v) =>
    ALTO_HUEVOS - 6 - (maxHuevos ? (v / maxHuevos) * (ALTO_HUEVOS - 38) : 0);

  // Los días en que el plantel no pone cortan la curva en vez de unirse con una
  // recta falsa: antes de la semana 24 y después de la 65 no hay dato, y un
  // trazo solo ataría los dos extremos.
  const tramosDe = (leerValor) => {
    const tramos = [];
    let actual = [];
    dias.forEach((d, i) => {
      const v = leerValor(d, i);
      if (v != null) actual.push({ x: xDia(i), y: yHuevos(v) });
      else if (actual.length) {
        tramos.push(actual);
        actual = [];
      }
    });
    if (actual.length) tramos.push(actual);
    return tramos.filter((tr) => tr.length > 1);
  };

  // Una curva por plantel: se colapsa la escalera semanal a un punto por semana
  // y se une con el spline monótono.
  const curvasDe = (serie) =>
    tramosDe((d) => serie.valores.get(d.clave)?.incubables ?? null).map((tr) =>
      caminoSuave(colapsarEscalones(tr))
    );

  // El total va DERECHO y día por día, a propósito: es el número operativo, el
  // que se lee para decidir cuántos huevos hay mañana. Suavizarlo escondería el
  // escalón del día en que un plantel cambia de semana, que es justo cuando la
  // producción cambia. Las curvas de los planteles explican la tendencia; esta
  // línea da el número.
  const tramosTotal = huevos
    ? tramosDe((d) => huevosPorClave.get(d.clave)?.incubables ?? null)
    : [];
  const areaTotal = tramosTotal.map((tr) => {
    const base = yHuevos(0);
    return (
      `M ${tr[0].x},${base} L ` +
      tr.map((pt) => `${pt.x},${pt.y}`).join(" L ") +
      ` L ${tr[tr.length - 1].x},${base} Z`
    );
  });

  // El número de cada día, para escribirlo arriba de la línea.
  const etiquetasTotal = huevos
    ? dias
        .map((d, i) => {
          const h = huevosPorClave.get(d.clave);
          if (!h || h.incubables <= 0) return null;
          return { clave: d.clave, x: xDia(i), y: yHuevos(h.incubables), valor: h.incubables };
        })
        .filter(Boolean)
    : [];

  // Lo recolectado de verdad, como puntos sobre la curva estimada.
  const puntosReales = huevos
    ? dias
        .map((d, i) => {
          const h = huevosPorClave.get(d.clave);
          return h?.real ? { clave: d.clave, cx: xDia(i), cy: yHuevos(h.real.incubables) } : null;
        })
        .filter(Boolean)
    : [];

  const kpis = [
    {
      t: "Objetivo",
      v: `${formatearNumero(parametros.objetivoDiario)}/día`,
      s: `${parametros.diasFaenaSemana.length} días por semana`,
      c: "",
    },
    {
      t: "Cobertura",
      v: `${Math.round((resumen.cobertura || 0) * 100)}%`,
      // Cuánto de la cobertura es proyección importa tanto como la cobertura:
      // 90% con la mitad sin nacer no es lo mismo que 90% asegurado.
      s: resumen.pollosProgramadosProyectados
        ? `${formatearNumero(resumen.pollosProgramadosReales)} reales + ${formatearNumero(
            resumen.pollosProgramadosProyectados
          )} proyectados`
        : `${formatearNumero(resumen.pollosProgramados)} de ${formatearNumero(resumen.objetivoTotal)}`,
      c:
        resumen.cobertura >= 0.95
          ? "text-success"
          : resumen.cobertura >= 0.7
          ? "text-warning"
          : "text-danger",
    },
    {
      t: "Días con hueco",
      v: formatearNumero(resumen.diasConHueco),
      s: `de ${formatearNumero(resumen.diasFaenaEnVentana)} días de faena`,
      c: resumen.diasConHueco > 0 ? "text-danger" : "text-success",
    },
    {
      // "Libres" decía una cosa y el subtítulo mostraba otra: la capacidad
      // INSTALADA total, ocupados incluidos. Ahora los dos números hablan de lo
      // mismo — cuántos galpones podés usar hoy y cuántos pollitos te entran en
      // ellos. El tooltip lista cuáles son.
      t: "Galpones disponibles",
      v: formatearNumero(resumen.galponesDisponiblesHoy),
      s: `${formatearNumero(resumen.capacidadDisponibleHoy)} pollitos entran hoy`,
      c: resumen.galponesDisponiblesHoy === 0 ? "text-danger" : "",
      titulo: resumen.detalleDisponiblesHoy?.length
        ? "Vacíos y en servicio hoy:\n" +
          resumen.detalleDisponiblesHoy
            .map((g) => `   ${g.etiqueta} · ${formatearNumero(g.capacidad)} pollitos`)
            .join("\n") +
          `\n─────────────\nCapacidad instalada total: ${formatearNumero(
            resumen.capacidadInstalada
          )} (todos los galpones en servicio, ocupados incluidos)`
        : "Ningún galpón vacío hoy. Los ocupados, los que están en saneamiento y " +
          "los que ya tienen una tanda asignada no cuentan.",
    },
    {
      t: "Pollitos sin galpón",
      v: formatearNumero(resumen.pollitosSinAsignar),
      s: "se venden o esperan destino",
      c: resumen.pollitosSinAsignar > 0 ? "text-warning" : "",
    },
  ];

  return (
    <>
      {/* ════ Huevos ════ */}
      {/*
        Pedido del cliente (2026-08-19): "día a día, según la cantidad de
        reproductoras, cuánto es lo que van a tener de huevos". Es la suma de
        todos los galpones de postura.

        Cada plantel aporta según la semana de vida en la que esté ESE día,
        siguiendo la curva de la planilla: arranca en la semana 24, pico entre
        la 30 y la 40, y después baja. Por eso la barra no es plana — va
        cayendo sola a medida que los planteles envejecen, y salta el día que
        un plantel nuevo entra a poner.
      */}
      {huevos && (
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-white py-2 d-flex flex-wrap align-items-center gap-2">
            <span className="fw-bold">
              <i className="bi bi-egg-fill me-1 text-warning"></i>Huevos
            </span>
            <span className="text-muted" style={{ fontSize: ".72rem" }}>
              suma de los galpones de postura · la incubadora pide{" "}
              {formatearNumero(paramHuevos.objetivoIncubablesDiario)} incubables por día
              ({paramHuevos.cargasPorSemana} cargas de{" "}
              {formatearNumero(paramHuevos.huevosPorCarga)})
            </span>
            <span
              className="ms-auto d-flex flex-wrap align-items-center gap-2"
              style={{ fontSize: ".68rem" }}
            >
              {seriesHuevos.map((serie) => (
                <span
                  key={serie._id}
                  title={`${serie.etiqueta} · ${formatearNumero(serie.hembras)} hembras`}
                >
                  <span
                    className="d-inline-block me-1"
                    style={{
                      width: 16,
                      height: 0,
                      borderTop: `2px solid ${serie.color}`,
                      verticalAlign: "middle",
                    }}
                  />
                  Plantel #{serie.numeroLote}
                </span>
              ))}
              <span className="text-success">
                <span
                  className="d-inline-block me-1"
                  style={{
                    width: 16,
                    height: 8,
                    background: "rgba(25,135,84,.15)",
                    borderTop: "4px solid #198754",
                    verticalAlign: "middle",
                  }}
                />
                total del día
              </span>
              {puntosReales.length > 0 && (
                <span>
                  <span
                    className="d-inline-block rounded-circle me-1"
                    style={{ width: 6, height: 6, background: "#212529", verticalAlign: "middle" }}
                  />
                  recolectado real
                </span>
              )}
            </span>
          </div>

          {/* Los números de la ventana. Van acá y no arriba porque la fila de
              KPIs de arriba habla de faena — mezclarlos haría leer "cobertura"
              como si fuera una sola cosa. */}
          <div className="row g-0 border-bottom">
            <div
              className="col-6 col-lg border-end p-3"
              title={
                "Todo lo incubable que van a poner los planteles en la ventana.\n" +
                "─────────────\n" +
                explicaVentana +
                "\n\nOjo: el total depende del largo de la ventana, así que no es una " +
                "cantidad con significado propio. El número comparable es el de por día."
              }
            >
              <div className="text-muted" style={{ fontSize: ".72rem" }}>
                Huevos incubables
              </div>
              <div className="h5 fw-bold mb-0">
                {formatearNumero(resumenHuevos.huevosIncubables)}
              </div>
              <div className="text-muted" style={{ fontSize: ".68rem" }}>
                en {resumenHuevos.diasProyectados} días ·{" "}
                {formatearNumero(resumenHuevos.promedioDiarioIncubables)} por día
              </div>
              {v && (
                <div className="text-muted" style={{ fontSize: ".62rem" }}>
                  <i className="bi bi-info-circle me-1"></i>
                  {v.ciclosGalpon} ciclos de galpón ({v.diasCicloGalpon} días c/u)
                </div>
              )}
            </div>
            <div className="col-6 col-lg border-end p-3">
              <div className="text-muted" style={{ fontSize: ".72rem" }}>
                Llenado de incubadora
              </div>
              <div
                className={`h5 fw-bold mb-0 ${
                  resumenHuevos.coberturaIncubadora >= 0.95
                    ? "text-success"
                    : resumenHuevos.coberturaIncubadora >= 0.7
                    ? "text-warning"
                    : "text-danger"
                }`}
              >
                {Math.round((resumenHuevos.coberturaIncubadora || 0) * 100)}%
              </div>
              <div className="text-muted" style={{ fontSize: ".68rem" }}>
                de {formatearNumero(paramHuevos.objetivoIncubablesDiario)} por día
              </div>
            </div>
            <div className="col-6 col-lg border-end p-3">
              <div className="text-muted" style={{ fontSize: ".72rem" }}>
                Planteles poniendo
              </div>
              <div
                className={`h5 fw-bold mb-0 ${
                  resumenHuevos.plantelesAportando === 0 ? "text-danger" : ""
                }`}
              >
                {formatearNumero(resumenHuevos.plantelesAportando)}
              </div>
              <div className="text-muted" style={{ fontSize: ".68rem" }}>
                en algún día de la ventana
              </div>
            </div>
            <div
              className="col-6 col-lg p-3"
              title={
                "Cuánto cae la producción entre el mejor y el peor día de la ventana. " +
                "Una caída grande es un plantel que se termina sin otro que lo reemplace."
              }
            >
              <div className="text-muted" style={{ fontSize: ".72rem" }}>
                Pico → valle
              </div>
              <div className="h5 fw-bold mb-0">
                {formatearNumero(resumenHuevos.pico?.incubables)} →{" "}
                {formatearNumero(resumenHuevos.valle?.incubables)}
              </div>
              <div className="text-muted" style={{ fontSize: ".68rem" }}>
                {resumenHuevos.valle ? etiquetaLarga(resumenHuevos.valle.clave) : "—"} es el más bajo
              </div>
            </div>
          </div>

          <div className="card-body p-0">
            <div
              ref={refHuevos}
              onScroll={alScrollearHuevos}
              style={{ overflowX: "auto", overflowY: "hidden" }}
            >
              <div className="position-relative" style={{ width: anchoTotal, minWidth: "100%" }}>
                <CapaDias
                  dias={dias}
                  indices={indices}
                  hoyClave={parametros.hoyClave}
                  alto={ALTO_ENCABEZADO + ALTO_HUEVOS}
                />
                <div className="position-relative" style={{ zIndex: 2 }}>
                  <Encabezado dias={dias} />
                  <div className="d-flex align-items-end" style={{ height: ALTO_HUEVOS }}>
                    <Etiqueta
                      alto={ALTO_HUEVOS}
                      className="d-flex flex-column justify-content-center text-muted"
                    >
                      <div style={{ fontSize: ".68rem" }}>Incubables/día</div>
                      <div style={{ fontSize: ".6rem" }}>
                        incubadora {formatearNumero(paramHuevos.objetivoIncubablesDiario)}
                      </div>
                      <div style={{ fontSize: ".58rem" }} className="text-muted">
                        máx {formatearNumero(maxHuevos)}
                      </div>
                    </Etiqueta>
                    <div
                      className="position-relative"
                      style={{
                        width: totalDias * ANCHO_DIA,
                        flex: "0 0 auto",
                        height: ALTO_HUEVOS,
                      }}
                    >
                      {/*
                        Gráfico de curvas, una por plantel.

                        Con barras apiladas se leía el total pero no la FORMA:
                        una gallina no pone parejo — sube hasta el pico (semanas
                        30-40) y después cae parejo hasta el final del ciclo. Esa
                        curva es la que deja ver que un plantel se está apagando
                        meses antes de que falte el huevo.

                        Se grafican los INCUBABLES, que son los que compiten
                        contra la cadencia de la incubadora (la línea roja). El
                        descarte va en el tooltip.
                      */}
                      <svg
                        width={totalDias * ANCHO_DIA}
                        height={ALTO_HUEVOS}
                        style={{ position: "absolute", inset: 0 }}
                      >
                        {/* Cadencia de la incubadora */}
                        <line
                          x1={0}
                          x2={totalDias * ANCHO_DIA}
                          y1={yHuevos(paramHuevos.objetivoIncubablesDiario)}
                          y2={yHuevos(paramHuevos.objetivoIncubablesDiario)}
                          stroke="#dc3545"
                          strokeWidth="1"
                          strokeDasharray="4 3"
                        />

                        {/* Suma de todos los planteles: área + línea recta */}
                        {areaTotal.map((d, i) => (
                          <path key={`area-${i}`} d={d} fill="rgba(25,135,84,.13)" />
                        ))}
                        {tramosTotal.map((tr, i) => (
                          <polyline
                            key={`total-${i}`}
                            points={tr.map((pt) => `${pt.x},${pt.y}`).join(" ")}
                            fill="none"
                            stroke="#198754"
                            strokeWidth="4"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        ))}

                        {/* Una curva por plantel, por encima del total */}
                        {seriesHuevos.map((serie) =>
                          curvasDe(serie).map((d, i) => (
                            <path
                              key={`${serie._id}-${i}`}
                              d={d}
                              fill="none"
                              stroke={serie.color}
                              strokeWidth="1.75"
                              strokeLinejoin="round"
                              strokeLinecap="round"
                            />
                          ))
                        )}

                        {/* El número del día, arriba de la línea del total. El
                            contorno blanco (paintOrder) lo despega de la curva y
                            del área para que se lea siempre. */}
                        {etiquetasTotal.map((et) => (
                          <text
                            key={`n-${et.clave}`}
                            x={et.x}
                            y={et.y - 7}
                            textAnchor="middle"
                            fontSize="9.5"
                            fontWeight="600"
                            fill="#146c43"
                            stroke="#fff"
                            strokeWidth="3"
                            paintOrder="stroke"
                          >
                            {formatearNumero(et.valor)}
                          </text>
                        ))}

                        {/* Lo recolectado de verdad, contra la curva estimada */}
                        {puntosReales.map((pt) => (
                          <circle key={pt.clave} cx={pt.cx} cy={pt.cy} r="2.5" fill="#212529" />
                        ))}
                      </svg>

                      {/* Zonas transparentes de hover: el SVG no da tooltip por
                          día, así que la columna invisible de cada día es la que
                          lleva el detalle. */}
                      {dias.map((d, i) => {
                        const h = huevosPorClave.get(d.clave);
                        if (!h) return null;

                        const detalle = (h.porPlantel || [])
                          .map(
                            (pl) =>
                              `   Plantel #${pl.numeroLote} · ${pl.etiqueta} · semana ${
                                pl.semanaVida
                              } · ${formatearNumero(pl.hembras)} hembras → ${formatearNumero(
                                pl.incubables
                              )} incubables` + (pl.enRecriaHoy ? " (hoy sigue en recría)" : "")
                          )
                          .join("\n");

                        return (
                          <div
                            key={d.clave}
                            className="position-absolute"
                            style={{
                              left: i * ANCHO_DIA,
                              top: 0,
                              width: ANCHO_DIA,
                              height: ALTO_HUEVOS,
                            }}
                            title={
                              `${etiquetaLarga(d.clave)}\n` +
                              `${formatearNumero(h.incubables)} incubables · ${formatearNumero(
                                h.descarte
                              )} de descarte · ${formatearNumero(h.totales)} en total` +
                              (h.deficitIncubables > 0
                                ? `\nFaltan ${formatearNumero(
                                    h.deficitIncubables
                                  )} para llenar la incubadora`
                                : "\nAlcanza para llenar la incubadora") +
                              (detalle
                                ? `\n─────────────\nDe qué plantel salen:\n${detalle}`
                                : "\nNingún plantel poniendo") +
                              (h.real
                                ? `\n─────────────\nRecolectado real: ${formatearNumero(
                                    h.real.totales
                                  )} (${h.real.desvio >= 0 ? "+" : ""}${formatearNumero(
                                    h.real.desvio
                                  )} vs proyectado)`
                                : "")
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="card-footer bg-white py-2 d-flex flex-wrap gap-3"
            style={{ fontSize: ".7rem" }}
          >
            <span className="text-muted">
              <i className="bi bi-info-circle me-1"></i>
              Curva de la planilla del cliente: {paramHuevos.huevosVidaIncubables} huevos
              incubables por gallina en las {paramHuevos.semanasCicloVida} semanas de vida.
              Empieza a poner en la semana {paramHuevos.semanaInicioPostura}, es fértil desde la{" "}
              {paramHuevos.semanaInicioFertilidad} y hace pico entre la{" "}
              {paramHuevos.semanaPicoDesde} y la {paramHuevos.semanaPicoHasta}.
            </span>
            <span className="text-muted">
              <i className="bi bi-graph-down me-1"></i>
              Las curvas son <strong>incubables</strong>. Sumando el descarte, el total de la
              ventana es {formatearNumero(resumenHuevos.huevosTotales)} huevos —{" "}
              {formatearNumero(resumenHuevos.huevosDescarte)} de descarte que van a venta.
            </span>
            <span className="text-warning-emphasis">
              <i className="bi bi-exclamation-triangle me-1"></i>
              No descuenta la mortandad que todavía va a pasar: usa las hembras vivas de hoy.
            </span>
            {resumenHuevos.contraste && (
              <span
                className={
                  Math.abs(resumenHuevos.contraste.desvioPorcentual || 0) > 15
                    ? "text-danger"
                    : "text-muted"
                }
                title={
                  `Real ${formatearNumero(resumenHuevos.contraste.real)} vs proyectado ` +
                  `${formatearNumero(resumenHuevos.contraste.proyectado)} en ` +
                  `${resumenHuevos.contraste.dias} días con recolección cargada`
                }
              >
                <i className="bi bi-check2-square me-1"></i>
                Contra lo recolectado en los últimos días: {resumenHuevos.contraste.desvioPorcentual >= 0 ? "+" : ""}
                {resumenHuevos.contraste.desvioPorcentual}%
              </span>
            )}
          </div>
        </div>
      )}
      {/* ════ Resumen ════ */}
      <div className="card shadow-sm mb-3">
        <div className="row g-0">
          {kpis.map((k) => (
            <div key={k.t} className="col-6 col-lg border-end p-3" title={k.titulo || undefined}>
              <div className="text-muted" style={{ fontSize: ".72rem" }}>
                {k.t}
              </div>
              <div className={`h5 fw-bold mb-0 ${k.c}`}>{k.v}</div>
              <div className="text-muted" style={{ fontSize: ".68rem" }}>
                {k.s}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════ Faena ════ */}
      <div className="card shadow-sm mb-3">
        <div className="card-header bg-white py-2 d-flex flex-wrap align-items-center gap-2">
          <span className="fw-bold">
            <i className="bi bi-bar-chart-fill me-1 text-primary"></i>Faena
          </span>
          <span className="text-muted" style={{ fontSize: ".72rem" }}>
            objetivo {formatearNumero(parametros.objetivoDiario)} pollos por día ·{" "}
            {parametros.diasFaenaSemana.length} días por semana
          </span>
          <span className="ms-auto d-flex flex-wrap gap-2" style={{ fontSize: ".68rem" }}>
            <span>
              <span
                className="d-inline-block me-1"
                style={{ width: 14, height: 10, background: "#0d6efd" }}
              />
              stock real
            </span>
            <span>
              <span
                className="d-inline-block me-1"
                style={{
                  width: 14,
                  height: 10,
                  background: "#cfe8fb",
                  border: "1px dashed #0d6efd",
                }}
              />
              proyectado (sin nacer)
            </span>
            <span>
              <span
                className="d-inline-block rounded-1 me-1"
                style={{ width: 14, height: 10, background: "#f1f3f5" }}
              />
              planta cerrada · <span style={{ color: "#997404" }}>★</span> feriado
            </span>
          </span>
        </div>
        <div className="card-body p-0">
          <div
            ref={refFaena}
            onScroll={alScrollearFaena}
            style={{ overflowX: "auto", overflowY: "hidden" }}
          >
            <div className="position-relative" style={{ width: anchoTotal, minWidth: "100%" }}>
              <CapaDias
                dias={dias}
                indices={indices}
                hoyClave={parametros.hoyClave}
                alto={altoFaena}
              />
              <div className="position-relative" style={{ zIndex: 2 }}>
                <Encabezado dias={dias} />
                <div className="d-flex align-items-end" style={{ height: ALTO_FAENA }}>
                  <Etiqueta
                    alto={ALTO_FAENA}
                    className="d-flex flex-column justify-content-center text-muted"
                  >
                    <div style={{ fontSize: ".68rem" }}>Pollos/día</div>
                    <div style={{ fontSize: ".6rem" }}>
                      objetivo {formatearNumero(parametros.objetivoDiario)}
                    </div>
                  </Etiqueta>
                  <div
                    className="position-relative"
                    style={{ width: totalDias * ANCHO_DIA, flex: "0 0 auto", height: ALTO_FAENA }}
                  >
                    <div
                      className="position-absolute w-100"
                      style={{
                        bottom: (parametros.objetivoDiario / maxPollos) * 62,
                        borderTop: "1px dashed #dc3545",
                        zIndex: 2,
                      }}
                    />
                    {dias.map((d, i) => {
                      // La barra se apila: abajo el stock real (sólido) y arriba
                      // lo proyectado (celeste punteado). Así se ve de un vistazo
                      // qué parte del día está asegurada y qué parte depende de
                      // que nazcan pollitos que todavía no existen.
                      const altoReal = maxPollos ? (d.pollosReales / maxPollos) * 62 : 0;
                      const altoProy = maxPollos ? (d.pollosProyectados / maxPollos) * 62 : 0;

                      // De qué galpón sale cada pollo del día. "4.000" solo no
                      // alcanza para ir a buscarlos: hay que saber que 2.500
                      // son de C3 y 1.500 de P1.
                      const detalleGalpones = (d.porGalpon || [])
                        .map(
                          (g) =>
                            `   ${g.etiqueta || "s/galpón"} · ${formatearNumero(g.pollos)} pollos` +
                            (g.origen === "proyectado" ? " (proyectado)" : "")
                        )
                        .join("\n");

                      return (
                        <div
                          key={d.clave}
                          className="position-absolute"
                          style={{
                            left: i * ANCHO_DIA,
                            bottom: 0,
                            width: ANCHO_DIA,
                            height: ALTO_FAENA - 8,
                          }}
                          title={
                            !d.esFaena
                              ? `${etiquetaLarga(d.clave)} · planta cerrada (${
                                  d.cerradoPor === "feriado" ? d.feriado : "descanso"
                                })`
                              : `${etiquetaLarga(d.clave)}\n${formatearNumero(d.pollos)} de ` +
                                `${formatearNumero(d.objetivo)} pollos` +
                                (d.deficit > 0
                                  ? ` · faltan ${formatearNumero(d.deficit)}`
                                  : " · completo") +
                                (detalleGalpones
                                  ? `\n─────────────\nDe qué galpón salen:\n${detalleGalpones}`
                                  : `\nNingún galpón sale este día`) +
                                (d.pollosProyectados > 0
                                  ? `\n─────────────\n${formatearNumero(
                                      d.pollosReales
                                    )} de stock real · ${formatearNumero(
                                      d.pollosProyectados
                                    )} proyectados (reservas sin nacer)`
                                  : "")
                          }
                        >
                          {d.esFaena && d.pollosReales > 0 && (
                            <div
                              className="position-absolute"
                              style={{
                                left: 3,
                                right: 3,
                                bottom: 0,
                                height: Math.max(altoReal, 2),
                                background: "#0d6efd",
                              }}
                            />
                          )}
                          {d.esFaena && d.pollosProyectados > 0 && (
                            <div
                              className="position-absolute rounded-top"
                              style={{
                                left: 3,
                                right: 3,
                                bottom: altoReal,
                                height: Math.max(altoProy, 2),
                                background: "#cfe8fb",
                                border: "1px dashed #0d6efd",
                                borderBottom: d.pollosReales > 0 ? "none" : "1px dashed #0d6efd",
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════ Galpones ════ */}
      <div className="card shadow-sm">
        <div className="card-header bg-white py-2">
          <span className="fw-bold">
            <i className="bi bi-grid-3x3-gap me-1 text-success"></i>Galpones de engorde
          </span>
          <span className="text-muted ms-2" style={{ fontSize: ".72rem" }}>
            crianza {parametros.diasCrianza} días → saneamiento {parametros.diasVaciamiento} días
          </span>
          {/* La explicación de la ventana vive al lado del título de la página:
              acá abajo repetirla sería ruido. El detalle completo sigue en el
              tooltip del KPI de huevos. */}
        </div>
        <div className="card-body p-0">
          <div
            ref={refGalpones}
            onScroll={alScrollearGalpones}
            style={{ overflowX: "auto", overflowY: "hidden" }}
          >
            <div className="position-relative" style={{ width: anchoTotal, minWidth: "100%" }}>
              <CapaDias
                dias={dias}
                indices={indices}
                hoyClave={parametros.hoyClave}
                alto={altoGalpones}
              />
              <div className="position-relative" style={{ zIndex: 2 }}>
                <Encabezado dias={dias} />

                {/* ── Nacimientos ── */}
                <div className="d-flex align-items-start" style={{ height: altoNacimientos }}>
                  <Etiqueta alto={altoNacimientos} className="d-flex align-items-center text-muted">
                    {/* Flex en vez de texto suelto: los íconos de Bootstrap traen
                        vertical-align:-.125em, así que el huevo caía por debajo de la
                        línea del texto. Con align-items-center los dos quedan a la
                        misma altura y el bloque centrado en el carril. */}
                    <span
                      className="d-inline-flex align-items-center"
                      // El carril mide 10+N*25 pero las pastillas van de y=5 a
                      // y=5+N*25-3, o sea 1,5px más arriba del centro del contenedor.
                      // Los 3px de abajo compensan eso y la etiqueta queda a la
                      // altura exacta de la pastilla, con uno o con varios carriles.
                      style={{ fontSize: ".68rem", lineHeight: 1, marginBottom: 3 }}
                      title="Fecha en que nace cada tanda que está en incubación. El número de la pastilla es lo que todavía no tiene destino: pasá el mouse por encima para el detalle."
                    >
                      <i className="bi bi-egg-fill me-1"></i>Nacimientos
                    </span>
                  </Etiqueta>
                  <div
                    className="position-relative"
                    style={{
                      width: totalDias * ANCHO_DIA,
                      flex: "0 0 auto",
                      height: altoNacimientos,
                    }}
                  >
                    {carrilesNacimientos.ubicados.map(({ n, izq, carril }) => {
                      // Lo que importa acá es lo que FALTA decidir, no el total:
                      // el total no se mueve nunca y no dice si terminaste. El
                      // relleno verde muestra cuánto ya tiene destino.
                      const listo = n.sinAsignar === 0;
                      const avance = n.pollitos
                        ? Math.min(100, Math.round((n.conDestino / n.pollitos) * 100))
                        : 0;

                      return (
                        <div
                          key={n._id}
                          className="position-absolute rounded-pill text-center fw-semibold overflow-hidden"
                          style={{
                            left: izq + INSET_PILL,
                            top: 5 + carril * (ALTO_PILL + 3),
                            height: ALTO_PILL,
                            lineHeight: `${ALTO_PILL}px`,
                            width: ANCHO_PILL - INSET_PILL * 2,
                            fontSize: ".62rem",
                            paddingInline: 3,
                            // Relleno proporcional a lo ya asignado: la pastilla
                            // se "llena" de verde a medida que repartís la tanda.
                            background: n.sobreasignado
                              ? "#dc3545"
                              : `linear-gradient(90deg,#198754 0 ${avance}%,#ffc107 ${avance}% 100%)`,
                            color: listo || n.sobreasignado ? "#fff" : "#212529",
                            border: "1px solid rgba(0,0,0,.15)",
                          }}
                          title={
                            `Tanda ${n.numeroTanda} · nace ${etiquetaLarga(n.fechaClave)}\n` +
                            `${formatearNumero(n.pollitos)} pollitos ${
                              n.nacio ? "(real)" : "(estimado 80%)"
                            }\n` +
                            `─────────────\n` +
                            `A galpón:        ${formatearNumero(n.asignadoAGalpon)}\n` +
                            (n.asignadoAGranjaSinGalpon
                              ? `A granja s/galpón: ${formatearNumero(n.asignadoAGranjaSinGalpon)}\n`
                              : "") +
                            (n.asignadoAClientes
                              ? `A clientes:      ${formatearNumero(n.asignadoAClientes)}\n`
                              : "") +
                            (n.sobreasignado
                              ? `⚠ SOBREASIGNADO en ${formatearNumero(n.sobreasignado)}`
                              : `FALTA DECIDIR:   ${formatearNumero(n.sinAsignar)}`)
                          }
                        >
                          {/* En un día entra un solo número, así que va el que
                              se mueve: lo que falta decidir. El total lo tapaba
                              y encima nunca cambia — está en el tooltip. El
                              relleno verde ya cuenta cuánto se repartió. */}
                          {n.sobreasignado
                            ? `+${formatearNumero(n.sobreasignado)}`
                            : listo
                            ? "✓"
                            : formatearNumero(n.sinAsignar)}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Filas ── */}
                {grupos.map(([granja, gs]) => (
                  <div key={granja}>
                    <div
                      className="position-sticky bg-light fw-semibold text-uppercase text-muted px-2"
                      style={{
                        left: 0,
                        width: ANCHO_LABEL,
                        zIndex: 3,
                        fontSize: ".62rem",
                        lineHeight: "22px",
                        height: 22,
                      }}
                    >
                      {labelGranja(granja)}
                    </div>
                    {gs.map((g) => (
                      <FilaGalpon
                        key={g.etiqueta}
                        galpon={g}
                        indices={indices}
                        totalDias={totalDias}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div
          className="border-top px-3 py-2 d-flex flex-wrap gap-3 align-items-center"
          style={{ fontSize: ".68rem" }}
        >
          <span className="text-muted fw-semibold">Referencias:</span>
          <span>
            <span
              className="d-inline-block rounded-1 me-1"
              style={{ width: 14, height: 10, background: "#198754" }}
            />
            crianza (lote real)
          </span>
          <span>
            <span
              className="d-inline-block rounded-1 me-1"
              style={{
                width: 14,
                height: 10,
                background: "rgba(25,135,84,.18)",
                border: "1px dashed #198754",
              }}
            />
            crianza proyectada
          </span>
          <span>
            <span
              className="d-inline-block rounded-1 me-1"
              style={{
                width: 14,
                height: 10,
                background:
                  "repeating-linear-gradient(45deg,#ffe08a,#ffe08a 3px,#fff3cd 3px,#fff3cd 6px)",
              }}
            />
            saneamiento ({parametros.diasVaciamiento} días)
          </span>
          <span>
            <span
              className="d-inline-block rounded-1 me-1"
              style={{
                width: 14,
                height: 10,
                background:
                  "repeating-linear-gradient(45deg,#f1aeb5,#f1aeb5 3px,#f8d7da 3px,#f8d7da 6px)",
              }}
            />
            excede tiempo (se pasó del ciclo)
          </span>
          <span>
            <span
              className="d-inline-block rounded-pill me-1"
              style={{
                width: 22,
                height: 10,
                background: "linear-gradient(90deg,#198754 0 55%,#ffc107 55% 100%)",
              }}
            />
            nacimientos: el número es lo que falta decidir · verde = ya tiene destino
          </span>
          <span className="text-muted">
            Cada barra muestra la cantidad de pollitos y el peso promedio del último pesaje
            cargado.
          </span>
        </div>
      </div>

    </>
  );
};

export default Almanaque;
