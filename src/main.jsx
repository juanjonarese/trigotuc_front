import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { recargarPorDeploy } from "./utils/recargaPorDeploy";

// Vite avisa cuando no puede bajar un archivo de la app (pasa con una pestaña
// abierta desde antes de un deploy): se recarga una vez y trae la versión nueva.
window.addEventListener("vite:preloadError", (e) => {
  if (recargarPorDeploy()) e.preventDefault();
});
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap-icons/font/bootstrap-icons.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
