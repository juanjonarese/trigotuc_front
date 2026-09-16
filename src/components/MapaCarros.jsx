import React from "react";
import { formatearNumero } from "../utils/reproductoresUtils";

/**
 * Mapa de los carros de una máquina (incubadora o nacedora).
 *
 * Los carros van numerados de corrido, en columnas de dos, y el ventilador es
 * VERTICAL. La incubadora tiene 12 (el ventilador parte el 6 del 7) y la
 * nacedora 4 (parte el 2 del 3):
 *
 *      1   3   5  ‖   7   9  11          1  ‖  3
 *      2   4   6  ‖   8  10  12          2  ‖  4
 *
 * El dibujo respeta esa disposición para que el operario encuentre el carro
 * mirando la pantalla igual que mira la máquina.
 *
 * Los carros de nacedora traen `capacidad` y `huevos` porque juntan varias
 * tandas: pueden estar libres, a medias (amarillo) o llenos (rojo).
 *
 * Dos formas de interactuar, las dos opcionales:
 *  - `onElegir`  → se tocan los carros con LUGAR, para mandar una tanda ahí
 *  - `onVerTanda(tanda, carro)` → se tocan los OCUPADOS, para ver qué tienen
 *
 * `maquina` es lo que devuelve GET /incubacion/ocupacion.
 *
 * `seleccion` puede ser un número (un carro) o un array de números (varios
 * carros, en el orden en que se eligieron: se muestra 1º, 2º, …).
 */
const MapaCarros = ({ maquina, seleccion, onElegir, onVerTanda, compacto = false }) => {
  const elegible = typeof onElegir === "function";
  const verTanda = typeof onVerTanda === "function";
  const carros = maquina.carros || [];
  const multiple = Array.isArray(seleccion);

  // Columnas de a dos: la 1 lleva los carros 1 y 2, la 2 el 3 y 4, y así.
  const columnas = [...new Set(carros.map((c) => c.columna))].sort((a, b) => a - b);

  const Carro = ({ c }) => {
    if (!c) return <div style={{ minWidth: compacto ? "32px" : "46px" }} />;
    const orden = multiple ? seleccion.indexOf(c.carro) : -1;
    const elegido = multiple ? orden >= 0 : seleccion === c.carro;
    // En la incubadora un carro ocupado ya está lleno; en la nacedora no.
    const conCapacidad = c.capacidad != null;
    const lleno = conCapacidad ? c.lleno : c.ocupado;
    const aMedias = c.ocupado && !lleno;
    const clase = elegido
      ? "btn-primary"
      : lleno
      ? "btn-danger"
      : aMedias
      ? "btn-warning"
      : elegible
      ? "btn-outline-success"
      : "btn-outline-secondary";

    const titulo = !c.ocupado
      ? `Carro ${c.carro} · libre` +
        (conCapacidad ? ` · entran ${formatearNumero(c.capacidad)} huevos` : "")
      : conCapacidad
      ? `Carro ${c.carro} · ${formatearNumero(c.huevos)} de ${formatearNumero(c.capacidad)} huevos · ` +
        c.tandas.map((t) => `tanda #${t.numeroTanda} (plantel #${t.numeroLote ?? "?"})`).join(", ") +
        (verTanda ? " — tocá para abrirlo" : "")
      : `Carro ${c.carro} · tanda #${c.tanda.numeroTanda} · plantel #${
          c.tanda.numeroLote ?? "?"
        } · ${formatearNumero(c.tanda.huevosIncubando ?? c.tanda.huevos)} huevos` +
        (verTanda ? " — tocá para abrirla" : "");

    // Un carro es clickeable si tiene lugar y se puede elegir, o si tiene algo
    // adentro y se puede abrir.
    const puedeElegir = elegible && !lleno;
    const clickeable = puedeElegir || (c.ocupado && verTanda);
    const alTocar = () => {
      if (puedeElegir) onElegir(c.carro);
      else if (c.ocupado && verTanda) onVerTanda(c.tanda, c);
    };

    const etiqueta = orden >= 0
      ? `${orden + 1}º`
      : !c.ocupado
      ? "libre"
      : conCapacidad
      ? `${Math.round((c.huevos / c.capacidad) * 100)}%`
      : `#${c.tanda.numeroLote ?? "?"}`;

    return (
      <button
        type="button"
        className={`btn btn-sm ${clase} p-1`}
        style={{ minWidth: compacto ? "32px" : "46px", lineHeight: 1.1 }}
        title={titulo}
        disabled={!clickeable}
        onClick={alTocar}
      >
        <div className="fw-bold" style={{ fontSize: compacto ? ".72rem" : ".82rem" }}>
          {c.carro}
        </div>
        {!compacto && (
          <div style={{ fontSize: ".6rem" }}>
            {etiqueta}
          </div>
        )}
      </button>
    );
  };

  const Columna = ({ col }) => {
    const arriba = carros.find((c) => c.columna === col && c.fila === "arriba");
    const abajo = carros.find((c) => c.columna === col && c.fila === "abajo");
    return (
      <div className="d-flex flex-column gap-1">
        <Carro c={arriba} />
        <Carro c={abajo} />
      </div>
    );
  };

  // El ventilador va donde cambia el lado: entre la última columna de la
  // izquierda y la primera de la derecha.
  const ultimaIzquierda = Math.max(
    ...carros.filter((c) => c.lado === "izquierda").map((c) => c.columna)
  );

  return (
    <div className="d-flex align-items-center gap-1">
      {columnas.map((col) => (
        <React.Fragment key={col}>
          <Columna col={col} />
          {col === ultimaIzquierda && (
            <div
              className="d-flex flex-column align-items-center justify-content-center text-muted mx-1"
              style={{ alignSelf: "stretch" }}
              title="Ventilador"
            >
              <div className="border-start border-2 border-secondary-subtle flex-grow-1"></div>
              <i className="bi bi-fan my-1" style={{ fontSize: ".8rem" }}></i>
              <div className="border-start border-2 border-secondary-subtle flex-grow-1"></div>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default MapaCarros;
