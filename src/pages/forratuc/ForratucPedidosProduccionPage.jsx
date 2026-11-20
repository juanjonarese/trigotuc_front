import React from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import PedidosProduccion from "../../components/forratuc/PedidosProduccion";

/**
 * Pedidos a Producción (2026-11-20): Forratuc le pide mercadería a Producción,
 * la recibe y recién ahí sale del Depósito Producción y entra a la Forrajería.
 * La otra punta (Producción la prepara y la manda) es la solapa "Pedidos de
 * Forratuc" de /forratuc/produccion. Todo en components/forratuc/PedidosProduccion.jsx.
 */
const ForratucPedidosProduccionPage = () => {
  const navigate = useNavigate();
  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex flex-wrap gap-2 align-items-center mb-4">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/forratuc")}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">
            <i className="bi bi-cart-check me-2 text-success"></i>
            Pedidos a Producción
          </h1>
        </div>
        <PedidosProduccion lado="forratuc" />
      </div>
    </Layout>
  );
};

export default ForratucPedidosProduccionPage;
