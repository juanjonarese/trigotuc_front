import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Almanaque from "../components/Almanaque";
import ConfigGalponesModal from "../components/ConfigGalponesModal";
import BotonExcel from "../components/BotonExcel";
import {
  obtenerAlmanaque,
  previewResetReproductores,
  resetearReproductores,
} from "../services/api";
// Los usa el Excel del almanaque (hojas de nacimientos y galpones).
import { ESTADO_TANDA, labelGranja } from "../utils/reproductoresUtils";
import { exportarLibroExcel } from "../utils/exportarExcel";
import Swal from "sweetalert2";

// ── Página ──────────────────────────────────────────────────────────────────
// Proyección (`/proyeccion`): el almanaque de faena. Contesta "¿voy a tener
// pollos todos los días para faenar?" — la cinta de cada galpón (crianza →
// saneamiento), los pollos que salen por día contra el objetivo, y la curva de
// huevos de los planteles. Más su Excel, los Parámetros y el reset del módulo.
//
// Se llamaba `ReservaPollitosPage` porque además tenía una solapa "Reparto
// nacimientos". Esa solapa se eliminó el 2026-09-20 — la absorbió el Plan de
// Pollitos (`/reproductores/plan`), que reparte por CARGA de incubadora y no
// por tanda, que es la unidad con la que piensa el cliente — así que el archivo
// se renombró a lo que de verdad es. Acá NO se asigna ningún pollito.
const ProyeccionPage = () => {
  const [almanaque, setAlmanaque] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  // Los dos botones de esta barra NO tienen el mismo candado, y es a propósito:
  // el `admin` toca los parámetros (mueve números, se corrige volviendo a
  // tocarlos) pero no resetea el módulo (borra todo y no se deshace).
  const rolUsuario = localStorage.getItem("rolUsuario");
  const puedeEditarParametros = rolUsuario === "superadmin" || rolUsuario === "admin";
  const puedeResetear = rolUsuario === "superadmin";
  const [reseteando, setReseteando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      // El estado de los galpones ya lo muestra el almanaque, que además dice
      // cuándo se libera cada uno: el panel viejo quedó de más.
      setAlmanaque(await obtenerAlmanaque());
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar el panorama.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ── Excel ──────────────────────────────────────────────────────────────────
  // El Gantt no se puede bajar como imagen útil, pero sí los números que lo
  // dibujan: cada carril del gráfico es una hoja del libro. Así el cliente puede
  // hacer sus propias cuentas sobre la misma proyección que ve en pantalla.
  const exportarAlmanaqueExcel = () => {
    if (!almanaque) return;
    const par = almanaque.parametros || {};
    const res = almanaque.resumen || {};
    const parH = almanaque.huevos?.parametros || {};
    const resH = almanaque.huevos?.resumen || {};

    // Hoja de resumen: concepto / valor, para que los supuestos viajen con los datos.
    const resumen = [
      ["Ventana — desde", par.desdeClave],
      ["Ventana — hasta", par.hastaClave],
      ["Hoy", par.hoyClave],
      ["Días proyectados", par.ventana?.proyectados],
      ["Días de contexto previo (no suman)", par.ventana?.contextoPrevio],
      ["Ciclo de galpón (días)", par.ventana?.diasCicloGalpon],
      ["Días de crianza", par.diasCrianza],
      ["Días de saneamiento", par.diasVaciamiento],
      ["Objetivo de faena diario", par.objetivoDiario],
      ["Mortandad de engorde asumida", par.mortandadEngorde],
      ["FAENA — días de faena en la ventana", res.diasFaenaEnVentana],
      ["FAENA — pollos programados", res.pollosProgramados],
      ["FAENA — de stock real", res.pollosProgramadosReales],
      ["FAENA — proyectados (aún sin nacer)", res.pollosProgramadosProyectados],
      ["FAENA — objetivo total", res.objetivoTotal],
      ["FAENA — cobertura", res.cobertura],
      ["FAENA — días con hueco", res.diasConHueco],
      ["FAENA — días sin nada que faenar", res.diasSinNadaQueFaenar],
      ["FAENA — pollos que no entran en la agenda", res.pollosSinFaenar],
      ["GALPONES — capacidad instalada", res.capacidadInstalada],
      ["GALPONES — disponibles hoy", res.galponesDisponiblesHoy],
      ["GALPONES — capacidad disponible hoy", res.capacidadDisponibleHoy],
      ["POLLITOS — sin asignar", res.pollitosSinAsignar],
      ["HUEVOS — objetivo incubables por día", parH.objetivoIncubablesDiario],
      ["HUEVOS — días proyectados", resH.diasProyectados],
      ["HUEVOS — totales en la ventana", resH.huevosTotales],
      ["HUEVOS — incubables en la ventana", resH.huevosIncubables],
      ["HUEVOS — promedio diario de incubables", resH.promedioDiarioIncubables],
      ["HUEVOS — cobertura de la incubadora", resH.coberturaIncubadora],
      ["HUEVOS — días bajo objetivo", resH.diasBajoObjetivo],
      ["HUEVOS — planteles aportando", resH.plantelesAportando],
    ].map(([concepto, valor]) => ({ concepto, valor }));

    // Huevos por plantel: se aplana día × plantel para poder hacer tabla
    // dinámica. Es la curva de cada color del gráfico.
    const huevosPorPlantel = (almanaque.huevos?.dias || []).flatMap((d) =>
      (d.porPlantel || []).map((pl) => ({ ...pl, clave: d.clave, esPasado: d.esPasado }))
    );

    exportarLibroExcel({
      nombreArchivo: "Proyeccion_almanaque",
      hojas: [
        {
          nombre: "Resumen",
          filas: resumen,
          columnas: [
            { header: "Concepto", valor: (f) => f.concepto, ancho: 42 },
            { header: "Valor",    valor: (f) => (f.valor ?? "") },
          ],
        },
        {
          nombre: "Faena por día",
          filas: almanaque.faena || [],
          columnas: [
            { header: "Fecha",           valor: (d) => d.clave },
            { header: "Es día de faena", valor: (d) => (d.esFaena ? "Sí" : "No") },
            { header: "Cerrado por",     valor: (d) => d.cerradoPor },
            { header: "Feriado",         valor: (d) => d.feriado },
            { header: "Objetivo",        valor: (d) => d.objetivo ?? 0 },
            { header: "Pollos",          valor: (d) => d.pollos ?? 0 },
            { header: "De stock real",   valor: (d) => d.pollosReales ?? 0 },
            { header: "Proyectados",     valor: (d) => d.pollosProyectados ?? 0 },
            { header: "Déficit",         valor: (d) => d.deficit ?? 0 },
            {
              header: "Galpones que aportan",
              valor: (d) =>
                (d.porGalpon || []).map((g) => (g.etiqueta || g.galpon) + ": " + g.pollos).join(" · "),
              ancho: 40,
            },
          ],
        },
        {
          nombre: "Huevos por día",
          filas: almanaque.huevos?.dias || [],
          columnas: [
            { header: "Fecha",               valor: (d) => d.clave },
            { header: "Pasado",              valor: (d) => (d.esPasado ? "Sí" : "No") },
            { header: "Totales proyect.",    valor: (d) => d.totales ?? 0 },
            { header: "Incubables proyect.", valor: (d) => d.incubables ?? 0 },
            { header: "Descarte proyect.",   valor: (d) => d.descarte ?? 0 },
            { header: "Objetivo incubables", valor: (d) => d.objetivoIncubables ?? 0 },
            { header: "Déficit incubables",  valor: (d) => d.deficitIncubables ?? 0 },
            { header: "Planteles aportando", valor: (d) => d.planteles ?? 0 },
            { header: "Real — totales",      valor: (d) => (d.real ? d.real.totales : "") },
            { header: "Real — incubables",   valor: (d) => (d.real ? d.real.incubables : "") },
            { header: "Desvío real vs proy.", valor: (d) => (d.real ? d.real.desvio : "") },
          ],
        },
        {
          nombre: "Huevos por plantel",
          filas: huevosPorPlantel,
          columnas: [
            { header: "Fecha",           valor: (f) => f.clave },
            { header: "Pasado",          valor: (f) => (f.esPasado ? "Sí" : "No") },
            { header: "Plantel",         valor: (f) => f.numeroLote ?? "" },
            { header: "Galpón",          valor: (f) => f.etiqueta },
            { header: "Semana vida",     valor: (f) => f.semanaVida ?? "" },
            { header: "Hembras",         valor: (f) => f.hembras ?? 0 },
            { header: "Totales",         valor: (f) => f.totales ?? 0 },
            { header: "Incubables",      valor: (f) => f.incubables ?? 0 },
            { header: "Sigue en recría", valor: (f) => (f.enRecriaHoy ? "Sí" : "") },
          ],
        },
        {
          nombre: "Nacimientos",
          filas: almanaque.nacimientos || [],
          columnas: [
            { header: "Fecha",             valor: (n) => n.fechaClave },
            { header: "Tanda",             valor: (n) => n.numeroTanda ?? "" },
            { header: "Plantel",           valor: (n) => n.lote?.numeroLote ?? "" },
            { header: "Ya nació",          valor: (n) => (n.nacio ? "Sí" : "No") },
            { header: "Días para nacer",   valor: (n) => n.diasParaNacer ?? "" },
            { header: "Pollitos",          valor: (n) => n.pollitos ?? 0 },
            { header: "A galpón propio",   valor: (n) => n.asignadoAGalpon ?? 0 },
            { header: "A granja s/galpón", valor: (n) => n.asignadoAGranjaSinGalpon ?? 0 },
            { header: "A clientes",        valor: (n) => n.asignadoAClientes ?? 0 },
            { header: "Con destino",       valor: (n) => n.conDestino ?? 0 },
            { header: "Sin asignar",       valor: (n) => n.sinAsignar ?? 0 },
            { header: "Sobreasignado",     valor: (n) => n.sobreasignado ?? 0 },
            { header: "Estado",            valor: (n) => ESTADO_TANDA[n.estado]?.label || n.estado },
          ],
        },
        {
          nombre: "Galpones",
          filas: almanaque.galpones || [],
          columnas: [
            { header: "Galpón",            valor: (g) => g.etiqueta },
            { header: "Granja",            valor: (g) => labelGranja(g.granja) },
            { header: "Número",            valor: (g) => g.galpon ?? "" },
            { header: "Capacidad",         valor: (g) => g.capacidad ?? "" },
            { header: "Días de faena que cubre", valor: (g) => g.diasFaenaQueCubre ?? "" },
            { header: "Fuera de servicio", valor: (g) => (g.fueraDeServicio ? "Sí" : "") },
            { header: "Ocupado",           valor: (g) => (g.ocupado ? "Sí" : "") },
            { header: "Lote actual",       valor: (g) => g.loteActual?.numeroLote ?? "" },
            { header: "Pollos del lote",   valor: (g) => g.loteActual?.pollos ?? "" },
            { header: "Excede tiempo",     valor: (g) => (g.atrasado ? "Sí" : "") },
            { header: "Días de atraso",    valor: (g) => g.diasAtraso ?? 0 },
            { header: "Libre desde",       valor: (g) => g.libreDesdeClave },
            { header: "Fecha estimada",    valor: (g) => (g.libreDesdeEstimada ? "Sí" : "") },
          ],
        },
        {
          nombre: "Huecos de faena",
          filas: almanaque.huecos || [],
          columnas: [
            { header: "Desde",               valor: (h) => h.desdeClave },
            { header: "Hasta",               valor: (h) => h.hastaClave },
            { header: "Días de faena",       valor: (h) => h.diasFaena ?? 0 },
            { header: "Pollos faltantes",    valor: (h) => h.faltante ?? 0 },
            { header: "Sin nada que faenar", valor: (h) => (h.vacio ? "Sí" : "") },
          ],
        },
      ],
    });
  };

  // ── Resetear el módulo Reproductores ──────────────────────────────────────
  // Borra el módulo entero, así que la confirmación muestra primero QUÉ se va a
  // borrar (traído del backend, no estimado acá) y recién después pide escribir
  // RESETEAR. El backend vuelve a exigir esa palabra y guarda un respaldo completo
  // antes de tocar nada.
  const handleResetear = async () => {
    let previo;
    try {
      previo = await previewResetReproductores();
    } catch (err) {
      return Swal.fire("Error", err.message || "No se pudo consultar qué hay para borrar.", "error");
    }

    const filas = Object.entries(previo.conteo || {})
      .filter(([, n]) => n > 0)
      .map(([nombre, n]) => `<tr><td class="text-start">${nombre}</td><td class="text-end fw-bold">${n}</td></tr>`)
      .join("");

    const { value: confirmacion } = await Swal.fire({
      icon: "warning",
      title: "Resetear proyección",
      html: `
        <p class="mb-2">Se va a borrar <b>todo el módulo Reproductores</b> y los contadores vuelven a cero:
        el próximo plantel será el #1 y la próxima tanda la #1.</p>
        ${filas
          ? `<table class="table table-sm mb-2"><tbody>${filas}</tbody></table>
             <p class="mb-2"><b>${previo.total}</b> documento(s) en total.</p>`
          : `<p class="mb-2 text-muted">No hay nada cargado: el módulo ya está vacío.</p>`}
        <p class="small text-muted mb-2">Granja y Frigorífico no se tocan. Se guarda un respaldo antes de borrar.</p>
        <p class="mb-1">Escribí <b>RESETEAR</b> para confirmar:</p>
      `,
      input: "text",
      inputPlaceholder: "RESETEAR",
      showCancelButton: true,
      confirmButtonText: "Resetear",
      confirmButtonColor: "#dc3545",
      cancelButtonText: "Cancelar",
      inputValidator: (v) => (v !== "RESETEAR" ? "Escribí RESETEAR tal cual para confirmar." : undefined),
    });

    if (confirmacion !== "RESETEAR") return;

    setReseteando(true);
    try {
      const r = await resetearReproductores(confirmacion);
      await cargar();
      Swal.fire(
        "Módulo reseteado",
        `Se borraron ${r.total} documento(s). El respaldo quedó guardado en la base.`,
        "success"
      );
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo resetear el módulo.", "error");
    } finally {
      setReseteando(false);
    }
  };

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-0">
              <i className="bi bi-graph-up-arrow text-success me-2"></i>Proyección
            </h1>
            {/* De dónde sale el largo de todo lo que se ve abajo. Sin esto, el
                "en 131 días" de las tarjetas parece un número elegido a ojo, y
                en realidad es la unidad con la que trabaja la granja: el ciclo
                del galpón. Los valores salen del backend, así que si el cliente
                confirma otros tiempos el texto se corrige solo. */}
            {almanaque?.parametros?.ventana && (
              <p className="text-muted mb-0 small">
                Los cálculos se basan en{" "}
                <strong>
                  {almanaque.parametros.ventana.ciclosGalpon} ciclos de{" "}
                  {almanaque.parametros.ventana.diasCicloGalpon} días
                </strong>{" "}
                — {almanaque.parametros.diasCrianza} de crianza +{" "}
                {almanaque.parametros.diasVaciamiento} de saneamiento — o sea{" "}
                {almanaque.parametros.ventana.dias} días hacia adelante, más{" "}
                {almanaque.parametros.ventana.contextoPrevio} previos de contexto que no suman
                a los totales.
              </p>
            )}
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            {/* El gráfico no se puede bajar como imagen útil, pero sus números
                sí: cada carril del Gantt es una hoja del libro. */}
            <BotonExcel
              onClick={exportarAlmanaqueExcel}
              disabled={loading || !almanaque}
              titulo="Descargar los datos del almanaque"
            />
            {/* La capacidad y el fuera de servicio cambian todos los números del
                almanaque, así que los editan solo superadmin y admin — igual que
                el PUT del backend. */}
            {puedeEditarParametros && (
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowConfig(true)}
                disabled={!almanaque?.galpones}
              >
                <i className="bi bi-sliders me-1"></i>Parámetros
              </button>
            )}
            {/* Deja Reproductores en cero para volver a probar el flujo desde el
                principio. Borra el módulo entero, así que va aparte del resto de
                los botones y en rojo — y es de las dos cosas que el `admin` NO
                hereda del superadmin. */}
            {puedeResetear && (
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={handleResetear}
                disabled={reseteando}
              >
                {reseteando
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Reseteando…</>
                  : <><i className="bi bi-arrow-counterclockwise me-1"></i>Resetear proyección</>}
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success"></div>
          </div>
        ) : almanaque ? (
          <Almanaque data={almanaque} />
        ) : (
          <div className="card shadow-sm">
            <div className="card-body text-center py-5 text-muted">
              No se pudo armar el almanaque.
            </div>
          </div>
        )}

      </div>

      {showConfig && almanaque?.galpones && (
        <ConfigGalponesModal
          // El almanaque ya devuelve los 14 galpones con etiqueta, capacidad y
          // fueraDeServicio, que es exactamente lo que el modal necesita.
          galpones={almanaque.galpones}
          // Y también el objetivo de faena vigente, con el dato de si todavía es
          // el valor de fábrica. No hace falta un fetch aparte.
          objetivoFaena={{
            objetivoFaenaDiario: almanaque.parametros?.objetivoDiario,
            porDefecto: almanaque.parametros?.objetivoDiarioPorDefecto,
            valorPorDefecto: almanaque.parametros?.objetivoDiarioDeFabrica,
          }}
          mortandadEngorde={almanaque.parametros?.mortandadEngorde}
          onClose={() => setShowConfig(false)}
          onGuardado={() => {
            setShowConfig(false);
            cargar();
          }}
        />
      )}
    </Layout>
  );
};

export default ProyeccionPage;
