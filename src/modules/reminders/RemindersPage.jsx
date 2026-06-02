import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, EmptyState, Page, PageHeader, Tabs } from '../../shared/components/ui/index.js';
import Modal from '../../shared/components/Modal.jsx';
import FormField from '../../shared/components/FormField.jsx';
import { useReminderAlerts } from '../../context/ReminderAlertsContext.jsx';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import reminderService from '../../services/reminderService.js';
import './RemindersPage.css';

const REMINDER_TYPE_OPTIONS = [
  { value: 'ALL', label: 'All types' },
  { value: 'FULL_SERVICE', label: 'Full service' },
  { value: 'PART', label: 'Part' },
];

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'DUE', label: 'Due' },
  { value: 'SENT', label: 'Sent' },
  { value: 'ACKNOWLEDGED', label: 'Completed' },
  { value: 'SNOOZED', label: 'Snoozed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'EXPIRED', label: 'Expired' },
];

const SECTION_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming', icon: 'bi-clock-history' },
  { value: 'dueToday', label: 'Due Today', icon: 'bi-calendar-event' },
  { value: 'overdue', label: 'Overdue', icon: 'bi-exclamation-triangle' },
  { value: 'completed', label: 'Completed', icon: 'bi-check2-circle' },
  { value: 'cancelled', label: 'Cancelled', icon: 'bi-slash-circle' },
];

const DEFAULT_FILTERS = {
  reminderType: 'ALL',
  status: 'ALL',
  search: '',
  fromDate: '',
  toDate: '',
};

