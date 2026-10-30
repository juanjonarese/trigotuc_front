// Empresas del grupo en el front (2026-10-16). El catálogo y quién ve qué lo
// decide el back (trigotuc_back/utils/empresas.js); acá solo se lee lo que vino
// en el login y se decide a qué pantalla va cada empresa.
//
// ⚠️ Una empresa nueva = sus prefijos en PREFIJOS_EMPRESA, su pantalla de
// entrada en `inicioEmpresa` y su menú en `Layout.jsx` (MENUS). Una ruta que no
// figure en ningún prefijo no es de ninguna empresa: no la corta nadie.

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

// Claves de las empresas en las que puede entrar. Sin ninguna (sesión vieja)
// es la avícola, igual que `InicioPage`: así nunca queda sin adónde ir.
const clavesUsuario = () => {
  const claves = obtenerEmpresasUsuario().map((e) => e.clave);
  return claves.length ? claves : ["avicola"];
};

// Si el cliente le compra a esa empresa (`clientes.empresas`). Sin lista es un
// cliente anterior al multiempresa: de la avícola, como el default del back.
export const clienteDeEmpresa = (cliente, clave) =>
  (cliente?.empresas?.length ? cliente.empresas : ["avicola"]).includes(clave);

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
// Actividad vive bajo /frigorifico por historia, pero es del grupo: dice quién
// hizo qué en todas.
const RUTAS_DEL_GRUPO = ["/inicio", "/clientes", "/personal", "/camiones", "/frigorifico/historial-accesos"];

// Qué rutas son de cada empresa (2026-10-26). La avícola tiene la lista
// explícita: antes era "todo lo que no es /forratuc", y con una tercera
// empresa una ruta mal registrada caía en la avícola sin que nadie lo notara.
const PREFIJOS_EMPRESA = {
  avicola: ["/dashboard", "/proyeccion", "/frigorifico", "/granja", "/reproductores", "/alimento"],
  forratuc: ["/forratuc"],
};

const empiezaCon = (path, prefijo) => path === prefijo || path.startsWith(`${prefijo}/`);

// De qué empresa es una ruta; null = del grupo (o de ninguna).
export const empresaDeRuta = (path) => {
  if (RUTAS_DEL_GRUPO.some((r) => empiezaCon(path, r))) return null;
  const entrada = Object.entries(PREFIJOS_EMPRESA).find(([, prefijos]) =>
    prefijos.some((p) => empiezaCon(path, p))
  );
  return entrada ? entrada[0] : null;
};

// Si el usuario puede abrir esa ruta: las del grupo sí; las de una empresa,
// solo si la tiene. Lo usa `ProtectedRoute`; el back corta igual
// (`requiereEmpresa`), esto es para no mostrar una pantalla que va a dar 403.
export const puedeEntrarARuta = (path) => {
  const empresa = empresaDeRuta(path);
  return !empresa || clavesUsuario().includes(empresa);
};

// Adónde mandar a quien cayó en una ruta que no es suya: con varias empresas,
// a las tarjetas; con una, a la entrada de esa.
export const inicioUsuario = (rolUsuario) => {
  const claves = clavesUsuario();
  return claves.length > 1 ? "/inicio" : inicioEmpresa(claves[0], rolUsuario);
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
    const guardada = localStorage.getItem("empresaActual");
    return guardada && clavesUsuario().includes(guardada) ? guardada : clavesUsuario()[0];
  } catch {
    return clavesUsuario()[0];
  }
};
