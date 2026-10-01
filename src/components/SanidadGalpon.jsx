import React, { useState } from "react";
import Swal from "sweetalert2";
import { agregarSanidad, editarSanidad, eliminarSanidad } from "../services/api";
import { formatearFechaLocal, obtenerFechaHoy, ajustarFechaParaGuardar } from "../utils/dateUtils";

/**
 * Sanidad del galpón: VACUNAS APLICADAS y TRATAMIENTOS MEDICAMENTOSOS.
 *
 * Replica las dos tablas de la "Planilla engorde de pollitos" de papel
 * (`vacunas y tratamientos.jpeg`, 2026-09-30), con las mismas columnas. Es el
 * mismo componente en Granja y en Reproductoras (`modulo`), y el mismo para
 * cargar (`editable`, en Datos Semanales) y para mirar (en el modal del galpón).
 *
 * La "Firma" del papel es quién lo cargó: la pone el back con el usuario.
 */

const MODELOS = {
  vacuna: {
    titulo: "Vacunas aplicadas",
    icono: "bi-shield-plus",
    vacio: "Todavía no se cargó ninguna vacuna.",
    campos: [
      { k: "fecha",       label: "Fecha",       tipo: "date", requerido: true },
      { k: "enfermedad",  label: "Enfermedad",  requerido: true, placeholder: "Ej.: Newcastle, Gumboro…" },
      { k: "cepa",        label: "Cepa" },
      { k: "serie",       label: "Serie" },
      { k: "vencimiento", label: "Vencimiento", tipo: "date" },
      { k: "dosis",       label: "Dosis",       placeholder: "Ej.: 1 dosis por ave" },
      { k: "marca",       label: "Marca" },
      { k: "remito",      label: "Remito" },
    ],
  },
  tratamiento: {
    titulo: "Tratamientos medicamentosos",
    icono: "bi-capsule",
    vacio: "Todavía no se cargó ningún tratamiento.",
    campos: [
      { k: "fecha",        label: "Fecha",         tipo: "date", requerido: true },
      { k: "tipoDroga",    label: "Tipo y droga",  requerido: true, placeholder: "Ej.: Vitamina, Amoxicilina…" },
      { k: "dosis",        label: "Dosis",         requerido: true, placeholder: "Ej.: 1 cm por litro" },
      { k: "duracionDias", label: "Duración (días)", tipo: "number" },
    ],
  },
};

// En Reproductoras cada registro dice a quién se aplicó (2026-09-30). "Ambos" es
// el galpón entero (p. ej. lo que va en el agua). En Granja no hay sexos.
const SEXOS = [
  { k: "hembra", label: "Hembras", badge: "bg-danger-subtle text-danger-emphasis" },
  { k: "macho",  label: "Machos",  badge: "bg-primary-subtle text-primary-emphasis" },
  { k: "ambos",  label: "Ambos",   badge: "bg-secondary-subtle text-secondary-emphasis" },
];
const sexoDe = (k) => SEXOS.find((s) => s.k === k);

// Al filtrar por un sexo también entra lo que se dio a ambos: a esas aves
// también se les aplicó.
const pasaFiltro = (r, filtro) => filtro === "todos" || r.sexo === filtro || r.sexo === "ambos";

const BadgeSexo = ({ sexo }) => {
  const s = sexoDe(sexo);
  return s ? <span className={`badge ${s.badge}`}>{s.label}</span> : <span className="text-muted">—</span>;
};

const aInput = (v) => (v ? String(v).split("T")[0] : "");
const dia = (v) => (v ? new Date(aInput(v) + "T12:00:00") : null);
const sumarDias = (fecha, n) => { const d = new Date(fecha); d.setDate(d.getDate() + n); return d; };

// La vacuna se aplicó con la fecha de vencimiento ya pasada.
const vencidaAlAplicar = (v) => v.vencimiento && dia(v.vencimiento) < dia(v.fecha);

// Último día del tratamiento y si hoy sigue corriendo.
const finTratamiento = (t) => (t.duracionDias ? sumarDias(dia(t.fecha), t.duracionDias - 1) : null);
const enCurso = (t) => {
  const fin = finTratamiento(t);
  if (!fin) return false;
  const hoy = new Date(obtenerFechaHoy() + "T12:00:00");
  return dia(t.fecha) <= hoy && hoy <= fin;
};

const porFecha = (a, b) => new Date(a.fecha) - new Date(b.fecha);

