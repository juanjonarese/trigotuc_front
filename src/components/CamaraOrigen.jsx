import { CAMARAS, estiloCamara } from "../utils/camaras";

/**
 * Botonera para filtrar las órdenes por cámara: Todas / Cañete / Trigotuc, cada
 * una con su color.
 */
export const FiltroCamara = ({ valor, onChange }) => (
  <div className="btn-group btn-group-sm" role="group">
    <button
      type="button"
      className={`btn ${valor === "" ? "btn-dark" : "btn-outline-secondary"}`}
      onClick={() => onChange("")}
    >
      Todas las cámaras
    </button>
    {CAMARAS.map((c) => {
      const e = estiloCamara(c.value);
      const sel = valor === c.value;
      return (
        <button
          key={c.value}
          type="button"
          className="btn fw-semibold"
          style={{
            border: `1px solid ${e.color}`,
            background: sel ? e.color : "#fff",
            color: sel ? "#fff" : e.color,
          }}
          onClick={() => onChange(c.value)}
        >
          <i className="bi bi-snow me-1"></i>{c.label}
        </button>
      );
    })}
  </div>
);

/**
 * Badge de la cámara con su color (azul Cañete, naranja Trigotuc).
 */
export const BadgeCamara = ({ camara, className = "" }) => {
  const e = estiloCamara(camara);
  return (
    <span className={`badge ${className}`} style={{ background: e.color, color: "#fff" }}>
      <i className="bi bi-snow me-1"></i>{e.label}
    </span>
  );
};

/**
 * Franja de arriba de la tarjeta de una orden: "SALE DE CAÑETE" / "SALE DE
 * TRIGOTUC" bien grande y con el color de la cámara. Es lo primero que ve el
 * personal, para que no vaya a cargar a la cámara equivocada.
 */
export const FranjaCamara = ({ camara }) => {
  const e = estiloCamara(camara);
  return (
    <div
      className="d-flex align-items-center justify-content-center fw-bold text-uppercase py-1"
      style={{
        background: e.color,
        color: "#fff",
        letterSpacing: ".08em",
        fontSize: ".85rem",
        borderTopLeftRadius: "inherit",
        borderTopRightRadius: "inherit",
      }}
    >
      <i className="bi bi-snow me-2"></i>Sale de {e.label}
    </div>
  );
};

