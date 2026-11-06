/**
 * Cartel del ENTORNO DE PRUEBA (2026-11-06): la app de prueba (rama `prueba`
 * en Vercel) lleva VITE_ENTORNO=prueba y usa otra base (trigotuc_prueba), para
 * que el cliente pruebe sin tocar los datos reales. El cartel está para que
 * nadie la confunda con la de verdad. En producción la variable no existe y
 * esto no dibuja nada.
 */
const esEntornoPrueba = import.meta.env.VITE_ENTORNO === "prueba";

const BannerPrueba = () =>
  esEntornoPrueba ? (
    <div className="text-center fw-bold small py-1"
      style={{ background: "repeating-linear-gradient(45deg,#ffc107,#ffc107 12px,#ffcd39 12px,#ffcd39 24px)", color: "#000", position: "sticky", top: 0, zIndex: 1100 }}>
      <i className="bi bi-cone-striped me-1"></i>
      ENTORNO DE PRUEBA — los datos son una copia: lo que se cargue acá no cuenta
    </div>
  ) : null;

export default BannerPrueba;
