import React from "react";
import { calcularDesgloseFaena } from "../utils/faenaValidacion";

const fmt = (n) => new Intl.NumberFormat("es-AR").format(Number(n) || 0);

/**
 * Muestra en vivo la cuenta del cierre de faena, para que el operario no la haga
 * a mano ni se entere del desvío recién al apretar Guardar:
 *
 *   recibidas − muertos − sin faenar = a faenar = enteros + trozados + decomisados
 *
 * Es solo lectura: la regla la aplican `validarDestinoFaena` (front, bloqueante al
 * enviar) y `lotes.services.js` (backend). Acá se explica mientras se carga.
 */
const Linea = ({ etiqueta, valor, signo, fuerte, tono }) => (
  <div className={`d-flex justify-content-between py-1 ${fuerte ? "border-top" : ""}`}>
    <span className={tono ? `text-${tono}` : ""}>
      {signo && <span className="text-muted me-1">{signo}</span>}
      {etiqueta}
    </span>
    <span className={`${fuerte ? "fw-bold" : ""} ${tono ? `text-${tono}` : ""}`}>{fmt(valor)}</span>
  </div>
);

const DesgloseFaena = ({
  unidadesRecibidas,
  muertos,
  pollosSinFaenar,
  pollosCalibres,
  unidadesTrozadas,
  unidadesDecomisadas,
  className = "",
}) => {
  const d = calcularDesgloseFaena({
    unidadesRecibidas, muertos, pollosSinFaenar,
    pollosCalibres, unidadesTrozadas, unidadesDecomisadas,
  });

  // Sin recibidas todavía no hay nada que contar.
  if (d.recibidas <= 0) return null;

  const faltan = d.diferencia > 0;

  const estado = d.negativa
    ? { tono: "danger", icono: "x-circle-fill", texto: "Los descuentos superan lo recibido" }
    : d.cuadra
      ? { tono: "success", icono: "check-circle-fill", texto: "La cuenta cierra" }
      : {
          tono: "danger",
          icono: "exclamation-triangle-fill",
          texto: faltan
            ? `Faltan ${fmt(d.diferencia)} pollos por asignar`
            : `Sobran ${fmt(-d.diferencia)} pollos asignados`,
        };

  return (
    <div className={`border rounded p-2 bg-light small ${className}`}>
      <Linea etiqueta="Unidades recibidas" valor={d.recibidas} fuerte />
      <Linea etiqueta="Muertos" valor={d.muertos} signo="−" />
      {d.sinFaenar > 0 && <Linea etiqueta="Sin faenar (vuelven a granja)" valor={d.sinFaenar} signo="−" />}
      <Linea etiqueta="A faenar" valor={d.aFaenar} signo="=" fuerte tono={d.negativa ? "danger" : undefined} />

      <div className="text-muted mt-2 mb-1" style={{ fontSize: ".85em" }}>Destinos cargados</div>
      <Linea etiqueta="Enteros (calibres)" valor={d.enteros} />
      <Linea etiqueta="Trozados" valor={d.trozadas} />
      <Linea etiqueta="Decomisados" valor={d.decomisadas} />
      <Linea etiqueta="Total asignado" valor={d.asignadas} fuerte />

      <div className={`d-flex align-items-center gap-2 mt-2 pt-2 border-top text-${estado.tono}`}>
        <i className={`bi bi-${estado.icono}`}></i>
        <span className="fw-semibold">{estado.texto}</span>
      </div>
    </div>
  );
};

export default DesgloseFaena;
