import React from 'react';
import { Link } from 'react-router-dom'; // ✅ Import Link
import '../styles/LandingPage.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const LandingPage = () => {
  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg sticky-top navbar-dark bg-dark shadow-sm animated-nav">
        <div className="container mx-3">
          <Link className="navbar-brand glow-logo" to="/">🚗 AutoPulse</Link>
          <div>
            {/* <Link className="nav-link d-inline text-light me-4" to="/">Home</Link>
            <Link className="nav-link d-inline text-light me-4" to="/features">Features</Link> */}
            <Link className="btn btn-outline-light" to="/login">Login 🔐</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section d-flex align-items-center text-white text-center">
        <div className="container">
          <h2 className="display-3 fw-bold tracking-in-expand">🔧 Maintain Smarter, Drive Further</h2>
          <p className="lead fade-in-text">A smart, modern system to manage your vehicles like a pro.</p>
          <div className="mt-4">
            <Link to="/login" className="btn btn-lg btn-primary pulse-btn me-3">Start Now</Link>
            {/* <Link to="/demo" className="btn btn-lg btn-outline-light btn-glow">Try Demo</Link> */}
          </div>
        </div>
        <div className="floating-icons">
          <span className="car-icon">🚘</span>
          <span className="gear-icon">⚙️</span>
          <span className="wrench-icon">🔧</span>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section py-5 bg-light text-center">
        <div className="container">
          <h2 className="mb-5 fade-in-down">🚀 Features That Drive Efficiency</h2>
          <div className="row">
            {[
              ['🔍', 'Smart Search', 'Find by mobile, name, or number plate.'],
              ['🧾', 'Service History', 'Full logs of every vehicle’s care.'],
              ['🛠️', 'Manage Services', 'Add, edit, delete easily.'],
              ['📈', 'Insights & Trends', 'Track costs & service frequency.'],
              ['👥', 'Multi-User Garage', 'Support for users with multiple vehicles.'],
            ].map(([icon, title, desc], i) => (
              <div className="col-md-4 mb-4 fade-in-up" key={i}>
                <div className="feature-card shadow p-4 rounded bg-white h-100 hover-zoom">
                  <div className="fs-1 mb-3">{icon}</div>
                  <h5 className="fw-bold">{title}</h5>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section text-white text-center py-5 bg-gradient-primary">
        <h2 className="mb-3 bounce-in">🚗 Ready to Upgrade Your Vehicle Management?</h2>
        <p>Join AutoPulse and simplify your entire service tracking process today.</p>
        <Link to="/" className="btn btn-lg btn-light mt-3 pulse-btn">Get Started Free</Link>
      </section>

      {/* Footer */}
      <footer className="bg-dark text-white text-center py-3 small">
        © {new Date().getFullYear()} AutoPulse. All rights reserved.
      </footer>
    </div>
  );
};

export default LandingPage;
