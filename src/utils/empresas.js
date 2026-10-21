// Empresas del grupo en el front (2026-10-16). El catálogo y quién ve qué lo
// decide el back (trigotuc_back/utils/empresas.js); acá solo se lee lo que vino
// en el login y se decide a qué pantalla va cada empresa.

// Las empresas que ve el usuario logueado, tal como las mandó el login. Una
// sesión abierta antes del 2026-10-16 no las tiene: se comporta como siempre,
// solo avícola y sin selector.
export const obtenerEmpresasUsuario = () => {
  try {
    const lista = JSON.parse(localStorage.getItem("empresas") || "[]");
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
};

// Pantalla de entrada de la avícola según el rol (lo que hacía el login).
export const inicioAvicola = (rolUsuario) => {
  if (rolUsuario === "frigorifico") return "/frigorifico/pedidos-granja";
  if (rolUsuario === "granja") return "/granja/galpones";
  if (rolUsuario === "reproductoras") return "/reproductores/galpones";
  return "/dashboard";
};

export const inicioEmpresa = (clave, rolUsuario) =>
  clave === "forratuc" ? "/forratuc" : inicioAvicola(rolUsuario);

// Rutas del grupo: no son de ninguna empresa, así que al entrar se queda el
// menú de la empresa en la que estabas (el padrón de clientes es uno solo).
const RUTAS_DEL_GRUPO = ["/inicio", "/clientes", "/personal", "/camiones"];

// De qué empresa es una ruta; null = del grupo.
export const empresaDeRuta = (path) => {
  if (RUTAS_DEL_GRUPO.some((r) => path.startsWith(r))) return null;
  if (path.startsWith("/forratuc")) return "forratuc";
  return "avicola";
};

// La empresa cuyo menú se muestra: la de la ruta, o la última en la que
// estuviste si la ruta es del grupo.
export const empresaActual = (path) => {
  const deRuta = empresaDeRuta(path);
  if (deRuta) {
    try { localStorage.setItem("empresaActual", deRuta); } catch { /* sin storage */ }
    return deRuta;
  }
  try {
    return localStorage.getItem("empresaActual") || "avicola";
  } catch {
    return "avicola";
  }
};
