import React, { useState } from "react";
import Layout from "../components/Layout";
import { listarArchivosDropbox, leerArchivoDropbox, procesarVentaPos, sincronizarVentasDropbox } from "../services/api";
import Swal from "sweetalert2";

// Parseo local (mismo criterio que el backend): líneas no vacías, columnas por delimitador.
const parsear = (texto, delimitador) =>
  texto
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => l.split(delimitador).map((c) => c.trim()));

const formatFecha = (iso) =>
  iso ? new Date(iso).toLocaleString("es-AR") : "—";

const PruebaDropboxPage = () => {
  const [encoding, setEncoding] = useState("latin1");
  const [delimitador, setDelimitador] = useState(";");

  const [contenido, setContenido] = useState("");
  const [filas, setFilas] = useState([]);
  const [origen, setOrigen] = useState(""); // descripción de qué se leyó

  const [archivos, setArchivos] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [cargandoArchivo, setCargandoArchivo] = useState(false);

  const [procesando, setProcesando] = useState(false);
  const [resultadoDescuento, setResultadoDescuento] = useState(null);

  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSync, setResultadoSync] = useState(null);

  // ---- A) Archivo local (FileReader) — sirve para probar sin Dropbox configurado ----
  const handleArchivoLocal = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const texto = ev.target.result;
      setContenido(texto);
      setFilas(parsear(texto, delimitador));
      setOrigen(`Archivo local: ${file.name}`);
    };
    reader.onerror = () => Swal.fire("Error", "No se pudo leer el archivo", "error");
    // El navegador soporta windows-1252 / iso-8859-1 para el caso FoxPro
    reader.readAsText(file, encoding === "latin1" ? "windows-1252" : encoding);
    e.target.value = ""; // permite volver a elegir el mismo archivo
  };

  // ---- B) Dropbox ----
  const cargarLista = async () => {
    setCargandoLista(true);
    try {
      const data = await listarArchivosDropbox();
      setArchivos(data);
      if (data.length === 0) {
        Swal.fire("Sin archivos", "No hay .txt en la carpeta configurada.", "info");
      }
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setCargandoLista(false);
    }
  };

  const leerDeDropbox = async (ruta, nombre) => {
    setCargandoArchivo(true);
    try {
      const data = await leerArchivoDropbox({ ruta, encoding, delimitador });
      setContenido(data.contenido);
      setFilas(data.filas);
      setOrigen(`Dropbox: ${nombre}`);
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setCargandoArchivo(false);
    }
  };

  // Re-parsear lo ya cargado si cambia el delimitador
  const reparsear = (nuevoDelim) => {
    setDelimitador(nuevoDelim);
    if (contenido) setFilas(parsear(contenido, nuevoDelim));
  };

  // ---- D) Sincronizar desde Dropbox (FLUJO REAL, idempotente) ----
  const handleSync = async () => {
    setSincronizando(true);
    try {
      const data = await sincronizarVentasDropbox("trigotuc");
      setResultadoSync(data);
      Swal.fire(
        "Sincronización lista",
        `Archivos leídos: ${data.archivosLeidos} · Tickets nuevos: ${data.procesados.length} · Ya procesados: ${data.yaProcesados.length} · Fallidos: ${data.fallidos.length}`,
        data.fallidos.length ? "warning" : "success"
      );
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSincronizando(false);
    }
  };

  // ---- C) Descontar stock (PRUEBA) ----
  const handleDescontar = async () => {
    if (filas.length === 0) return;
    const confirm = await Swal.fire({
      title: "¿Descontar stock de cámara Trigotuc?",
      html: `Se procesarán <b>${filas.length}</b> línea(s) y se descontará el stock correspondiente.<br><small class="text-muted">Prueba sin idempotencia: reenviar el mismo archivo descuenta de nuevo.</small>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, descontar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    setProcesando(true);
    try {
      const data = await procesarVentaPos({ filas, camara: "trigotuc" });
      setResultadoDescuento(data);
      const r = data.resumen;
      Swal.fire(
        "Stock descontado",
        `Líneas descontadas: ${r.lineasDescontadas} · No mapeadas: ${r.noMapeados} · Errores: ${r.errores}`,
        r.noMapeados || r.errores ? "warning" : "success"
      );
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setProcesando(false);
    }
  };

  const maxColumnas = filas.reduce((m, f) => Math.max(m, f.length), 0);

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-box-arrow-in-down fs-3 text-primary"></i>
          <div>
            <h1 className="h4 mb-0">Prueba — Lectura de archivo POS</h1>
            <small className="text-muted">
              Lee los .txt de la carpeta de Dropbox y descuenta el stock de cámara Trigotuc.
            </small>
          </div>
        </div>

        {/* Sincronización automática desde Dropbox (flujo real) */}
        <div className="card mb-3 border-success">
          <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <h6 className="mb-1">
                <i className="bi bi-arrow-repeat me-1 text-success"></i>
                Sincronizar ventas desde Dropbox
              </h6>
              <small className="text-muted">
                Lee la carpeta, descuenta los <b>tickets nuevos</b> (idempotente) y saltea los ya procesados.
                El backend también revisa solo, automáticamente, cada 30&nbsp;s.
              </small>
            </div>
            <button className="btn btn-success" onClick={handleSync} disabled={sincronizando}>
              <i className="bi bi-cloud-download me-1"></i>
              {sincronizando ? "Sincronizando…" : "Sincronizar ahora"}
            </button>
          </div>
          {resultadoSync && (
            <div className="card-body border-top pt-3">
              <div className="d-flex flex-wrap gap-3 mb-2">
                <span className="badge bg-secondary">Archivos leídos: {resultadoSync.archivosLeidos}</span>
                <span className="badge bg-success">Tickets nuevos: {resultadoSync.procesados.length}</span>
                <span className="badge bg-info text-dark">Ya procesados: {resultadoSync.yaProcesados.length}</span>
                <span className="badge bg-warning text-dark">Fallidos: {resultadoSync.fallidos.length}</span>
              </div>
              {resultadoSync.procesados.length > 0 && (
                <table className="table table-sm table-bordered mb-2">
                  <thead>
                    <tr><th>Ticket</th><th>Entero (cajones)</th><th>Trozado (cajas)</th></tr>
                  </thead>
                  <tbody>
                    {resultadoSync.procesados.map((p) => (
                      <tr key={p.ticket}>
                        <td>{p.ticket}</td>
                        <td>{p.calibres.map((c) => `cal${c.calibre}: ${c.cajones}`).join(", ") || "—"}</td>
                        <td>{p.trozados.map((t) => `${t.tipo}: ${t.cajas}`).join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {resultadoSync.fallidos.length > 0 && (
                <div className="alert alert-warning py-2 mb-0">
                  <b>Tickets fallidos:</b>{" "}
                  {resultadoSync.fallidos.map((f) => `${f.ticket} (${f.motivo})`).join(" · ")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Opciones de parseo */}
        <div className="card mb-3">
          <div className="card-body row g-3 align-items-end">
            <div className="col-6 col-md-3">
              <label className="form-label mb-1">Delimitador</label>
              <select
                className="form-select"
                value={delimitador}
                onChange={(e) => reparsear(e.target.value)}
              >
                <option value=";">Punto y coma ( ; )</option>
                <option value="|">Barra ( | )</option>
                <option value=",">Coma ( , )</option>
                <option value={"\t"}>Tabulación</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label mb-1">Codificación</label>
              <select
                className="form-select"
                value={encoding}
                onChange={(e) => setEncoding(e.target.value)}
              >
                <option value="latin1">Latin-1 / Windows-1252 (FoxPro)</option>
                <option value="utf8">UTF-8</option>
              </select>
            </div>
          </div>
        </div>

        <div className="row g-3">
          {/* A) Archivo local */}
          <div className="col-12 col-lg-6">
            <div className="card h-100">
              <div className="card-header bg-light fw-semibold">
                <i className="bi bi-file-earmark-arrow-up me-1"></i>
                Probar con archivo local
              </div>
              <div className="card-body">
                <p className="text-muted small mb-2">
                  Elegí un .txt de tu PC para validar el parseo sin depender de Dropbox.
                </p>
                <input
                  type="file"
                  accept=".txt,text/plain"
                  className="form-control"
                  onChange={handleArchivoLocal}
                />
              </div>
            </div>
          </div>

          {/* B) Dropbox */}
          <div className="col-12 col-lg-6">
            <div className="card h-100">
              <div className="card-header bg-light fw-semibold d-flex justify-content-between align-items-center">
                <span>
                  <i className="bi bi-dropbox me-1"></i>
                  Leer desde Dropbox
                </span>
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={cargarLista}
                  disabled={cargandoLista}
                >
                  {cargandoLista ? "Cargando…" : "Listar archivos"}
                </button>
              </div>
              <div className="card-body">
                {archivos.length === 0 ? (
                  <p className="text-muted small mb-0">
                    Tocá “Listar archivos” para ver los .txt de la carpeta configurada.
                  </p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {archivos.map((a) => (
                      <li
                        key={a.ruta}
                        className="list-group-item d-flex justify-content-between align-items-center px-0"
                      >
                        <div>
                          <div className="fw-semibold">{a.nombre}</div>
                          <small className="text-muted">
                            {formatFecha(a.modificado)} · {a.tamano} bytes
                          </small>
                        </div>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => leerDeDropbox(a.ruta, a.nombre)}
                          disabled={cargandoArchivo}
                        >
                          Leer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resultado */}
        {origen && (
          <div className="card mt-3">
            <div className="card-header bg-light fw-semibold d-flex justify-content-between align-items-center">
              <span>
                <i className="bi bi-table me-1"></i>
                Resultado — {origen}
              </span>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-secondary">
                  {filas.length} fila{filas.length === 1 ? "" : "s"}
                </span>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={handleDescontar}
                  disabled={procesando || filas.length === 0}
                >
                  <i className="bi bi-box-arrow-down me-1"></i>
                  {procesando ? "Descontando…" : "Descontar stock (prueba)"}
                </button>
              </div>
            </div>
            <div className="card-body">
              {/* Tabla parseada */}
              <div className="table-responsive mb-3">
                <table className="table table-sm table-bordered table-striped mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      {Array.from({ length: maxColumnas }).map((_, i) => (
                        <th key={i}>Col {i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((fila, idx) => (
                      <tr key={idx}>
                        <td className="text-muted">{idx + 1}</td>
                        {Array.from({ length: maxColumnas }).map((_, i) => (
                          <td key={i}>{fila[i] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Contenido crudo */}
              <details>
                <summary className="text-muted small" style={{ cursor: "pointer" }}>
                  Ver contenido crudo
                </summary>
                <pre
                  className="bg-dark text-light p-2 rounded mt-2 mb-0"
                  style={{ maxHeight: 300, overflow: "auto", fontSize: "0.8rem" }}
                >
                  {contenido}
                </pre>
              </details>
            </div>
          </div>
        )}

        {/* Resultado del descuento de stock */}
        {resultadoDescuento && (
          <div className="card mt-3 border-danger">
            <div className="card-header bg-danger text-white fw-semibold">
              <i className="bi bi-box-arrow-down me-1"></i>
              Descuento de stock — Cámara {resultadoDescuento.camara}
            </div>
            <div className="card-body">
              <div className="row g-3 mb-3">
                {/* Entero descontado */}
                <div className="col-12 col-md-6">
                  <h6 className="text-muted">Pollo entero descontado (cajones)</h6>
                  {resultadoDescuento.descuentoEntero.length === 0 ? (
                    <p className="text-muted small mb-0">Nada.</p>
                  ) : (
                    <table className="table table-sm table-bordered mb-0">
                      <thead>
                        <tr><th>Calibre</th><th>Cajones</th><th>Pollos</th></tr>
                      </thead>
                      <tbody>
                        {resultadoDescuento.descuentoEntero.map((d) => (
                          <tr key={d.calibre}>
                            <td>{d.calibre}</td>
                            <td>{d.cajones}</td>
                            <td>{d.pollos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {/* Trozado descontado */}
                <div className="col-12 col-md-6">
                  <h6 className="text-muted">Trozado descontado (cajas)</h6>
                  {resultadoDescuento.descuentoTrozado.length === 0 ? (
                    <p className="text-muted small mb-0">Nada.</p>
                  ) : (
                    <table className="table table-sm table-bordered mb-0">
                      <thead>
                        <tr><th>Tipo</th><th>Cajas</th></tr>
                      </thead>
                      <tbody>
                        {resultadoDescuento.descuentoTrozado.map((d) => (
                          <tr key={d.tipo}>
                            <td>{d.tipo}</td>
                            <td>{d.cajas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* No mapeados / errores */}
              {resultadoDescuento.noMapeados.length > 0 && (
                <div className="alert alert-warning py-2 mb-2">
                  <b>Códigos no mapeados:</b>{" "}
                  {resultadoDescuento.noMapeados
                    .map((n) => `${n.codigo} (línea ${n.linea})`)
                    .join(", ")}
                </div>
              )}
              {resultadoDescuento.errores.length > 0 && (
                <div className="alert alert-danger py-2 mb-2">
                  <b>Filas con error:</b>{" "}
                  {resultadoDescuento.errores
                    .map((e) => `línea ${e.linea}: ${e.motivo}`)
                    .join(" · ")}
                </div>
              )}

              {/* Stock antes/después por calibre */}
              <details>
                <summary className="text-muted small" style={{ cursor: "pointer" }}>
                  Ver stock antes / después
                </summary>
                <pre
                  className="bg-dark text-light p-2 rounded mt-2 mb-0"
                  style={{ maxHeight: 300, overflow: "auto", fontSize: "0.8rem" }}
                >
                  {JSON.stringify(resultadoDescuento.stock, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PruebaDropboxPage;
