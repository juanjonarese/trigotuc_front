import React from "react";

const Footer = () => {
  return (
    <footer className="bg-dark text-white py-3 mt-auto">
      <div className="container">
        <div className="row align-items-center">
          <div className="col-12 col-md-4 text-center text-md-start mb-2 mb-md-0">
            <small>&copy; 2024 Desarrollado por <strong>JotaDev</strong></small>
          </div>
          <div className="col-12 col-md-4 text-center mb-2 mb-md-0">
            <small>
              <i className="bi bi-envelope me-2"></i>
              <a href="mailto:contacto@jotadev.com" className="text-white text-decoration-none">
                contacto@jotadev.com
              </a>
            </small>
          </div>
          <div className="col-12 col-md-4 text-center text-md-end">
            <small>
              <i className="bi bi-telephone me-2"></i>
              <a href="tel:+5493815934826" className="text-white text-decoration-none">
                +54 9 381 593-4826
              </a>
            </small>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
