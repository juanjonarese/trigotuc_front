import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import { especieDe, etiquetaEspecie } from "../../utils/especies";
import { formatearFechaLocal } from "../../utils/dateUtils";
import { obtenerStockForratuc } from "../../services/api";

/**
 * Stock de Forratuc (2026-10-26): todo lo que el local tiene para vender.
 *
 * Pollo, huevo y pollitos son stock de la avícola (entre empresas no se vende:
 * se usa el stock) y se leen igual que en el presupuesto. El alimento
 * balanceado es de Forratuc, que lo fabrica: se lleva en BOLSAS por alimento y
 * por depósito (Trigotuc y la forrajería).
 * Todo viene de GET /stock-forratuc; acá no se suma nada por cuenta propia.
 */
const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 1 });

const Resumen = ({ icono, titulo, valor, unidad, detalle }) => (
  <div className="col-6 col-lg-3">
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <div className="text-muted small fw-semibold d-flex align-items-center gap-2">
          <i className={`bi ${icono}`}></i>{titulo}
        </div>
        <div className="fs-3 fw-bold mt-1">
          {fmt(valor)} <span className="fs-6 fw-normal text-muted">{unidad}</span>
        </div>
        {detalle && <div className="small text-muted">{detalle}</div>}
      </div>
    </div>
  </div>
);

// Una fila de stock: nombre a la izquierda, cantidad a la derecha. Sirve igual
// en el celular que en la compu, sin tabla.
const Fila = ({ nombre, sub, cantidad, unidad, apagada }) => (
  <li className={`list-group-item d-flex justify-content-between align-items-center gap-3 ${apagada ? "text-muted" : ""}`}>
    <div>
      <div className={apagada ? "" : "fw-semibold"}>{nombre}</div>
      {sub && <div className="small text-muted">{sub}</div>}
    </div>
    <div className="text-end text-nowrap">
      <span className={apagada ? "" : "fw-bold"}>{fmt(cantidad)}</span>{" "}
      <span className="small text-muted">{unidad}</span>
    </div>
  </li>
);

const Seccion = ({ titulo, icono, children, vacio }) => (
  <div className="card border-0 shadow-sm mb-4">
    <div className="card-header bg-white fw-semibold">
      <i className={`bi ${icono} me-2 text-secondary`}></i>{titulo}
    </div>
    {vacio ? (
      <div className="card-body text-muted small">{vacio}</div>
    ) : (
      <ul className="list-group list-group-flush">{children}</ul>
    )}
  </div>
);

