import React, { useMemo } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, LabelList,
} from "recharts";
import { formatearFechaLocal } from "../utils/dateUtils";
import { formatearNumero } from "../utils/reproductoresUtils";

// Estado de los galpones de engorde. Vive en components porque lo usan dos
// pantallas: Proyección y Pollitos por Nacer, donde hace falta para decidir a
// qué galpón mandar los pollitos que están por nacer.

// dd/mm sin año
const fechaCorta = (f) =>
  new Date(f).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

// ── Paleta del gráfico ──────────────────────────────────────────────────────
// Slots categóricos 1 y 2 para los dos lados del cero (ocupado / vacío).
// Validados contra la superficie blanca de las tarjetas: separación CVD ΔE 24,7
// (mínimo 8) y contraste ≥ 3:1.
// El rojo de estado va SIEMPRE con ícono y texto, nunca color solo.
const VIZ = {
  serie1:    "#2a78d6", // galpón ocupado
  serie2:    "#eb6834", // galpón vacío (reposo)
  critico:   "#d03b3b", // estado: galpón pasado del ciclo
  grilla:    "#e1e0d9",
  eje:       "#c3c2b7",
  texto:     "#52514e",
  tenue:     "#898781",
};

// ── Gráfico: estado de cada galpón de engorde ───────────────────────────────
// Barras divergentes desde el cero. A la derecha los ocupados, con el día de
// vida del lote contra la línea de los 50 días. A la izquierda los vacíos, con
// los días que llevan de reposo. El cero separa las dos lecturas: nunca hay que
// interpretar una barra sin saber de qué lado está.
// El rojo de estado va SIEMPRE con ícono y la palabra "atrasado", nunca solo.
// La etiqueta va del lado de afuera de la barra: los ocupados a la derecha, los
// vacíos a la izquierda. Se calcula contra los extremos reales del rect en vez
// de confiar en `position`, que recharts invierte cuando el valor es negativo.
const EtiquetaBarra = ({ x, y, width, height, value, index, datos }) => {
  if (!value) return null;
  const haciaIzquierda = !datos[index]?.ocupado;
  const extremo = haciaIzquierda ? Math.min(x, x + width) : Math.max(x, x + width);
  return (
    <text
      x={haciaIzquierda ? extremo - 6 : extremo + 6}
      y={y + height / 2}
      dy={4}
      textAnchor={haciaIzquierda ? "end" : "start"}
      style={{ fontSize: 11, fill: VIZ.texto }}
    >
      {value}
    </text>
  );
};

// Los ticks del eje se arman a mano: los automáticos de recharts sobre un
// dominio asimétrico no caen en números redondos y se saltean el cero, que acá
// es justamente la referencia que separa ocupado de vacío.
const ticksEje = (maxReposo, maxCiclo, paso = 20) => {
  const ticks = [0];
  for (let v = paso; v <= maxCiclo; v += paso) ticks.push(v);
  for (let v = paso; v <= maxReposo; v += paso) ticks.unshift(-v);
  return ticks;
};

const TooltipGalpones = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border rounded shadow-sm px-3 py-2 small">
      <div className="fw-semibold mb-1">{d.etiqueta}</div>
      {d.fueraDeServicio ? (
        <div style={{ color: VIZ.texto }}>Fuera de servicio</div>
      ) : d.ocupado ? (
        <>
          <div style={{ color: VIZ.texto }}>
            Lote #{d.numeroLote} · día {d.dias} de {d.diasCrianza}
          </div>
          <div style={{ color: VIZ.texto }}>
            {d.atrasado
              ? `Pasado del ciclo por ${d.dias - d.diasCrianza} día(s)`
              : `Faltan ${d.diasCrianza - d.dias} día(s) para vaciarlo`}
          </div>
          <div style={{ color: VIZ.tenue }}>{formatearNumero(d.pollos)} pollos</div>
        </>
      ) : (
        <>
          <div style={{ color: VIZ.texto }}>
            Vacío hace {d.diasReposo} día{d.diasReposo === 1 ? "" : "s"}
          </div>
          <div style={{ color: VIZ.tenue }}>
            {d.fechaVaciado
              ? `Se vació el ${formatearFechaLocal(d.fechaVaciado)}${d.fechaVaciadoEstimada ? " (estimada)" : ""}`
              : "Sin registro de vaciado"}
          </div>
          {d.ultimoLote && <div style={{ color: VIZ.tenue }}>Último lote #{d.ultimoLote}</div>}
        </>
      )}
    </div>
  );
};

