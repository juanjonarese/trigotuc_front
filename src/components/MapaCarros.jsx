import React from "react";
import { formatearNumero } from "../utils/reproductoresUtils";

/**
 * Mapa de los 12 carros de una máquina (incubadora o nacedora).
 *
 * Los carros van numerados 1..12 de corrido, en columnas de dos, y el
 * ventilador es VERTICAL: parte la máquina entre el carro 6 y el 7.
 *
 *      1   3   5  ‖   7   9  11      ← fila de arriba
 *      2   4   6  ‖   8  10  12      ← fila de abajo
 *                 ↑ ventilador
 *
 * El dibujo respeta esa disposición para que el operario encuentre el carro
 * mirando la pantalla igual que mira la máquina.
 *
 * Dos formas de interactuar, las dos opcionales:
 *  - `onElegir`  → se tocan los carros LIBRES, para mandar una tanda ahí
 *  - `onVerTanda` → se tocan los OCUPADOS, para abrir la tanda que tienen adentro
 *
 * `maquina` es lo que devuelve GET /incubacion/ocupacion.
 */
const MapaCarros = ({ maquina, seleccion, onElegir, onVerTanda, compacto = false }) => {
  const elegible = typeof onElegir === "function";
  const verTanda = typeof onVerTanda === "function";
  const carros = maquina.carros || [];

  // Columnas de a dos: la 1 lleva los carros 1 y 2, la 2 el 3 y 4, y así.
  const columnas = [...new Set(carros.map((c) => c.columna))].sort((a, b) => a - b);

  const Carro = ({ c }) => {
    if (!c) return <div style={{ minWidth: compacto ? "32px" : "46px" }} />;
    const elegido = seleccion === c.carro;
    const clase = elegido
      ? "btn-primary"
      : c.ocupado
      ? "btn-danger"
      : elegible
      ? "btn-outline-success"
      : "btn-outline-secondary";

    const titulo = c.ocupado
      ? `Carro ${c.carro} · tanda #${c.tanda.numeroTanda} · plantel #${
          c.tanda.numeroLote ?? "?"
        } · ${formatearNumero(c.tanda.huevosIncubando ?? c.tanda.huevos)} huevos` +
        (verTanda ? " — tocá para abrirla" : "")
      : `Carro ${c.carro} · libre`;

    // Un carro es clickeable si está libre y se puede elegir, o si está ocupado
    // y se puede abrir la tanda que tiene adentro.
    const clickeable = c.ocupado ? verTanda : elegible;
    const alTocar = () => {
      if (c.ocupado && verTanda) onVerTanda(c.tanda);
      else if (!c.ocupado && elegible) onElegir(c.carro);
    };

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
            {c.ocupado ? `#${c.tanda.numeroLote ?? "?"}` : "libre"}
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
