import React from "react";

/**
 * Comparativa de peso de los planteles reproductores contra la tabla de la línea
 * genética (Arbor Acres Max), debajo de los galpones.
 *
 * Mismo diseño que la "Comparativa de crecimiento por galpón" de Granja
 * (`GranjaLotesPage`): una columna por semana con el peso de tabla en el
 * encabezado, y cada pesaje pintado según cuánto se aleja de la tabla. La
 * diferencia es que acá hay DOS sexos por galpón, con tablas distintas, así que
 * cada plantel ocupa dos filas: hembras y machos.
 *
 * La tabla viene del back (`constantes.pesoObjetivo`, índice 0 = semana 1); no
 * se copia acá para que viva en un solo lugar.
 */

// Tolerancia respecto de la tabla — la misma que Granja: ±5% en rango, hasta
// ±10% aviso, más es alerta.
const TOL_OK    = 0.05;
const TOL_AVISO = 0.10;

const nivelPeso = (peso, objetivo) => {
  if (peso == null || objetivo == null) return null;
  const dif = Math.abs(peso - objetivo) / objetivo;
  if (dif <= TOL_OK)    return "ok";
  if (dif <= TOL_AVISO) return "aviso";
  return "alerta";
};

const clsPeso = (peso, objetivo) => {
  const n = nivelPeso(peso, objetivo);
  if (n === "ok")     return "text-success fw-bold";
  if (n === "aviso")  return "text-warning fw-bold";
  if (n === "alerta") return "text-danger fw-bold";
  return "fw-bold text-primary"; // sin referencia (semana fuera de la tabla)
};

const formatPeso = (g) => {
  if (g == null) return "-";
  return g >= 1000 ? `${(g / 1000).toFixed(3).replace(".", ",")} kg` : `${g} g`;
};

const fmtG = (n) => new Intl.NumberFormat("es-AR").format(n);

const SEXOS = [
  { key: "hembra", label: "Hembras" },
  { key: "macho",  label: "Machos" },
];

// El pesaje de un sexo en una semana. Si hubo más de uno, vale el último cargado
// (por fecha): es la corrección.
const pesajeDe = (lote, sexo, semana) => {
  const delSexo = (lote.pesajes || []).filter((p) => p.sexo === sexo && p.semana === semana);
  if (!delSexo.length) return null;
  return delSexo.reduce((ult, p) => (new Date(p.fecha) >= new Date(ult.fecha) ? p : ult));
};

const ComparativaPesoReproductores = ({ lotes, constantes, nombreGalpon }) => {
  const tabla = constantes?.pesoObjetivo;
  const objetivo = (sexo, semana) => tabla?.[sexo]?.[semana - 1] ?? null;

  // Planteles activos, en el orden de los galpones (1 y 2 recría, 3 a 6 postura).
  const activos = lotes
    .filter((l) => l.estado !== "finalizado")
    .sort((a, b) => a.galpon - b.galpon);

  // Una columna por cada semana que tenga algún pesaje, en cualquier plantel.
  const semanas = [...new Set(
    activos.flatMap((l) => (l.pesajes || []).map((p) => p.semana))
  )].sort((a, b) => a - b);

  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-header bg-white py-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <h6 className="mb-0">
          <i className="bi bi-bar-chart-line me-2 text-success"></i>
          Comparativa de peso por galpón
        </h6>
        <span className="text-muted small">
          Tabla: {constantes?.pesoObjetivoFuente || "Arbor Acres Max"}
        </span>
      </div>

      {/* Sin la tabla todo saldría "sin ref." y sin colores, que parece un dato
          y no lo es: se avisa en vez de mostrar una comparación vacía. */}
      {!tabla ? (
        <div className="card-body">
          <div className="alert alert-warning small mb-0">
            <i className="bi bi-exclamation-triangle me-1"></i>
            No llegó la tabla de pesos de referencia, así que no se puede comparar. Actualizá la
            página; si sigue igual, el servidor está corriendo una versión anterior.
          </div>
        </div>
      ) : activos.length === 0 || semanas.length === 0 ? (
        <div className="card-body text-center text-muted small py-4">
          {activos.length === 0
            ? "No hay planteles en los galpones."
            : "Todavía no hay pesajes cargados. Se cargan en Datos Semanales."}
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-sm table-bordered align-middle mb-0">
              <thead className="table-light text-center">
                <tr>
                  <th className="text-start" colSpan={2}>Galpón</th>
                  {semanas.map((s) => {
                    const h = objetivo("hembra", s);
                    const m = objetivo("macho", s);
                    return (
                      <th key={s} style={{ minWidth: 86 }}>
                        Sem. {s}
                        <div className="text-muted fw-normal" style={{ fontSize: "0.7rem" }}>
                          {h == null && m == null ? "sin ref." : `H ${formatPeso(h)}`}
                        </div>
                        {m != null && (
                          <div className="text-muted fw-normal" style={{ fontSize: "0.7rem" }}>
                            M {formatPeso(m)}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {activos.map((lote) =>
                  SEXOS.map((sx, i) => (
                    <tr key={`${lote._id}-${sx.key}`}>
                      {i === 0 && (
                        <td rowSpan={SEXOS.length} className="fw-semibold" style={{ whiteSpace: "nowrap" }}>
                          {nombreGalpon(lote)}
                          <div className="text-muted fw-normal" style={{ fontSize: "0.7rem" }}>
                            Plantel #{lote.numeroLote} · Sem. {lote.semanaVida ?? "?"} actual
                          </div>
                        </td>
                      )}
                      <td className="small text-muted" style={{ whiteSpace: "nowrap" }}>{sx.label}</td>
                      {semanas.map((s) => {
                        const p = pesajeDe(lote, sx.key, s);
                        if (!p) return <td key={s} className="text-center text-muted">—</td>;
                        const obj = objetivo(sx.key, s);
                        const dif = obj != null ? p.pesoPromedio - obj : null;
                        return (
                          <td
                            key={s}
                            className={`text-center ${clsPeso(p.pesoPromedio, obj)}`}
                            title={
                              obj != null
                                ? `Tabla ${fmtG(obj)} g · ${dif >= 0 ? "+" : ""}${fmtG(dif)} g ` +
                                  `(${dif >= 0 ? "+" : ""}${((dif / obj) * 100).toFixed(1).replace(".", ",")}%)`
                                : "Semana fuera de la tabla"
                            }
                          >
                            {formatPeso(p.pesoPromedio)}
                            {dif != null && (
                              <div className="fw-normal" style={{ fontSize: "0.7rem" }}>
                                {dif >= 0 ? "+" : ""}{fmtG(dif)} g
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="card-footer bg-white d-flex gap-3 flex-wrap small text-muted py-2">
            <span className="text-success"><i className="bi bi-check-circle-fill me-1"></i>En tabla (±5%)</span>
            <span className="text-warning"><i className="bi bi-exclamation-triangle-fill me-1"></i>Desvío entre 5% y 10%</span>
            <span className="text-danger"><i className="bi bi-exclamation-circle-fill me-1"></i>Fuera de tabla (más de 10%)</span>
            <span>Debajo de cada peso: la diferencia en gramos contra la tabla.</span>
          </div>
        </>
      )}
    </div>
  );
};

export default ComparativaPesoReproductores;
