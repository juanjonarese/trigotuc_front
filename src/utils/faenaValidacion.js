import Swal from "sweetalert2";

const fmt = (n) => new Intl.NumberFormat("es-AR").format(Number(n) || 0);

// Tolerancia de unidades antes de avisar incoherencia: 0.5% de lo faenado,
// con un mínimo de 5 pollos. Evita molestar por diferencias de conteo menores.
const tolerancia = (faenados) => Math.max(5, Math.round(faenados * 0.005));

/**
 * Verifica que las unidades faenadas cuadren con su desglose:
 *
 *   unidadesFaenadas = pollos en calibres + trozados (u) + decomisados (u)
 *
 * Los MUERTOS no entran: murieron en transporte, nunca se faenaron
 * (el backend calcula cantidadReal = unidadesFaenadas + muertos).
 *
 * Si la diferencia supera la tolerancia, muestra un aviso "advertir y
 * confirmar" y deja decidir al usuario.
 *
 * @returns {Promise<boolean>} true si se puede continuar, false si cancela.
 */
export const confirmarCoherenciaFaena = async ({
  unidadesFaenadas,
  pollosCalibres = 0,
  unidadesTrozadas = 0,
  unidadesDecomisadas = 0,
  confirmText = "Crear igual",
}) => {
  const faenados = Number(unidadesFaenadas) || 0;
  // Sin faenados declarados no hay base para comparar.
  if (faenados <= 0) return true;

  const desglose =
    (Number(pollosCalibres) || 0) +
    (Number(unidadesTrozadas) || 0) +
    (Number(unidadesDecomisadas) || 0);
  const diferencia = faenados - desglose;

  if (Math.abs(diferencia) <= tolerancia(faenados)) return true;

  const faltan = diferencia > 0;
  const res = await Swal.fire({
    icon: "warning",
    title: "Las unidades no cuadran",
    html:
      `<div class="text-start small">` +
      `Faenadas declaradas: <strong>${fmt(faenados)}</strong><br>` +
      `Desglose (calibres + trozados + decomisados): <strong>${fmt(desglose)}</strong>` +
      `</div><br>` +
      `<span class="text-danger">` +
      (faltan
        ? `Faltan <strong>${fmt(Math.abs(diferencia))}</strong> pollos por clasificar.`
        : `Hay <strong>${fmt(Math.abs(diferencia))}</strong> pollos de más respecto a las faenadas.`) +
      `</span><br>` +
      `<span class="text-muted small">Los muertos en transporte no cuentan como faenados.</span>`,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Revisar",
    confirmButtonColor: "#198754",
  });
  return res.isConfirmed;
};
