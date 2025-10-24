import React from 'react';

const Header = () => {
  return (
    <nav className="navbar navbar-dark gradient-bg">
      <div className="container">
        <span className="navbar-brand mb-0 h1">
          <i className="fas fa-file-invoice me-2"></i>
          Invoice Validation System
        </span>
        <span className="navbar-text">
          <i className="fas fa-shield-alt me-1"></i>
          Automated PDF Validation
        </span>
      </div>
    </nav>
  );
};

export default Header;