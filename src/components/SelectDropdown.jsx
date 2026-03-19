import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Bootstrap dropdown responsivo usando portal + position:fixed
 * para que no sea cortado por overflow:hidden/auto del modal.
 */
const SelectDropdown = ({
  value,
  onChange,
  options = [],
  placeholder = "Seleccionar...",
  disabled = false,
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));

  const calcPosition = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = Math.min(260, options.length * 40);

    if (spaceBelow >= menuHeight || spaceBelow >= 150) {
      // Abrir hacia abajo
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        maxHeight: "260px",
        overflowY: "auto",
      });
    } else {
      // Abrir hacia arriba
      setMenuStyle({
        position: "fixed",
        bottom: window.innerHeight - rect.top + 2,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        maxHeight: "260px",
        overflowY: "auto",
      });
    }
  };

  const toggle = () => {
    if (disabled) return;
    if (!open) calcPosition();
    setOpen((v) => !v);
  };

  // Cerrar al hacer click fuera o al hacer scroll
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  // Recalcular si cambia el tamaño de la ventana
  useEffect(() => {
    if (!open) return;
    const onResize = () => calcPosition();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  return (
    <div className={`w-100 ${className}`} style={{ position: "relative" }}>
      <button
        ref={btnRef}
        type="button"
        className="btn btn-outline-secondary w-100 text-start d-flex justify-content-between align-items-center"
        onClick={toggle}
        disabled={disabled}
        style={{ minWidth: 0 }}
      >
        <span className="text-truncate me-2" style={{ flex: 1, minWidth: 0 }}>
          {selected?.label ?? <span className="text-muted">{placeholder}</span>}
        </span>
        <i className={`bi bi-chevron-${open ? "up" : "down"} flex-shrink-0`}></i>
      </button>

      {open &&
        createPortal(
          <ul
            ref={menuRef}
            className="dropdown-menu show shadow"
            style={menuStyle}
          >
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  className={[
                    "dropdown-item",
                    String(o.value) === String(value) ? "active" : "",
                    o.disabled ? "disabled text-muted" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseDown={(e) => {
                    e.preventDefault(); // evita que blur cierre antes del click
                    if (o.disabled) return;
                    onChange(o.value);
                    setOpen(false);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    if (o.disabled) return;
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
};

export default SelectDropdown;
