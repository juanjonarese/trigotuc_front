import React from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";

// Forratuc (2026-10-16): local de venta al público del grupo. Vende lo propio
// (alimento balanceado que fabrica, aceites, etc.) y lo de la avícola (pollo,
// huevo y pollitos), que entre empresas no se vende: se usa el stock.
// En desarrollo: solo lo ve el superadmin hasta que se libere.
const PROXIMAMENTE = [
  { titulo: "Ingreso de alimento balanceado", texto: "Cargar lo que se produce, para que entre al stock en bolsas." },
  { titulo: "Otros artículos", texto: "Catálogo propio de Forratuc más allá del alimento: aceites y demás." },
];

const ForratucInicioPage = () => {
  const navigate = useNavigate();

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

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <div className="fw-semibold">Stock</div>
              <div className="text-muted small">Lo que hay para vender: pollo, huevo y pollitos de la avícola, y el alimento balanceado que produce Forratuc, en bolsas.</div>
            </div>
            <button type="button" className="btn btn-dark btn-sm" onClick={() => navigate("/forratuc/stock")}>
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
