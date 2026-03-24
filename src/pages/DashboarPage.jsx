import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../css/DashboardPage.css";
import { obtenerCtaCteClientes, obtenerResumenStock } from "../services/api";
import Layout from "../components/Layout";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

const DashboardPage = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [stockGranja, setStockGranja] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const COLORS = ["#198754", "#0d6efd", "#ffc107", "#dc3545"];

  useEffect(() => {
    const rol = localStorage.getItem("rolUsuario");
    if (rol === "frigorifico") {
      navigate("/frigorifico/lotes/nuevo");
      return;
    }
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [dataClientes, dataGranja] = await Promise.all([
        obtenerCtaCteClientes(),
        obtenerResumenStock().catch(() => null), // no bloquea si falla
      ]);
      setClientes(dataClientes.cuentasCorrientes || []);
      setStockGranja(dataGranja);
      setError("");
    } catch (err) {
      console.error("Error al cargar datos:", err);
      setError("Error al cargar los datos del dashboard");
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatNum = (n) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n ?? 0);

  const totalesClientes = clientes.reduce(
    (acc, cta) => ({
      facturado: acc.facturado + (cta.totalFacturasARS || 0),
      pagos:     acc.pagos     + (cta.totalCobrosARS  || 0),
      saldo:     acc.saldo     + (cta.saldoARS         || 0),
    }),
    { facturado: 0, pagos: 0, saldo: 0 }
  );

  // Gráfico frigorífico: cajones por calibre, desglosado por cámara
  const dataGranjaBar = (() => {
    if (!stockGranja) return [];
    const calibres = new Set([
      ...(stockGranja.stockCañete   || []).map((c) => c.calibre),
      ...(stockGranja.stockTrigotuc || []).map((c) => c.calibre),
    ]);
    const cañeteMap   = Object.fromEntries((stockGranja.stockCañete   || []).map((c) => [c.calibre, c.cajones]));
    const trigotucMap = Object.fromEntries((stockGranja.stockTrigotuc || []).map((c) => [c.calibre, c.cajones]));
    return [...calibres].sort((a, b) => a - b).map((cal) => ({
      calibre:  `Cal. ${cal}`,
      Cañete:   cañeteMap[cal]   || 0,
      Trigotuc: trigotucMap[cal] || 0,
    }));
  })();

  const dataClientesPie = [
    { name: "Facturado", value: totalesClientes.facturado },
    { name: "Cobrado",   value: totalesClientes.pagos     },
    { name: "Saldo",     value: totalesClientes.saldo     },
  ].filter((item) => item.value > 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.95)",
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "5px",
            boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
          }}
        >
          <p className="mb-1 fw-bold">{payload[0].name}</p>
          <p className="mb-0" style={{ color: payload[0].fill }}>
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Layout>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
          <div className="spinner-border text-success" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container-fluid">
          <div className="alert alert-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container-fluid">
        {/* Header */}
        <div className="mb-4">
          <h1 className="h3 mb-0">
            <i className="bi bi-speedometer2 me-2"></i>
            Dashboard
          </h1>
          <p className="text-muted mb-0 small">Resumen general del sistema</p>
        </div>

        {/* ── Fila 1: Clientes + Granja ── */}
        <div className="row g-3 mb-4">
          {/* Card Clientes */}
          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-people-fill text-success me-2"></i>
                    Clientes
                  </h5>
                  <span className="badge bg-success">{clientes.length}</span>
                </div>
                <div className="row text-center g-0">
                  <div className="col-4 border-end">
                    <small className="text-muted d-block">Facturado</small>
                    <span className="fw-semibold text-primary" style={{ fontSize: "0.85rem" }}>
                      {formatCurrency(totalesClientes.facturado)}
                    </span>
                  </div>
                  <div className="col-4 border-end">
                    <small className="text-muted d-block">Cobrado</small>
                    <span className="fw-semibold text-success" style={{ fontSize: "0.85rem" }}>
                      {formatCurrency(totalesClientes.pagos)}
                    </span>
                  </div>
                  <div className="col-4">
                    <small className="text-muted d-block">Saldo</small>
                    <span className="fw-semibold text-danger" style={{ fontSize: "0.85rem" }}>
                      {formatCurrency(totalesClientes.saldo)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="card-footer bg-transparent border-0 pb-3">
                <button
                  className="btn btn-outline-success btn-sm w-100"
                  onClick={() => navigate("/cta-cte-clientes")}
                >
                  Ver cuenta corriente
                </button>
              </div>
            </div>
          </div>

          {/* Card Granja */}
          {stockGranja && (
            <div className="col-12 col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="card-title mb-0">
                      <i className="bi bi-snow text-warning me-2"></i>
                      Frigorífico — Stock
                    </h5>
                  </div>
                  <div className="row text-center g-0">
                    <div className="col-4 border-end">
                      <small className="text-muted d-block">Pollos</small>
                      <span className="fw-semibold" style={{ fontSize: "0.85rem" }}>
                        {formatNum(stockGranja.totalPollosVivos)}
                      </span>
                    </div>
                    <div className="col-4 border-end">
                      <small className="text-muted d-block">Kg totales</small>
                      <span className="fw-semibold" style={{ fontSize: "0.85rem" }}>
                        {formatNum(stockGranja.totalKg)}
                      </span>
                    </div>
                    <div className="col-4">
                      <small className="text-muted d-block">Cajones</small>
                      <span className="fw-semibold text-primary" style={{ fontSize: "0.85rem" }}>
                        {formatNum(stockGranja.cajonesDisponibles)}
                      </span>
                    </div>
                  </div>
                  {stockGranja.porCalibre && stockGranja.porCalibre.length > 0 && (
                    <div className="d-flex flex-wrap gap-1 mt-2">
                      {stockGranja.porCalibre.map((c) => (
                        <span key={c.calibre} className="badge bg-primary" style={{ fontSize: "0.7rem" }}>
                          Cal.{c.calibre}: {formatNum(c.cajones)} caj
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="card-footer bg-transparent border-0 pb-3">
                  <button
                    className="btn btn-outline-warning btn-sm w-100"
                    onClick={() => navigate("/frigorifico")}
                  >
                    Ver stock frigorífico
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Gráficos ── */}
        {(dataClientesPie.length > 0 || dataGranjaBar.length > 0) && (
          <div className="row g-3">

            {/* Gráfico clientes */}
            {dataClientesPie.length > 0 && (
              <div className="col-12 col-md-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h5 className="card-title mb-3">
                      <i className="bi bi-pie-chart-fill text-success me-2"></i>
                      Distribución Clientes
                    </h5>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={dataClientesPie}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={90}
                          dataKey="value"
                        >
                          {dataClientesPie.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Gráfico frigorífico */}
            {dataGranjaBar.length > 0 && (
              <div className="col-12 col-md-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h5 className="card-title mb-3">
                      <i className="bi bi-bar-chart-fill text-warning me-2"></i>
                      Stock por calibre y cámara
                    </h5>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={dataGranjaBar} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="calibre" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(value, name) => [`${formatNum(value)} caj`, name]}
                          contentStyle={{ fontSize: 13 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 13 }} />
                        <Bar dataKey="Cañete"   fill="#0dcaf0" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Trigotuc" fill="#0d6efd" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </Layout>
  );
};

export default DashboardPage;
