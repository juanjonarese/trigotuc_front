import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { obtenerEmpresasUsuario } from "../utils/empresas";

// Forratuc (2026-10-16): local de venta al público del grupo. Vende lo propio
// (alimento balanceado que fabrica, aceites, etc.) y lo de la avícola (pollo,
// huevo y pollitos), que entre empresas no se vende: se usa el stock.
// En desarrollo: solo lo ve el superadmin hasta que se libere.
const PROXIMAMENTE = [
  { titulo: "Artículos y stock", texto: "Catálogo propio de Forratuc: alimento balanceado, aceites y demás." },
  { titulo: "Stock de la avícola", texto: "Pollo, huevo y pollitos que se toman del stock de Trigotuc Avícola." },
];

const ForratucInicioPage = () => {
  const navigate = useNavigate();
  const habilitada = obtenerEmpresasUsuario().some((e) => e.clave === "forratuc");
  if (!habilitada) return <Navigate to="/inicio" replace />;

  return (
    <Layout>
      <div className="container-fluid">
        <h1 className="h3 mb-1">Forratuc</h1>
        <p className="text-muted mb-4">
          Local de venta al público · <span className="small fw-semibold">EN DESARROLLO</span>, por ahora solo lo ve el superadmin.
        </p>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <div className="fw-semibold">Mostrador · Presupuestos</div>
              <div className="text-muted small">Fecha, cliente y precios: pollo, huevo, pollitos y alimento. Contado o cuenta corriente. Se imprime y el cliente retira con él.</div>
            </div>
            <button type="button" className="btn btn-dark btn-sm" onClick={() => navigate("/forratuc/mostrador")}>
              Abrir
            </button>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <div className="fw-semibold">Cuentas corrientes</div>
              <div className="text-muted small">Lo que deben los clientes por presupuestos en cuenta corriente, y los pagos a cuenta con recibo.</div>
            </div>
            <button type="button" className="btn btn-dark btn-sm" onClick={() => navigate("/forratuc/cuentas-corrientes")}>
              Abrir
            </button>
          </div>
        </div>

        <div className="text-muted small fw-semibold mb-2">PRÓXIMAMENTE</div>
        <div className="card border-0 shadow-sm">
          <ul className="list-group list-group-flush">
            {PROXIMAMENTE.map((p) => (
              <li key={p.titulo} className="list-group-item py-3">
                <div className="fw-semibold text-secondary">{p.titulo}</div>
                <div className="text-muted small">{p.texto}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default ForratucInicioPage;
