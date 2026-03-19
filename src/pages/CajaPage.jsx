import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { obtenerMovimientosCaja, obtenerCheques, cambiarEstadoCheque, eliminarCheque, obtenerChequePorId, obtenerChequesPropios, cambiarEstadoChequePropio, eliminarChequePropio, obtenerChequePropoPorId, obtenerCuentasBancarias, obtenerCobros, obtenerPagos, obtenerPagosCostosFijos, obtenerPagosContratistas, obtenerMovimientosDolares, crearMovimientoDolar, eliminarMovimientoDolar, obtenerMovimientosEfectivo, crearMovimientoEfectivo, eliminarMovimientoEfectivo, obtenerMovimientosBancarios, cerrarCaja, transferirFondos, obtenerTransferencias, obtenerUsuarios, aprobarTransferencia, aceptarTransferencia, rechazarTransferencia, rechazarTransferenciaPorContable, anularTransferencia } from "../services/api";
import Swal from "sweetalert2";
import "../css/Tablas.css";
import * as XLSX from "xlsx";

const CajaPage = () => {
  const [activeTab, setActiveTab] = useState("efectivo");

  // Estados para Efectivo
  const [movimientos, setMovimientos] = useState([]);
  const [totales, setTotales] = useState({ ingresos: 0, egresos: 0, saldo: 0 });
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Estados para Cheques
  const [cheques, setCheques] = useState([]);
  const [totalesCheques, setTotalesCheques] = useState({
    cantidad: 0,
    montoTotal: 0,
    cantidadCheques: 0,
    montoCheques: 0,
    cantidadEcheques: 0,
    montoEcheques: 0,
  });
  const [loadingCheques, setLoadingCheques] = useState(true);
  const [estadoFiltro, setEstadoFiltro] = useState("cartera");
  const [tipoFiltro, setTipoFiltro] = useState("");

  // Estados para Modal de Historial
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [chequeSeleccionado, setChequeSeleccionado] = useState(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Estados para Cheques Propios
  const [chequesPropios, setChequesPropios] = useState([]);
  const [totalesChequesPropios, setTotalesChequesPropios] = useState({
    cantidad: 0,
    montoTotal: 0,
    cantidadPendientes: 0,
    montoPendientes: 0,
    cantidadCobrados: 0,
    montoCobrados: 0,
  });
  const [loadingChequesPropios, setLoadingChequesPropios] = useState(true);
  const [estadoFiltroPropios, setEstadoFiltroPropios] = useState("pendiente");

  // Estados para Cuentas Bancarias
  const [cuentasBancarias, setCuentasBancarias] = useState([]);
  const [loadingCuentas, setLoadingCuentas] = useState(true);

  // Estados para Cobros y Pagos (para transferencias y depósitos)
  const [cobros, setCobros] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [pagosCostosFijos, setPagosCostosFijos] = useState([]);
  const [pagosContratistas, setPagosContratistas] = useState([]);
  const [loadingMovimientosBancarios, setLoadingMovimientosBancarios] = useState(false);

  // Estados para Dólares
  const [movimientosDolares, setMovimientosDolares] = useState([]);
  const [totalesDolares, setTotalesDolares] = useState({
    saldoInicial: 0,
    ingresos: 0,
    egresos: 0,
    saldo: 0,
  });
  const [loadingDolares, setLoadingDolares] = useState(true);
  const [fechaDesdeDolares, setFechaDesdeDolares] = useState("");
  const [fechaHastaDolares, setFechaHastaDolares] = useState("");
  const [nuevoMovimientoDolar, setNuevoMovimientoDolar] = useState({
    tipo: "ingreso",
    monto: "",
    detalle: "",
    fecha: new Date().toISOString().split("T")[0],
  });

  // Estados para Movimientos de Efectivo
  const [movimientosEfectivo, setMovimientosEfectivo] = useState([]);
  const [totalesEfectivo, setTotalesEfectivo] = useState({
    ingresos: 0,
    egresos: 0,
    saldo: 0,
  });
  const [loadingEfectivo, setLoadingEfectivo] = useState(true);
  const [fechaDesdeEfectivo, setFechaDesdeEfectivo] = useState("");
  const [fechaHastaEfectivo, setFechaHastaEfectivo] = useState("");
  const [nuevoMovimientoEfectivo, setNuevoMovimientoEfectivo] = useState({
    tipo: "egreso",
    monto: "",
    detalle: "",
    fecha: new Date().toISOString().split("T")[0],
  });

  // Estados para Movimientos Bancarios
  const [movimientosBancarios, setMovimientosBancarios] = useState([]);
  const [totalesBancarios, setTotalesBancarios] = useState({ ingresos: 0, egresos: 0, saldo: 0 });
  const [loadingBancarios, setLoadingBancarios] = useState(true);
  const [fechaDesdeBancarios, setFechaDesdeBancarios] = useState("");
  const [fechaHastaBancarios, setFechaHastaBancarios] = useState("");
  const [cuentaBancariaFiltro, setCuentaBancariaFiltro] = useState("");

  // Estados para Transferencias
  const [transferencias, setTransferencias] = useState([]);
  const [loadingTransferencias, setLoadingTransferencias] = useState(true);
  const [showModalCerrarCaja, setShowModalCerrarCaja] = useState(false);
  const [showModalTransferir, setShowModalTransferir] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [formCierre, setFormCierre] = useState({
    montoPesos: "",
    montoDolares: "",
    cheques: [],
    detalle: ""
  });
  const [formTransferencia, setFormTransferencia] = useState({
    montoPesos: "",
    montoDolares: "",
    chequesTerceros: [],
    chequesPropios: [],
    detalle: "",
    destinoUsuarioId: ""
  });
  const [chequesDisponibles, setChequesDisponibles] = useState([]);
  const [chequesTercerosDisponibles, setChequesTercerosDisponibles] = useState([]);
  const [chequesPropiosDisponibles, setChequesPropiosDisponibles] = useState([]);
  const rolUsuario = localStorage.getItem("rolUsuario");

  useEffect(() => {
    cargarMovimientos();
    cargarCheques({ estado: "cartera" });
    cargarChequesPropios();
    cargarCuentasBancarias();
    cargarCobrosYPagos();
    cargarMovimientosDolares();
    cargarMovimientosEfectivo();
    cargarMovimientosBancarios();
    cargarTransferencias();
    if (rolUsuario === "admin") {
      cargarUsuarios();
    }
  }, []);

  // Cargar todos los cheques cuando estamos en un tab de banco
  useEffect(() => {
    if (false && activeTab.startsWith("banco-")) {
      // Cargar TODOS los cheques sin filtro de estado para mostrar en bancos
      cargarCheques({});
      cargarChequesPropios();
    }
  }, [activeTab]);

  const cargarMovimientos = async (filtros = {}) => {
    try {
      setLoading(true);
      const data = await obtenerMovimientosCaja(filtros);
      setMovimientos(data.movimientos || []);
      setTotales(data.totales || { ingresos: 0, egresos: 0, saldo: 0 });
    } catch (error) {
      console.error("Error al cargar movimientos de caja:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los movimientos de caja",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFiltrar = () => {
    const filtros = {};
    if (fechaDesde) filtros.fechaDesde = fechaDesde;
    if (fechaHasta) filtros.fechaHasta = fechaHasta;
    cargarMovimientos(filtros);
  };

  const handleLimpiarFiltros = () => {
    setFechaDesde("");
    setFechaHasta("");
    cargarMovimientos();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    // Ajustar por la diferencia de zona horaria
    const adjustedDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
    return adjustedDate.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const exportarExcel = () => {
    if (movimientos.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Sin datos",
        text: "No hay movimientos para exportar",
      });
      return;
    }

    const datosExcel = movimientos.map((mov) => ({
      Fecha: formatDate(mov.fecha),
      Tipo: mov.tipo,
      Concepto: mov.concepto,
      "Cliente/Proveedor/Costo": mov.costoFijo || mov.contratista || mov.cliente || mov.proveedor || "N/A",
      "CUIT/DNI/Categoría": mov.categoria || mov.dni || mov.cuit || "-",
      Factura: mov.factura,
      Monto: mov.monto,
      Referencia: mov.referencia,
    }));

    // Agregar fila de totales
    datosExcel.push({
      Fecha: "",
      Tipo: "",
      Concepto: "",
      "Cliente/Proveedor/Costo": "",
      "CUIT/DNI/Categoría": "",
      Factura: "TOTALES",
      Monto: "",
      Referencia: "",
    });
    datosExcel.push({
      Fecha: "",
      Tipo: "",
      Concepto: "",
      "Cliente/Proveedor/Costo": "",
      "CUIT/DNI/Categoría": "",
      Factura: "Total Ingresos",
      Monto: totales.ingresos,
      Referencia: "",
    });
    datosExcel.push({
      Fecha: "",
      Tipo: "",
      Concepto: "",
      "Cliente/Proveedor/Costo": "",
      "CUIT/DNI/Categoría": "",
      Factura: "Total Egresos",
      Monto: totales.egresos,
      Referencia: "",
    });
    datosExcel.push({
      Fecha: "",
      Tipo: "",
      Concepto: "",
      "Cliente/Proveedor/Costo": "",
      "CUIT/DNI/Categoría": "",
      Factura: "Saldo en Caja",
      Monto: totales.saldo,
      Referencia: "",
    });

    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos Caja");
    XLSX.writeFile(wb, `Caja_${new Date().toISOString().split("T")[0]}.xlsx`);

    Swal.fire({
      icon: "success",
      title: "Exportado",
      text: "El archivo se descargó correctamente",
      timer: 2000,
    });
  };

  // Función para exportar movimientos de dólares a Excel
  const exportarExcelDolares = () => {
    if (movimientosDolares.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Sin datos",
        text: "No hay movimientos de dólares para exportar",
      });
      return;
    }

    const datosExcel = movimientosDolares.map((mov) => ({
      Fecha: formatDate(mov.fecha),
      Tipo: mov.tipo === "ingreso" ? "INGRESO" : "EGRESO",
      Detalle: mov.detalle,
      Monto: mov.monto,
      Referencia: `Mov. #${mov._id.toString().slice(-6)}`,
    }));

    // Agregar fila de totales
    datosExcel.push({
      Fecha: "",
      Tipo: "",
      Detalle: "",
      Monto: "",
      Referencia: "",
    });
    datosExcel.push({
      Fecha: "",
      Tipo: "",
      Detalle: "TOTALES",
      Monto: "",
      Referencia: "",
    });
    datosExcel.push({
      Fecha: "",
      Tipo: "",
      Detalle: "Saldo Inicial",
      Monto: totalesDolares.saldoInicial,
      Referencia: "",
    });
    datosExcel.push({
      Fecha: "",
      Tipo: "",
      Detalle: "Total Ingresos",
      Monto: totalesDolares.ingresos,
      Referencia: "",
    });
    datosExcel.push({
      Fecha: "",
      Tipo: "",
      Detalle: "Total Egresos",
      Monto: totalesDolares.egresos,
      Referencia: "",
    });
    datosExcel.push({
      Fecha: "",
      Tipo: "",
      Detalle: "Saldo Final",
      Monto: totalesDolares.saldo,
      Referencia: "",
    });

    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos Dólares");
    XLSX.writeFile(wb, `Dolares_${new Date().toISOString().split("T")[0]}.xlsx`);

    Swal.fire({
      icon: "success",
      title: "Exportado",
      text: "El archivo se descargó correctamente",
      timer: 2000,
    });
  };

  // Funciones para Cheques
  const cargarCheques = async (filtros = {}) => {
    try {
      setLoadingCheques(true);
      const data = await obtenerCheques(filtros);
      setCheques(data.cheques || []);
      setTotalesCheques(data.totales || {
        cantidad: 0,
        montoTotal: 0,
        cantidadCheques: 0,
        montoCheques: 0,
        cantidadEcheques: 0,
        montoEcheques: 0,
      });
    } catch (error) {
      console.error("Error al cargar cheques:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los cheques",
      });
    } finally {
      setLoadingCheques(false);
    }
  };

  const handleFiltrarCheques = async () => {
    const filtros = {};

    // Si el filtro es "financiera", cargar cheques cobrados y filtrar por costoCambio > 0
    if (estadoFiltro === "financiera") {
      filtros.estado = "cobrado";
      if (tipoFiltro) filtros.tipoCheque = tipoFiltro;

      const data = await obtenerCheques(filtros);
      const chequesFinanciera = (data.cheques || []).filter(ch => (ch.costoCambio || 0) > 0);

      setCheques(chequesFinanciera);
      setTotalesCheques({
        cantidad: chequesFinanciera.length,
        montoTotal: chequesFinanciera.reduce((sum, ch) => sum + ch.monto, 0),
        cantidadCheques: chequesFinanciera.filter(ch => ch.tipoCheque === "cheque").length,
        montoCheques: chequesFinanciera.filter(ch => ch.tipoCheque === "cheque").reduce((sum, ch) => sum + ch.monto, 0),
        cantidadEcheques: chequesFinanciera.filter(ch => ch.tipoCheque === "echeq").length,
        montoEcheques: chequesFinanciera.filter(ch => ch.tipoCheque === "echeq").reduce((sum, ch) => sum + ch.monto, 0),
      });
      setLoadingCheques(false);
      return;
    }

    // Si el filtro es "cobrado", cargar cheques cobrados y filtrar por costoCambio === 0
    if (estadoFiltro === "cobrado") {
      filtros.estado = "cobrado";
      if (tipoFiltro) filtros.tipoCheque = tipoFiltro;

      const data = await obtenerCheques(filtros);
      const chequesCobrados = (data.cheques || []).filter(ch => (ch.costoCambio || 0) === 0);

      setCheques(chequesCobrados);
      setTotalesCheques({
        cantidad: chequesCobrados.length,
        montoTotal: chequesCobrados.reduce((sum, ch) => sum + ch.monto, 0),
        cantidadCheques: chequesCobrados.filter(ch => ch.tipoCheque === "cheque").length,
        montoCheques: chequesCobrados.filter(ch => ch.tipoCheque === "cheque").reduce((sum, ch) => sum + ch.monto, 0),
        cantidadEcheques: chequesCobrados.filter(ch => ch.tipoCheque === "echeq").length,
        montoEcheques: chequesCobrados.filter(ch => ch.tipoCheque === "echeq").reduce((sum, ch) => sum + ch.monto, 0),
      });
      setLoadingCheques(false);
      return;
    }

    // Para otros estados, filtrar normalmente
    if (estadoFiltro) filtros.estado = estadoFiltro;
    if (tipoFiltro) filtros.tipoCheque = tipoFiltro;
    cargarCheques(filtros);
  };

  const handleLimpiarFiltrosCheques = () => {
    setEstadoFiltro("cartera");
    setTipoFiltro("");
    cargarCheques({ estado: "cartera" });
  };

  const handleCambiarEstado = async (id, nuevoEstado) => {
    try {
      let cuentaBancariaId = null;

      // Validar fecha de vencimiento para depositar o cobrar
      if (nuevoEstado === "depositado" || nuevoEstado === "cobrado") {
        // Obtener el cheque completo
        const { cheque } = await obtenerChequePorId(id);

        // Validar si el cheque está en fecha
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechaVencimiento = new Date(cheque.fechaVencimiento);
        fechaVencimiento.setHours(0, 0, 0, 0);

        // Si la fecha de vencimiento es futura, no está en fecha
        if (fechaVencimiento > hoy) {
          return Swal.fire({
            icon: "warning",
            title: "Cheque no está en fecha",
            html: `
              <p>Este cheque no se puede ${nuevoEstado === "depositado" ? "depositar" : "cobrar"} porque aún no está en fecha.</p>
              <p><strong>Fecha de vencimiento:</strong> ${fechaVencimiento.toLocaleDateString('es-AR')}</p>
              <p>Solo se pueden depositar o cobrar cheques cuya fecha de vencimiento sea igual o anterior a la fecha actual.</p>
            `,
          });
        }
      }

      // Si el estado es "depositado", solicitar seleccionar cuenta bancaria
      if (nuevoEstado === "depositado") {
        const cuentasData = await obtenerCuentasBancarias();
        const cuentas = cuentasData.cuentasBancarias || [];

        if (cuentas.length === 0) {
          return Swal.fire({
            icon: "warning",
            title: "Sin cuentas bancarias",
            text: "Debe crear al menos una cuenta bancaria para depositar cheques",
          });
        }

        // Crear opciones para el select
        const opcionesCuentas = cuentas
          .filter(c => c.activo)
          .map(c => `<option value="${c._id}">${c.banco} - ${c.numeroCuenta} (${c.titular})</option>`)
          .join("");

        const { value: cuentaSeleccionada } = await Swal.fire({
          title: "Seleccionar cuenta bancaria",
          html: `
            <label class="form-label">Cuenta para depositar:</label>
            <select id="cuenta-select" class="form-select">
              <option value="">Seleccione una cuenta</option>
              ${opcionesCuentas}
            </select>
          `,
          showCancelButton: true,
          confirmButtonText: "Depositar",
          cancelButtonText: "Cancelar",
          preConfirm: () => {
            const select = document.getElementById("cuenta-select");
            if (!select.value) {
              Swal.showValidationMessage("Debe seleccionar una cuenta bancaria");
            }
            return select.value;
          },
        });

        if (!cuentaSeleccionada) return;
        cuentaBancariaId = cuentaSeleccionada;
      } else if (nuevoEstado === "cobrado") {
        // Para cobrar, mostrar confirmación que irá a efectivo
        const result = await Swal.fire({
          title: "¿Cobrar cheque?",
          html: `
            <p>El cheque se marcará como cobrado y el monto se agregará a efectivo.</p>
          `,
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Sí, cobrar",
          cancelButtonText: "Cancelar",
        });

        if (!result.isConfirmed) return;
      } else {
        const result = await Swal.fire({
          title: "¿Cambiar estado del cheque?",
          text: `El cheque se marcará como "${nuevoEstado}"`,
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Sí, cambiar",
          cancelButtonText: "Cancelar",
        });

        if (!result.isConfirmed) return;
      }

      await cambiarEstadoCheque(id, nuevoEstado, cuentaBancariaId);
      Swal.fire({
        icon: "success",
        title: "Estado actualizado",
        text: `Cheque marcado como ${nuevoEstado}`,
        timer: 2000,
      });
      handleFiltrarCheques();
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo cambiar el estado del cheque",
      });
    }
  };

  const handleRevertirDeposito = async (chequeId, cuentaBancariaId) => {
    try {
      const result = await Swal.fire({
        title: "¿Revertir depósito?",
        html: `
          <p>El cheque volverá a estar en <strong>cartera</strong> y se restará del saldo de la cuenta bancaria.</p>
          <p>Esta acción se puede revertir depositando el cheque nuevamente.</p>
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, revertir",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#d33",
      });

      if (!result.isConfirmed) return;

      // Cambiar el estado del cheque a "cartera"
      await cambiarEstadoCheque(chequeId, "cartera", null);

      Swal.fire({
        icon: "success",
        title: "Depósito revertido",
        text: "El cheque volvió a cartera y se actualizó el saldo de la cuenta",
        timer: 2000,
      });

      // Recargar datos
      cargarCheques({});
      cargarCuentasBancarias();
      cargarCobrosYPagos();
    } catch (error) {
      console.error("Error al revertir depósito:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo revertir el depósito",
      });
    }
  };

  const handleRevertirCobrado = async (chequePropioId, cuentaBancariaId) => {
    try {
      const result = await Swal.fire({
        title: "¿Revertir cobro?",
        html: `
          <p>El cheque propio volverá a estar <strong>pendiente</strong> y se sumará nuevamente al saldo de la cuenta bancaria.</p>
          <p>Esta acción se puede revertir marcando el cheque como cobrado nuevamente.</p>
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, revertir",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#d33",
      });

      if (!result.isConfirmed) return;

      // Cambiar el estado del cheque propio a "pendiente"
      await cambiarEstadoChequePropio(chequePropioId, "pendiente", null);

      Swal.fire({
        icon: "success",
        title: "Cobro revertido",
        text: "El cheque volvió a pendiente y se actualizó el saldo de la cuenta",
        timer: 2000,
      });

      // Recargar datos
      cargarChequesPropios();
      cargarCuentasBancarias();
      cargarCobrosYPagos();
    } catch (error) {
      console.error("Error al revertir cobro:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo revertir el cobro",
      });
    }
  };

  const handleCambiarEnFinanciera = async (id) => {
    try {
      // Obtener el cheque para mostrar su valor
      const { cheque } = await obtenerChequePorId(id);

      const { value: formValues } = await Swal.fire({
        title: "Cambiar cheque en financiera",
        html: `
          <div class="text-start">
            <p><strong>Valor del cheque:</strong> ${formatCurrency(cheque.monto)}</p>
            <div class="mb-3">
              <label class="form-label">Costo por cambio en financiera:</label>
              <input
                id="costo-cambio"
                type="number"
                class="form-control"
                placeholder="Ingrese el costo"
                min="0"
                step="0.01"
              />
            </div>
            <div id="calculo-neto" class="alert alert-info" style="display: none;">
              <strong>Efectivo neto:</strong> <span id="monto-neto"></span>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Confirmar cambio",
        cancelButtonText: "Cancelar",
        didOpen: () => {
          const costoInput = document.getElementById("costo-cambio");
          const calculoDiv = document.getElementById("calculo-neto");
          const montoNetoSpan = document.getElementById("monto-neto");

          costoInput.addEventListener("input", () => {
            const costo = parseFloat(costoInput.value) || 0;
            const neto = cheque.monto - costo;

            if (costo > 0) {
              montoNetoSpan.textContent = formatCurrency(neto);
              calculoDiv.style.display = "block";
            } else {
              calculoDiv.style.display = "none";
            }
          });
        },
        preConfirm: () => {
          const costo = parseFloat(document.getElementById("costo-cambio").value);

          if (!costo || costo <= 0) {
            Swal.showValidationMessage("Debe ingresar un costo válido mayor a 0");
            return false;
          }

          if (costo >= cheque.monto) {
            Swal.showValidationMessage("El costo no puede ser igual o mayor al valor del cheque");
            return false;
          }

          return { costoCambio: costo };
        },
      });

      if (!formValues) return;

      // Cambiar el estado del cheque a "cobrado" con el costo de cambio
      await cambiarEstadoCheque(id, "cobrado", null, formValues.costoCambio);

      const efectivoNeto = cheque.monto - formValues.costoCambio;

      Swal.fire({
        icon: "success",
        title: "Cheque cambiado",
        html: `
          <p>El cheque fue cambiado en financiera.</p>
          <p><strong>Costo:</strong> ${formatCurrency(formValues.costoCambio)}</p>
          <p><strong>Efectivo ingresado a caja:</strong> ${formatCurrency(efectivoNeto)}</p>
        `,
        timer: 3000,
      });

      // Recargar datos
      handleFiltrarCheques();
      cargarMovimientos();
    } catch (error) {
      console.error("Error al cambiar cheque en financiera:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo cambiar el cheque",
      });
    }
  };

  const handleEliminarCheque = async (id) => {
    Swal.fire({
      icon: "info",
      title: "No se puede eliminar directamente",
      html: "Para eliminar un cheque de tercero, debes eliminar el cobro que lo generó.<br/><br/>" +
            "Dirígete a la sección de <strong>Cobros</strong> y elimina el cobro correspondiente.",
      confirmButtonText: "Entendido",
      confirmButtonColor: "#0d6efd",
    });
  };

  const handleVerHistorial = async (id) => {
    try {
      setLoadingHistorial(true);
      const data = await obtenerChequePorId(id);
      setChequeSeleccionado(data.cheque);
      setShowHistorialModal(true);
    } catch (error) {
      console.error("Error al cargar historial del cheque:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo cargar el historial del cheque",
      });
    } finally {
      setLoadingHistorial(false);
    }
  };

  const exportarExcelCheques = () => {
    if (cheques.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Sin datos",
        text: "No hay cheques para exportar",
      });
      return;
    }

    const datosExcel = cheques.map((cheque) => ({
      "Nro. Cheque": cheque.numeroCheque,
      Monto: cheque.monto,
      "Fecha Emisión": formatDate(cheque.fechaEmision),
      "Fecha Vencimiento": formatDate(cheque.fechaVencimiento),
      Banco: cheque.banco,
      Tipo: cheque.tipoCheque === "cheque" ? "Cheque" : "E-Cheque",
      Estado: cheque.estado,
      Origen: cheque.origen,
      "Cliente/Proveedor": cheque.cliente?.razonSocial || cheque.proveedor?.razonSocial || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cartera de Cheques");
    XLSX.writeFile(wb, `Cartera_Cheques_${new Date().toISOString().split("T")[0]}.xlsx`);

    Swal.fire({
      icon: "success",
      title: "Exportado",
      text: "El archivo se descargó correctamente",
      timer: 2000,
    });
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      cartera: "bg-primary",
      depositado: "bg-success",
      rechazado: "bg-danger",
      cobrado: "bg-info",
      pendiente: "bg-warning",
      cancelado: "bg-secondary",
    };
    return badges[estado] || "bg-secondary";
  };

  // Funciones para Cheques Propios
  const cargarChequesPropios = async (filtros = {}) => {
    try {
      setLoadingChequesPropios(true);
      const data = await obtenerChequesPropios(filtros);
      setChequesPropios(data.chequesPropios || []);
      setTotalesChequesPropios(data.totales || {
        cantidad: 0,
        montoTotal: 0,
        cantidadPendientes: 0,
        montoPendientes: 0,
        cantidadCobrados: 0,
        montoCobrados: 0,
      });
    } catch (error) {
      console.error("Error al cargar cheques propios:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los cheques propios",
      });
    } finally {
      setLoadingChequesPropios(false);
    }
  };

  const handleFiltrarChequesPropios = () => {
    const filtros = {};
    if (estadoFiltroPropios) filtros.estado = estadoFiltroPropios;
    cargarChequesPropios(filtros);
  };

  const handleLimpiarFiltrosChequesPropios = () => {
    setEstadoFiltroPropios("pendiente");
    cargarChequesPropios();
  };

  const handleMarcarCobrado = async (id) => {
    try {
      // Obtener cuentas bancarias
      const cuentasData = await obtenerCuentasBancarias();
      const cuentas = cuentasData.cuentasBancarias || [];

      if (cuentas.length === 0) {
        return Swal.fire({
          icon: "warning",
          title: "Sin cuentas bancarias",
          text: "Debe crear al menos una cuenta bancaria para registrar el cobro del cheque",
        });
      }

      // Crear opciones para el select
      const opcionesCuentas = cuentas
        .filter(c => c.activo)
        .map(c => `<option value="${c._id}">${c.banco} - ${c.numeroCuenta} (${c.titular})</option>`)
        .join("");

      const { value: cuentaSeleccionada } = await Swal.fire({
        title: "Depositar cheque en cuenta",
        html: `
          <label class="form-label">Cuenta desde donde se descontará:</label>
          <select id="cuenta-select" class="form-select">
            <option value="">Seleccione una cuenta</option>
            ${opcionesCuentas}
          </select>
          <p class="text-muted mt-3">El monto del cheque será descontado del saldo de la cuenta seleccionada</p>
        `,
        showCancelButton: true,
        confirmButtonText: "Depositar",
        cancelButtonText: "Cancelar",
        preConfirm: () => {
          const select = document.getElementById("cuenta-select");
          if (!select.value) {
            Swal.showValidationMessage("Debe seleccionar una cuenta bancaria");
          }
          return select.value;
        },
      });

      if (!cuentaSeleccionada) return;

      await cambiarEstadoChequePropio(id, "cobrado", cuentaSeleccionada);
      Swal.fire({
        icon: "success",
        title: "Cheque depositado",
        text: "El cheque ha sido depositado en la cuenta y el saldo fue descontado",
        timer: 2000,
      });

      // Recargar datos
      cargarChequesPropios();
      cargarCuentasBancarias();
      cargarCobrosYPagos();
    } catch (error) {
      console.error("Error al marcar cheque:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo marcar el cheque como cobrado",
      });
    }
  };

  const handleEliminarChequePropio = async (id) => {
    Swal.fire({
      icon: "info",
      title: "No se puede eliminar directamente",
      html: "Para eliminar un cheque propio, debes eliminar el pago que lo generó.<br/><br/>" +
            "Dirígete a la sección de <strong>Pagos a Proveedores</strong>, <strong>Pagos a Contratistas</strong> " +
            "o <strong>Pagos de Costos Fijos</strong> y elimina el pago correspondiente.",
      confirmButtonText: "Entendido",
      confirmButtonColor: "#0d6efd",
    });
  };

  const exportarExcelChequesPropios = () => {
    if (chequesPropios.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Sin datos",
        text: "No hay cheques propios para exportar",
      });
      return;
    }

    const datosExcel = chequesPropios.map((cheque) => ({
      Banco: cheque.bancoEmisor || "-",
      "Nro. Cheque": cheque.numeroCheque,
      Monto: cheque.monto,
      "Fecha Emisión": formatDate(cheque.fechaEmision),
      "Fecha Pago": formatDate(cheque.fechaPago),
      Proveedor: cheque.proveedor?.razonSocial || "N/A",
      Estado: cheque.estado,
    }));

    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cheques Propios");
    XLSX.writeFile(wb, `Cheques_Propios_${new Date().toISOString().split("T")[0]}.xlsx`);

    Swal.fire({
      icon: "success",
      title: "Exportado",
      text: "El archivo se descargó correctamente",
      timer: 2000,
    });
  };

  // Funciones para Cuentas Bancarias
  const cargarCuentasBancarias = async () => {
    try {
      setLoadingCuentas(true);
      const data = await obtenerCuentasBancarias();
      setCuentasBancarias(data.cuentasBancarias || []);
    } catch (error) {
      console.error("Error al cargar cuentas bancarias:", error);
    } finally {
      setLoadingCuentas(false);
    }
  };

  // Cargar cobros y pagos para mostrar transferencias y depósitos
  const cargarCobrosYPagos = async () => {
    try {
      setLoadingMovimientosBancarios(true);
      const [cobrosData, pagosData, pagosCostosData, pagosContratistasData] = await Promise.all([
        obtenerCobros(),
        obtenerPagos(),
        obtenerPagosCostosFijos(),
        obtenerPagosContratistas()
      ]);
      setCobros(cobrosData.cobros || []);
      setPagos(pagosData.pagos || []);
      setPagosCostosFijos(pagosCostosData.pagos || []);
      setPagosContratistas(pagosContratistasData.pagos || []);
    } catch (error) {
      console.error("Error al cargar cobros y pagos:", error);
    } finally {
      setLoadingMovimientosBancarios(false);
    }
  };

  // Funciones para Movimientos Bancarios
  const cargarMovimientosBancarios = async (filtros = {}) => {
    try {
      setLoadingBancarios(true);
      const data = await obtenerMovimientosBancarios(filtros);
      setMovimientosBancarios(data.movimientos || []);
      setTotalesBancarios(data.totales || { ingresos: 0, egresos: 0, saldo: 0 });
    } catch (error) {
      console.error("Error al cargar movimientos bancarios:", error);
    } finally {
      setLoadingBancarios(false);
    }
  };

  const handleFiltrarBancarios = () => {
    const filtros = {};
    if (fechaDesdeBancarios) filtros.fechaDesde = fechaDesdeBancarios;
    if (fechaHastaBancarios) filtros.fechaHasta = fechaHastaBancarios;
    if (cuentaBancariaFiltro) filtros.cuentaBancariaId = cuentaBancariaFiltro;
    cargarMovimientosBancarios(filtros);
  };

  const handleLimpiarFiltrosBancarios = () => {
    setFechaDesdeBancarios("");
    setFechaHastaBancarios("");
    setCuentaBancariaFiltro("");
    cargarMovimientosBancarios();
  };

  // Funciones para Dólares
  const cargarMovimientosDolares = async (filtros = {}) => {
    try {
      setLoadingDolares(true);
      const data = await obtenerMovimientosDolares(filtros);
      setMovimientosDolares(data.movimientos || []);
      setTotalesDolares(data.totales || { saldoInicial: 0, ingresos: 0, egresos: 0, saldo: 0 });
    } catch (error) {
      console.error("Error al cargar movimientos de dólares:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los movimientos de dólares",
      });
    } finally {
      setLoadingDolares(false);
    }
  };

  const handleFiltrarDolares = () => {
    const filtros = {};
    if (fechaDesdeDolares) filtros.fechaDesde = fechaDesdeDolares;
    if (fechaHastaDolares) filtros.fechaHasta = fechaHastaDolares;
    cargarMovimientosDolares(filtros);
  };

  const handleLimpiarFiltrosDolares = () => {
    setFechaDesdeDolares("");
    setFechaHastaDolares("");
    cargarMovimientosDolares();
  };

  const handleCrearMovimientoDolar = async (e) => {
    e.preventDefault();

    const montoNumero = parseFloat(nuevoMovimientoDolar.monto);

    if (!montoNumero || montoNumero <= 0) {
      return Swal.fire({
        icon: "error",
        title: "Error",
        text: "El monto debe ser mayor a 0",
      });
    }

    if (!nuevoMovimientoDolar.detalle.trim()) {
      return Swal.fire({
        icon: "error",
        title: "Error",
        text: "El detalle es obligatorio",
      });
    }

    try {
      await crearMovimientoDolar({
        ...nuevoMovimientoDolar,
        monto: montoNumero
      });
      Swal.fire({
        icon: "success",
        title: "Éxito",
        text: `${nuevoMovimientoDolar.tipo === "ingreso" ? "Ingreso" : "Egreso"} de dólares registrado correctamente`,
        timer: 2000,
      });
      setNuevoMovimientoDolar({
        tipo: "ingreso",
        monto: "",
        detalle: "",
        fecha: new Date().toISOString().split("T")[0],
      });
      cargarMovimientosDolares();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo registrar el movimiento",
      });
    }
  };

  const handleEliminarMovimientoDolar = async (id) => {
    const result = await Swal.fire({
      title: "¿Eliminar movimiento?",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });

    if (!result.isConfirmed) return;

    try {
      await eliminarMovimientoDolar(id);
      Swal.fire({
        icon: "success",
        title: "Eliminado",
        text: "Movimiento eliminado correctamente",
        timer: 2000,
      });
      cargarMovimientosDolares();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo eliminar el movimiento",
      });
    }
  };

  // ============= FUNCIONES MOVIMIENTOS EFECTIVO =============

  const cargarMovimientosEfectivo = async (filtros = {}) => {
    try {
      setLoadingEfectivo(true);
      const data = await obtenerMovimientosEfectivo(filtros);
      setMovimientosEfectivo(data.movimientos || []);
      setTotalesEfectivo(data.totales || { ingresos: 0, egresos: 0, saldo: 0 });
    } catch (error) {
      console.error("Error al cargar movimientos de efectivo:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los movimientos de efectivo",
      });
    } finally {
      setLoadingEfectivo(false);
    }
  };

  const handleFiltrarEfectivo = () => {
    const filtros = {};
    if (fechaDesdeEfectivo) filtros.fechaDesde = fechaDesdeEfectivo;
    if (fechaHastaEfectivo) filtros.fechaHasta = fechaHastaEfectivo;
    cargarMovimientosEfectivo(filtros);
  };

  const handleLimpiarFiltrosEfectivo = () => {
    setFechaDesdeEfectivo("");
    setFechaHastaEfectivo("");
    cargarMovimientosEfectivo();
  };

  const handleCrearMovimientoEfectivo = async (e) => {
    e.preventDefault();

    if (!nuevoMovimientoEfectivo.monto || parseFloat(nuevoMovimientoEfectivo.monto) <= 0) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "El monto debe ser mayor a 0",
      });
      return;
    }

    try {
      await crearMovimientoEfectivo({
        ...nuevoMovimientoEfectivo,
        monto: parseFloat(nuevoMovimientoEfectivo.monto),
      });

      Swal.fire({
        icon: "success",
        title: "Registrado",
        text: "Movimiento de efectivo registrado correctamente",
        timer: 2000,
      });

      setNuevoMovimientoEfectivo({
        tipo: "egreso",
        monto: "",
        detalle: "",
        fecha: new Date().toISOString().split("T")[0],
      });

      cargarMovimientosEfectivo();
      cargarMovimientos(); // Recargar también la tabla principal de efectivo
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo registrar el movimiento",
      });
    }
  };

  const handleEliminarMovimientoEfectivo = async (id) => {
    const result = await Swal.fire({
      title: "¿Eliminar movimiento?",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });

    if (!result.isConfirmed) return;

    try {
      await eliminarMovimientoEfectivo(id);
      Swal.fire({
        icon: "success",
        title: "Eliminado",
        text: "Movimiento eliminado correctamente",
        timer: 2000,
      });
      cargarMovimientosEfectivo();
      cargarMovimientos(); // Recargar también la tabla principal de efectivo
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo eliminar el movimiento",
      });
    }
  };

  // Cargar transferencias
  const cargarTransferencias = async () => {
    try {
      setLoadingTransferencias(true);
      const data = await obtenerTransferencias();
      setTransferencias(data.transferencias || []);
    } catch (error) {
      console.error("Error al cargar transferencias:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las transferencias",
      });
    } finally {
      setLoadingTransferencias(false);
    }
  };

  // Cargar usuarios (para admin)
  const cargarUsuarios = async () => {
    try {
      const data = await obtenerUsuarios();
      setUsuarios(data.usuarios || []);
      console.log("Usuarios cargados:", data.usuarios);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
    }
  };

  // Cerrar caja (contable)
  const handleCerrarCaja = async (e) => {
    e.preventDefault();
    try {
      const montoPesos = parseFloat(formCierre.montoPesos) || 0;
      const montoDolares = parseFloat(formCierre.montoDolares) || 0;
      const cheques = formCierre.cheques || [];

      // Validar que haya al menos un item
      if (montoPesos <= 0 && montoDolares <= 0 && cheques.length === 0) {
        Swal.fire({
          icon: "warning",
          title: "Atención",
          text: "Debe transferir al menos un item (efectivo, dólares o cheques)",
        });
        return;
      }

      const data = {
        montoPesos,
        montoDolares,
        cheques,
        detalle: formCierre.detalle || "Cierre de caja"
      };

      await cerrarCaja(data);
      Swal.fire({
        icon: "success",
        title: "Cierre de caja exitoso",
        text: "Transferencia enviada. Pendiente de aprobación por administrador.",
        timer: 3000,
      });
      setShowModalCerrarCaja(false);
      setFormCierre({ montoPesos: "", montoDolares: "", cheques: [], detalle: "" });
      cargarTransferencias();
      cargarMovimientos();
      cargarMovimientosDolares();
      cargarCheques({ estado: "cartera" });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo cerrar la caja",
      });
    }
  };

  // Transferir fondos (admin)
  const handleTransferirFondos = async (e) => {
    e.preventDefault();
    try {
      const montoPesos = parseFloat(formTransferencia.montoPesos) || 0;
      const montoDolares = parseFloat(formTransferencia.montoDolares) || 0;
      const chequesTerceros = formTransferencia.chequesTerceros || [];
      const chequesPropios = formTransferencia.chequesPropios || [];

      // Validar que haya al menos un item
      if (montoPesos <= 0 && montoDolares <= 0 && chequesTerceros.length === 0 && chequesPropios.length === 0) {
        Swal.fire({
          icon: "warning",
          title: "Atención",
          text: "Debe transferir al menos un item (efectivo, dólares o cheques)",
        });
        return;
      }

      if (!formTransferencia.destinoUsuarioId) {
        Swal.fire({
          icon: "warning",
          title: "Atención",
          text: "Debe seleccionar un usuario destino",
        });
        return;
      }

      const data = {
        montoPesos,
        montoDolares,
        chequesTerceros,
        chequesPropios,
        detalle: formTransferencia.detalle || "Transferencia desde caja general",
        destinoUsuarioId: formTransferencia.destinoUsuarioId
      };

      await transferirFondos(data);
      Swal.fire({
        icon: "success",
        title: "Transferencia exitosa",
        text: "Los fondos han sido enviados correctamente",
        timer: 2000,
      });
      setShowModalTransferir(false);
      setFormTransferencia({
        montoPesos: "",
        montoDolares: "",
        chequesTerceros: [],
        chequesPropios: [],
        detalle: "",
        destinoUsuarioId: ""
      });
      cargarTransferencias();
      cargarMovimientos();
      cargarMovimientosDolares();
      cargarCheques({ estado: "depositado" });
      cargarChequesPropios({ estado: "pendiente" });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo realizar la transferencia",
      });
    }
  };

  // Abrir modal de cerrar caja y cargar cheques disponibles
  const abrirModalCerrarCaja = async () => {
    try {
      const data = await obtenerCheques({ estado: "cartera" });
      setChequesDisponibles(data.cheques || []);
      setShowModalCerrarCaja(true);
    } catch (error) {
      console.error("Error al cargar cheques:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los cheques disponibles",
      });
    }
  };

  // Aprobar transferencia (admin)
  const handleAprobarTransferencia = async (id) => {
    try {
      const result = await Swal.fire({
        title: "¿Aprobar transferencia?",
        text: "Los fondos se acreditarán en la caja general",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sí, aprobar",
        cancelButtonText: "Cancelar",
      });

      if (result.isConfirmed) {
        await aprobarTransferencia(id);
        Swal.fire({
          icon: "success",
          title: "Transferencia aprobada",
          text: "Los fondos han sido acreditados en caja general",
          timer: 2000,
        });
        cargarTransferencias();
        cargarMovimientos();
        cargarMovimientosDolares();
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo aprobar la transferencia",
      });
    }
  };

  // Aceptar transferencia (contable)
  const handleAceptarTransferencia = async (id) => {
    try {
      const result = await Swal.fire({
        title: "¿Aceptar transferencia?",
        text: "Los fondos se acreditarán en tu caja",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sí, aceptar",
        cancelButtonText: "Cancelar",
      });

      if (result.isConfirmed) {
        await aceptarTransferencia(id);
        Swal.fire({
          icon: "success",
          title: "Transferencia aceptada",
          text: "Los fondos han sido acreditados en tu caja",
          timer: 2000,
        });
        cargarTransferencias();
        cargarMovimientos();
        cargarMovimientosDolares();
        cargarCheques({ estado: "cartera" });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo aceptar la transferencia",
      });
    }
  };

  // Rechazar transferencia (admin)
  const handleRechazarTransferencia = async (id) => {
    try {
      const result = await Swal.fire({
        title: "¿Rechazar transferencia?",
        text: "Los fondos se devolverán al usuario origen",
        input: "textarea",
        inputLabel: "Motivo del rechazo",
        inputPlaceholder: "Ingrese el motivo...",
        showCancelButton: true,
        confirmButtonText: "Sí, rechazar",
        cancelButtonText: "Cancelar",
        inputValidator: (value) => {
          if (!value) {
            return "Debe ingresar un motivo";
          }
        },
      });

      if (result.isConfirmed) {
        await rechazarTransferencia(id, result.value);
        Swal.fire({
          icon: "success",
          title: "Transferencia rechazada",
          text: "Los fondos han sido devueltos al usuario",
          timer: 2000,
        });
        cargarTransferencias();
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo rechazar la transferencia",
      });
    }
  };

  // Rechazar transferencia por contable
  const handleRechazarTransferenciaContable = async (id) => {
    try {
      const result = await Swal.fire({
        title: "¿Rechazar transferencia?",
        text: "La transferencia será rechazada y no se acreditarán los fondos",
        input: "textarea",
        inputLabel: "Motivo del rechazo (opcional)",
        inputPlaceholder: "Ingrese el motivo...",
        showCancelButton: true,
        confirmButtonText: "Sí, rechazar",
        cancelButtonText: "Cancelar",
      });

      if (result.isConfirmed) {
        await rechazarTransferenciaPorContable(id, result.value || "Rechazada por el contable");
        Swal.fire({
          icon: "success",
          title: "Transferencia rechazada",
          text: "La transferencia ha sido rechazada",
          timer: 2000,
        });
        cargarTransferencias();
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo rechazar la transferencia",
      });
    }
  };

  // Anular transferencia aprobada (admin)
  const handleAnularTransferencia = async (id) => {
    try {
      const result = await Swal.fire({
        title: "¿Anular transferencia?",
        text: "Se revertirán todos los movimientos de fondos",
        input: "textarea",
        inputLabel: "Motivo de la anulación",
        inputPlaceholder: "Ingrese el motivo...",
        showCancelButton: true,
        confirmButtonText: "Sí, anular",
        cancelButtonText: "Cancelar",
        inputValidator: (value) => {
          if (!value) {
            return "Debe ingresar un motivo";
          }
        },
      });

      if (result.isConfirmed) {
        await anularTransferencia(id, result.value);
        Swal.fire({
          icon: "success",
          title: "Transferencia anulada",
          text: "Los fondos han sido revertidos",
          timer: 2000,
        });
        cargarTransferencias();
        cargarMovimientos();
        cargarMovimientosDolares();
        cargarCheques({ estado: "cartera" });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "No se pudo anular la transferencia",
      });
    }
  };

  // Toggle selección de cheque (cerrar caja)
  const toggleChequeSeleccion = (chequeId) => {
    setFormCierre(prev => ({
      ...prev,
      cheques: prev.cheques.includes(chequeId)
        ? prev.cheques.filter(id => id !== chequeId)
        : [...prev.cheques, chequeId]
    }));
  };

  // Toggle selección de cheque de terceros (transferir fondos)
  const toggleChequeTerceroTransferencia = (chequeId) => {
    setFormTransferencia(prev => ({
      ...prev,
      chequesTerceros: prev.chequesTerceros.includes(chequeId)
        ? prev.chequesTerceros.filter(id => id !== chequeId)
        : [...prev.chequesTerceros, chequeId]
    }));
  };

  // Toggle selección de cheque propio (transferir fondos)
  const toggleChequePropioTransferencia = (chequeId) => {
    setFormTransferencia(prev => ({
      ...prev,
      chequesPropios: prev.chequesPropios.includes(chequeId)
        ? prev.chequesPropios.filter(id => id !== chequeId)
        : [...prev.chequesPropios, chequeId]
    }));
  };

  // Abrir modal de transferir fondos y cargar cheques disponibles
  const abrirModalTransferirFondos = async () => {
    try {
      // Cargar cheques de terceros depositados (en caja general)
      const dataTerceros = await obtenerCheques({ estado: "depositado" });
      setChequesTercerosDisponibles(dataTerceros.cheques || []);

      // Cargar cheques propios pendientes
      const dataPropios = await obtenerChequesPropios({ estado: "pendiente" });
      setChequesPropiosDisponibles(dataPropios.cheques || []);

      setShowModalTransferir(true);
    } catch (error) {
      console.error("Error al cargar cheques:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los cheques disponibles",
      });
    }
  };

  return (
    <Layout>
      {/* Page Header */}
      <div className="row mb-4">
        <div className="col-12 col-md-6 mb-3 mb-md-0">
          <h1 className="h4 mb-0">
            <i className="bi bi-cash-coin me-2"></i>
            Caja
          </h1>
        </div>
        <div className="col-12 col-md-6">
          <div className="d-flex gap-2 justify-content-md-end">
            {activeTab === "efectivo" && (
              <button className="btn btn-success" onClick={exportarExcel}>
                <i className="bi bi-file-earmark-excel me-2"></i>
                Exportar
              </button>
            )}
            {activeTab === "cheques" && (
              <button className="btn btn-success" onClick={exportarExcelCheques}>
                <i className="bi bi-file-earmark-excel me-2"></i>
                Exportar
              </button>
            )}
            {activeTab === "chequesPropios" && (
              <button className="btn btn-success" onClick={exportarExcelChequesPropios}>
                <i className="bi bi-file-earmark-excel me-2"></i>
                Exportar
              </button>
            )}
            {activeTab === "dolares" && (
              <button className="btn btn-success" onClick={exportarExcelDolares}>
                <i className="bi bi-file-earmark-excel me-2"></i>
                Exportar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "efectivo" ? "active" : ""}`}
            onClick={() => setActiveTab("efectivo")}
          >
            <i className="bi bi-cash-stack me-2"></i>
            Efectivo
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "dolares" ? "active" : ""}`}
            onClick={() => setActiveTab("dolares")}
          >
            <i className="bi bi-currency-dollar me-2"></i>
            Dólares
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "movimientosBancarios" ? "active" : ""}`}
            onClick={() => setActiveTab("movimientosBancarios")}
          >
            <i className="bi bi-bank me-2"></i>
            Movimientos Bancarios
          </button>
        </li>
        {/* Pestañas dinámicas de Bancos */}
        {false && !loadingCuentas && cuentasBancarias.filter(c => c.activo).map((cuenta) => (
          <li className="nav-item" key={cuenta._id}>
            <button
              className={`nav-link ${activeTab === `banco-${cuenta._id}` ? "active" : ""}`}
              onClick={() => setActiveTab(`banco-${cuenta._id}`)}
            >
              <i className="bi bi-bank me-2"></i>
              {cuenta.banco}
            </button>
          </li>
        ))}
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "cheques" ? "active" : ""}`}
            onClick={() => setActiveTab("cheques")}
          >
            <i className="bi bi-credit-card me-2"></i>
            Cheques de Terceros
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "chequesPropios" ? "active" : ""}`}
            onClick={() => setActiveTab("chequesPropios")}
          >
            <i className="bi bi-wallet2 me-2"></i>
            Cheques Propios
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "transferencias" ? "active" : ""}`}
            onClick={() => setActiveTab("transferencias")}
          >
            <i className="bi bi-arrow-left-right me-2"></i>
            Transferencia de Caja
          </button>
        </li>
      </ul>

      {/* Tab Content - Efectivo */}
      {activeTab === "efectivo" && (
        <>
          {/* Filtros */}
          <div className="card border-0 shadow-sm mb-4" style={{ transition: 'none' }}>
        <div className="card-body">
          <h5 className="card-title mb-3">
            <i className="bi bi-funnel me-2"></i>
            Filtros
          </h5>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Fecha Desde</label>
              <input
                type="date"
                className="form-control"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Fecha Hasta</label>
              <input
                type="date"
                className="form-control"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            <div className="col-md-4 d-flex align-items-end">
              <button className="btn btn-primary me-2" onClick={handleFiltrar}>
                <i className="bi bi-search me-2"></i>
                Filtrar
              </button>
              <button className="btn btn-secondary" onClick={handleLimpiarFiltros}>
                <i className="bi bi-x-circle me-2"></i>
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario para agregar movimiento de efectivo */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-light">
          <h5 className="mb-0">
            <i className="bi bi-plus-circle me-2"></i>
            Registrar Movimiento
          </h5>
        </div>
        <div className="card-body">
          <form onSubmit={handleCrearMovimientoEfectivo}>
            <div className="row g-3 mb-3">
              <div className="col-md-3">
                <label className="form-label">Tipo *</label>
                <select
                  className="form-select"
                  value={nuevoMovimientoEfectivo.tipo}
                  onChange={(e) =>
                    setNuevoMovimientoEfectivo({ ...nuevoMovimientoEfectivo, tipo: e.target.value })
                  }
                  required
                >
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Fecha *</label>
                <input
                  type="date"
                  className="form-control"
                  value={nuevoMovimientoEfectivo.fecha}
                  onChange={(e) =>
                    setNuevoMovimientoEfectivo({ ...nuevoMovimientoEfectivo, fecha: e.target.value })
                  }
                  required
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Monto $ *</label>
                <input
                  type="number"
                  className="form-control"
                  step="0.01"
                  placeholder="0.00"
                  value={nuevoMovimientoEfectivo.monto}
                  onChange={(e) =>
                    setNuevoMovimientoEfectivo({ ...nuevoMovimientoEfectivo, monto: e.target.value })
                  }
                  required
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Detalle *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Origen/Destino"
                  value={nuevoMovimientoEfectivo.detalle}
                  onChange={(e) =>
                    setNuevoMovimientoEfectivo({ ...nuevoMovimientoEfectivo, detalle: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              <i className="bi bi-save me-2"></i>
              Registrar Movimiento
            </button>
          </form>
        </div>
      </div>

      {/* Resumen de Totales */}
      <div className="row mb-4">
        <div className="col-md-4 mb-3">
          <div className="card border-0 shadow-sm h-100 bg-success bg-gradient text-white">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="flex-grow-1">
                  <h6 className="card-subtitle mb-2 text-white-50">
                    <i className="bi bi-arrow-down-circle me-2"></i>
                    Ingresos
                  </h6>
                  <h3 className="mb-0">{formatCurrency(totales.ingresos)}</h3>
                </div>
                <div className="fs-1 opacity-50">
                  <i className="bi bi-plus-circle"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4 mb-3">
          <div className="card border-0 shadow-sm h-100 bg-danger bg-gradient text-white">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="flex-grow-1">
                  <h6 className="card-subtitle mb-2 text-white-50">
                    <i className="bi bi-arrow-up-circle me-2"></i>
                    Egresos
                  </h6>
                  <h3 className="mb-0">{formatCurrency(totales.egresos)}</h3>
                </div>
                <div className="fs-1 opacity-50">
                  <i className="bi bi-dash-circle"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4 mb-3">
          <div className={`card border-0 shadow-sm h-100 ${totales.saldo >= 0 ? 'bg-primary' : 'bg-warning'} bg-gradient text-white`}>
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="flex-grow-1">
                  <h6 className="card-subtitle mb-2 text-white-50">
                    <i className="bi bi-wallet2 me-2"></i>
                    Saldo
                  </h6>
                  <h3 className="mb-0">{formatCurrency(totales.saldo)}</h3>
                </div>
                <div className="fs-1 opacity-50">
                  <i className="bi bi-cash-stack"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="d-flex justify-content-center align-items-center my-5">
          <div className="spinner-border text-success" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      )}

      {/* Tabla de Movimientos */}
      {!loading && (
        <div className="card border-0 shadow-sm tabla-sin-movimiento">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="fw-semibold">FECHA</th>
                    <th className="fw-semibold">TIPO</th>
                    <th className="fw-semibold">CONCEPTO</th>
                    <th className="fw-semibold">DETALLE</th>
                    <th className="fw-semibold">FACTURA</th>
                    <th className="fw-semibold text-end">MONTO</th>
                    <th className="fw-semibold">REFERENCIA</th>
                    <th className="fw-semibold text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5">
                        <i className="bi bi-inbox display-4 d-block mb-2 text-muted"></i>
                        <p className="text-muted mb-0">No hay movimientos de efectivo registrados</p>
                      </td>
                    </tr>
                  ) : (
                    movimientos.map((mov) => (
                      <tr key={mov._id}>
                        <td>{formatDate(mov.fecha)}</td>
                        <td>
                          <span
                            className={`badge ${
                              mov.tipo === "INGRESO" ? "bg-success" : "bg-danger"
                            }`}
                          >
                            {mov.tipo}
                          </span>
                        </td>
                        <td>{mov.concepto}</td>
                        <td>
                          {mov.concepto === "Movimiento manual de efectivo" ? (
                            <strong>{mov.detalle || "N/A"}</strong>
                          ) : (
                            <div>
                              <strong>
                                {mov.costoFijo || mov.contratista || mov.cliente || mov.proveedor || "N/A"}
                              </strong>
                              <br />
                              <small className="text-muted">
                                {mov.categoria && `Categoría: ${mov.categoria}`}
                                {mov.dni && `DNI: ${mov.dni}`}
                                {mov.cuit && `CUIT: ${mov.cuit}`}
                              </small>
                            </div>
                          )}
                        </td>
                        <td>{mov.factura}</td>
                        <td className="text-end">
                          <strong
                            className={mov.tipo === "INGRESO" ? "text-success" : "text-danger"}
                          >
                            {formatCurrency(mov.monto)}
                          </strong>
                        </td>
                        <td>
                          <small className="text-muted">{mov.referencia}</small>
                        </td>
                        <td className="text-center">
                          {mov.concepto === "Movimiento manual de efectivo" && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleEliminarMovimientoEfectivo(mov._id)}
                              title="Eliminar movimiento"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Tab Content - Dólares */}
      {activeTab === "dolares" && (
        <>
          {/* Filtros */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">
              <h5 className="card-title mb-3">
                <i className="bi bi-funnel me-2"></i>
                Filtros
              </h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Fecha Desde</label>
                  <input
                    type="date"
                    className="form-control"
                    value={fechaDesdeDolares}
                    onChange={(e) => setFechaDesdeDolares(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Fecha Hasta</label>
                  <input
                    type="date"
                    className="form-control"
                    value={fechaHastaDolares}
                    onChange={(e) => setFechaHastaDolares(e.target.value)}
                  />
                </div>
                <div className="col-md-4 d-flex align-items-end gap-2">
                  <button className="btn btn-primary" onClick={handleFiltrarDolares}>
                    <i className="bi bi-search me-2"></i>
                    Filtrar
                  </button>
                  <button className="btn btn-secondary" onClick={handleLimpiarFiltrosDolares}>
                    <i className="bi bi-x-circle me-2"></i>
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Formulario para agregar movimiento */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-light">
              <h5 className="mb-0">
                <i className="bi bi-plus-circle me-2"></i>
                Registrar Movimiento
              </h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleCrearMovimientoDolar}>
                <div className="row g-3 mb-3">
                  <div className="col-md-3">
                    <label className="form-label">Tipo *</label>
                    <select
                      className="form-select"
                      value={nuevoMovimientoDolar.tipo}
                      onChange={(e) =>
                        setNuevoMovimientoDolar({ ...nuevoMovimientoDolar, tipo: e.target.value })
                      }
                      required
                    >
                      <option value="ingreso">Ingreso</option>
                      <option value="egreso">Egreso</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Fecha *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={nuevoMovimientoDolar.fecha}
                      onChange={(e) =>
                        setNuevoMovimientoDolar({ ...nuevoMovimientoDolar, fecha: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Monto USD *</label>
                    <input
                      type="number"
                      className="form-control"
                      step="0.01"
                      placeholder="0.00"
                      value={nuevoMovimientoDolar.monto}
                      onChange={(e) =>
                        setNuevoMovimientoDolar({ ...nuevoMovimientoDolar, monto: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Detalle *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Origen/Destino"
                      value={nuevoMovimientoDolar.detalle}
                      onChange={(e) =>
                        setNuevoMovimientoDolar({ ...nuevoMovimientoDolar, detalle: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">
                  <i className="bi bi-save me-2"></i>
                  Registrar Movimiento
                </button>
              </form>
            </div>
          </div>

          {/* Resumen de Totales Dólares */}
          <div className="row mb-4">
            <div className="col-md-4 mb-3">
              <div className="card border-0 shadow-sm h-100 bg-success bg-gradient text-white">
                <div className="card-body">
                  <div className="d-flex align-items-center">
                    <div className="flex-grow-1">
                      <h6 className="card-subtitle mb-2 text-white-50">
                        <i className="bi bi-arrow-down-circle me-2"></i>
                        Ingresos
                      </h6>
                      <h3 className="mb-0">USD {(totalesDolares.saldoInicial + totalesDolares.ingresos).toFixed(2)}</h3>
                    </div>
                    <div className="fs-1 opacity-50">
                      <i className="bi bi-plus-circle"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-3">
              <div className="card border-0 shadow-sm h-100 bg-danger bg-gradient text-white">
                <div className="card-body">
                  <div className="d-flex align-items-center">
                    <div className="flex-grow-1">
                      <h6 className="card-subtitle mb-2 text-white-50">
                        <i className="bi bi-arrow-up-circle me-2"></i>
                        Egresos
                      </h6>
                      <h3 className="mb-0">USD {totalesDolares.egresos.toFixed(2)}</h3>
                    </div>
                    <div className="fs-1 opacity-50">
                      <i className="bi bi-dash-circle"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-3">
              <div className={`card border-0 shadow-sm h-100 ${totalesDolares.saldo >= 0 ? 'bg-primary' : 'bg-warning'} bg-gradient text-white`}>
                <div className="card-body">
                  <div className="d-flex align-items-center">
                    <div className="flex-grow-1">
                      <h6 className="card-subtitle mb-2 text-white-50">
                        <i className="bi bi-wallet2 me-2"></i>
                        Saldo
                      </h6>
                      <h3 className="mb-0">USD {totalesDolares.saldo.toFixed(2)}</h3>
                    </div>
                    <div className="fs-1 opacity-50">
                      <i className="bi bi-cash-stack"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de movimientos */}
          {loadingDolares ? (
            <div className="d-flex justify-content-center align-items-center my-5">
              <div className="spinner-border text-success" role="status" style={{ width: "3rem", height: "3rem" }}>
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-light">
                <h5 className="mb-0">
                  <i className="bi bi-list-ul me-2"></i>
                  Movimientos ({movimientosDolares.length})
                </h5>
              </div>
              <div className="card-body p-0">
                {movimientosDolares.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="bi bi-inbox display-1 text-muted mb-3"></i>
                    <p className="text-muted">No hay movimientos de dólares registrados</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Detalle</th>
                          <th className="text-end">Monto USD</th>
                          <th className="text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientosDolares.map((movimiento) => (
                          <tr key={movimiento._id}>
                            <td>{formatDate(movimiento.fecha)}</td>
                            <td>
                              {movimiento.tipo === "ingreso" ? (
                                <span className="badge bg-success">
                                  <i className="bi bi-arrow-down-circle me-1"></i>
                                  Ingreso
                                </span>
                              ) : (
                                <span className="badge bg-danger">
                                  <i className="bi bi-arrow-up-circle me-1"></i>
                                  Egreso
                                </span>
                              )}
                            </td>
                            <td>{movimiento.detalle}</td>
                            <td className="text-end">
                              <strong className={movimiento.tipo === "ingreso" ? "text-success" : "text-danger"}>
                                {movimiento.tipo === "ingreso" ? "+" : "-"} USD {movimiento.monto.toFixed(2)}
                              </strong>
                            </td>
                            <td className="text-center">
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleEliminarMovimientoDolar(movimiento._id)}
                                title="Eliminar"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab Content - Cheques */}
      {activeTab === "cheques" && (
        <>
          {/* Filtros */}
          <div className="card border-0 shadow-sm mb-4" style={{ transition: 'none' }}>
            <div className="card-body">
              <h5 className="card-title mb-3">
                <i className="bi bi-funnel me-2"></i>
                Filtros
              </h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={estadoFiltro}
                    onChange={(e) => setEstadoFiltro(e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="cartera">En Cartera</option>
                    <option value="depositado">Depositado</option>
                    <option value="rechazado">Rechazado</option>
                    <option value="cobrado">Cobrado</option>
                    <option value="financiera">Financiera</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Tipo</label>
                  <select
                    className="form-select"
                    value={tipoFiltro}
                    onChange={(e) => setTipoFiltro(e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="cheque">Cheque</option>
                    <option value="echeq">E-Cheque</option>
                  </select>
                </div>
                <div className="col-md-4 d-flex align-items-end">
                  <button className="btn btn-primary me-2" onClick={handleFiltrarCheques}>
                    <i className="bi bi-search me-2"></i>
                    Filtrar
                  </button>
                  <button className="btn btn-secondary" onClick={handleLimpiarFiltrosCheques}>
                    <i className="bi bi-x-circle me-2"></i>
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loadingCheques && (
            <div className="d-flex justify-content-center align-items-center my-5">
              <div className="spinner-border text-success" role="status" style={{ width: "3rem", height: "3rem" }}>
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          )}

          {/* Tabla de Cheques */}
          {!loadingCheques && (
            <div className="card border-0 shadow-sm tabla-sin-movimiento">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="fw-semibold">NRO. CHEQUE</th>
                        <th className="fw-semibold text-end">MONTO</th>
                        <th className="fw-semibold">VENCIMIENTO</th>
                        <th className="fw-semibold">BANCO</th>
                        <th className="fw-semibold">TIPO</th>
                        <th className="fw-semibold">ESTADO</th>
                        <th className="fw-semibold">ORIGEN</th>
                        <th className="fw-semibold">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cheques.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center py-5">
                            <i className="bi bi-inbox display-4 d-block mb-2 text-muted"></i>
                            <p className="text-muted mb-0">No hay cheques en cartera</p>
                          </td>
                        </tr>
                      ) : (
                        cheques.map((cheque) => (
                          <tr key={cheque._id}>
                            <td>
                              <strong>{cheque.numeroCheque}</strong>
                            </td>
                            <td className="text-end">
                              <strong className="text-primary">{formatCurrency(cheque.monto)}</strong>
                            </td>
                            <td>{formatDate(cheque.fechaVencimiento)}</td>
                            <td>{cheque.banco}</td>
                            <td>
                              <span className={`badge ${cheque.tipoCheque === "cheque" ? "bg-success" : "bg-info"}`}>
                                {cheque.tipoCheque === "cheque" ? "Cheque" : "E-Cheque"}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${getEstadoBadge(cheque.estado)}`}>
                                {cheque.estado === "cobrado" && (cheque.costoCambio || 0) > 0
                                  ? "Financiera"
                                  : cheque.estado}
                              </span>
                            </td>
                            <td>
                              <div>
                                <small className="text-muted text-uppercase">{cheque.origen}</small>
                                <br />
                                <small>{cheque.cliente?.razonSocial || cheque.proveedor?.razonSocial || "N/A"}</small>
                              </div>
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => handleCambiarEstado(cheque._id, "depositado")}
                                  title="Marcar como depositado"
                                  disabled={cheque.estado !== "cartera"}
                                >
                                  <i className="bi bi-bank"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-info"
                                  onClick={() => handleCambiarEstado(cheque._id, "cobrado")}
                                  title="Marcar como cobrado"
                                  disabled={cheque.estado !== "cartera"}
                                >
                                  <i className="bi bi-check-circle"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-warning"
                                  onClick={() => handleCambiarEnFinanciera(cheque._id)}
                                  title="Cambiar en financiera"
                                  disabled={cheque.estado !== "cartera"}
                                >
                                  <i className="bi bi-cash-coin"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleEliminarCheque(cheque._id)}
                                  title="Eliminar"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab Content - Bancos */}
      {false && !loadingCuentas && cuentasBancarias.filter(c => c.activo).map((cuenta) => {
        // Calcular saldo real sumando movimientos
        const chequesDepositados = cheques.filter(
          ch => ch.estado === "depositado" && ch.cuentaBancaria?._id === cuenta._id
        );
        const chequesPropiosCobrados = chequesPropios.filter(
          ch => ch.estado === "cobrado" && ch.cuentaBancaria?._id === cuenta._id
        );
        const transferenciasRecibidas = [];
        cobros.forEach(cobro => {
          cobro.mediosPago?.forEach(medio => {
            if (medio.tipo === "transferencia" && medio.cuentaBancaria?._id === cuenta._id) {
              transferenciasRecibidas.push(medio.monto);
            }
          });
        });
        const transferenciasEmitidas = [];
        pagos.forEach(pago => {
          pago.mediosPago?.forEach(medio => {
            if (medio.tipo === "transferencia" && medio.cuentaBancaria?._id === cuenta._id) {
              transferenciasEmitidas.push(medio.monto);
            }
          });
        });
        pagosCostosFijos.forEach(pago => {
          pago.mediosPago?.forEach(medio => {
            if (medio.tipo === "transferencia" && medio.cuentaBancaria?._id === cuenta._id) {
              transferenciasEmitidas.push(medio.monto);
            }
          });
        });
        pagosContratistas.forEach(pago => {
          pago.mediosPago?.forEach(medio => {
            if (medio.tipo === "transferencia" && medio.cuentaBancaria?._id === cuenta._id) {
              transferenciasEmitidas.push(medio.monto);
            }
          });
        });
        const depositosEfectivo = [];
        cobros.forEach(cobro => {
          cobro.mediosPago?.forEach(medio => {
            if (medio.tipo === "efectivo" && medio.cuentaBancaria?._id === cuenta._id) {
              depositosEfectivo.push(medio.monto);
            }
          });
        });

        // Calcular saldo real
        const totalIngresos =
          chequesDepositados.reduce((sum, ch) => sum + ch.monto, 0) +
          transferenciasRecibidas.reduce((sum, monto) => sum + monto, 0) +
          depositosEfectivo.reduce((sum, monto) => sum + monto, 0);

        const totalEgresos =
          chequesPropiosCobrados.reduce((sum, ch) => sum + ch.monto, 0) +
          transferenciasEmitidas.reduce((sum, monto) => sum + monto, 0);

        const saldoReal = totalIngresos - totalEgresos;

        return activeTab === `banco-${cuenta._id}` && (
          <div key={cuenta._id}>
            {/* Resumen de la Cuenta */}
            <div className="row mb-4">
              <div className="col-md-4 mb-3">
                <div className="card border-0 shadow-sm h-100 bg-primary bg-gradient text-white">
                  <div className="card-body">
                    <div className="d-flex align-items-center">
                      <div className="flex-grow-1">
                        <h6 className="card-subtitle mb-2 text-white-50">
                          <i className="bi bi-wallet2 me-2"></i>
                          Saldo Disponible
                        </h6>
                        <h3 className="mb-0">{formatCurrency(saldoReal)}</h3>
                      </div>
                      <div className="fs-1 opacity-50">
                        <i className="bi bi-cash-stack"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-4 mb-3">
                <div className="card border-0 shadow-sm h-100 bg-warning bg-gradient text-white">
                  <div className="card-body">
                    <div className="d-flex align-items-center">
                      <div className="flex-grow-1">
                        <h6 className="card-subtitle mb-2 text-white-50">
                          <i className="bi bi-credit-card me-2"></i>
                          Descubierto
                        </h6>
                        <h3 className="mb-0">{formatCurrency(cuenta.descubierto)}</h3>
                      </div>
                      <div className="fs-1 opacity-50">
                        <i className="bi bi-shield-check"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-4 mb-3">
                <div className="card border-0 shadow-sm h-100 bg-success bg-gradient text-white">
                  <div className="card-body">
                    <div className="d-flex align-items-center">
                      <div className="flex-grow-1">
                        <h6 className="card-subtitle mb-2 text-white-50">
                          <i className="bi bi-wallet-fill me-2"></i>
                          Total Disponible
                        </h6>
                        <h3 className="mb-0">{formatCurrency(saldoReal + cuenta.descubierto)}</h3>
                      </div>
                      <div className="fs-1 opacity-50">
                        <i className="bi bi-piggy-bank"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de Movimientos Bancarios */}
            <div className="card border-0 shadow-sm tabla-sin-movimiento">
              <div className="card-header bg-light">
                <h5 className="mb-0">
                  <i className="bi bi-list-ul me-2"></i>
                  Historial de Movimientos
                </h5>
              </div>
              <div className="card-body p-0">
                {loadingMovimientosBancarios ? (
                  <div className="d-flex justify-content-center align-items-center my-5">
                    <div className="spinner-border text-success" role="status" style={{ width: "3rem", height: "3rem" }}>
                      <span className="visually-hidden">Cargando movimientos...</span>
                    </div>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="fw-semibold">FECHA</th>
                          <th className="fw-semibold">TIPO</th>
                          <th className="fw-semibold">CONCEPTO</th>
                          <th className="fw-semibold">REFERENCIA</th>
                          <th className="fw-semibold text-end">INGRESO</th>
                          <th className="fw-semibold text-end">EGRESO</th>
                          <th className="fw-semibold text-end">SALDO</th>
                          <th className="fw-semibold text-center">ACCIONES</th>
                        </tr>
                      </thead>
                      <tbody>
                      {(() => {
                        // Obtener cheques de terceros depositados en esta cuenta
                        const chequesDepositados = cheques.filter(
                          ch => ch.estado === "depositado" && ch.cuentaBancaria?._id === cuenta._id
                        );

                        // Obtener cheques propios cobrados de esta cuenta
                        const chequesPropiosCobrados = chequesPropios.filter(
                          ch => ch.estado === "cobrado" && ch.cuentaBancaria?._id === cuenta._id
                        );

                        // Obtener transferencias recibidas (cobros con medio de pago transferencia)
                        const transferenciasRecibidas = [];
                        cobros.forEach(cobro => {
                          cobro.mediosPago?.forEach(medio => {
                            if (medio.tipo === "transferencia" && medio.cuentaBancaria?._id === cuenta._id) {
                              transferenciasRecibidas.push({
                                fecha: cobro.fecha,
                                tipo: "TRANSFERENCIA RECIBIDA",
                                concepto: `Cobro de ${cobro.cliente?.razonSocial || 'Cliente'}`,
                                referencia: medio.numeroReferencia || 'Sin referencia',
                                ingreso: medio.monto,
                                egreso: 0,
                                tipoMovimiento: 'ingreso'
                              });
                            }
                          });
                        });

                        // Obtener transferencias emitidas (pagos con medio de pago transferencia)
                        const transferenciasEmitidas = [];
                        pagos.forEach(pago => {
                          pago.mediosPago?.forEach(medio => {
                            if (medio.tipo === "transferencia" && medio.cuentaBancaria?._id === cuenta._id) {
                              transferenciasEmitidas.push({
                                fecha: pago.fecha,
                                tipo: "TRANSFERENCIA EMITIDA",
                                concepto: `Pago a ${pago.proveedor?.razonSocial || 'Proveedor'}`,
                                referencia: medio.numeroReferencia || 'Sin referencia',
                                ingreso: 0,
                                egreso: medio.monto,
                                tipoMovimiento: 'egreso'
                              });
                            }
                          });
                        });

                        // Obtener transferencias emitidas de costos fijos
                        pagosCostosFijos.forEach(pago => {
                          pago.mediosPago?.forEach(medio => {
                            if (medio.tipo === "transferencia" && medio.cuentaBancaria?._id === cuenta._id) {
                              transferenciasEmitidas.push({
                                fecha: pago.fecha,
                                tipo: "TRANSFERENCIA EMITIDA",
                                concepto: `Pago Costo Fijo: ${pago.costoFijo?.nombreGasto || 'Costo Fijo'}`,
                                referencia: medio.numeroReferencia || 'Sin referencia',
                                ingreso: 0,
                                egreso: medio.monto,
                                tipoMovimiento: 'egreso'
                              });
                            }
                          });
                        });

                        // Obtener transferencias emitidas de contratistas
                        pagosContratistas.forEach(pago => {
                          pago.mediosPago?.forEach(medio => {
                            if (medio.tipo === "transferencia" && medio.cuentaBancaria?._id === cuenta._id) {
                              transferenciasEmitidas.push({
                                fecha: pago.fecha,
                                tipo: "TRANSFERENCIA EMITIDA",
                                concepto: `Pago Contratista: ${pago.contratista?.apellido || ''}, ${pago.contratista?.nombre || 'Contratista'}`,
                                referencia: medio.numeroReferencia || 'Sin referencia',
                                ingreso: 0,
                                egreso: medio.monto,
                                tipoMovimiento: 'egreso'
                              });
                            }
                          });
                        });

                        // Obtener depósitos en efectivo (cobros con medio de pago efectivo)
                        const depositosEfectivo = [];
                        cobros.forEach(cobro => {
                          cobro.mediosPago?.forEach(medio => {
                            if (medio.tipo === "efectivo" && medio.cuentaBancaria?._id === cuenta._id) {
                              depositosEfectivo.push({
                                fecha: cobro.fecha,
                                tipo: "DEPÓSITO EFECTIVO",
                                concepto: `Cobro de ${cobro.cliente?.razonSocial || 'Cliente'}`,
                                referencia: 'Efectivo',
                                ingreso: medio.monto,
                                egreso: 0,
                                tipoMovimiento: 'ingreso'
                              });
                            }
                          });
                        });

                        const movimientosBancarios = [
                          ...chequesDepositados.map(ch => ({
                            fecha: ch.updatedAt,
                            tipo: "CHEQUE DEPOSITADO",
                            concepto: `Cheque de ${ch.cliente?.razonSocial || 'Cliente'}`,
                            referencia: `Nro. ${ch.numeroCheque} - ${ch.banco}`,
                            ingreso: ch.monto,
                            egreso: 0,
                            tipoMovimiento: 'ingreso',
                            chequeId: ch._id,
                            esReversible: true
                          })),
                          ...chequesPropiosCobrados.map(ch => ({
                            fecha: ch.updatedAt,
                            tipo: "CHEQUE PROPIO",
                            concepto: `Cheque emitido a ${ch.proveedor?.razonSocial || 'Proveedor'}`,
                            referencia: `Nro. ${ch.numeroCheque}`,
                            ingreso: 0,
                            egreso: ch.monto,
                            tipoMovimiento: 'egreso',
                            chequePropioId: ch._id,
                            esReversiblePropio: true
                          })),
                          ...transferenciasRecibidas,
                          ...transferenciasEmitidas,
                          ...depositosEfectivo
                        ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

                        let saldoAcumulado = saldoReal;

                        return movimientosBancarios.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="text-center py-5">
                              <i className="bi bi-inbox display-4 d-block mb-2 text-muted"></i>
                              <p className="text-muted mb-0">No hay movimientos bancarios registrados</p>
                            </td>
                          </tr>
                        ) : (
                          movimientosBancarios.map((mov, index) => {
                            // Guardamos el saldo actual (después de este movimiento)
                            const saldoActual = saldoAcumulado;
                            // Calculamos el saldo para el siguiente movimiento (más antiguo)
                            saldoAcumulado = saldoAcumulado - mov.ingreso + mov.egreso;

                            return (
                              <tr key={index}>
                                <td>{formatDate(mov.fecha)}</td>
                                <td>
                                  <span className={`badge ${
                                    mov.tipoMovimiento === 'ingreso' ? 'bg-success' : 'bg-danger'
                                  }`}>
                                    {mov.tipo}
                                  </span>
                                </td>
                                <td>{mov.concepto}</td>
                                <td><small className="text-muted">{mov.referencia}</small></td>
                                <td className="text-end">
                                  {mov.ingreso > 0 && (
                                    <strong className="text-success">
                                      {formatCurrency(mov.ingreso)}
                                    </strong>
                                  )}
                                </td>
                                <td className="text-end">
                                  {mov.egreso > 0 && (
                                    <strong className="text-danger">
                                      {formatCurrency(mov.egreso)}
                                    </strong>
                                  )}
                                </td>
                                <td className="text-end">
                                  <strong className={saldoActual >= 0 ? 'text-primary' : 'text-danger'}>
                                    {formatCurrency(saldoActual)}
                                  </strong>
                                </td>
                                <td className="text-center">
                                  {mov.esReversible && (
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => handleRevertirDeposito(mov.chequeId, cuenta._id)}
                                      title="Revertir depósito (volver a cartera)"
                                    >
                                      <i className="bi bi-arrow-counterclockwise"></i>
                                    </button>
                                  )}
                                  {mov.esReversiblePropio && (
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => handleRevertirCobrado(mov.chequePropioId, cuenta._id)}
                                      title="Revertir cobro (volver a pendiente)"
                                    >
                                      <i className="bi bi-arrow-counterclockwise"></i>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        );
                      })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Tab Content - Cheques Propios */}
      {activeTab === "chequesPropios" && (
        <>
          {/* Filtros */}
          <div className="card border-0 shadow-sm mb-4" style={{ transition: 'none' }}>
            <div className="card-body">
              <h5 className="card-title mb-3">
                <i className="bi bi-funnel me-2"></i>
                Filtros
              </h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={estadoFiltroPropios}
                    onChange={(e) => setEstadoFiltroPropios(e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="pendiente">Pendientes</option>
                    <option value="cobrado">Depositados</option>
                  </select>
                </div>
                <div className="col-md-6 d-flex align-items-end">
                  <button className="btn btn-primary me-2" onClick={handleFiltrarChequesPropios}>
                    <i className="bi bi-search me-2"></i>
                    Filtrar
                  </button>
                  <button className="btn btn-secondary" onClick={handleLimpiarFiltrosChequesPropios}>
                    <i className="bi bi-x-circle me-2"></i>
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loadingChequesPropios && (
            <div className="d-flex justify-content-center align-items-center my-5">
              <div className="spinner-border text-success" role="status" style={{ width: "3rem", height: "3rem" }}>
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          )}

          {/* Tabla de Cheques Propios */}
          {!loadingChequesPropios && (
            <div className="card border-0 shadow-sm tabla-sin-movimiento">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="fw-semibold">BANCO</th>
                        <th className="fw-semibold">NRO. CHEQUE</th>
                        <th className="fw-semibold text-end">MONTO</th>
                        <th className="fw-semibold">FECHA EMISIÓN</th>
                        <th className="fw-semibold">FECHA PAGO</th>
                        <th className="fw-semibold">DESTINATARIO</th>
                        <th className="fw-semibold">ESTADO</th>
                        <th className="fw-semibold">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chequesPropios.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center py-5">
                            <i className="bi bi-inbox display-4 d-block mb-2 text-muted"></i>
                            <p className="text-muted mb-0">No hay cheques propios registrados</p>
                          </td>
                        </tr>
                      ) : (
                        chequesPropios.map((cheque) => (
                          <tr key={cheque._id}>
                            <td>
                              <strong>{cheque.bancoEmisor || "-"}</strong>
                            </td>
                            <td>
                              <strong>{cheque.numeroCheque}</strong>
                            </td>
                            <td className="text-end">
                              <strong className="text-danger">{formatCurrency(cheque.monto)}</strong>
                            </td>
                            <td>{formatDate(cheque.fechaEmision)}</td>
                            <td>
                              <strong>{formatDate(cheque.fechaPago)}</strong>
                            </td>
                            <td>
                              <strong>
                                {cheque.contratista
                                  ? `${cheque.contratista.apellido}, ${cheque.contratista.nombre}`
                                  : cheque.proveedor?.razonSocial
                                  || cheque.costoFijo?.nombreGasto
                                  || "N/A"}
                              </strong>
                            </td>
                            <td>
                              <span className={`badge ${getEstadoBadge(cheque.estado)}`}>
                                {cheque.estado === "cobrado" ? "Depositado" : cheque.estado}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-success me-2"
                                onClick={() => handleMarcarCobrado(cheque._id)}
                                title="Depositado en cuenta bancaria"
                                disabled={cheque.estado !== "pendiente"}
                              >
                                <i className="bi bi-bank me-1"></i>
                                Depositado en Cta
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleEliminarChequePropio(cheque._id)}
                                title="Eliminar cheque"
                                disabled={cheque.estado === "cobrado"}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab Content - Movimientos Bancarios */}
      {activeTab === "movimientosBancarios" && (
        <>
          {/* Filtros */}
          <div className="card border-0 shadow-sm mb-4" style={{ transition: 'none' }}>
            <div className="card-body">
              <h5 className="card-title mb-3">
                <i className="bi bi-funnel me-2"></i>
                Filtros
              </h5>
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label">Fecha Desde</label>
                  <input
                    type="date"
                    className="form-control"
                    value={fechaDesdeBancarios}
                    onChange={(e) => setFechaDesdeBancarios(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Fecha Hasta</label>
                  <input
                    type="date"
                    className="form-control"
                    value={fechaHastaBancarios}
                    onChange={(e) => setFechaHastaBancarios(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Cuenta Bancaria</label>
                  <select
                    className="form-select"
                    value={cuentaBancariaFiltro}
                    onChange={(e) => setCuentaBancariaFiltro(e.target.value)}
                  >
                    <option value="">Todas</option>
                    {cuentasBancarias.filter(c => c.activo).map((cuenta) => (
                      <option key={cuenta._id} value={cuenta._id}>
                        {cuenta.banco}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3 d-flex align-items-end">
                  <button className="btn btn-primary me-2" onClick={handleFiltrarBancarios}>
                    <i className="bi bi-search me-2"></i>
                    Filtrar
                  </button>
                  <button className="btn btn-secondary" onClick={handleLimpiarFiltrosBancarios}>
                    <i className="bi bi-x-circle me-2"></i>
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de Movimientos */}
          <div className="card border-0 shadow-sm tabla-sin-movimiento">
            <div className="card-header bg-light">
              <h5 className="mb-0">
                <i className="bi bi-list-ul me-2"></i>
                Movimientos Bancarios
              </h5>
            </div>
            <div className="card-body p-0">
              {loadingBancarios ? (
                <div className="d-flex justify-content-center align-items-center my-5">
                  <div className="spinner-border text-success" role="status" style={{ width: "3rem", height: "3rem" }}>
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="fw-semibold">FECHA</th>
                        <th className="fw-semibold">TIPO</th>
                        <th className="fw-semibold">CUENTA BANCARIA</th>
                        <th className="fw-semibold">DETALLE</th>
                        <th className="fw-semibold text-end">INGRESO</th>
                        <th className="fw-semibold text-end">EGRESO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientosBancarios.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-4">
                            <p className="text-muted mb-0">No hay movimientos bancarios registrados</p>
                          </td>
                        </tr>
                      ) : (
                        movimientosBancarios.map((mov) => (
                          <tr key={mov._id}>
                            <td>{formatDate(mov.fecha)}</td>
                            <td>
                              <span className={`badge ${mov.tipo === "ingreso" ? "bg-success" : "bg-danger"}`}>
                                {mov.tipo === "ingreso" ? "INGRESO" : "EGRESO"}
                              </span>
                            </td>
                            <td>
                              {mov.cuentaBancaria ? mov.cuentaBancaria.banco : "-"}
                            </td>
                            <td>{mov.detalle}</td>
                            <td className="text-end">
                              {mov.tipo === "ingreso" ? (
                                <strong className="text-success">{formatCurrency(mov.monto)}</strong>
                              ) : "-"}
                            </td>
                            <td className="text-end">
                              {mov.tipo === "egreso" ? (
                                <strong className="text-danger">{formatCurrency(mov.monto)}</strong>
                              ) : "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tab Content - Transferencias */}
      {activeTab === "transferencias" && (
        <>
          {/* Botones de Acción */}
          <div className="card border-0 shadow-sm mb-4" style={{ transition: 'none' }}>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  <i className="bi bi-arrow-left-right me-2"></i>
                  Gestión de Transferencia de Caja
                </h5>
                <div>
                  {rolUsuario === "contable" && (
                    <button
                      className="btn btn-warning"
                      onClick={abrirModalCerrarCaja}
                    >
                      <i className="bi bi-box-arrow-up me-2"></i>
                      Cerrar Caja
                    </button>
                  )}
                  {rolUsuario === "admin" && (
                    <button
                      className="btn btn-primary"
                      onClick={abrirModalTransferirFondos}
                    >
                      <i className="bi bi-send me-2"></i>
                      Transferir Fondos
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de Transferencias */}
          <div className="card border-0 shadow-sm tabla-sin-movimiento">
            <div className="card-header bg-light">
              <h5 className="mb-0">
                <i className="bi bi-list-ul me-2"></i>
                Historial de Transferencia de Caja
              </h5>
            </div>
            <div className="card-body p-0">
              {loadingTransferencias ? (
                <div className="d-flex justify-content-center align-items-center my-5">
                  <div className="spinner-border text-success" role="status" style={{ width: "3rem", height: "3rem" }}>
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="fw-semibold">FECHA</th>
                        <th className="fw-semibold">USUARIO</th>
                        <th className="fw-semibold">ITEMS</th>
                        <th className="fw-semibold">ESTADO</th>
                        <th className="fw-semibold">DETALLE</th>
                        {(rolUsuario === "admin" || rolUsuario === "contable") && <th className="fw-semibold text-center">ACCIONES</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {transferencias.length === 0 ? (
                        <tr>
                          <td colSpan={(rolUsuario === "admin" || rolUsuario === "contable") ? "6" : "5"} className="text-center py-4">
                            <p className="text-muted mb-0">No hay transferencias registradas</p>
                          </td>
                        </tr>
                      ) : (
                        transferencias.map((trans) => (
                          <tr key={trans._id}>
                            <td>{formatDate(trans.fecha)}</td>
                            <td>
                              {trans.esDeCajaGeneral ? (
                                <div>
                                  <strong>Caja General</strong>
                                  <i className="bi bi-arrow-right mx-1"></i>
                                  {trans.usuarioDestino?.nombreCompleto || trans.usuarioDestino?.nombreUsuario || "-"}
                                </div>
                              ) : (
                                <div>
                                  {trans.usuarioOrigen?.nombreCompleto || trans.usuarioOrigen?.nombreUsuario || "-"}
                                  <i className="bi bi-arrow-right mx-1"></i>
                                  <strong>Caja General</strong>
                                </div>
                              )}
                            </td>
                            <td>
                              <div>
                                {trans.montoPesos > 0 && (
                                  <div><i className="bi bi-cash me-1"></i> ARS: ${trans.montoPesos.toLocaleString("es-AR")}</div>
                                )}
                                {trans.montoDolares > 0 && (
                                  <div><i className="bi bi-currency-dollar me-1"></i> USD: ${trans.montoDolares.toLocaleString("es-AR")}</div>
                                )}
                                {trans.cheques && trans.cheques.length > 0 && (
                                  <div><i className="bi bi-journal-check me-1"></i> {trans.cheques.length} cheque(s)</div>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${
                                trans.estado === "pendiente" ? "bg-warning" :
                                trans.estado === "aprobado" ? "bg-success" :
                                trans.estado === "anulada" ? "bg-secondary" : "bg-danger"
                              }`}>
                                {trans.estado.toUpperCase()}
                              </span>
                              {(trans.estado === "rechazado" || trans.estado === "anulada") && trans.motivoRechazo && (
                                <div><small className="text-muted">{trans.motivoRechazo}</small></div>
                              )}
                            </td>
                            <td>{trans.detalle}</td>
                            {(rolUsuario === "admin" || rolUsuario === "contable") && (
                              <td className="text-center">
                                {trans.estado === "pendiente" && (
                                  <>
                                    {/* Admin: puede aprobar cierres de caja (esDeCajaGeneral = false) */}
                                    {rolUsuario === "admin" && !trans.esDeCajaGeneral && (
                                      <div className="btn-group btn-group-sm">
                                        <button
                                          className="btn btn-sm btn-success"
                                          onClick={() => handleAprobarTransferencia(trans._id)}
                                          title="Aprobar"
                                        >
                                          <i className="bi bi-check-lg"></i>
                                        </button>
                                        <button
                                          className="btn btn-sm btn-danger"
                                          onClick={() => handleRechazarTransferencia(trans._id)}
                                          title="Rechazar"
                                        >
                                          <i className="bi bi-x-lg"></i>
                                        </button>
                                      </div>
                                    )}
                                    {/* Contable: puede aceptar/rechazar transferencias de caja general (esDeCajaGeneral = true) */}
                                    {rolUsuario === "contable" && trans.esDeCajaGeneral && (
                                      <div className="btn-group btn-group-sm">
                                        <button
                                          className="btn btn-sm btn-success"
                                          onClick={() => handleAceptarTransferencia(trans._id)}
                                          title="Aceptar"
                                        >
                                          <i className="bi bi-check-lg"></i>
                                        </button>
                                        <button
                                          className="btn btn-sm btn-danger"
                                          onClick={() => handleRechazarTransferenciaContable(trans._id)}
                                          title="Rechazar"
                                        >
                                          <i className="bi bi-x-lg"></i>
                                        </button>
                                      </div>
                                    )}
                                  </>
                                )}
                                {/* Admin: puede anular transferencias aprobadas */}
                                {trans.estado === "aprobado" && rolUsuario === "admin" && (
                                  <button
                                    className="btn btn-sm btn-warning"
                                    onClick={() => handleAnularTransferencia(trans._id)}
                                    title="Anular"
                                  >
                                    <i className="bi bi-x-circle"></i> Anular
                                  </button>
                                )}
                                {trans.estado !== "pendiente" && trans.estado !== "aprobado" && "-"}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal de Cerrar Caja */}
      {showModalCerrarCaja && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-box-arrow-up me-2"></i>
                  Cerrar Caja
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowModalCerrarCaja(false);
                    setFormCierre({ montoPesos: "", montoDolares: "", cheques: [], detalle: "" });
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <i className="bi bi-info-circle me-2"></i>
                  Al cerrar la caja, los fondos se transferirán a la Caja General pendiente de aprobación.
                </div>

                {/* Efectivo (Pesos) */}
                <div className="mb-3">
                  <label className="form-label">Efectivo (Pesos ARS)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formCierre.montoPesos}
                    onChange={(e) => setFormCierre({ ...formCierre, montoPesos: e.target.value })}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Dólares */}
                <div className="mb-3">
                  <label className="form-label">Dólares (USD)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formCierre.montoDolares}
                    onChange={(e) => setFormCierre({ ...formCierre, montoDolares: e.target.value })}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Cheques */}
                <div className="mb-3">
                  <label className="form-label">Cheques de Terceros en Cartera</label>
                  <div className="border rounded p-2" style={{ maxHeight: "200px", overflowY: "auto" }}>
                    {chequesDisponibles.length === 0 ? (
                      <p className="text-muted mb-0 text-center py-2">No hay cheques disponibles en cartera</p>
                    ) : (
                      chequesDisponibles.map((cheque) => (
                        <div key={cheque._id} className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`cheque-${cheque._id}`}
                            checked={formCierre.cheques.includes(cheque._id)}
                            onChange={() => toggleChequeSeleccion(cheque._id)}
                          />
                          <label className="form-check-label" htmlFor={`cheque-${cheque._id}`}>
                            <strong>{cheque.numeroCheque}</strong> - {cheque.banco} - ${cheque.monto.toLocaleString("es-AR")}
                            {cheque.tipoCheque === "echeq" && <span className="badge bg-info ms-2">E-Cheque</span>}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  {formCierre.cheques.length > 0 && (
                    <small className="text-muted">{formCierre.cheques.length} cheque(s) seleccionado(s)</small>
                  )}
                </div>

                {/* Detalle */}
                <div className="mb-3">
                  <label className="form-label">Detalle</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={formCierre.detalle}
                    onChange={(e) => setFormCierre({ ...formCierre, detalle: e.target.value })}
                    placeholder="Ingrese un detalle (opcional)"
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowModalCerrarCaja(false);
                    setFormCierre({ montoPesos: "", montoDolares: "", cheques: [], detalle: "" });
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={handleCerrarCaja}
                >
                  <i className="bi bi-box-arrow-up me-2"></i>
                  Cerrar Caja
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Transferir Fondos */}
      {showModalTransferir && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-send me-2"></i>
                  Transferir Fondos
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowModalTransferir(false);
                    setFormTransferencia({
                      montoPesos: "",
                      montoDolares: "",
                      chequesTerceros: [],
                      chequesPropios: [],
                      detalle: "",
                      destinoUsuarioId: ""
                    });
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <i className="bi bi-info-circle me-2"></i>
                  Transferir fondos desde la Caja General a la caja de un contable.
                </div>

                {/* Usuario Destino */}
                <div className="mb-3">
                  <label className="form-label">Usuario Destino *</label>
                  <select
                    className="form-select"
                    value={formTransferencia.destinoUsuarioId}
                    onChange={(e) => setFormTransferencia({ ...formTransferencia, destinoUsuarioId: e.target.value })}
                  >
                    <option value="">Seleccione un usuario</option>
                    {usuarios
                      .filter((u) => u.rolUsuario === "contable")
                      .map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.nombreCompleto || u.nombreUsuario || u.emailUsuario}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Efectivo (Pesos) */}
                <div className="mb-3">
                  <label className="form-label">Efectivo (Pesos ARS)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formTransferencia.montoPesos}
                    onChange={(e) => setFormTransferencia({ ...formTransferencia, montoPesos: e.target.value })}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Dólares */}
                <div className="mb-3">
                  <label className="form-label">Dólares (USD)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formTransferencia.montoDolares}
                    onChange={(e) => setFormTransferencia({ ...formTransferencia, montoDolares: e.target.value })}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Cheques de Terceros */}
                <div className="mb-3">
                  <label className="form-label">Cheques de Terceros (Depositados en Caja General)</label>
                  <div className="border rounded p-2" style={{ maxHeight: "150px", overflowY: "auto" }}>
                    {chequesTercerosDisponibles.length === 0 ? (
                      <p className="text-muted mb-0 text-center py-2">No hay cheques de terceros en caja general</p>
                    ) : (
                      chequesTercerosDisponibles.map((cheque) => (
                        <div key={cheque._id} className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`cheque-tercero-${cheque._id}`}
                            checked={formTransferencia.chequesTerceros.includes(cheque._id)}
                            onChange={() => toggleChequeTerceroTransferencia(cheque._id)}
                          />
                          <label className="form-check-label" htmlFor={`cheque-tercero-${cheque._id}`}>
                            <strong>{cheque.numeroCheque}</strong> - {cheque.banco} - ${cheque.monto.toLocaleString("es-AR")}
                            {cheque.tipoCheque === "echeq" && <span className="badge bg-info ms-2">E-Cheque</span>}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  {formTransferencia.chequesTerceros.length > 0 && (
                    <small className="text-muted">{formTransferencia.chequesTerceros.length} cheque(s) seleccionado(s)</small>
                  )}
                </div>

                {/* Cheques Propios */}
                <div className="mb-3">
                  <label className="form-label">Cheques Propios (Pendientes)</label>
                  <div className="border rounded p-2" style={{ maxHeight: "150px", overflowY: "auto" }}>
                    {chequesPropiosDisponibles.length === 0 ? (
                      <p className="text-muted mb-0 text-center py-2">No hay cheques propios disponibles</p>
                    ) : (
                      chequesPropiosDisponibles.map((cheque) => (
                        <div key={cheque._id} className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`cheque-propio-${cheque._id}`}
                            checked={formTransferencia.chequesPropios.includes(cheque._id)}
                            onChange={() => toggleChequePropioTransferencia(cheque._id)}
                          />
                          <label className="form-check-label" htmlFor={`cheque-propio-${cheque._id}`}>
                            <strong>{cheque.numeroCheque}</strong> - {cheque.banco} - ${cheque.monto.toLocaleString("es-AR")}
                            {cheque.tipoCheque === "echeq" && <span className="badge bg-info ms-2">E-Cheque</span>}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  {formTransferencia.chequesPropios.length > 0 && (
                    <small className="text-muted">{formTransferencia.chequesPropios.length} cheque(s) seleccionado(s)</small>
                  )}
                </div>

                {/* Detalle */}
                <div className="mb-3">
                  <label className="form-label">Detalle</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={formTransferencia.detalle}
                    onChange={(e) => setFormTransferencia({ ...formTransferencia, detalle: e.target.value })}
                    placeholder="Ingrese un detalle (opcional)"
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowModalTransferir(false);
                    setFormTransferencia({
                      montoPesos: "",
                      montoDolares: "",
                      chequesTerceros: [],
                      chequesPropios: [],
                      detalle: "",
                      destinoUsuarioId: ""
                    });
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleTransferirFondos}
                >
                  <i className="bi bi-send me-2"></i>
                  Transferir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Historial de Cheque */}
      {showHistorialModal && chequeSeleccionado && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-fullscreen-sm-down modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-clock-history me-2"></i>
                  Historial del Cheque {chequeSeleccionado.numeroCheque}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowHistorialModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {loadingHistorial ? (
                  <div className="d-flex justify-content-center align-items-center my-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Información del Cheque */}
                    <div className="card mb-3">
                      <div className="card-header bg-light">
                        <h6 className="mb-0"><i className="bi bi-info-circle me-2"></i>Información del Cheque</h6>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-6">
                            <p><strong>Número:</strong> {chequeSeleccionado.numeroCheque}</p>
                            <p><strong>Monto:</strong> {formatCurrency(chequeSeleccionado.monto)}</p>
                            <p><strong>Banco:</strong> {chequeSeleccionado.banco}</p>
                          </div>
                          <div className="col-md-6">
                            <p><strong>Tipo:</strong> <span className={`badge ${chequeSeleccionado.tipoCheque === "cheque" ? "bg-success" : "bg-info"}`}>
                              {chequeSeleccionado.tipoCheque === "cheque" ? "Cheque" : "E-Cheque"}
                            </span></p>
                            <p><strong>Estado:</strong> <span className={`badge ${getEstadoBadge(chequeSeleccionado.estado)}`}>
                              {chequeSeleccionado.estado}
                            </span></p>
                            <p><strong>Fecha Emisión:</strong> {formatDate(chequeSeleccionado.fechaEmision)}</p>
                            <p><strong>Fecha Vencimiento:</strong> {formatDate(chequeSeleccionado.fechaVencimiento)}</p>
                          </div>
                        </div>
                        {chequeSeleccionado.observaciones && (
                          <div className="row mt-2">
                            <div className="col-12">
                              <p><strong>Observaciones:</strong> {chequeSeleccionado.observaciones}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Historial de Movimientos */}
                    <div className="card">
                      <div className="card-header bg-light">
                        <h6 className="mb-0"><i className="bi bi-list-ul me-2"></i>Historial de Movimientos</h6>
                      </div>
                      <div className="card-body">
                        <div className="timeline">
                          {/* Origen del cheque */}
                          {chequeSeleccionado.cobro && (
                            <div className="timeline-item mb-4">
                              <div className="d-flex">
                                <div className="flex-shrink-0">
                                  <div className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                                    <i className="bi bi-arrow-down"></i>
                                  </div>
                                </div>
                                <div className="flex-grow-1 ms-3">
                                  <div className="card">
                                    <div className="card-body">
                                      <h6 className="card-title text-success">
                                        <i className="bi bi-cash-coin me-2"></i>Cheque Recibido
                                      </h6>
                                      <p className="mb-1"><strong>Cliente:</strong> {chequeSeleccionado.cobro.cliente?.razonSocial || 'N/A'}</p>
                                      {chequeSeleccionado.cobro.cliente?.cuit && (
                                        <p className="mb-1"><strong>CUIT:</strong> {chequeSeleccionado.cobro.cliente.cuit}</p>
                                      )}
                                      {chequeSeleccionado.cobro.factura && (
                                        <p className="mb-1"><strong>Factura:</strong> {chequeSeleccionado.cobro.factura.tipoFactura === 'X' ? 'Orden de Pago' : `Factura ${chequeSeleccionado.cobro.factura.tipoFactura}`} {chequeSeleccionado.cobro.factura.numeroFactura}</p>
                                      )}
                                      <p className="mb-0"><small className="text-muted">Recibido mediante cobro a cliente</small></p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Si se usó en un pago */}
                          {chequeSeleccionado.pago && (
                            <div className="timeline-item mb-4">
                              <div className="d-flex">
                                <div className="flex-shrink-0">
                                  <div className="bg-danger text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                                    <i className="bi bi-arrow-up"></i>
                                  </div>
                                </div>
                                <div className="flex-grow-1 ms-3">
                                  <div className="card">
                                    <div className="card-body">
                                      <h6 className="card-title text-danger">
                                        <i className="bi bi-wallet2 me-2"></i>Utilizado en Pago
                                      </h6>
                                      <p className="mb-1"><strong>Proveedor:</strong> {chequeSeleccionado.pago.proveedor?.razonSocial || 'N/A'}</p>
                                      {chequeSeleccionado.pago.proveedor?.cuit && (
                                        <p className="mb-1"><strong>CUIT:</strong> {chequeSeleccionado.pago.proveedor.cuit}</p>
                                      )}
                                      {chequeSeleccionado.pago.facturaCompra && (
                                        <p className="mb-1"><strong>Factura:</strong> {chequeSeleccionado.pago.facturaCompra.tipoFactura === 'X' ? 'Orden de Compra' : `Factura ${chequeSeleccionado.pago.facturaCompra.tipoFactura}`} {chequeSeleccionado.pago.facturaCompra.numeroFactura}</p>
                                      )}
                                      <p className="mb-0"><small className="text-muted">Cheque entregado como medio de pago</small></p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Estado depositado */}
                          {chequeSeleccionado.estado === "depositado" && (
                            <div className="timeline-item mb-4">
                              <div className="d-flex">
                                <div className="flex-shrink-0">
                                  <div className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                                    <i className="bi bi-bank"></i>
                                  </div>
                                </div>
                                <div className="flex-grow-1 ms-3">
                                  <div className="card">
                                    <div className="card-body">
                                      <h6 className="card-title text-success">
                                        <i className="bi bi-check-circle me-2"></i>Cheque Depositado
                                      </h6>
                                      {chequeSeleccionado.cuentaBancaria && (
                                        <>
                                          <p className="mb-1"><strong>Cuenta Bancaria:</strong> {chequeSeleccionado.cuentaBancaria.banco}</p>
                                          <p className="mb-1"><strong>Número de Cuenta:</strong> {chequeSeleccionado.cuentaBancaria.numeroCuenta}</p>
                                          <p className="mb-1"><strong>Titular:</strong> {chequeSeleccionado.cuentaBancaria.titular}</p>
                                        </>
                                      )}
                                      <p className="mb-0"><small className="text-muted">El cheque fue depositado en la cuenta bancaria</small></p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Estado rechazado */}
                          {chequeSeleccionado.estado === "rechazado" && (
                            <div className="timeline-item mb-4">
                              <div className="d-flex">
                                <div className="flex-shrink-0">
                                  <div className="bg-danger text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                                    <i className="bi bi-x-circle"></i>
                                  </div>
                                </div>
                                <div className="flex-grow-1 ms-3">
                                  <div className="card border-danger">
                                    <div className="card-body">
                                      <h6 className="card-title text-danger">
                                        <i className="bi bi-exclamation-triangle me-2"></i>Cheque Rechazado
                                      </h6>
                                      {chequeSeleccionado.cobro && (
                                        <div className="alert alert-danger mb-0">
                                          <p className="mb-1"><strong>Cliente que emitió el cheque:</strong></p>
                                          <p className="mb-1">{chequeSeleccionado.cobro.cliente?.razonSocial || 'N/A'}</p>
                                          {chequeSeleccionado.cobro.cliente?.cuit && (
                                            <p className="mb-1"><strong>CUIT:</strong> {chequeSeleccionado.cobro.cliente.cuit}</p>
                                          )}
                                        </div>
                                      )}
                                      {chequeSeleccionado.pago && (
                                        <div className="alert alert-warning mb-0 mt-2">
                                          <p className="mb-1"><strong>El cheque fue entregado a:</strong></p>
                                          <p className="mb-1">{chequeSeleccionado.pago.proveedor?.razonSocial || 'N/A'}</p>
                                          {chequeSeleccionado.pago.proveedor?.cuit && (
                                            <p className="mb-1"><strong>CUIT:</strong> {chequeSeleccionado.pago.proveedor.cuit}</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Estado cobrado */}
                          {chequeSeleccionado.estado === "cobrado" && !chequeSeleccionado.pago && (
                            <div className="timeline-item mb-4">
                              <div className="d-flex">
                                <div className="flex-shrink-0">
                                  <div className="bg-info text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                                    <i className="bi bi-cash-stack"></i>
                                  </div>
                                </div>
                                <div className="flex-grow-1 ms-3">
                                  <div className="card">
                                    <div className="card-body">
                                      <h6 className="card-title text-info">
                                        <i className="bi bi-check2-circle me-2"></i>Cheque Cobrado
                                      </h6>
                                      <p className="mb-0"><small className="text-muted">El cheque fue cobrado</small></p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowHistorialModal(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default CajaPage;