const ACTIVE_STATUSES = new Set(['SCHEDULED', 'DUE', 'SNOOZED', 'SENT', 'EXPIRED']);
const COMPLETED_STATUSES = new Set(['ACKNOWLEDGED']);
const CANCELLED_STATUSES = new Set(['CANCELLED']);

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const toLocalDateTimeInputValue = (value) => {
  if (!value) return { date: '', time: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
};

const sameLocalDay = (left, right = new Date()) => {
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

const startOfLocalDay = (value) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const endOfLocalDay = (value) => {
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeText = (value) => (value || '').toString().toLowerCase();

const getReminderLabel = (reminder) =>
  reminder?.title ||
  reminder?.sourceItemName ||
  reminder?.service?.serviceType ||
  reminder?.sourceServiceSnapshot?.serviceType ||
  'Reminder';

const getReminderTypeTone = (type) => (type === 'PART' ? 'muted' : 'primary');

const getStatusTone = (status) => {
  switch (status) {
    case 'ACKNOWLEDGED':
      return 'success';
    case 'SNOOZED':
      return 'muted';
    case 'CANCELLED':
      return 'destructive';
    case 'EXPIRED':
      return 'warning';
    case 'DUE':
      return 'warning';
    case 'SENT':
      return 'primary';
    case 'SCHEDULED':
    default:
      return 'primary';
  }
};

const isReminderOverdue = (reminder) => {
  if (!reminder) return false;
  if (reminder.isOverdue) return true;
  if (!ACTIVE_STATUSES.has(reminder.status)) return false;
  const remindAt = new Date(reminder.remindAt);
  return !Number.isNaN(remindAt.getTime()) && remindAt.getTime() < Date.now() && !sameLocalDay(remindAt, new Date());
};

const isReminderDueToday = (reminder) => {
  if (!reminder) return false;
  if (reminder.isDueNow) return true;
  if (!ACTIVE_STATUSES.has(reminder.status)) return false;
  return sameLocalDay(reminder.remindAt, new Date());
};

const isReminderUpcoming = (reminder) => {
  if (!reminder) return false;
  if (!ACTIVE_STATUSES.has(reminder.status)) return false;
  if (isReminderOverdue(reminder) || isReminderDueToday(reminder)) return false;
  const remindAt = new Date(reminder.remindAt);
  return !Number.isNaN(remindAt.getTime()) && remindAt.getTime() >= Date.now();
};

const matchesSearch = (reminder, search) => {
  if (!search) return true;
  const haystack = [
    getReminderLabel(reminder),
    reminder?.reminderType,
    reminder?.status,
    reminder?.customer?.name,
    reminder?.customer?.email,
    reminder?.customer?.phone,
    reminder?.vehicle?.registrationNumber,
    reminder?.vehicle?.make,
    reminder?.vehicle?.model,
    reminder?.service?.serviceType,
    reminder?.sourceItemName,
    reminder?.notes,
  ]
    .map(normalizeText)
    .join(' ');
  return haystack.includes(normalizeText(search));
};

const matchesDateRange = (reminder, fromDate, toDate) => {
  const remindAt = new Date(reminder?.remindAt);
  if (Number.isNaN(remindAt.getTime())) return false;

  if (fromDate) {
    const start = startOfLocalDay(fromDate);
    if (start && remindAt < start) return false;
  }

  if (toDate) {
    const end = endOfLocalDay(toDate);
    if (end && remindAt > end) return false;
  }

  return true;
};

const bucketReminder = (reminder) => {
  if (CANCELLED_STATUSES.has(reminder.status)) return 'cancelled';
  if (COMPLETED_STATUSES.has(reminder.status)) return 'completed';
  if (isReminderOverdue(reminder)) return 'overdue';
  if (isReminderDueToday(reminder)) return 'dueToday';
  return 'upcoming';
};

const getReminderCustomerName = (reminder) => reminder?.customer?.name || 'Unknown customer';

const getReminderVehicleNumber = (reminder) => reminder?.vehicle?.registrationNumber || 'Unknown vehicle';

const getReminderServiceType = (reminder) => reminder?.service?.serviceType || reminder?.sourceServiceSnapshot?.serviceType || '-';

const hasActiveFilters = (filters) =>
  Boolean(
    filters.search ||
      filters.fromDate ||
      filters.toDate ||
      filters.reminderType !== 'ALL' ||
      filters.status !== 'ALL'
  );

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

const ReminderCard = ({ reminder, onAcknowledge, onSnooze, onCancel }) => {
  const isCompleted = reminder.status === 'ACKNOWLEDGED';
  const isCancelled = reminder.status === 'CANCELLED';
  const partLabel = reminder.reminderType === 'PART' ? reminder.sourceItemName : null;

  return (
    <Card className="reminders-page__card" padding="lg">
      <CardBody className="reminders-page__card-body">
        <div className="reminders-page__card-top">
          <div className="reminders-page__card-main">
            <div className="reminders-page__title-row">
              <h3 className="reminders-page__title">{getReminderLabel(reminder)}</h3>
              <Badge tone={getReminderTypeTone(reminder.reminderType)}>{String(reminder.reminderType || 'Reminder').replace('_', ' ')}</Badge>
              <Badge tone={getStatusTone(reminder.status)}>{String(reminder.status || 'SCHEDULED').replace('_', ' ')}</Badge>
            </div>
            <p className="reminders-page__subtitle">
              {getReminderCustomerName(reminder)} | {getReminderVehicleNumber(reminder)}
            </p>
            <div className="reminders-page__info-row">
              <span>
                <i className="bi bi-calendar-event" aria-hidden="true" />
                {formatDateTime(reminder.remindAt)}
              </span>
              <span>
                <i className="bi bi-truck-front" aria-hidden="true" />
                {getReminderVehicleNumber(reminder)}
              </span>
            </div>
            {partLabel && (
              <div className="reminders-page__part-callout">
                <span>Part reminder</span>
                <strong>{partLabel}</strong>
                <p>Reminder-only parts are not included in bill total.</p>
              </div>
            )}
          </div>

          <div className="reminders-page__dates">
            <p>
              <span>Reminder date</span>
              <strong>{formatDateTime(reminder.remindAt)}</strong>
            </p>
            <p>
              <span>Due odometer</span>
              <strong>{reminder.dueOdometer ?? '-'}</strong>
            </p>
          </div>
        </div>

        <div className="reminders-page__details-grid">
          <div>
            <span>Customer</span>
            <strong>{getReminderCustomerName(reminder)}</strong>
          </div>
          <div>
            <span>Vehicle</span>
            <strong>{getReminderVehicleNumber(reminder)}</strong>
          </div>
          <div>
            <span>Service type</span>
            <strong>{getReminderServiceType(reminder)}</strong>
          </div>
          <div>
            <span>Part name</span>
            <strong>{partLabel || '-'}</strong>
          </div>
          <div>
            <span>Timezone</span>
            <strong>{reminder.timezone || '-'}</strong>
          </div>
          <div>
            <span>Notes</span>
            <strong>{reminder.notes || '-'}</strong>
          </div>
        </div>

        <div className="reminders-page__meta">
          <span>Service #{reminder.service?.id ? reminder.service.id.slice(-6) : reminder.serviceId?.slice?.(-6) || '-'}</span>
          <span>{reminder.vehicle?.make ? `${reminder.vehicle.make} ${reminder.vehicle.model || ''}`.trim() : ''}</span>
        </div>

        <div className="reminders-page__actions">
          {!isCompleted && !isCancelled && (
            <>
              <Button variant="success" size="sm" icon="bi-check2-circle" onClick={() => onAcknowledge(reminder)}>
                Mark completed
              </Button>
              <Button variant="outline" size="sm" icon="bi-clock-history" onClick={() => onSnooze(reminder)}>
                Snooze
              </Button>
              <Button variant="outline" size="sm" icon="bi-x-circle" onClick={() => onCancel(reminder)}>
                Cancel
              </Button>
            </>
          )}
          {isCompleted && <Badge tone="success">Completed</Badge>}
          {isCancelled && <Badge tone="destructive">Cancelled</Badge>}
        </div>
      </CardBody>
    </Card>
  );
};

const RemindersPage = () => {
  const toast = useToast();
  const {
    counts: reminderCenterCounts,
    browserNotificationsSupported,
    notificationPermission,
    requestNotificationPermission,
  } = useReminderAlerts();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('upcoming');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [snoozeTarget, setSnoozeTarget] = useState(null);
  const [snoozeDate, setSnoozeDate] = useState('');
  const [snoozeTime, setSnoozeTime] = useState('');
  const [snoozeNotes, setSnoozeNotes] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelNotes, setCancelNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('USER_CANCELLED');

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

      setReminders(collected);
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

  const filteredReminders = useMemo(() => {
    return reminders.filter((reminder) => {
      if (filters.reminderType !== 'ALL' && reminder.reminderType !== filters.reminderType) {
        return false;
      }

      if (filters.status !== 'ALL' && reminder.status !== filters.status) {
        return false;
      }

      if (!matchesSearch(reminder, filters.search)) {
        return false;
      }

      if (!matchesDateRange(reminder, filters.fromDate, filters.toDate)) {
        return false;
      }

      return true;
    });
  }, [filters, reminders]);

  const sections = useMemo(() => {
    const buckets = {
      upcoming: [],
      dueToday: [],
      overdue: [],
      completed: [],
      cancelled: [],
    };

    filteredReminders.forEach((reminder) => {
      buckets[bucketReminder(reminder)].push(reminder);
    });

    Object.values(buckets).forEach((items) => {
      items.sort((left, right) => new Date(left.remindAt) - new Date(right.remindAt));
    });

    return buckets;
  }, [filteredReminders]);

  const activeReminders = sections[activeSection] || [];

  const summary = useMemo(() => {
    const total = reminders.length;
    const dueToday = reminders.filter((reminder) => isReminderDueToday(reminder)).length;
    const overdue = reminders.filter((reminder) => isReminderOverdue(reminder)).length;
    const upcoming = reminders.filter((reminder) => isReminderUpcoming(reminder)).length;
    const completed = reminders.filter((reminder) => COMPLETED_STATUSES.has(reminder.status)).length;
    return { total, dueToday, overdue, upcoming, completed };
  }, [reminders]);

  const filtersActive = hasActiveFilters(filters);

  const handleFilterChange = (name) => (event) => {
    const value = event.target.value;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setActiveSection('upcoming');
  }, []);

  const sectionTabs = useMemo(
    () =>
      SECTION_OPTIONS.map((section) => {
        const count = sections[section.value]?.length || 0;
        return {
          ...section,
          label: `${section.label} (${count})`,
        };
      }),
    [sections]
  );

  const summaryCards = useMemo(
    () => [
      { label: 'Total reminders', value: summary.total, icon: 'bi-inboxes', tone: 'primary' },
      { label: 'Due today', value: summary.dueToday, icon: 'bi-calendar-event', tone: 'warning' },
      { label: 'Overdue', value: summary.overdue, icon: 'bi-exclamation-triangle', tone: 'destructive' },
      { label: 'Upcoming', value: summary.upcoming, icon: 'bi-clock-history', tone: 'primary' },
      { label: 'Completed', value: summary.completed, icon: 'bi-check2-circle', tone: 'success' },
    ],
    [summary.completed, summary.dueToday, summary.overdue, summary.total, summary.upcoming]
  );

  const reminderBannerVisible = reminderCenterCounts.alertCount > 0 || (browserNotificationsSupported && notificationPermission !== 'granted');
  const reminderBannerTone = reminderCenterCounts.overdue > 0 ? 'destructive' : reminderCenterCounts.dueToday > 0 ? 'warning' : 'primary';
  const canPromptNotificationPermission = browserNotificationsSupported && notificationPermission === 'default';
  const reminderBannerTitle =
    reminderCenterCounts.alertCount > 0
      ? `${reminderCenterCounts.alertCount} reminder${reminderCenterCounts.alertCount === 1 ? '' : 's'} need attention`
      : 'Browser notifications are available for future reminder alerts';
  const reminderBannerDescription =
    reminderCenterCounts.alertCount > 0
      ? `${reminderCenterCounts.overdue} overdue and ${reminderCenterCounts.dueToday} due today. Keep reminder alerts visible while you work.`
      : notificationPermission === 'denied'
        ? 'Browser notifications are blocked in your browser settings, but reminder alerts will still appear in the app.'
        : 'Turn on browser notifications to get reminder alerts while you work in ServiFleet.';

  const getEmptyStateForSection = useCallback(
    (section) => {
      const filteredMessage = 'Try clearing the filters or searching a different keyword.';
      const baseMessages = {
        upcoming: {
          title: 'No upcoming reminders yet',
          description: 'Upcoming reminders will appear here when they are scheduled.',
        },
        dueToday: {
          title: 'No reminders due today',
          description: 'Everything looks quiet for today. New due reminders will show up here automatically.',
        },
        overdue: {
          title: 'No overdue reminders',
          description: 'There are no overdue reminders right now. This section stays empty when follow-ups are on track.',
        },
        completed: {
          title: 'No completed reminders',
          description: 'Completed reminders will show here after they are marked done.',
        },
        cancelled: {
          title: 'No cancelled reminders',
          description: 'Cancelled reminders will appear here to keep the history intact.',
        },
      };

      if (filtersActive) {
        return {
          title: 'No reminders match your filters',
          description: filteredMessage,
          actionLabel: 'Clear filters',
          onAction: clearFilters,
        };
      }

      const message = baseMessages[section] || baseMessages.upcoming;
      return {
        ...message,
        actionLabel: 'Refresh',
        onAction: loadReminders,
      };
    },
    [clearFilters, filtersActive, loadReminders]
  );

  const handleAcknowledge = async (reminder) => {
    setSavingId(reminder.id);
    try {
      await reminderService.acknowledgeReminder(reminder.id);
      toast.addToast('Reminder marked as completed.', 'success');
      await loadReminders();
    } catch (actionError) {
      toast.addToast(actionError.response?.data?.message || 'Unable to mark reminder as completed.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const openSnoozeModal = (reminder) => {
    const local = toLocalDateTimeInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000));
    setSnoozeTarget(reminder);
    setSnoozeDate(local.date);
    setSnoozeTime(local.time);
    setSnoozeNotes(reminder.notes || '');
  };

  const handleSnoozeSubmit = async () => {
    if (!snoozeTarget) return;
    if (!snoozeDate || !snoozeTime) {
      toast.addToast('Please choose both snooze date and time.', 'warning');
      return;
    }

    const snoozedUntil = new Date(`${snoozeDate}T${snoozeTime}`);
    if (Number.isNaN(snoozedUntil.getTime())) {
      toast.addToast('Please choose a valid snooze date and time.', 'warning');
      return;
    }

    setSavingId(snoozeTarget.id);
    try {
      await reminderService.snoozeReminder(snoozeTarget.id, {
        snoozedUntil: snoozedUntil.toISOString(),
        notes: snoozeNotes,
      });
      toast.addToast('Reminder snoozed successfully.', 'success');
      setSnoozeTarget(null);
      await loadReminders();
    } catch (actionError) {
      toast.addToast(actionError.response?.data?.message || 'Unable to snooze reminder.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const openCancelModal = (reminder) => {
    setCancelTarget(reminder);
    setCancelNotes(reminder.notes || '');
    setCancelReason('USER_CANCELLED');
  };

  const handleCancelSubmit = async () => {
    if (!cancelTarget) return;

    setSavingId(cancelTarget.id);
    try {
      await reminderService.cancelReminder(cancelTarget.id, {
        cancelReason,
        notes: cancelNotes,
      });
      toast.addToast('Reminder cancelled successfully.', 'success');
      setCancelTarget(null);
      await loadReminders();
    } catch (actionError) {
      toast.addToast(actionError.response?.data?.message || 'Unable to cancel reminder.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const renderReminderList = () => {
    if (loading) {
      return (
        <div className="reminders-page__skeleton-list" aria-label="Loading reminders">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={`skeleton-${index}`} className="reminders-page__skeleton-card" padding="lg">
              <CardBody className="reminders-page__skeleton-body">
                <div className="reminders-page__skeleton-line reminders-page__skeleton-line--title" />
                <div className="reminders-page__skeleton-badges">
                  <span />
                  <span />
                </div>
                <div className="reminders-page__skeleton-grid">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      );
    }

    if (error) {
      return <EmptyState title="Unable to load reminders" description={error} actionLabel="Try again" onAction={loadReminders} />;
    }

    if (!activeReminders.length) {
      const emptyState = getEmptyStateForSection(activeSection);
      return (
        <EmptyState title={emptyState.title} description={emptyState.description} actionLabel={emptyState.actionLabel} onAction={emptyState.onAction} />
      );
    }

    return (
      <div className="reminders-page__list">
        {activeReminders.map((reminder) => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            onAcknowledge={handleAcknowledge}
            onSnooze={openSnoozeModal}
            onCancel={openCancelModal}
          />
        ))}
      </div>
    );
  };

  return (
    <Page className="reminders-page">
      <PageHeader
        eyebrow="Maintenance reminders"
        title="Reminders"
        description="Review upcoming, due, overdue, completed, and cancelled reminders in one clean workspace."
        actions={
          <div className="reminders-page__header-actions">
            <Button variant="outline" icon="bi-arrow-clockwise" loading={loading} onClick={loadReminders}>
              Refresh
            </Button>
            <Button variant="ghost" icon="bi-funnel" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        }
      />

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
                  <span className="reminder-alert-banner__badge">
                    <i className="bi bi-check2-circle" aria-hidden="true" />
                    Completed: {reminderCenterCounts.completed}
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
            {canPromptNotificationPermission && (
              <Button variant="primary" icon="bi-bell-fill" onClick={requestNotificationPermission}>
                Enable browser notifications
              </Button>
            )}
          </div>
        </section>
      )}

      <section className="reminders-page__summary" aria-label="Reminder summary">
        <div className="reminders-page__summary-grid">
          {summaryCards.map((card) => (
            <Card key={card.label} className="reminders-page__stat-card" padding="lg">
              <CardBody className="reminders-page__stat-body">
                <div className="reminders-page__stat-top">
                  <span className="reminders-page__stat-label">{card.label}</span>
                  <span className={`reminders-page__stat-icon reminders-page__stat-icon--${card.tone}`} aria-hidden="true">
                    <i className={`bi ${card.icon}`} />
                  </span>
                </div>
                <strong className="reminders-page__stat-value">{card.value}</strong>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {(summary.dueToday > 0 || summary.overdue > 0) && (
        <Card className="reminders-page__warning" padding="lg">
          <CardBody className="reminders-page__warning-body">
            <div>
              <p className="reminders-page__warning-label">Attention needed</p>
              <h2>{summary.overdue > 0 ? `${summary.overdue} overdue reminder${summary.overdue > 1 ? 's' : ''}` : `${summary.dueToday} reminder${summary.dueToday > 1 ? 's' : ''} due today`}</h2>
              <p>Open the reminders list to acknowledge, snooze, or cancel maintenance follow-ups.</p>
            </div>
            <Button variant="outline" icon="bi-bell" onClick={() => setActiveSection(summary.overdue > 0 ? 'overdue' : 'dueToday')}>
              Review reminders
            </Button>
          </CardBody>
        </Card>
      )}

      <Card padding="lg" className="reminders-page__filters">
        <CardBody>
          <div className="reminders-page__filters-grid">
            <FormField
              className="reminders-page__filter reminders-page__filter--search"
              label="Search reminders"
              name="reminder-search"
              value={filters.search}
              onChange={handleFilterChange('search')}
              placeholder="Customer, vehicle, part, or service title"
            />
            <FormField className="reminders-page__filter" label="Type" name="reminder-type" as="select" value={filters.reminderType} onChange={handleFilterChange('reminderType')}>
              {REMINDER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FormField>
            <FormField className="reminders-page__filter" label="Status" name="reminder-status" as="select" value={filters.status} onChange={handleFilterChange('status')}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FormField>
            <FormField className="reminders-page__filter" label="From date" name="reminder-from" type="date" value={filters.fromDate} onChange={handleFilterChange('fromDate')} />
            <FormField className="reminders-page__filter" label="To date" name="reminder-to" type="date" value={filters.toDate} onChange={handleFilterChange('toDate')} />
          </div>
        </CardBody>
      </Card>

      <section className="reminders-page__sections" aria-label="Reminder sections">
        <div className="reminders-page__tabs-scroll">
          <Tabs items={sectionTabs} value={activeSection} onChange={setActiveSection} />
        </div>
        <div className="reminders-page__section-meta">
          <span>
            {activeReminders.length} reminder{activeReminders.length === 1 ? '' : 's'} shown
          </span>
          <span>
            {filteredReminders.length} match{filteredReminders.length === 1 ? '' : 'es'} after filters
          </span>
          {filtersActive && <span>Filters active</span>}
        </div>
        {renderReminderList()}
      </section>

      <Modal
        open={Boolean(snoozeTarget)}
        title={`Snooze ${snoozeTarget ? getReminderLabel(snoozeTarget) : 'reminder'}`}
        onClose={() => setSnoozeTarget(null)}
      >
        <div className="reminders-page__modal-grid">
          <FormField label="Snooze date" name="snooze-date" type="date" value={snoozeDate} onChange={(event) => setSnoozeDate(event.target.value)} />
          <FormField label="Snooze time" name="snooze-time" type="time" value={snoozeTime} onChange={(event) => setSnoozeTime(event.target.value)} />
          <FormField label="Notes" name="snooze-notes" as="textarea" rows={4} value={snoozeNotes} onChange={(event) => setSnoozeNotes(event.target.value)} placeholder="Optional notes" />
        </div>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setSnoozeTarget(null)}>
            Close
          </Button>
          <Button variant="outline" loading={savingId === snoozeTarget?.id} onClick={handleSnoozeSubmit}>
            Snooze reminder
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(cancelTarget)}
        title={`Cancel ${cancelTarget ? getReminderLabel(cancelTarget) : 'reminder'}`}
        onClose={() => setCancelTarget(null)}
      >
        <div className="reminders-page__cancel-copy">
          <p>This reminder will be cancelled and kept in history so the maintenance trail stays intact.</p>
          <FormField label="Cancel reason" name="cancel-reason" as="select" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)}>
            <option value="USER_CANCELLED">User cancelled</option>
            <option value="SOURCE_ITEM_REMOVED">Source item removed</option>
            <option value="SERVICE_DELETED">Service deleted</option>
            <option value="COMPLETED">Completed elsewhere</option>
            <option value="DUPLICATE">Duplicate</option>
            <option value="SYSTEM_CLEANUP">System cleanup</option>
          </FormField>
          <FormField label="Notes" name="cancel-notes" as="textarea" rows={4} value={cancelNotes} onChange={(event) => setCancelNotes(event.target.value)} placeholder="Optional cancellation note" />
        </div>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setCancelTarget(null)}>
            Back
          </Button>
          <Button variant="outline" loading={savingId === cancelTarget?.id} onClick={handleCancelSubmit}>
            Cancel reminder
          </Button>
        </div>
      </Modal>
    </Page>
  );
};

export default RemindersPage;
