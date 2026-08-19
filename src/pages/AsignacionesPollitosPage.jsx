import React, { useState, useEffect, useCallback, useMemo } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import {
  obtenerRepartoPollitos,
  actualizarReservaPollitos,
  eliminarReservaPollitos,
} from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import {
  formatearNumero,
  formatearMoneda,
  labelGranja,
  prefijoGranja,
  diasHasta,
  textoDias,
} from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 20;

const ESTADO_RESERVA = {
  reservada: { label: "Reservada", clase: "bg-primary" },
  entregada: { label: "Entregada", clase: "bg-success" },
  cancelada: { label: "Cancelada", clase: "bg-secondary" },
};

// A dónde van los pollitos, en una línea.
const Destino = ({ r }) =>
  r.destino === "granja" ? (
    <>
      <i className="bi bi-house-door text-success me-1"></i>
      {labelGranja(r.granja)}
      <span className="text-muted">
        {r.galpon ? ` · ${prefijoGranja(r.granja)}${r.galpon}` : " · galpón a definir"}
      </span>
    </>
  ) : (
    <>
      <i className="bi bi-person text-primary me-1"></i>
      {r.cliente?.razonSocial || "Cliente"}
      {r.cliente?.telefono && <span className="text-muted small"> · {r.cliente.telefono}</span>}
    </>
  );

