import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import BotonExcel from "../components/BotonExcel";
import { obtenerEnviosCamara, recibirEnvioCamara } from "../services/api";
import Swal from "sweetalert2";
import { exportarLibroExcel } from "../utils/exportarExcel";

const TIPOS_LABEL = { filet: "Filet", pata: "Pata muslo", alita: "Alita", menudo: "Menudo", carcaza: "Carcaza" };
const camaraLbl = (c) => (c === "cañete" ? "Cañete" : c === "trigotuc" ? "Trigotuc" : c);
const fmt = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
const fmtFecha = (f) => (f ? new Date(f).toLocaleDateString("es-AR") : "—");

const RecepcionCamaraPage = () => {
  const navigate = useNavigate();
  const [envios, setEnvios]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [recibiendo, setRecibiendo] = useState(null);

  const cargar = async () => {
    try {
      setLoading(true);
      setEnvios(await obtenerEnviosCamara());
    } catch {
      Swal.fire("Error", "No se pudieron cargar los envíos.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  // Solo los pendientes que entran a Trigotuc (los que recibe granja).
  const pendientes = envios.filter((e) => e.estado === "pendiente" && e.camaraDestino === "trigotuc");
  const recibidos  = envios.filter((e) => e.estado === "recibido" && e.recibidoPor);
  // Excel: las dos listas de la pantalla — lo que está en camino y lo que ya se
  // recibió — en dos hojas, porque son dos estados distintos del mismo envío.
  const columnasEnvio = (conRecepcion) => [
    { header: "N° Envío",    valor: (e) => e.numeroEnvio },
    { header: "Fecha",       valor: (e) => fmtFecha(e.fecha) },
    { header: "Origen",      valor: (e) => camaraLbl(e.camaraOrigen) },
    { header: "Destino",     valor: (e) => camaraLbl(e.camaraDestino) },
    { header: "Calibres",    valor: (e) => (e.calibres || [])
        .map((c) => "Cal." + c.calibre + ": " + c.cajones + " caj").join(" · "), ancho: 36 },
    { header: "Trozados",    valor: (e) => (e.trozados || [])
        .map((t) => (TIPOS_LABEL[t.tipo] || t.tipo) + (t.clase ? " " + t.clase : "") + ": " + t.cajas + " cajas").join(" · "), ancho: 36 },
    { header: "Pollos",      valor: (e) => e.totalPollos ?? 0 },
    { header: "Cajones",     valor: (e) => e.totalCajones ?? 0 },
    { header: "Kg enteros",  valor: (e) => e.pesoTotalKg ?? 0 },
    { header: "Kg trozados", valor: (e) => e.totalKgTrozados ?? 0 },
    { header: "Camión",      valor: (e) => (e.camion ? e.camion.marca + " " + e.camion.patente : "") },
    { header: "Chofer",      valor: (e) => e.chofer?.nombreUsuario },
    ...(conRecepcion
      ? [
          { header: "Fecha recepción", valor: (e) => fmtFecha(e.fechaRecepcion) },
          { header: "Recibido por",    valor: (e) => e.recibidoPor?.nombreUsuario },
        ]
      : []),
    { header: "Observaciones", valor: (e) => e.observaciones },
  ];

  const exportarExcel = () => exportarLibroExcel({
    nombreArchivo: "Frigorifico_recepcion_camara",
    hojas: [
      { nombre: "Pendientes", filas: pendientes, columnas: columnasEnvio(false) },
      { nombre: "Recibidos",  filas: recibidos,  columnas: columnasEnvio(true) },
    ],
  });


  const handleRecibir = async (envio) => {
    const confirm = await Swal.fire({
      title: "¿Recibir en Trigotuc?",
      html: `Confirmás que llegó el envío <strong>${envio.numeroEnvio}</strong> ` +
            `(${camaraLbl(envio.camaraOrigen)} → ${camaraLbl(envio.camaraDestino)}) y lo ingresás a cámara Trigotuc.`,
      icon: "question", showCancelButton: true,
      confirmButtonColor: "#198754", confirmButtonText: "Sí, recibir", cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    setRecibiendo(envio._id);
    try {
      await recibirEnvioCamara(envio._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Ingresado a Trigotuc", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo recibir el envío.", "error");
    } finally {
      setRecibiendo(null);
    }
  };

  const detalle = (e) => (
    <div className="d-flex flex-wrap gap-1 mb-2">
      {(e.calibres || []).map((c, i) => (
        <span key={`c${i}`} className="badge bg-info text-dark">Cal.{c.calibre}: {fmt(c.cajones)} caj</span>
      ))}
      {(e.trozados || []).map((t, i) => (
        <span key={`t${i}`} className="badge bg-warning text-dark">
          {TIPOS_LABEL[t.tipo] || t.tipo}{t.clase ? ` · ${t.clase}` : ""}: {fmt(t.cajas)} caj
        </span>
      ))}
    </div>
  );

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex align-items-center gap-2 mb-4">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/dashboard")}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">
            <i className="bi bi-box-arrow-in-down me-2 text-primary"></i>
            Recepción de Cámara — Trigotuc
          </h1>
          <BotonExcel
            onClick={exportarExcel}
            disabled={loading || (pendientes.length === 0 && recibidos.length === 0)}
            className="ms-auto"
            titulo="Descargar pendientes y recibidos"
          />
        </div>

        <div className="alert alert-info py-2 small">
          <i className="bi bi-info-circle me-1"></i>
          Envíos de Cañete que están en camino. Al <strong>recibir</strong>, el stock ingresa a la cámara Trigotuc.
        </div>

        {loading ? (
          <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
        ) : (
          <>
            {/* Pendientes */}
            <h6 className="text-muted mb-2">Pendientes de recibir ({pendientes.length})</h6>
            {pendientes.length === 0 ? (
              <p className="text-muted small">No hay envíos pendientes.</p>
            ) : (
              <div className="row g-3 mb-4">
                {pendientes.map((e) => (
                  <div key={e._id} className="col-12 col-md-6 col-lg-4">
                    <div className="card border-warning shadow-sm h-100">
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="badge bg-dark fs-6">{e.numeroEnvio}</span>
                          <span className="text-muted small">{fmtFecha(e.fecha)}</span>
                        </div>
                        <div className="mb-2">
                          <span className="badge bg-secondary">{camaraLbl(e.camaraOrigen)}</span>
                          <i className="bi bi-arrow-right text-muted mx-1"></i>
                          <span className="badge bg-secondary">{camaraLbl(e.camaraDestino)}</span>
                        </div>
                        {detalle(e)}
                        {e.camion && (
                          <div className="text-muted small mb-2"><i className="bi bi-truck me-1"></i>{e.camion.marca} {e.camion.patente}</div>
                        )}
                        <button
                          className="btn btn-success w-100"
                          disabled={recibiendo === e._id}
                          onClick={() => handleRecibir(e)}
                        >
                          {recibiendo === e._id
                            ? <span className="spinner-border spinner-border-sm me-1"></span>
                            : <i className="bi bi-check-circle me-1"></i>}
                          Recibir e ingresar a Trigotuc
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recibidos (historial corto) */}
            {recibidos.length > 0 && (
              <>
                <h6 className="text-muted mb-2">Recibidos</h6>
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Envío</th><th>Origen → Destino</th><th>Detalle</th><th>Recibido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recibidos.map((e) => (
                        <tr key={e._id}>
                          <td><span className="badge bg-dark">{e.numeroEnvio}</span></td>
                          <td className="small">{camaraLbl(e.camaraOrigen)} → {camaraLbl(e.camaraDestino)}</td>
                          <td>{detalle(e)}</td>
                          <td className="small text-muted">{fmtFecha(e.fechaRecepcion)}{e.recibidoPor?.nombreUsuario ? ` · ${e.recibidoPor.nombreUsuario}` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default RecepcionCamaraPage;
