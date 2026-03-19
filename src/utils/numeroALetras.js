// Función para convertir números a letras en español
const unidades = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'
];

const decenas = [
  '', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'
];

const centenas = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos'
];

const convertirGrupo = (n) => {
  if (n === 0) return '';
  if (n === 100) return 'cien';

  let resultado = '';

  // Centenas
  if (n >= 100) {
    resultado += centenas[Math.floor(n / 100)] + ' ';
    n = n % 100;
  }

  // Decenas y unidades
  if (n > 0) {
    if (n < 30) {
      resultado += unidades[n];
    } else {
      resultado += decenas[Math.floor(n / 10)];
      if (n % 10 > 0) {
        resultado += ' y ' + unidades[n % 10];
      }
    }
  }

  return resultado.trim();
};

export const numeroALetras = (numero, moneda = 'ARS') => {
  if (numero === 0) return moneda === 'USD' ? 'cero dólares' : 'cero pesos';

  const parteEntera = Math.floor(Math.abs(numero));
  const centavos = Math.round((Math.abs(numero) - parteEntera) * 100);

  let resultado = '';

  // Miles de millones
  if (parteEntera >= 1000000000) {
    const milesMillones = Math.floor(parteEntera / 1000000000);
    resultado += convertirGrupo(milesMillones) + ' mil ';
    resultado += (parteEntera % 1000000000 >= 1000000) ? '' : 'millones ';
  }

  // Millones
  const millones = Math.floor((parteEntera % 1000000000) / 1000000);
  if (millones > 0) {
    if (millones === 1) {
      resultado += 'un millón ';
    } else {
      resultado += convertirGrupo(millones) + ' millones ';
    }
  }

  // Miles
  const miles = Math.floor((parteEntera % 1000000) / 1000);
  if (miles > 0) {
    if (miles === 1) {
      resultado += 'mil ';
    } else {
      resultado += convertirGrupo(miles) + ' mil ';
    }
  }

  // Unidades, decenas, centenas
  const resto = parteEntera % 1000;
  if (resto > 0) {
    resultado += convertirGrupo(resto) + ' ';
  }

  // Agregar moneda
  if (moneda === 'USD') {
    resultado += parteEntera === 1 ? 'dólar' : 'dólares';
  } else {
    resultado += parteEntera === 1 ? 'peso' : 'pesos';
  }

  // Agregar centavos
  if (centavos > 0) {
    resultado += ' con ' + String(centavos).padStart(2, '0') + '/100';
  }

  // Capitalizar primera letra
  return resultado.charAt(0).toUpperCase() + resultado.slice(1).trim();
};

export default numeroALetras;