const ForratucStockPage = () => {
  const navigate = useNavigate();
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    setLoading(true);
    try {
      setStock(await obtenerStockForratuc());
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar el stock.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  const pollo = stock?.pollo;
  const huevos = stock?.huevos;
  const pollitos = stock?.pollitos;
  const alimento = stock?.alimento;
  const sinPesoBolsa = (alimento?.productos || []).some((p) => p.kgPorBolsa == null);

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/forratuc")}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">
            <i className="bi bi-boxes me-2 text-secondary"></i>Stock
          </h1>
          <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={cargar} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-1"></i>Actualizar
          </button>
        </div>

        {loading && !stock ? (
          <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
        ) : stock && (
          <>
            <div className="row g-3 mb-4">
              <Resumen icono="bi-snow" titulo="Pollo entero" valor={pollo.totalCajones} unidad="cajones"
                detalle={pollo.totalCajasTrozado ? `+ ${fmt(pollo.totalCajasTrozado)} cajas de trozado` : null} />
              <Resumen icono="bi-egg" titulo="Huevos" valor={huevos.maples} unidad="maples"
                detalle={`${fmt(huevos.total)} huevos`} />
              <Resumen icono="bi-feather" titulo="Pollitos" valor={pollitos.total} unidad="pollitos" />
              <Resumen icono="bi-bag" titulo="Alimento balanceado" valor={alimento.totalBolsas} unidad="bolsas"
                detalle={alimento.depositos.map((d) => `${d.etiqueta.replace(/^Depósito /, "")} ${fmt(d.bolsas)}`).join(" · ")} />
            </div>

            <div className="row g-4">
              <div className="col-lg-6">
                <Seccion titulo="Pollo · cámara Trigotuc" icono="bi-snow"
                  vacio={!pollo.enteros.length && !pollo.trozados.length ? "No hay pollo en la cámara Trigotuc." : null}>
                  {pollo.enteros.map((e) => (
                    <Fila key={`e|${especieDe(e)}|${e.calibre}`}
                      nombre={`${etiquetaEspecie(especieDe(e))} entero · calibre ${e.calibre}`}
                      sub={`${fmt(e.pollos)} aves`}
                      cantidad={e.cajones} unidad="cajones" />
                  ))}
                  {pollo.trozados.map((t) => (
                    <Fila key={`t|${especieDe(t)}|${t.tipo}|${t.clase || "A"}|${t.kgCaja}`}
                      nombre={`${etiquetaEspecie(especieDe(t))} ${t.etiqueta.toLowerCase()} ${t.clase || "A"}`}
                      sub={`caja de ${fmt(t.kgCaja)} kg · ${fmt(t.kgTotal)} kg en total`}
                      cantidad={t.cajas} unidad="cajas" />
                  ))}
                </Seccion>

                <Seccion titulo="Huevos" icono="bi-egg"
                  vacio={!huevos.porTipo.length ? "No hay huevo para vender." : null}>
                  {huevos.porTipo.map((h) => (
                    <Fila key={h.tipo} nombre={h.etiqueta} sub={`${fmt(h.huevos)} huevos`}
                      cantidad={h.maples} unidad="maples" />
                  ))}
                </Seccion>

                <Seccion titulo="Pollitos" icono="bi-feather"
                  vacio={!pollitos.envios.length ? "No hay pollitos en el mostrador." : null}>
                  {pollitos.envios.map((e) => (
                    <Fila key={e._id} nombre={`Envío ${e.numero}`}
                      sub={`${formatearFechaLocal(e.fecha)} · llegaron ${fmt(e.cantidad)}`}
                      cantidad={e.disponibles} unidad="pollitos" />
                  ))}
                </Seccion>
              </div>

              <div className="col-lg-6">
                {/* Alimento: en bolsas, una columna por depósito (2026-10-26).
                    Las columnas salen de `alimento.depositos`, así un depósito
                    nuevo aparece solo. */}
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-header bg-white fw-semibold">
                    <i className="bi bi-bag me-2 text-secondary"></i>Alimento balanceado · producción Forratuc
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Alimento</th>
                          {alimento.depositos.map((d) => (
                            <th key={d.key} className="text-end">{d.etiqueta.replace(/^Depósito /, "")}</th>
                          ))}
                          <th className="text-end">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alimento.productos.map((p) => (
                          <tr key={p.alimento} className={p.bolsas === 0 ? "text-muted" : ""}>
                            <td>
                              {p.etiqueta}
                              {p.kg != null && (
                                <div className="small text-muted">{fmt(p.kg)} kg · bolsa de {fmt(p.kgPorBolsa)} kg</div>
                              )}
                            </td>
                            {alimento.depositos.map((d) => (
                              <td key={d.key} className="text-end">{fmt(p.porDeposito[d.key])}</td>
                            ))}
                            <td className={`text-end ${p.bolsas ? "fw-bold" : ""}`}>{fmt(p.bolsas)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="table-light fw-semibold">
                        <tr>
                          <td>Total bolsas</td>
                          {alimento.depositos.map((d) => (
                            <td key={d.key} className="text-end">{fmt(d.bolsas)}</td>
                          ))}
                          <td className="text-end">{fmt(alimento.totalBolsas)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                {alimento.totalBolsas === 0 && (
                  <div className="small text-muted mb-2">
                    Todavía no se cargó ningún ingreso de alimento: el stock arranca cuando se registre la producción.
                  </div>
                )}
                {sinPesoBolsa && (
                  <div className="small text-muted">
                    Falta el peso de la bolsa de cada alimento para mostrar los kg.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default ForratucStockPage;