// ── Modal de alta / edición ─────────────────────────────────────────────────
const RegistroModal = ({ tipo, inicial, conSexo, guardando, onGuardar, onClose }) => {
  const modelo = MODELOS[tipo];
  const [sexo, setSexo] = useState(inicial?.sexo || "");
  const [form, setForm] = useState(() => ({
    ...Object.fromEntries(
      modelo.campos.map((c) => [
        c.k,
        c.tipo === "date"
          ? aInput(inicial?.[c.k]) || (c.k === "fecha" ? obtenerFechaHoy() : "")
          : inicial?.[c.k] ?? "",
      ])
    ),
    observaciones: inicial?.observaciones ?? "",
  }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const faltan = modelo.campos.filter((c) => c.requerido && !String(form[c.k] ?? "").trim());
  const faltaSexo = conSexo && !sexo;

  const enviar = (e) => {
    e.preventDefault();
    if (faltan.length || faltaSexo) return;
    const data = { observaciones: form.observaciones, ...(conSexo ? { sexo } : {}) };
    for (const c of modelo.campos) {
      const v = form[c.k];
      data[c.k] = c.tipo === "date" ? (v ? ajustarFechaParaGuardar(v) : "") : v;
    }
    onGuardar(data);
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header py-2">
              <h6 className="modal-title fw-bold">
                <i className={`bi ${modelo.icono} me-2`}></i>
                {inicial ? "Corregir" : "Cargar"} {tipo === "vacuna" ? "vacuna" : "tratamiento"}
              </h6>
              <button type="button" className="btn-close" onClick={onClose} disabled={guardando}></button>
            </div>
            <form onSubmit={enviar}>
              <div className="modal-body">
                {/* Reproductoras: a quién se aplicó. Va primero porque cambia de
                    qué se trata el resto. */}
                {conSexo && (
                  <div className="mb-2">
                    <label className="form-label small mb-1">
                      Aplicado a <span className="text-danger">*</span>
                    </label>
                    <div className="btn-group w-100" role="group">
                      {SEXOS.map((s) => (
                        <button
                          key={s.k}
                          type="button"
                          className={`btn btn-sm ${sexo === s.k ? "btn-dark" : "btn-outline-secondary"}`}
                          onClick={() => setSexo(s.k)}
                          disabled={guardando}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="row g-2">
                  {modelo.campos.map((c) => (
                    <div key={c.k} className={c.k === "enfermedad" || c.k === "tipoDroga" ? "col-12" : "col-6"}>
                      <label className="form-label small mb-0">
                        {c.label}{c.requerido && <span className="text-danger"> *</span>}
                      </label>
                      <input
                        type={c.tipo || "text"}
                        className="form-control form-control-sm"
                        value={form[c.k]}
                        onChange={(e) => set(c.k, e.target.value)}
                        placeholder={c.placeholder}
                        min={c.tipo === "number" ? 1 : undefined}
                        step={c.tipo === "number" ? 1 : undefined}
                        disabled={guardando}
                      />
                    </div>
                  ))}
                  <div className="col-12">
                    <label className="form-label small mb-0">Observaciones</label>
                    <input
                      className="form-control form-control-sm"
                      value={form.observaciones}
                      onChange={(e) => set("observaciones", e.target.value)}
                      disabled={guardando}
                    />
                  </div>
                </div>
                <div className="text-muted mt-2" style={{ fontSize: ".75rem" }}>
                  <i className="bi bi-pen me-1"></i>La firma queda con tu usuario.
                </div>
              </div>
              <div className="modal-footer py-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose} disabled={guardando}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={guardando || faltan.length > 0 || faltaSexo}>
                  {guardando && <span className="spinner-border spinner-border-sm me-1"></span>}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Componente ──────────────────────────────────────────────────────────────
const SanidadGalpon = ({ lote, modulo, editable = false, onActualizado }) => {
  const [abierto, setAbierto] = useState(null); // { tipo, registro? }
  const [guardando, setGuardando] = useState(false);
  // Reproductoras: ver todo o separar por sexo.
  const [filtro, setFiltro] = useState("todos");
  const conSexo = modulo === "reproductores";

  if (!lote) return null;
  const vacunas = [...(lote.vacunas || [])].filter((r) => !conSexo || pasaFiltro(r, filtro)).sort(porFecha);
  const tratamientos = [...(lote.tratamientos || [])].filter((r) => !conSexo || pasaFiltro(r, filtro)).sort(porFecha);

  const guardar = async (data) => {
    setGuardando(true);
    try {
      const actualizado = abierto.registro
        ? await editarSanidad(modulo, lote._id, abierto.tipo, abierto.registro._id, data)
        : await agregarSanidad(modulo, lote._id, abierto.tipo, data);
      setAbierto(null);
      onActualizado?.(actualizado);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (tipo, registro) => {
    const nombre = tipo === "vacuna" ? registro.enfermedad : registro.tipoDroga;
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: `¿Borrar ${tipo === "vacuna" ? "la vacuna" : "el tratamiento"}?`,
      text: `${nombre} del ${formatearFechaLocal(registro.fecha)}`,
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      onActualizado?.(await eliminarSanidad(modulo, lote._id, tipo, registro._id));
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo borrar.", "error");
    }
  };

  const acciones = (tipo, r) =>
    editable && (
      <td className="text-end text-nowrap">
        <button className="btn btn-sm btn-link p-0 me-2" title="Corregir" onClick={() => setAbierto({ tipo, registro: r })}>
          <i className="bi bi-pencil"></i>
        </button>
        <button className="btn btn-sm btn-link text-danger p-0" title="Borrar" onClick={() => borrar(tipo, r)}>
          <i className="bi bi-trash"></i>
        </button>
      </td>
    );

  const encabezado = (tipo, cantidad) => (
    <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center">
      <span className="fw-semibold small text-uppercase">
        <i className={`bi ${MODELOS[tipo].icono} me-1`}></i>{MODELOS[tipo].titulo}
        <span className="text-muted fw-normal ms-1">({cantidad})</span>
      </span>
      {editable && (
        <button className="btn btn-sm btn-outline-primary py-0" onClick={() => setAbierto({ tipo })}>
          <i className="bi bi-plus-lg me-1"></i>Cargar
        </button>
      )}
    </div>
  );

  return (
    <div className="d-flex flex-column gap-3">
      {/* ── Reproductoras: separar por sexo ── */}
      {conSexo && (
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="small text-muted">Ver:</span>
          <div className="btn-group btn-group-sm" role="group">
            {[{ k: "todos", label: "Todos" }, ...SEXOS.filter((s) => s.k !== "ambos")].map((s) => (
              <button
                key={s.k}
                type="button"
                className={`btn ${filtro === s.k ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setFiltro(s.k)}
              >
                {s.label}
              </button>
            ))}
          </div>
          {filtro !== "todos" && (
            <span className="small text-muted">
              Incluye lo que se aplicó a ambos.
            </span>
          )}
        </div>
      )}

      {/* ── Vacunas aplicadas ── */}
      <div className="card border shadow-sm">
        {encabezado("vacuna", vacunas.length)}
        {vacunas.length === 0 ? (
          <div className="card-body text-muted small py-3">{filtro !== "todos" ? "Nada para este sexo." : MODELOS.vacuna.vacio}</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-bordered align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Fecha</th><th>Sem.</th>{conSexo && <th>Aplicado a</th>}<th>Enfermedad</th><th>Cepa</th><th>Serie</th>
                  <th>Venc.</th><th>Dosis</th><th>Marca</th><th>Remito</th><th>Firma</th>
                  {editable && <th></th>}
                </tr>
              </thead>
              <tbody>
                {vacunas.map((v) => (
                  <tr key={v._id}>
                    <td className="text-nowrap">{formatearFechaLocal(v.fecha)}</td>
                    <td className="text-center">{v.semana ?? "—"}</td>
                    {conSexo && <td><BadgeSexo sexo={v.sexo} /></td>}
                    <td className="fw-semibold">
                      {v.enfermedad}
                      {v.observaciones && <div className="text-muted fw-normal">{v.observaciones}</div>}
                    </td>
                    <td>{v.cepa || "—"}</td>
                    <td>{v.serie || "—"}</td>
                    <td className="text-nowrap">
                      {v.vencimiento ? formatearFechaLocal(v.vencimiento) : "—"}
                      {vencidaAlAplicar(v) && (
                        <div><span className="badge bg-danger"><i className="bi bi-exclamation-triangle me-1"></i>Vencida al aplicar</span></div>
                      )}
                    </td>
                    <td>{v.dosis || "—"}</td>
                    <td>{v.marca || "—"}</td>
                    <td>{v.remito || "—"}</td>
                    <td className="text-muted">{v.firma || "—"}</td>
                    {acciones("vacuna", v)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Tratamientos medicamentosos ── */}
      <div className="card border shadow-sm">
        {encabezado("tratamiento", tratamientos.length)}
        {tratamientos.length === 0 ? (
          <div className="card-body text-muted small py-3">{filtro !== "todos" ? "Nada para este sexo." : MODELOS.tratamiento.vacio}</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-bordered align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Fecha</th><th>Sem.</th>{conSexo && <th>Aplicado a</th>}<th>Tipo y droga</th><th>Dosis</th><th>Duración</th><th>Firma</th>
                  {editable && <th></th>}
                </tr>
              </thead>
              <tbody>
                {tratamientos.map((t) => {
                  const fin = finTratamiento(t);
                  return (
                    <tr key={t._id}>
                      <td className="text-nowrap">{formatearFechaLocal(t.fecha)}</td>
                      <td className="text-center">{t.semana ?? "—"}</td>
                      {conSexo && <td><BadgeSexo sexo={t.sexo} /></td>}
                      <td className="fw-semibold">
                        {t.tipoDroga}
                        {t.observaciones && <div className="text-muted fw-normal">{t.observaciones}</div>}
                      </td>
                      <td>{t.dosis}</td>
                      <td className="text-nowrap">
                        {t.duracionDias ? `${t.duracionDias} día${t.duracionDias === 1 ? "" : "s"}` : "—"}
                        {fin && (
                          <div className="text-muted" style={{ fontSize: ".72rem" }}>
                            hasta el {fin.toLocaleDateString("es-AR")}
                          </div>
                        )}
                        {enCurso(t) && <span className="badge bg-info text-dark">En curso</span>}
                      </td>
                      <td className="text-muted">{t.firma || "—"}</td>
                      {acciones("tratamiento", t)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {abierto && (
        <RegistroModal
          tipo={abierto.tipo}
          inicial={abierto.registro}
          conSexo={conSexo}
          guardando={guardando}
          onGuardar={guardar}
          onClose={() => setAbierto(null)}
        />
      )}
    </div>
  );
};

export default SanidadGalpon;
