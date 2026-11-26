/**
 * Clientes iguales o parecidos en el padrón del grupo (2026-11-16, pedido del
 * usuario: al dar de alta, avisar si ya existe alguno similar, porque el padrón
 * es uno para todas las empresas y un cliente de la avícola puede empezar a
 * comprar en Forratuc). Se busca sobre TODO el padrón, no solo la empresa actual.
 *
 *   · `iguales`: mismo teléfono, CUIT o DNI (el DNI desde el 26/11). Es el mismo cliente seguro (el
 *     back no deja cargar otro con esos datos).
 *   · `parecidos`: nombre parecido (sin tildes, mayúsculas, puntuación ni
 *     "S.A." / "SRL"…): puede ser el mismo, lo decide quien carga.
 */
const SUFIJOS = new Set(["sa", "srl", "sas", "sh", "sc", "saci", "sacif", "y", "de", "del", "la", "el", "los", "las", "hnos", "hermanos"]);

const normalizar = (texto) =>
  String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .split(/\s+/)
    .filter((p) => p && !SUFIJOS.has(p));

const digitos = (v) => String(v || "").replace(/\D/g, "");
// Los teléfonos se cargan con y sin característica: se comparan los últimos 8.
const mismoTelefono = (a, b) => {
  const x = digitos(a);
  const y = digitos(b);
  return x.length >= 6 && y.length >= 6 && x.slice(-8) === y.slice(-8);
};
const mismoCuit = (a, b) => digitos(a).length === 11 && digitos(a) === digitos(b);
const mismoDni = (a, b) => digitos(a).length >= 7 && digitos(a) === digitos(b);

// Distancia de edición (cuántas letras cambian), para errores de tipeo.
const distancia = (a, b) => {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return fila[b.length];
};

const nombreParecido = (a, b) => {
  const pa = normalizar(a);
  const pb = normalizar(b);
  if (!pa.length || !pb.length) return false;
  const ja = pa.join(" ");
  const jb = pb.join(" ");
  if (ja === jb) return true;
  // Uno contiene al otro ("Juan Perez" / "Juan Perez Distribuidora").
  if (Math.min(ja.length, jb.length) >= 4 && (ja.includes(jb) || jb.includes(ja))) return true;
  // Las mismas palabras en otro orden ("Perez Juan").
  if (pa.length >= 2 && pa.length === pb.length && [...pa].sort().join(" ") === [...pb].sort().join(" ")) return true;
  // Un error de tipeo (hasta 2 letras en nombres de 6 o más).
  return Math.min(ja.length, jb.length) >= 6 && distancia(ja, jb) <= 2;
};

/** Los del padrón iguales o parecidos al que se está por dar de alta. */
export const buscarParecidos = (nuevo, padron = []) => {
  const iguales = [];
  const parecidos = [];
  for (const c of padron) {
    const motivos = [];
    if (nuevo.telefono && mismoTelefono(nuevo.telefono, c.telefono)) motivos.push("mismo teléfono");
    if (nuevo.cuit && mismoCuit(nuevo.cuit, c.cuit)) motivos.push("mismo CUIT");
    if (nuevo.dni && mismoDni(nuevo.dni, c.dni)) motivos.push("mismo DNI");
    if (motivos.length) iguales.push({ cliente: c, motivo: motivos.join(" y ") });
    else if (nombreParecido(nuevo.razonSocial, c.razonSocial)) parecidos.push({ cliente: c, motivo: "nombre parecido" });
  }
  return { iguales, parecidos: parecidos.slice(0, 8) };
};
