/**
 * Piezas compartidas por las solapas del Dashboard (Granja, Frigorífico y
 * Reproductoras): las tarjetas de KPI y los títulos de sección. Los formatos
 * de números están en `utils/formatoDashboard.js`.
 */

export const KpiCard = ({ icon, label, value, sub, color = "text-dark", onClick }) => (
  <div className={`card border-0 shadow-sm h-100 ${onClick ? "cursor-pointer" : ""}`}
    style={{ borderTop: `3px solid var(--bs-${color.replace("text-", "")}, #198754)` }}
    onClick={onClick}>
    <div className="card-body py-3">
      <div className="d-flex align-items-center gap-2 mb-1">
        <i className={`bi bi-${icon} fs-5 ${color}`}></i>
        <span className="text-muted small text-uppercase fw-semibold" style={{ fontSize: "0.65rem", letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <div className={`fw-bold fs-4 ${color}`}>{value}</div>
      {sub && <div className="text-muted small mt-1">{sub}</div>}
    </div>
  </div>
);

export const SectionTitle = ({ icon, title, color }) => (
  <div className="d-flex align-items-center gap-2 mb-3">
    <i className={`bi bi-${icon} fs-5 ${color}`}></i>
    <h5 className="mb-0 fw-semibold">{title}</h5>
  </div>
);

// Título chico en mayúsculas de adentro de una tarjeta.
export const CardLabel = ({ children, className = "mb-3" }) => (
  <h6 className={`text-muted text-uppercase fw-semibold ${className}`} style={{ fontSize: "0.7rem", letterSpacing: "0.05em" }}>
    {children}
  </h6>
);
