import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../styles/dashboard.css'; // Make sure this path is correct
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();

  const cards = [
    {
      iconClass: 'bi-people-fill',
      title: 'All Users',
      description: 'View and manage all users',
      path: '/alluser',
    },
    {
      iconClass: 'bi-search',
      title: 'Search Users',
      description: 'Search by name, mobile, or vehicle',
      path: '/search',
    },
  ];

  return (
    <section className="dashboard-wrapper">
      <div className="dashboard-container mb-3">
        <h1 className="dashboard-title ">
          <u><span className="gradient-text">AutoPulse Admin Dashboard</span></u>
        </h1>

        <div className="dashboard-cards">
          {cards.map((card, idx) => (
            <div
              className="dashboard-card"
              key={idx}
              onClick={() => navigate(card.path)}
            >
              <i className={`bi ${card.iconClass}`}></i>
                 <hr />
                 
              <h5>{card.title}</h5>
           
              <p className="card-desc">{card.description}</p>
              {/* “Shine” overlay element */}
              <div className="card-shine"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