const GraficoGalpones = ({ datos, diasCrianza, compacto = false }) => {
  // En compacto las filas van más juntas: el gráfico acompaña a otra cosa y no
  // puede comerse la pantalla.
  const altoFila = compacto ? 22 : 34;
  const anchoBarra = compacto ? 12 : 20;
  // Cada lado se escala con su propio máximo, con aire para que la etiqueta de
  // la barra más larga entre en una sola línea.
  const maxCiclo = Math.max(diasCrianza + 10, ...datos.map((d) => d.valor));
  // A la izquierda el dominio lleva aire extra: la etiqueta de reposo se dibuja
  // para afuera de la barra, y si la más larga llegara al borde del área se
  // montaría sobre los nombres del eje. Agrandar el margen no alcanza, porque
  // corre el eje junto con el gráfico.
  const topeReposo = Math.max(10, ...datos.map((d) => -d.valor));
  const maxReposo = Math.ceil((topeReposo * 1.35) / 10) * 10;

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <h6 className="fw-bold mb-1">Estado de cada galpón</h6>
        <p className="text-muted small mb-3">
          A la derecha del cero, los ocupados: día de vida del lote contra los {diasCrianza} días de
          crianza. En rojo <i className="bi bi-exclamation-triangle-fill"></i>, los que ya se
          pasaron. A la izquierda, los vacíos y los días de reposo que llevan.
        </p>
        <ResponsiveContainer
          width="100%"
          height={Math.max(compacto ? 180 : 220, datos.length * altoFila + 56)}
        >
          <BarChart
            data={datos}
            layout="vertical"
            margin={{ top: 20, right: 96, left: 8, bottom: 0 }}
          >
            <CartesianGrid stroke={VIZ.grilla} strokeWidth={1} horizontal={false} />
            <XAxis
              type="number"
              domain={[-maxReposo, maxCiclo]}
              ticks={ticksEje(maxReposo, maxCiclo)}
              tick={{ fontSize: 11, fill: VIZ.tenue }}
              axisLine={{ stroke: VIZ.eje }}
              tickLine={false}
              tickFormatter={(v) => String(Math.abs(v))}
            />
            <YAxis
              type="category"
              dataKey="etiqueta"
              width={54}
              tick={{ fontSize: 11, fill: VIZ.tenue }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<TooltipGalpones />} cursor={{ fill: "rgba(11,11,11,0.04)" }} />
            {/* El cero es el eje que separa ocupado de vacío. */}
            <ReferenceLine x={0} stroke={VIZ.eje} strokeWidth={1} />
            <ReferenceLine
              x={diasCrianza}
              stroke={VIZ.critico}
              strokeWidth={1}
              label={{ value: `${diasCrianza} d`, position: "top", fontSize: 11, fill: VIZ.texto }}
            />
            {/* Sin animación de entrada: es un tablero de consulta, la barra
                tiene que estar legible apenas abre. */}
            <Bar dataKey="valor" name="Días" maxBarSize={anchoBarra} isAnimationActive={false}>
              {datos.map((d) => (
                <Cell
                  key={d.etiqueta}
                  fill={d.atrasado ? VIZ.critico : d.ocupado ? VIZ.serie1 : VIZ.serie2}
                  fillOpacity={d.ocupado ? 1 : 0.55}
                />
              ))}
              {/* `position` no sirve acá: recharts lo invierte en las barras
                  negativas y todas las etiquetas terminan pegadas al cero. Se
                  posiciona a mano contra el extremo libre de cada barra. */}
              <LabelList
                dataKey="etiquetaValor"
                content={(props) => <EtiquetaBarra {...props} datos={datos} />}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="d-flex flex-wrap gap-3 small mt-2" style={{ color: VIZ.texto }}>
          <span className="d-flex align-items-center gap-1">
            <span style={{ width: 10, height: 10, borderRadius: 2, background: VIZ.serie1 }}></span>
            Ocupado
          </span>
          <span className="d-flex align-items-center gap-1">
            <span
              style={{ width: 10, height: 10, borderRadius: 2, background: VIZ.serie2, opacity: 0.55 }}
            ></span>
            Vacío (reposo)
          </span>
          <span className="d-flex align-items-center gap-1">
            <span style={{ width: 10, height: 10, borderRadius: 2, background: VIZ.critico }}></span>
            <i className="bi bi-exclamation-triangle-fill"></i> Pasado del ciclo
          </span>
        </div>
      </div>
    </div>
  );
};
// Arma los datos del gráfico a partir de los galpones que devuelve /proyeccion.
// El valor es la magnitud con signo: positivo = días de ciclo del lote, negativo
// = días de reposo. Ordenados de mayor a menor, así los que están por vaciarse
// quedan arriba y los que llevan más reposo abajo.
const datosDeGalpones = (galpones, diasCrianza) =>
  (galpones || [])
    .map((g) => {
      if (g.fueraDeServicio) {
        return {
          etiqueta: g.etiqueta,
          valor: 0,
          ocupado: false,
          fueraDeServicio: true,
          etiquetaValor: "fuera de servicio",
        };
      }
      if (g.ocupado) {
        return {
          etiqueta: g.etiqueta,
          valor: g.lote.dias,
          dias: g.lote.dias,
          diasCrianza,
          ocupado: true,
          atrasado: g.atrasado,
          numeroLote: g.lote.numeroLote,
          pollos: g.lote.cantidadActual,
          etiquetaValor: g.atrasado
            ? `día ${g.lote.dias} ⚠`
            : `día ${g.lote.dias} · faltan ${diasCrianza - g.lote.dias}`,
        };
      }
      // Vacío: la barra va hacia la izquierda. Sin fecha de vaciado no hay
      // reposo que contar, así que queda en cero y se dice explícitamente.
      const reposo = g.diasReposo ?? 0;
      return {
        etiqueta: g.etiqueta,
        valor: -reposo,
        ocupado: false,
        fueraDeServicio: false,
        diasReposo: reposo,
        fechaVaciado: g.fechaVaciado,
        fechaVaciadoEstimada: g.fechaVaciadoEstimada,
        ultimoLote: g.ultimoLote,
        etiquetaValor: g.fechaVaciado
          ? `${reposo} d · ${fechaCorta(g.fechaVaciado)}`
          : "sin registro",
      };
    })
    .sort((a, b) => b.valor - a.valor);

// Recibe los galpones crudos de /proyeccion y arma los datos del gráfico.
const PanelGalpones = ({ galpones, diasCrianza = 50, compacto = false }) => {
  const datos = useMemo(() => datosDeGalpones(galpones, diasCrianza), [galpones, diasCrianza]);
  if (datos.length === 0) return null;
  return <GraficoGalpones datos={datos} diasCrianza={diasCrianza} compacto={compacto} />;
};

export default PanelGalpones;
