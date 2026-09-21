import React, { useState, useRef, useEffect, useMemo } from "react";

/**
 * Buscador de clientes: se escribe y se filtra, en vez de un <select> con la
 * lista entera. Con la cartera de clientes que hay, buscar a mano en el
 * desplegable es inusable.
 *
 * Filtra por razón social, CUIT y teléfono — el que carga suele tener a mano
 * cualquiera de los tres. Devuelve el `_id` por `onChange`, igual que un select.
 */

const nombreCliente = (c) => c?.razonSocial || c?.nombre || "Cliente";

// Cuántas opciones se muestran. Más que esto y la lista deja de ayudar: lo que
// corresponde es seguir escribiendo.
const MAX_RESULTADOS = 8;

const BuscadorCliente = ({
  clientes = [],
  value = "",
  onChange,
  placeholder = "Escribí para buscar...",
  size = "",
  autoFocus = false,
}) => {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  // Si el input está cerca del borde de abajo (típico: el form al pie de un
  // modal), la lista se abre hacia arriba en vez de quedar cortada.
  const [haciaArriba, setHaciaArriba] = useState(false);
  const contenedor = useRef(null);

  const ALTO_LISTA = 260;

  const abrir = () => {
    const r = contenedor.current?.getBoundingClientRect();
    if (r) setHaciaArriba(window.innerHeight - r.bottom < ALTO_LISTA && r.top > ALTO_LISTA);
    setAbierto(true);
  };

  const elegido = useMemo(
    () => clientes.find((c) => String(c._id) === String(value)) || null,
    [clientes, value]
  );

  // Lo que se ve en el cuadro es derivado, no un estado que haya que sincronizar:
  // mientras se busca manda lo tecleado, y cerrado manda el elegido. Así, cuando
  // el formulario se limpia desde afuera (después de guardar), el cuadro queda
  // vacío solo, sin un efecto que lo persiga.
  const mostrado = abierto ? texto : elegido ? nombreCliente(elegido) : "";

  // Cerrar al hacer click fuera: si no, el desplegable queda colgado.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      if (contenedor.current && !contenedor.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const resultados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    // Sin texto (o con el nombre del ya elegido) se muestran los primeros: sirve
    // para abrir y mirar qué hay sin tener que adivinar una letra.
    if (!q || (elegido && q === nombreCliente(elegido).toLowerCase()))
      return clientes.slice(0, MAX_RESULTADOS);
    return clientes
      .filter((c) =>
        `${nombreCliente(c)} ${c.cuit || ""} ${c.telefono || ""}`.toLowerCase().includes(q)
      )
      .slice(0, MAX_RESULTADOS);
  }, [clientes, texto, elegido]);

  const elegir = (c) => {
    onChange(c._id);
    setTexto(nombreCliente(c));
    setAbierto(false);
  };

  const limpiar = () => {
    onChange("");
    setTexto("");
    setAbierto(false);
  };

  const teclas = (e) => {
    if (!abierto) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarcado((m) => Math.min(m + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarcado((m) => Math.max(m - 1, 0));
    } else if (e.key === "Enter") {
      // El buscador suele vivir dentro de un form: sin esto, elegir con Enter
      // manda el formulario.
      e.preventDefault();
      if (resultados[marcado]) elegir(resultados[marcado]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  const clase = size === "sm" ? "form-control form-control-sm" : "form-control";

  return (
    <div className="position-relative" ref={contenedor}>
      <div className="input-group">
        <input
          type="text"
          className={clase}
          value={mostrado}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => {
            setTexto(e.target.value);
            setMarcado(0);
            abrir();
            // Escribir encima de un cliente ya elegido lo suelta: si no, la
            // pantalla muestra un nombre y guarda otro.
            if (value) onChange("");
          }}
          onFocus={() => {
            setTexto(elegido ? nombreCliente(elegido) : "");
            abrir();
          }}
          onKeyDown={teclas}
        />
        {mostrado && (
          <button
            type="button"
            className={`btn btn-outline-secondary ${size === "sm" ? "btn-sm" : ""}`}
            onClick={limpiar}
            title="Limpiar"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        )}
      </div>

      {abierto && (
        <ul
          className="list-group position-absolute w-100 shadow"
          style={{
            zIndex: 1060,
            maxHeight: ALTO_LISTA,
            overflowY: "auto",
            ...(haciaArriba ? { bottom: "100%", marginBottom: 2 } : { marginTop: 2 }),
          }}
        >
          {resultados.length === 0 ? (
            <li className="list-group-item small text-muted">
              Ningún cliente coincide con "{texto}"
            </li>
          ) : (
            resultados.map((c, i) => (
              <li key={c._id}>
                <button
                  type="button"
                  className={`list-group-item list-group-item-action w-100 text-start py-1 ${
                    i === marcado ? "active" : ""
                  }`}
                  onMouseEnter={() => setMarcado(i)}
                  onClick={() => elegir(c)}
                >
                  <span className="fw-semibold">{nombreCliente(c)}</span>
                  {(c.cuit || c.telefono) && (
                    <span className={`small ms-2 ${i === marcado ? "" : "text-muted"}`}>
                      {[c.cuit, c.telefono].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default BuscadorCliente;
