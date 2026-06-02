import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, CardBody, EmptyState, LoadingState, Page } from '../../shared/components/ui/index.js';
import { useReminderAlerts } from '../../context/ReminderAlertsContext.jsx';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import reminderService from '../../services/reminderService.js';
import '../../styles/operations-dashboard.css';

const ACTIVE_STATUSES = new Set(['SCHEDULED', 'DUE', 'SNOOZED', 'SENT', 'EXPIRED']);
const normalizeListPayload = (response) => {
  if (Array.isArray(response)) {
    return { metadata: { total: response.length, page: 1, limit: response.length, pages: 1 }, data: response };
  }

  if (response?.metadata && Array.isArray(response?.data)) {
    return response;
  }

  const data = Array.isArray(response?.data) ? response.data : Array.isArray(response?.items) ? response.items : [];
  return {
    metadata: response?.metadata || {
      total: data.length,
      page: 1,
      limit: data.length,
      pages: 1,
    },
    data,
  };
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const isSameLocalDay = (left, right = new Date()) => {
  if (!left) return false;
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return false;
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

const isDueToday = (reminder) => {
  if (!reminder) return false;
  if (reminder.isDueNow) return true;
  return ACTIVE_STATUSES.has(reminder.status) && isSameLocalDay(reminder.remindAt, new Date());
};

const isOverdue = (reminder) => {
  if (!reminder) return false;
  if (reminder.isOverdue) return true;
  if (!ACTIVE_STATUSES.has(reminder.status)) return false;
  const remindAt = new Date(reminder.remindAt);
  return !Number.isNaN(remindAt.getTime()) && remindAt.getTime() < Date.now() && !isSameLocalDay(remindAt, new Date());
};

const getReminderLabel = (reminder) =>
  reminder?.title ||
  reminder?.sourceItemName ||
  reminder?.service?.serviceType ||
  reminder?.sourceServiceSnapshot?.serviceType ||
  'Reminder';

const getReminderTone = (type) => (type === 'PART' ? 'muted' : 'primary');

const getStatusTone = (status) => {
  switch (status) {
    case 'ACKNOWLEDGED':
      return 'success';
    case 'SNOOZED':
      return 'muted';
    case 'CANCELLED':
      return 'destructive';
    case 'EXPIRED':
    case 'DUE':
      return 'warning';
    default:
      return 'primary';
  }
};

const fetchAllReminders = async () => {
  const pageSize = 100;
  let page = 1;
  let pages = 1;
  const collected = [];

  do {
    const response = await reminderService.listReminders({ page, limit: pageSize });
    const payload = normalizeListPayload(response);
    collected.push(...payload.data);
    pages = payload.metadata?.pages || 1;
    page += 1;
  } while (page <= pages);

  return collected;
};

const ReminderSummaryCard = ({ title, count, icon, tone, actionLabel, onAction }) => (
  <Card className="ops-dashboard__reminder-stat" padding="lg">
    <CardBody className="ops-dashboard__card-body">
      <div className="ops-dashboard__stat-top">
        <span className="ops-dashboard__label">{title}</span>
        <span className="ops-dashboard__icon-chip" aria-hidden="true">
          <i className={`bi ${icon}`} />
        </span>
      </div>
      <div className="ops-dashboard__reminder-stat-footer">
        <strong className="ops-dashboard__stat-value">{count}</strong>
        <Badge tone={tone}>{title}</Badge>
      </div>
      {onAction && (
        <Button variant="ghost" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </CardBody>
  </Card>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    counts: reminderCenterCounts,
    browserNotificationsSupported,
    notificationPermission,
    requestNotificationPermission,
  } = useReminderAlerts();
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState([]);
  const [error, setError] = useState('');
  const alertedRef = useRef(false);

  const stats = [
    { label: 'Core areas', value: '3', icon: 'bi-grid-1x2', tone: 'primary' },
    { label: 'Records status', value: 'Live', icon: 'bi-activity', tone: 'primary' },
    { label: 'Access level', value: 'Secure', icon: 'bi-shield-check', tone: 'primary' },
  ];

  const modules = [
    {
      title: 'Customers',
      description: 'Keep customer records, contacts, and related vehicles organized.',
      path: '/customers',
      icon: 'bi-people-fill',
    },
    {
      title: 'Service History',
      description: 'Search service records and review the full maintenance trail.',
      path: '/search',
      icon: 'bi-wrench-adjustable-circle-fill',
      featured: true,
    },
    {
      title: 'Vehicles',
      description: 'See vehicle records and how they connect back to customers.',
      path: '/customers',
      icon: 'bi-truck-front-fill',
    },
  ];

  const loadReminders = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      try {
        await reminderService.processDueReminders();
      } catch (processError) {
        toast.addToast(
          processError.response?.data?.message || 'Unable to refresh reminder due states right now. Showing the latest reminders.',
          'warning'
        );
      }

      const data = await fetchAllReminders();
      setReminders(data);
    } catch (fetchError) {
      const message = fetchError.response?.data?.message || 'Unable to load reminders.';
      setError(message);
      toast.addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const summary = useMemo(() => {
    const dueToday = reminders.filter((reminder) => isDueToday(reminder)).length;
    const overdue = reminders.filter((reminder) => isOverdue(reminder)).length;
    const upcoming = reminders.filter((reminder) => ACTIVE_STATUSES.has(reminder.status) && !isDueToday(reminder) && !isOverdue(reminder)).length;
    return { dueToday, overdue, upcoming };
  }, [reminders]);

  const topReminders = useMemo(() => {
    return reminders
      .filter((reminder) => isDueToday(reminder) || isOverdue(reminder))
      .sort((left, right) => new Date(left.remindAt) - new Date(right.remindAt))
      .slice(0, 5);
  }, [reminders]);

  const reminderBannerVisible = reminderCenterCounts.alertCount > 0 || (browserNotificationsSupported && notificationPermission !== 'granted');
  const reminderBannerTone = reminderCenterCounts.overdue > 0 ? 'destructive' : reminderCenterCounts.dueToday > 0 ? 'warning' : 'primary';
  const canPromptNotificationPermission = browserNotificationsSupported && notificationPermission === 'default';
  const reminderBannerTitle =
    reminderCenterCounts.alertCount > 0
      ? `${reminderCenterCounts.alertCount} reminder${reminderCenterCounts.alertCount === 1 ? '' : 's'} need attention`
      : 'Browser notifications are available for future reminder alerts';
  const reminderBannerDescription =
    reminderCenterCounts.alertCount > 0
      ? `${reminderCenterCounts.overdue} overdue and ${reminderCenterCounts.dueToday} due today. Keep reminders visible with a browser notification badge.`
      : notificationPermission === 'denied'
        ? 'Browser notifications are blocked in your browser settings, but in-app reminder alerts will still appear here.'
        : 'Turn on browser notifications to get reminder alerts while you work in ServiFleet.';

  useEffect(() => {
    if (loading) return;
    const alertKey = `${summary.dueToday}:${summary.overdue}`;
    if ((summary.dueToday > 0 || summary.overdue > 0) && alertedRef.current !== alertKey) {
      alertedRef.current = alertKey;
      toast.addToast(
        summary.overdue > 0
          ? `${summary.overdue} overdue reminder${summary.overdue > 1 ? 's' : ''} need attention.`
          : `${summary.dueToday} reminder${summary.dueToday > 1 ? 's' : ''} are due today.`,
        'warning'
      );
    }
    if (summary.dueToday === 0 && summary.overdue === 0) {
      alertedRef.current = false;
    }
  }, [loading, summary.dueToday, summary.overdue, toast]);

  return (
    <Page className="ops-dashboard">
      <header className="ops-dashboard__hero">
        <div className="ops-dashboard__hero-copy">
          <p className="ops-dashboard__eyebrow">Operations dashboard</p>
          <h1>Your operations, at a glance</h1>
          <p>Manage customers, fleet records, service history, and reminders from one calm workspace.</p>
        </div>

        <div className="ops-dashboard__hero-actions">
          <Button variant="outline" icon="bi-bell" onClick={() => navigate('/reminders')}>
            Open reminders
          </Button>
          <Button variant="outline" icon="bi-search" className="ops-dashboard__search" onClick={() => navigate('/search')}>
            Search records
          </Button>
        </div>
      </header>

      {reminderBannerVisible && (
        <section className={`reminder-alert-banner reminder-alert-banner--${reminderBannerTone}`} aria-label="Reminder alerts">
          <div className="reminder-alert-banner__content">
            <p className="reminder-alert-banner__eyebrow">Reminder alerts</p>
            <h2 className="reminder-alert-banner__title">{reminderBannerTitle}</h2>
            <p className="reminder-alert-banner__description">{reminderBannerDescription}</p>
            <div className="reminder-alert-banner__badges">
              {reminderCenterCounts.alertCount > 0 ? (
                <>
                  <span className={`reminder-alert-banner__badge reminder-alert-banner__badge--${reminderBannerTone}`}>
                    <i className="bi bi-calendar-event" aria-hidden="true" />
                    Due today: {reminderCenterCounts.dueToday}
                  </span>
                  <span className={`reminder-alert-banner__badge reminder-alert-banner__badge--${reminderBannerTone}`}>
                    <i className="bi bi-exclamation-triangle" aria-hidden="true" />
                    Overdue: {reminderCenterCounts.overdue}
                  </span>
                </>
              ) : (
                <span className="reminder-alert-banner__badge">
                  <i className="bi bi-bell" aria-hidden="true" />
                  {notificationPermission === 'denied' ? 'Notifications blocked in browser settings' : 'Ready for future reminder alerts'}
                </span>
              )}
            </div>
          </div>
          <div className="reminder-alert-banner__actions">
            <Button variant="outline" icon="bi-bell" onClick={() => navigate('/reminders')}>
              Open reminders
            </Button>
            {canPromptNotificationPermission && (
              <Button variant="primary" icon="bi-bell-fill" onClick={requestNotificationPermission}>
                Enable browser notifications
              </Button>
            )}
          </div>
        </section>
      )}

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

      <section className="ops-dashboard__reminders" aria-label="Reminder summary">
        {loading ? (
          <LoadingState title="Loading reminders" description="Fetching the latest due and upcoming reminders." />
        ) : error ? (
          <EmptyState title="Unable to load reminders" description={error} actionLabel="Try again" onAction={loadReminders} />
        ) : (
          <>
            <div className="ops-dashboard__reminder-summary">
              <ReminderSummaryCard title="Due today" count={summary.dueToday} icon="bi-calendar-event" tone="warning" actionLabel="View reminders" onAction={() => navigate('/reminders')} />
              <ReminderSummaryCard title="Overdue" count={summary.overdue} icon="bi-exclamation-triangle" tone="destructive" actionLabel="Review overdue" onAction={() => navigate('/reminders')} />
              <ReminderSummaryCard title="Upcoming" count={summary.upcoming} icon="bi-clock-history" tone="primary" actionLabel="Open list" onAction={() => navigate('/reminders')} />
            </div>

            <Card className="ops-dashboard__reminder-list-card" padding="lg">
              <CardBody className="ops-dashboard__reminder-list-body">
                <div className="ops-dashboard__reminder-list-header">
                  <div>
                    <p className="ops-dashboard__eyebrow">Maintenance reminders</p>
                    <h2>Top reminders</h2>
                    <p>Due today and overdue reminders are highlighted here for quick action.</p>
                  </div>
                  <Button variant="outline" icon="bi-bell" onClick={() => navigate('/reminders')}>
                    Open reminders page
                  </Button>
                </div>

                {!topReminders.length ? (
                  <EmptyState
                    title="No active reminders"
                    description="There are no due or overdue reminders at the moment."
                    actionLabel="View all reminders"
                    onAction={() => navigate('/reminders')}
                  />
                ) : (
                  <div className="ops-dashboard__reminder-items">
                    {topReminders.map((reminder) => (
                      <article key={reminder.id} className="ops-dashboard__reminder-item">
                        <div className="ops-dashboard__reminder-item-top">
                          <div>
                            <div className="ops-dashboard__reminder-title-row">
                              <h3>{getReminderLabel(reminder)}</h3>
                              <Badge tone={getReminderTone(reminder.reminderType)}>{String(reminder.reminderType || 'Reminder').replace('_', ' ')}</Badge>
                              <Badge tone={getStatusTone(reminder.status)}>{String(reminder.status || 'SCHEDULED').replace('_', ' ')}</Badge>
                            </div>
                            <p>
                              {reminder.customer?.name || 'Unknown customer'} | {reminder.vehicle?.registrationNumber || 'Unknown vehicle'}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => navigate('/reminders')}>
                            Open
                          </Button>
                        </div>

                        <div className="ops-dashboard__reminder-meta">
                          <span>{reminder.service?.serviceType || reminder.sourceServiceSnapshot?.serviceType || 'Service'}</span>
                          <span>{formatDateTime(reminder.remindAt)}</span>
                          <span>{reminder.dueOdometer ? `ODO ${reminder.dueOdometer}` : 'No odometer set'}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </>
        )}
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

              <button type="button" className="ops-dashboard__link" onClick={() => navigate(module.path)}>
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
