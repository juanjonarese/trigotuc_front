import React, { useState, useRef, useEffect } from "react";
import { preguntarAsistente } from "../services/api";

/**
 * El asistente de IA, como botón flotante (2026-10-22). Solo para el
 * superadmin: lo monta el Layout, así que está en todas las pantallas.
 *
 * Se le pregunta en castellano por cualquier dato de la plataforma —avícola y
 * Forratuc— y contesta consultando la base. Es de SOLO LECTURA: no carga,
 * modifica ni borra nada.
 *
 * El servidor no guarda la conversación: viaja entera en cada pregunta. Como
 * cada pantalla monta su propio Layout, la conversación y si el panel está
 * abierto se guardan en sessionStorage, para que no se pierdan al cambiar de
 * pantalla (y se van al cerrar la pestaña).
 */

const CLAVE = "asistente.conversacion";
const CLAVE_ABIERTO = "asistente.abierto";

const leer = (clave, defecto) => {
  try {
    const v = sessionStorage.getItem(clave);
    return v == null ? defecto : JSON.parse(v);
  } catch {
    return defecto;
  }
};
const guardar = (clave, valor) => {
  try { sessionStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin storage */ }
};

// Arranques: las preguntas que se hacen igual, y muestran qué entiende.
const EJEMPLOS = [
  "¿Cuánto pollo hay en la cámara de Trigotuc, por calibre?",
  "¿Qué cargas de pollitos de noviembre tienen lugar libre para vender?",
  "¿Cómo vienen los galpones de engorde: mortandad y peso contra el objetivo?",
  "¿Qué se vendió hoy por el mostrador?",
];

// Formato mínimo para la respuesta: negritas, títulos, viñetas y tablas. Sin
// librería de Markdown para un chat, pero tampoco los asteriscos a la vista.
const negritas = (texto) =>
  texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith("**") && parte.endsWith("**") ? (
      <strong key={i}>{parte.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={i}>{parte}</React.Fragment>
    )
  );

