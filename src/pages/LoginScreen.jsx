import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../css/Login.css";
import Footer from "../components/Footer";

const LoginScreen = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    emailUsuario: "",
    contraseniaUsuario: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Limpiar localStorage al montar el componente para evitar problemas con credenciales viejas
  useEffect(() => {
    localStorage.clear();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Limpiar error cuando el usuario empieza a escribir
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

      const response = await fetch(`${API_URL}/usuarios/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailUsuario: formData.emailUsuario.trim(),
          contraseniaUsuario: formData.contraseniaUsuario,
        }),
      });

      // Verificar si la respuesta es JSON antes de parsear
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Error del servidor. Por favor, contacte al administrador.");
      }

      const data = await response.json();

      if (response.ok) {
        // Guardar el token y la información del usuario
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("token", data.token);
        localStorage.setItem("rolUsuario", data.rolUsuario);
        localStorage.setItem("emailUsuario", formData.emailUsuario.trim());

        // Redirigir al dashboard
        navigate("/dashboard");
      } else {
        setError(data.msg || "Usuario o contraseña incorrectos");
      }
    } catch (err) {
      // Manejar diferentes tipos de errores
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        setError("No se puede conectar con el servidor. Verifique su conexión a Internet.");
      } else {
        setError(err.message || "Error al conectar con el servidor. Intente nuevamente.");
      }
      console.error("Error en login:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper d-flex flex-column" style={{ minHeight: '100vh' }}>
      <div className="container flex-grow-1">
        <div className="row justify-content-center align-items-center min-vh-100">
          <div className="col-12 col-md-6 col-lg-4">
            <div className="card login-card shadow-lg">
              <div className="card-body p-4">
                {/* Logo/Header */}
                <div className="text-center mb-3">
                  <img
                    src="/logo_trigotuc.png"
                    alt="Logo Trigotuc"
                    className="mb-3"
                    style={{ maxWidth: '180px', width: '100%', height: 'auto' }}
                  />
                </div>

                {/* Mensaje de error */}
                {error && (
                  <div
                    className="alert alert-danger alert-dismissible fade show"
                    role="alert"
                  >
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {error}
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setError("")}
                    ></button>
                  </div>
                )}

                {/* Formulario */}
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label
                      htmlFor="emailUsuario"
                      className="form-label text-muted small fw-semibold"
                    >
                      EMAIL
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      id="emailUsuario"
                      name="emailUsuario"
                      placeholder="correo@ejemplo.com"
                      value={formData.emailUsuario}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label
                      htmlFor="contraseniaUsuario"
                      className="form-label text-muted small fw-semibold"
                    >
                      CLAVE DE INGRESO
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      id="contraseniaUsuario"
                      name="contraseniaUsuario"
                      placeholder="Clave de Ingreso"
                      value={formData.contraseniaUsuario}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-warning w-100 mt-3"
                    disabled={loading}
                    style={{ fontWeight: '600', letterSpacing: '1px' }}
                  >
                    {loading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Ingresando...
                      </>
                    ) : (
                      "INGRESAR"
                    )}
                  </button>
                </form>

                {/* Ayuda/Info */}
                <div className="text-center mt-4">
                  <small className="text-muted">
                    ¿No tenés cuenta? Contactá al administrador
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default LoginScreen;
