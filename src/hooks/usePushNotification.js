import { useEffect, useState, useCallback } from "react";
import { obtenerVapidKey, suscribirPush } from "../services/api";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
};

const ROLES_CON_NOTIFICACIONES = ["granja", "frigorifico", "superadmin", "administracion"];

const suscribirConReg = async (reg) => {
  try {
    const { publicKey } = await obtenerVapidKey();
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await suscribirPush(subscription.toJSON());
  } catch {
    // silencioso
  }
};

// Lee el permiso actual fuera de cualquier efecto para inicializar el estado
const leerPermiso = () => {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // 'default' | 'granted' | 'denied'
};

const usePushNotification = () => {
  const [estado, setEstado] = useState(leerPermiso);
  const [swReg, setSwReg] = useState(null);

  const rol = localStorage.getItem("rolUsuario");
  const rolHabilitado = ROLES_CON_NOTIFICACIONES.includes(rol);

  useEffect(() => {
    if (!rolHabilitado) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      setSwReg(reg);
      // Siempre sincroniza con el backend para corregir datos desactualizados (rol, etc.)
      if (Notification.permission === "granted") {
        await suscribirConReg(reg);
      }
    }).catch(() => {});
  }, [rolHabilitado]);

  // Llamada desde botón — necesario en iOS (requiere gesto del usuario)
  const activar = useCallback(async () => {
    if (!swReg) return;
    try {
      const permiso = await Notification.requestPermission();
      setEstado(permiso);
      if (permiso === "granted") {
        await suscribirConReg(swReg);
      }
    } catch {
      setEstado("denied");
    }
  }, [swReg]);

  return { estado, activar, rolHabilitado };
};

export default usePushNotification;
