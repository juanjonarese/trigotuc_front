import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import { crearLote, ingresarLoteDesdeRemito, obtenerRemitoGranjaPorId, obtenerRemitosGranja } from "../services/api";
import { obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const fmtNum = (n) => n != null ? new Intl.NumberFormat("es-AR").format(n) : "—";

const GRANJA_LABEL  = { cañete: "Cañete", los_pinos: "Los Pinos" };
const GRANJA_PREFIX = { cañete: "C", los_pinos: "P" };

const LoteCreatePage = () => {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const remitoId       = searchParams.get("remito");

  const [remito, setRemito]   = useState(null);
  const [loadingRemito, setLoadingRemito] = useState(!!remitoId);

  const [remitosDisponibles, setRemitosDisponibles] = useState([]);
  const [loadingRemitos, setLoadingRemitos]         = useState(false);

  const [form, setForm] = useState({
    fechaIngreso:     obtenerFechaHoy(),
    kgVivos:          "",
    unidadesTrozadas: "",
    kgTrozados:       "",
    observaciones:    "",
  });
  const [lineas, setLineas]   = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (remitoId) return;
    setLoadingRemitos(true);
    obtenerRemitosGranja({ estado: "recibido" })
      .then((data) => setRemitosDisponibles(data.filter((r) => !r.loteIngresado)))
      .catch(() => {})
      .finally(() => setLoadingRemitos(false));
  }, [remitoId]);

  useEffect(() => {
    if (!remitoId) return;
    obtenerRemitoGranjaPorId(remitoId)
      .then((r) => {
        if (r.loteIngresado) {
          Swal.fire("Aviso", "Este remito ya tiene un lote ingresado.", "warning");
          navigate("/frigorifico/lotes/nuevo");
          return;
        }
        if (r.estado === "en_transito") {
          Swal.fire("Aviso", "El remito todavía no fue recepcionado.", "warning");
          navigate("/frigorifico/recepcion");
          return;
        }
        setRemito(r);
      })
      .catch(() => {
        Swal.fire("Error", "No se pudo cargar el remito.", "error");
        navigate("/frigorifico/lotes/nuevo");
      })
      .finally(() => setLoadingRemito(false));
  }, [remitoId, navigate]);

  const handleSeleccionarRemito = (e) => {
    const id = e.target.value;
    if (!id) { setRemito(null); return; }
    const found = remitosDisponibles.find((r) => r._id === id);
    if (found) setRemito(found);
  };

  const lineasCalculadas = lineas.map((l) => ({
    ...l,
    cajones: calcularCajones(l.pollos, l.calibre),
  }));
  const totalPollos  = lineasCalculadas.reduce((acc, l) => acc + Number(l.pollos || 0), 0);
  const totalCajones = lineasCalculadas.reduce((acc, l) => acc + l.cajones, 0);
  const totalKg      = totalCajones * 20;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalCajones === 0) {
      Swal.fire("Error", "Ingresá al menos una línea con pollos.", "error");
      return;
    }
    setLoading(true);
    try {
      const calibresPayload = lineasCalculadas
        .filter((l) => l.pollos && l.cajones > 0)
        .map(({ calibre, pollos, cajones }) => ({ calibre: Number(calibre), pollos: Number(pollos), cajones }));

      let loteCreado;

      if (remito) {
        loteCreado = await ingresarLoteDesdeRemito(remito._id, {
          fechaIngreso:     form.fechaIngreso,
          calibres:         calibresPayload,
          unidadesTrozadas: form.unidadesTrozadas ? Number(form.unidadesTrozadas) : 0,
          kgTrozados:       form.kgTrozados       ? Number(form.kgTrozados)       : 0,
          observaciones:    form.observaciones    || undefined,
        });
      } else {
        const payload = {
          fechaIngreso:  form.fechaIngreso,
          calibres:      calibresPayload,
          observaciones: form.observaciones || undefined,
        };
        if (form.kgVivos)          payload.kgVivos          = Number(form.kgVivos);
        if (form.unidadesTrozadas) payload.unidadesTrozadas = Number(form.unidadesTrozadas);
        if (form.kgTrozados)       payload.kgTrozados       = Number(form.kgTrozados);
        loteCreado = await crearLote(payload);
      }

      Swal.fire({
        icon: "success",
        title: `Lote #${loteCreado.numeroLote} creado`,
        html: `${fmtNum(totalPollos)} pollos · ${fmtNum(totalCajones)} cajones · ${fmtNum(totalKg)} kg`,
        timer: 2000,
        showConfirmButton: false,
      });
      navigate("/frigorifico");
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo crear el lote.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loadingRemito) {
    return <Layout><div className="text-center p-5"><div className="spinner-border text-primary"></div></div></Layout>;
  }

  const netos = remito?.netos ?? remito?.cantidadEnviada;

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex align-items-center gap-2 mb-4">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate(remito ? "/frigorifico/recepcion" : "/frigorifico")}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">Nuevo Lote</h1>
        </div>

        {/* Selector de remito — solo visible cuando se entra desde el menú (sin ?remito en URL) */}
        {!remitoId && (
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body py-3">
              <label className="form-label fw-semibold mb-2">
                <i className="bi bi-truck me-1 text-primary"></i>
                Vincular remito de granja <span className="fw-normal text-muted">(opcional)</span>
              </label>
              {loadingRemitos ? (
                <div className="d-flex align-items-center gap-2 text-muted small">
                  <div className="spinner-border spinner-border-sm"></div>
                  Cargando remitos...
                </div>
              ) : remitosDisponibles.length === 0 ? (
                <p className="text-muted small mb-0">No hay remitos recibidos pendientes de ingresar.</p>
              ) : (
                <select
                  className="form-select"
                  value={remito?._id || ""}
                  onChange={handleSeleccionarRemito}
                >
                  <option value="">— Crear lote sin remito —</option>
                  {remitosDisponibles.map((r) => {
                    const lg = r.loteGranja;
                    const origen = lg
                      ? `${GRANJA_LABEL[lg.granja]} — G${GRANJA_PREFIX[lg.granja]}${lg.galpon}`
                      : "Granja";
                    return (
                      <option key={r._id} value={r._id}>
                        {r.numeroRemito} · {origen} · {fmtNum(r.netos ?? r.cantidadEnviada)} pollos netos
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Banner de recepción vinculada */}
        {remito && (
          <div className="alert alert-primary border-start border-4 border-primary mb-4 py-3">
            <div className="d-flex align-items-center gap-2 mb-1">
              <i className="bi bi-truck fs-5"></i>
              <strong>Remito {remito.numeroRemito}</strong>
              {remito.loteGranja && (
                <span className="text-muted small ms-1">
                  — {GRANJA_LABEL[remito.loteGranja.granja]} G{GRANJA_PREFIX[remito.loteGranja.granja]}{remito.loteGranja.galpon}
                </span>
              )}
            </div>
            <div className="d-flex flex-wrap gap-3 mt-2">
              <div className="text-center px-3 border-end">
                <div className="text-muted small">Enviados</div>
                <div className="fw-bold">{fmtNum(remito.cantidadEnviada)}</div>
              </div>
              <div className="text-center px-3 border-end">
                <div className="text-muted small">Muertos</div>
                <div className="fw-bold text-danger">{fmtNum(remito.muertos ?? 0)}</div>
              </div>
              <div className="text-center px-3 border-end">
                <div className="text-muted small">Decomisados</div>
                <div className="fw-bold text-warning">{fmtNum(remito.decomisados ?? 0)}</div>
              </div>
              <div className="text-center px-3">
                <div className="text-muted small">Netos para faena</div>
                <div className="fw-bold text-success fs-5">{fmtNum(netos)}</div>
              </div>
            </div>
          </div>
        )}

        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                  <label className="form-label fw-semibold">Fecha de faena</label>
                  <input
                    type="date" className="form-control"
                    value={form.fechaIngreso}
                    onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
                    required
                  />
                </div>
                {!remito && (
                  <div className="col-6 col-md-3">
                    <label className="form-label">Kg vivos</label>
                    <input
                      type="number" className="form-control"
                      value={form.kgVivos}
                      onChange={(e) => setForm({ ...form, kgVivos: e.target.value })}
                      min="0" step="0.01" placeholder="0"
                    />
                  </div>
                )}
                <div className="col-6 col-md-3">
                  <label className="form-label">Trozados (u)</label>
                  <input
                    type="number" className="form-control"
                    value={form.unidadesTrozadas}
                    onChange={(e) => setForm({ ...form, unidadesTrozadas: e.target.value })}
                    min="0" placeholder="0"
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Trozados (kg)</label>
                  <input
                    type="number" className="form-control"
                    value={form.kgTrozados}
                    onChange={(e) => setForm({ ...form, kgTrozados: e.target.value })}
                    min="0" step="0.01" placeholder="0"
                  />
                </div>
                <div className="col-12 col-md-9">
                  <label className="form-label">Observaciones</label>
                  <input
                    type="text" className="form-control"
                    value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  />
                </div>
              </div>

              <label className="form-label fw-semibold">
                Calibres (resultado de la faena)
                {remito && netos > 0 && (
                  <span className="text-muted fw-normal ms-2 small">referencia: {fmtNum(netos)} pollos netos</span>
                )}
              </label>
              <p className="text-muted small mb-2">El calibre indica cuántos pollos entran en un cajón de 20 kg.</p>
              <CalibreTable lineas={lineas} onChange={setLineas} />

              {totalCajones > 0 && (
                <div className="alert alert-info py-2 mt-3 mb-3">
                  <div className="row text-center g-0">
                    <div className="col-4">
                      <div className="text-muted small">Pollos</div>
                      <div className="fw-bold">{fmtNum(totalPollos)}</div>
                    </div>
                    <div className="col-4 border-start border-end">
                      <div className="text-muted small">Cajones</div>
                      <div className="fw-bold">{fmtNum(totalCajones)}</div>
                    </div>
                    <div className="col-4">
                      <div className="text-muted small">Kg</div>
                      <div className="fw-bold">{fmtNum(totalKg)}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="d-grid gap-2 d-sm-flex mt-2">
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-plus-circle me-1"></i>Crear Lote
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(remito ? "/frigorifico/recepcion" : "/frigorifico")}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LoteCreatePage;