const Respuesta = ({ texto }) => {
  const bloques = [];
  let tabla = null;
  const cerrarTabla = () => {
    if (tabla) bloques.push({ tipo: "tabla", filas: tabla });
    tabla = null;
  };

  for (const linea of texto.split("\n")) {
    const limpia = linea.trim();
    if (limpia.startsWith("|") && limpia.endsWith("|")) {
      const celdas = limpia.slice(1, -1).split("|").map((c) => c.trim());
      if (celdas.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separador |---|
      tabla = tabla || [];
      tabla.push(celdas);
      continue;
    }
    cerrarTabla();
    if (!limpia) continue;
    if (limpia.startsWith("#")) bloques.push({ tipo: "titulo", texto: limpia.replace(/^#+\s*/, "") });
    else if (/^[-*•]\s+/.test(limpia)) bloques.push({ tipo: "item", texto: limpia.replace(/^[-*•]\s+/, "") });
    else bloques.push({ tipo: "parrafo", texto: limpia });
  }
  cerrarTabla();

  return bloques.map((b, i) => {
    if (b.tipo === "titulo") return <div key={i} className="fw-bold mt-2 mb-1">{negritas(b.texto)}</div>;
    if (b.tipo === "item")
      return (
        <div key={i} className="d-flex gap-2 mb-1">
          <span className="text-success">•</span>
          <span>{negritas(b.texto)}</span>
        </div>
      );
    if (b.tipo === "tabla") {
      const [encabezado, ...resto] = b.filas;
      return (
        <div key={i} className="table-responsive my-2">
          <table className="table table-sm table-bordered align-middle mb-0 bg-white" style={{ fontSize: "0.8rem" }}>
            <thead className="table-light">
              <tr>{encabezado.map((c, j) => <th key={j}>{negritas(c)}</th>)}</tr>
            </thead>
            <tbody>
              {resto.map((fila, j) => (
                <tr key={j}>{fila.map((c, k) => <td key={k}>{negritas(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return <p key={i} className="mb-2">{negritas(b.texto)}</p>;
  });
};

const AsistenteFlotante = () => {
  const [abierto, setAbierto] = useState(() => leer(CLAVE_ABIERTO, false));
  // [{ rol: "usuario" | "asistente" | "error", texto }]
  const [conversacion, setConversacion] = useState(() => leer(CLAVE, []));
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const finRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => guardar(CLAVE, conversacion), [conversacion]);
  useEffect(() => guardar(CLAVE_ABIERTO, abierto), [abierto]);
  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ block: "end" });
  }, [conversacion, pensando, abierto]);
  useEffect(() => {
    if (abierto) inputRef.current?.focus();
  }, [abierto]);

  const preguntar = async (pregunta) => {
    const p = pregunta.trim();
    if (!p || pensando) return;
    // Al server van solo los turnos de verdad: los errores son de esta pantalla.
    const previos = conversacion.filter((t) => t.rol !== "error");
    setConversacion((c) => [...c, { rol: "usuario", texto: p }]);
    setTexto("");
    setPensando(true);
    try {
      const data = await preguntarAsistente(p, previos);
      setConversacion((c) => [...c, { rol: "asistente", texto: data.respuesta }]);
    } catch (err) {
      // El error entra como un turno más: queda claro a qué pregunta corresponde.
      setConversacion((c) => [...c, { rol: "error", texto: err.message || "No pude procesar la consulta." }]);
    } finally {
      setPensando(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      preguntar(texto);
    }
  };

  return (
    <>
      {abierto && (
        <div
          className="position-fixed bg-white border rounded-3 shadow-lg d-flex flex-column"
          style={{
            right: 16, bottom: 88, zIndex: 1060,
            width: "min(440px, calc(100vw - 32px))",
            height: "min(640px, calc(100vh - 120px))",
          }}
          role="dialog"
          aria-label="Asistente"
        >
          <div className="d-flex align-items-center gap-2 px-3 py-2 border-bottom bg-success text-white rounded-top-3">
            <i className="bi bi-stars"></i>
            <div className="flex-grow-1">
              <div className="fw-semibold lh-1">Asistente</div>
              <div className="small opacity-75">Consultas sobre los datos de la plataforma</div>
            </div>
            {conversacion.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-outline-light"
                title="Empezar una conversación nueva"
                onClick={() => setConversacion([])}
                disabled={pensando}
              >
                <i className="bi bi-arrow-counterclockwise"></i>
              </button>
            )}
            <button type="button" className="btn-close btn-close-white" aria-label="Cerrar" onClick={() => setAbierto(false)}></button>
          </div>

          <div className="flex-grow-1 overflow-auto px-3 py-2 small" style={{ background: "#f6f7f9" }}>
            {conversacion.length === 0 && (
              <div className="py-2">
                <p className="text-muted mb-2">
                  Preguntame lo que quieras sobre la avícola o Forratuc: stock, galpones, incubadora, plan de
                  pollitos, ventas del mostrador, cuentas corrientes… Solo consulto, no modifico nada.
                </p>
                {EJEMPLOS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="btn btn-sm btn-outline-secondary text-start w-100 mb-2 bg-white"
                    onClick={() => preguntar(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            {conversacion.map((t, i) =>
              t.rol === "usuario" ? (
                <div key={i} className="d-flex justify-content-end mb-2">
                  <div className="bg-success text-white rounded-3 px-3 py-2" style={{ maxWidth: "85%", whiteSpace: "pre-wrap" }}>
                    {t.texto}
                  </div>
                </div>
              ) : t.rol === "error" ? (
                <div key={i} className="alert alert-danger py-2 px-3 mb-2 small">
                  <i className="bi bi-exclamation-triangle me-1"></i>{t.texto}
                </div>
              ) : (
                <div key={i} className="bg-white border rounded-3 px-3 py-2 mb-2">
                  <Respuesta texto={t.texto} />
                </div>
              )
            )}

            {pensando && (
              <div className="bg-white border rounded-3 px-3 py-2 mb-2 text-muted">
                <span className="spinner-border spinner-border-sm me-2"></span>
                Consultando los datos…
              </div>
            )}
            <div ref={finRef}></div>
          </div>

          <div className="border-top p-2">
            <div className="input-group">
              <textarea
                ref={inputRef}
                className="form-control form-control-sm"
                rows={2}
                maxLength={2000}
                placeholder="Escribí tu pregunta… (Enter para enviar)"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={pensando}
                style={{ resize: "none" }}
              />
              <button
                type="button"
                className="btn btn-success"
                onClick={() => preguntar(texto)}
                disabled={pensando || !texto.trim()}
                title="Enviar"
              >
                <i className="bi bi-send"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn btn-success rounded-circle shadow-lg position-fixed d-flex align-items-center justify-content-center"
        style={{ right: 16, bottom: 16, width: 60, height: 60, zIndex: 1060 }}
        onClick={() => setAbierto((v) => !v)}
        title={abierto ? "Cerrar el asistente" : "Preguntarle al asistente"}
        aria-label="Asistente"
      >
        <i className={`bi ${abierto ? "bi-x-lg" : "bi-stars"} fs-4`}></i>
      </button>
    </>
  );
};

export default AsistenteFlotante;
