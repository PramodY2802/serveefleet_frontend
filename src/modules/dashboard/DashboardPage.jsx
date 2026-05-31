import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, CardBody, Page } from '../../shared/components/ui/index.js';
import '../../styles/operations-dashboard.css';

const DashboardPage = () => {
  const navigate = useNavigate();

  const stats = [
    { label: 'Active modules', value: '3', icon: 'bi-grid-1x2', tone: 'primary' },
    { label: 'Service visibility', value: 'Live', icon: 'bi-activity', tone: 'info' },
    { label: 'Workspace mode', value: 'Secure', icon: 'bi-shield-check', tone: 'primary' },
  ];

  const modules = [
    {
      title: 'Customers',
      description: 'Manage customer records and quick actions.',
      path: '/customers',
      icon: 'bi-people-fill',
    },
    {
      title: 'Service History',
      description: 'View service records and timelines.',
      path: '/search',
      icon: 'bi-wrench-adjustable-circle-fill',
      featured: true,
    },
    {
      title: 'Vehicles',
      description: 'Track vehicles and maintenance schedules.',
      path: '/customers',
      icon: 'bi-truck-front-fill',
    },
  ];

  return (
    <Page className="ops-dashboard">
      <header className="ops-dashboard__hero">
        <div className="ops-dashboard__hero-copy">
          <p className="ops-dashboard__eyebrow">Operations dashboard</p>
          <h1>Welcome back to AutoPulse</h1>
          <p>
            A focused command center for customer accounts, fleet inventory, and service history.
          </p>
        </div>

        <Button
          variant="outline"
          icon="bi-search"
          className="ops-dashboard__search"
          onClick={() => navigate('/search')}
        >
          Search records
        </Button>
      </header>

      <section className="ops-dashboard__stats" aria-label="Dashboard metrics">
        {stats.map((stat) => (
          <Card key={stat.label} className="ops-dashboard__stat-card" padding="lg">
            <CardBody className="ops-dashboard__card-body">
              <div className="ops-dashboard__stat-top">
                <span className="ops-dashboard__label">{stat.label}</span>
                <span className="ops-dashboard__icon-chip" aria-hidden="true">
                  <i className={`bi ${stat.icon}`} />
                </span>
              </div>
              <strong className="ops-dashboard__stat-value">{stat.value}</strong>
            </CardBody>
          </Card>
        ))}
      </section>

      <section className="ops-dashboard__modules" aria-label="Primary modules">
        {modules.map((module) => (
          <Card
            key={module.title}
            className={`ops-dashboard__module-card ${module.featured ? 'is-featured' : ''}`}
            padding="lg"
            interactive
          >
            <CardBody className="ops-dashboard__card-body ops-dashboard__module-body">
              <div className="ops-dashboard__module-top">
                <Badge tone="primary" className="ops-dashboard__module-badge">
                  Module
                </Badge>
                <span className="ops-dashboard__icon-chip" aria-hidden="true">
                  <i className={`bi ${module.icon}`} />
                </span>
              </div>

              <div className="ops-dashboard__module-copy">
                <h2>{module.title}</h2>
                <p>{module.description}</p>
              </div>

              <button
                type="button"
                className="ops-dashboard__link"
                onClick={() => navigate(module.path)}
              >
                <span>Open module</span>
                <i className="bi bi-arrow-right" aria-hidden="true" />
              </button>
            </CardBody>
          </Card>
        ))}
      </section>
    </Page>
  );
};

export default DashboardPage;