const AsignacionesPollitosPage = () => {
  const [repartos, setRepartos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todas"); // todas | granja | cliente
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    try {
      const data = await obtenerRepartoPollitos();
      setRepartos(Array.isArray(data) ? data : []);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar las asignaciones.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El backend devuelve el reparto agrupado por tanda; acá se aplana para poder
  // mirarlo como lista: una fila por asignación, con la fecha en que nace.
  const asignaciones = useMemo(
    () =>
      repartos
        .flatMap((rep) =>
          (rep.reservas || []).map((r) => ({
            ...r,
            fechaNacimiento: rep.tanda.fechaNacimiento,
            nacio: rep.tanda.nacio,
            numeroTanda: rep.tanda.numeroTanda,
            numeroLote: rep.tanda.lote?.numeroLote,
          }))
        )
        .sort((a, b) => new Date(a.fechaNacimiento) - new Date(b.fechaNacimiento)),
    [repartos]
  );

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return asignaciones.filter((r) => {
      if (filtro !== "todas" && r.destino !== filtro) return false;
      if (!texto) return true;
      const donde =
        r.destino === "granja"
          ? `${labelGranja(r.granja)} ${prefijoGranja(r.granja)}${r.galpon || ""}`
          : `${r.cliente?.razonSocial || ""} ${r.cliente?.telefono || ""}`;
      return (
        donde.toLowerCase().includes(texto) ||
        String(r.numeroTanda).includes(texto) ||
        String(r.numeroLote ?? "").includes(texto)
      );
    });
  }, [asignaciones, filtro, busqueda]);

  const pagActual = filtradas.slice((pagina - 1) * ITEMS_POR_PAGINA, pagina * ITEMS_POR_PAGINA);

  // Los totales acompañan al filtro: si mirás solo clientes, los números son de
  // clientes. Las canceladas no suman.
  const totales = useMemo(
    () =>
      filtradas
        .filter((r) => r.estado !== "cancelada")
        .reduce(
          (acc, r) => ({
            cantidad: acc.cantidad + r.cantidad,
            aGranja: acc.aGranja + (r.destino === "granja" ? r.cantidad : 0),
            aClientes: acc.aClientes + (r.destino === "cliente" ? r.cantidad : 0),
            facturado: acc.facturado + (r.total || 0),
          }),
          { cantidad: 0, aGranja: 0, aClientes: 0, facturado: 0 }
        ),
    [filtradas]
  );

  const marcarEntregada = async (r) => {
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: "¿Marcar como entregada?",
      text: `${formatearNumero(r.cantidad)} pollitos a ${
        r.destino === "granja" ? labelGranja(r.granja) : r.cliente?.razonSocial
      }.`,
      showCancelButton: true,
      confirmButtonText: "Sí, entregada",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;
    try {
      await actualizarReservaPollitos(r._id, { estado: "entregada" });
      await cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo actualizar.", "error");
    }
  };

  const liberar = async (r) => {
    const quien = r.destino === "granja" ? labelGranja(r.granja) : r.cliente?.razonSocial;
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Liberar estos pollitos?",
      text: `Vuelven a quedar disponibles ${r.cantidad} pollitos de ${quien}.`,
      showCancelButton: true,
      confirmButtonText: "Sí, liberar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      await eliminarReservaPollitos(r._id);
      await cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo liberar.", "error");
    }
  };

  const cambiarFiltro = (f) => {
    setFiltro(f);
    setPagina(1);
  };

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-1">
              <i className="bi bi-list-check text-success me-2"></i>Asignaciones de Pollitos
            </h1>
            <p className="text-muted mb-0 small">
              Todo lo que ya tiene destino: reservas de clientes y envíos a galpón propio. Se
              cargan desde <strong>Proyección</strong>.
            </p>
          </div>
          <button className="btn btn-outline-secondary btn-sm" onClick={cargar} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-1"></i>Actualizar
          </button>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success"></div>
          </div>
        ) : (
          <>
            <div className="row g-2 mb-3">
              <div className="col-6 col-lg-3">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">Pollitos asignados</div>
                    <div className="h4 fw-bold mb-0">{formatearNumero(totales.cantidad)}</div>
                  </div>
                </div>
              </div>
              <div className="col-6 col-lg-3">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">A granja propia</div>
                    <div className="h4 fw-bold text-success mb-0">
                      {formatearNumero(totales.aGranja)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-6 col-lg-3">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">A clientes</div>
                    <div className="h4 fw-bold text-primary mb-0">
                      {formatearNumero(totales.aClientes)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-6 col-lg-3">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">Asignaciones</div>
                    <div className="h4 fw-bold mb-0">{filtradas.length}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filtros */}
            <div className="d-flex flex-wrap gap-2 mb-3">
              <div className="btn-group btn-group-sm">
                <button
                  className={`btn ${filtro === "todas" ? "btn-secondary" : "btn-outline-secondary"}`}
                  onClick={() => cambiarFiltro("todas")}
                >
                  Todas
                </button>
                <button
                  className={`btn ${filtro === "granja" ? "btn-success" : "btn-outline-secondary"}`}
                  onClick={() => cambiarFiltro("granja")}
                >
                  <i className="bi bi-house-door me-1"></i>Granja
                </button>
                <button
                  className={`btn ${filtro === "cliente" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => cambiarFiltro("cliente")}
                >
                  <i className="bi bi-person me-1"></i>Clientes
                </button>
              </div>
              <input
                type="search"
                className="form-control form-control-sm"
                style={{ maxWidth: "260px" }}
                placeholder="Buscar cliente, galpón, tanda…"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPagina(1);
                }}
              />
            </div>

            {filtradas.length === 0 ? (
              <div className="card shadow-sm">
                <div className="card-body text-center py-5 text-muted">
                  <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                  {asignaciones.length === 0
                    ? "Todavía no se asignó ningún pollito. Se hace desde Proyección."
                    : "No hay asignaciones que coincidan con el filtro."}
                </div>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="card shadow-sm d-none d-md-block">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Nace</th>
                          <th>Destino</th>
                          <th className="text-center">Tanda</th>
                          <th className="text-center">Plantel</th>
                          <th className="text-end">Pollitos</th>
                          <th className="text-end">Total</th>
                          <th className="text-center">Estado</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagActual.map((r) => {
                          const est = ESTADO_RESERVA[r.estado] || {};
                          return (
                            <tr key={r._id} className={r.estado === "cancelada" ? "text-muted" : ""}>
                              <td>
                                {formatearFechaLocal(r.fechaNacimiento)}
                                <div className="text-muted small">
                                  {r.nacio ? "ya nació" : textoDias(diasHasta(r.fechaNacimiento), true)}
                                </div>
                              </td>
                              <td>
                                <Destino r={r} />
                                {r.observaciones && (
                                  <div className="text-muted small">{r.observaciones}</div>
                                )}
                              </td>
                              <td className="text-center">#{r.numeroTanda}</td>
                              <td className="text-center">#{r.numeroLote ?? "?"}</td>
                              <td className="text-end fw-semibold">
                                {formatearNumero(r.cantidad)}
                              </td>
                              <td className="text-end">
                                {r.total ? formatearMoneda(r.total) : "—"}
                              </td>
                              <td className="text-center">
                                <span className={`badge ${est.clase}`}>{est.label}</span>
                              </td>
                              <td className="text-end text-nowrap">
                                {r.estado === "reservada" && (
                                  <button
                                    className="btn btn-sm btn-outline-success me-1"
                                    onClick={() => marcarEntregada(r)}
                                    title="Marcar como entregada"
                                  >
                                    <i className="bi bi-check-lg"></i>
                                  </button>
                                )}
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => liberar(r)}
                                  title="Liberar"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile */}
                <div className="d-md-none">
                  {pagActual.map((r) => {
                    const est = ESTADO_RESERVA[r.estado] || {};
                    return (
                      <div className="card shadow-sm mb-2" key={r._id}>
                        <div className="card-body">
                          <div className="d-flex justify-content-between mb-2">
                            <strong>{formatearFechaLocal(r.fechaNacimiento)}</strong>
                            <span className={`badge ${est.clase}`}>{est.label}</span>
                          </div>
                          <div className="mb-2">
                            <Destino r={r} />
                          </div>
                          <div className="row g-2 small">
                            <div className="col-6">
                              <span className="text-muted">Pollitos:</span>{" "}
                              <strong>{formatearNumero(r.cantidad)}</strong>
                            </div>
                            <div className="col-6">
                              <span className="text-muted">Tanda:</span> #{r.numeroTanda}
                            </div>
                            {r.total > 0 && (
                              <div className="col-12">
                                <span className="text-muted">Total:</span>{" "}
                                {formatearMoneda(r.total)}
                              </div>
                            )}
                          </div>
                          <div className="d-flex gap-2 mt-3">
                            {r.estado === "reservada" && (
                              <button
                                className="btn btn-sm btn-outline-success flex-fill"
                                onClick={() => marcarEntregada(r)}
                              >
                                <i className="bi bi-check-lg me-1"></i>Entregada
                              </button>
                            )}
                            <button
                              className="btn btn-sm btn-outline-danger flex-fill"
                              onClick={() => liberar(r)}
                            >
                              <i className="bi bi-trash me-1"></i>Liberar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Pagination
                  currentPage={pagina}
                  totalItems={filtradas.length}
                  itemsPerPage={ITEMS_POR_PAGINA}
                  onPageChange={setPagina}
                />
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default AsignacionesPollitosPage;
