import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import CalibreTable from "../components/CalibreTable";
import { obtenerResumenStock, registrarSalidaMostrador } from "../services/api";
import Swal from "sweetalert2";

const TIPOS_LABEL = { filet: "Filet", pata: "Pata/muslo", alita: "Alita", menudo: "Menudo", carcaza: "Carcaza" };
const fmt = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

const SalidaMostradorPage = () => {
  const navigate = useNavigate();
  const [resumen, setResumen]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [lineas, setLineas]     = useState([]);           // enteros: { calibre, cajones, pollos }
  const [trozadosLineas, setTrozadosLineas] = useState([]); // { tipo, clase, cajas, kgCaja }

  const cargar = async () => {
    try {
      setResumen(await obtenerResumenStock());
    } catch {
      Swal.fire("Error", "No se pudo cargar el stock.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  const stockEnteros = resumen?.stockTrigotuc || [];
  const trozadosDisp = (resumen?.trozadosTrigotucDetalle || []).filter((t) => t.cajas > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const calibresValidos = lineas.filter((l) => Number(l.cajones) > 0);
    const trozadosValidos = trozadosLineas.filter((t) => Number(t.cajas) > 0);

    if (calibresValidos.length === 0 && trozadosValidos.length === 0) {
      Swal.fire("Faltan datos", "Ingresá al menos un cajón o una caja vendida.", "warning");
      return;
    }

    // Validar stock disponible
    for (const t of trozadosValidos) {
      const disp = trozadosDisp.find((d) => d.tipo === t.tipo && d.clase === t.clase)?.cajas || 0;
      if (Number(t.cajas) > disp) {
        Swal.fire("Error", `Stock insuficiente de ${TIPOS_LABEL[t.tipo] || t.tipo} clase ${t.clase}. Disponible: ${disp} cajas.`, "error");
        return;
      }
    }
    for (const c of calibresValidos) {
      const disp = stockEnteros.find((s) => s.calibre === Number(c.calibre))?.cajones || 0;
      if (Number(c.cajones) > disp) {
        Swal.fire("Error", `Stock insuficiente de Cal. ${c.calibre}. Disponible: ${disp} cajones.`, "error");
        return;
      }
    }

    setSaving(true);
    try {
      await registrarSalidaMostrador({
        calibres: calibresValidos.map((c) => ({ calibre: Number(c.calibre), cajones: Number(c.cajones) })),
        trozados: trozadosValidos.map((t) => ({ tipo: t.tipo, clase: t.clase, cajas: Number(t.cajas), kgCaja: Number(t.kgCaja) })),
      });
      await Swal.fire({ icon: "success", title: "Salida registrada", text: "Se descontó el stock de Trigotuc.", timer: 1500, showConfirmButton: false });
      setLineas([]);
      setTrozadosLineas([]);
      cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar la salida.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex align-items-center gap-2 mb-4">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/frigorifico")}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">
            <i className="bi bi-shop me-2 text-secondary"></i>
            Salida de Mostrador — Trigotuc
          </h1>
        </div>

        <div className="alert alert-info py-2 small">
          <i className="bi bi-info-circle me-1"></i>
          Cargá lo que se vendió por mostrador. Descuenta el stock de la cámara <strong>Trigotuc</strong>.
          (Puente manual hasta que el POS descuente automático.)
        </div>

        {loading ? (
          <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
        ) : (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                {/* Enteros */}
                {stockEnteros.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Pollo entero (por cajón)</label>
                    <CalibreTable lineas={lineas} onChange={setLineas} inputCajones showPollos={false} stockCalibres={stockEnteros} />
                  </div>
                )}

                {/* Trozados */}
                {trozadosDisp.length > 0 ? (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Trozados (por caja)</label>
                    <table className="table table-sm table-bordered align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Tipo</th>
                          <th>Clase</th>
                          <th className="text-end">Disponible</th>
                          <th style={{ width: "9rem" }}>Cajas vendidas</th>
                          <th className="text-muted small">kg/caja</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trozadosDisp.map((t) => {
                          const linea = trozadosLineas.find((l) => l.tipo === t.tipo && l.clase === t.clase) || { tipo: t.tipo, clase: t.clase, cajas: "", kgCaja: t.kgCaja };
                          return (
                            <tr key={`${t.tipo}-${t.clase || "A"}`}>
                              <td className="text-capitalize fw-semibold">{TIPOS_LABEL[t.tipo] || t.tipo}</td>
                              <td><span className="badge bg-secondary">Clase {t.clase || "A"}</span></td>
                              <td className="text-end text-muted">{fmt(t.cajas)} cajas</td>
                              <td>
                                <input
                                  type="number" min="0" max={t.cajas} step="1"
                                  className="form-control form-control-sm text-center"
                                  placeholder="0"
                                  value={linea.cajas}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTrozadosLineas((prev) => {
                                      const idx = prev.findIndex((l) => l.tipo === t.tipo && l.clase === t.clase);
                                      const nueva = { tipo: t.tipo, clase: t.clase, cajas: val, kgCaja: t.kgCaja };
                                      return idx === -1 ? [...prev, nueva] : prev.map((l, i) => i === idx ? nueva : l);
                                    });
                                  }}
                                />
                              </td>
                              <td className="text-muted small">{t.kgCaja} kg</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : stockEnteros.length === 0 && (
                  <p className="text-muted">No hay stock en la cámara Trigotuc.</p>
                )}

                <button type="submit" className="btn btn-primary" disabled={saving || (stockEnteros.length === 0 && trozadosDisp.length === 0)}>
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-cart-dash me-1"></i>
                  Registrar salida
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SalidaMostradorPage;
