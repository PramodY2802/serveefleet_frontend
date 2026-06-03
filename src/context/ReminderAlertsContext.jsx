import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import reminderService from '../services/reminderService.js';
import { useAuthContext } from './AuthContext.jsx';

const ReminderAlertsContext = createContext(null);

const STORAGE_PREFIX = 'servifleet:reminder-alerts';
const POLL_INTERVAL_MS = 60000;
const PAGE_SIZE = 100;

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

const isCompleted = (reminder) => reminder?.status === 'ACKNOWLEDGED';
const isCancelled = (reminder) => reminder?.status === 'CANCELLED';
const isActiveReminder = (reminder) => !isCompleted(reminder) && !isCancelled(reminder);

const isDueTodayReminder = (reminder) => {
  if (!reminder || !isActiveReminder(reminder)) return false;
  if (reminder.isDueNow) return true;
  return sameLocalDay(reminder.remindAt, new Date());
};

const isOverdueReminder = (reminder) => {
  if (!reminder || !isActiveReminder(reminder)) return false;
  if (reminder.isOverdue) return true;
  const remindAt = new Date(reminder.remindAt);
  return !Number.isNaN(remindAt.getTime()) && remindAt.getTime() < Date.now() && !sameLocalDay(remindAt, new Date());
};

const normalizeReminder = (reminder) => {
  const remindAt = new Date(reminder?.remindAt);
  const dueToday = isDueTodayReminder(reminder);
  const overdue = isOverdueReminder(reminder);

  return {
    ...reminder,
    isDueNow: dueToday,
    isOverdue: overdue,
    remindAt: Number.isNaN(remindAt.getTime()) ? reminder?.remindAt : remindAt.toISOString(),
  };
};

const getStorageKey = (userId) => `${STORAGE_PREFIX}:${userId || 'guest'}`;

const safeStorage = {
  getItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage failures.
    }
  },
};

const extractListPayload = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  return [];
};

const fetchAllReminders = async () => {
  let page = 1;
  let pages = 1;
  const collected = [];

  do {
    const response = await reminderService.listReminders({ page, limit: PAGE_SIZE });
    const payload = response?.data && response?.metadata ? response : response?.data?.metadata ? response.data : response;
    const items = extractListPayload(payload);
    collected.push(...items);
    pages = payload?.metadata?.pages || 1;
    page += 1;
  } while (page <= pages);

  return collected.map(normalizeReminder);
};

const getAlertSnapshot = (reminders) => {
  const alertItems = reminders
    .filter((reminder) => isDueTodayReminder(reminder) || isOverdueReminder(reminder))
    .map((reminder) => `${reminder.id || reminder._id}:${reminder.status}:${reminder.updatedAt || reminder.lastNotifiedAt || reminder.remindAt}`)
    .sort();

  return alertItems.join('|');
};

const getNotificationBody = (counts) => {
  const segments = [];
  if (counts.overdue > 0) {
    segments.push(`${counts.overdue} overdue`);
  }
  if (counts.dueToday > 0) {
    segments.push(`${counts.dueToday} due today`);
  }

  if (!segments.length) {
    return 'Your reminder list is clear.';
  }

  return `You have ${segments.join(' and ')}.`;
};

export const ReminderAlertsProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuthContext();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const loadTokenRef = useRef(0);
  const currentRemindersRef = useRef([]);
  const lastNotifiedSnapshotRef = useRef('');
  const timerRef = useRef(null);

  const storageKey = useMemo(() => getStorageKey(user?.id), [user?.id]);

  const browserNotificationsSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

  const counts = useMemo(() => {
    const total = reminders.length;
    const dueToday = reminders.filter((reminder) => isDueTodayReminder(reminder)).length;
    const overdue = reminders.filter((reminder) => isOverdueReminder(reminder)).length;
    const completed = reminders.filter((reminder) => reminder.status === 'ACKNOWLEDGED').length;
    const upcoming = reminders.filter((reminder) => isActiveReminder(reminder) && !isDueTodayReminder(reminder) && !isOverdueReminder(reminder)).length;

    return {
      total,
      dueToday,
      overdue,
      upcoming,
      completed,
      alertCount: dueToday + overdue,
    };
  }, [reminders]);

  const alertReminders = useMemo(
    () =>
      reminders
        .filter((reminder) => isDueTodayReminder(reminder) || isOverdueReminder(reminder))
        .sort((left, right) => new Date(left.remindAt) - new Date(right.remindAt)),
    [reminders]
  );

  const persistSnapshot = useCallback(
    (snapshot) => {
      safeStorage.setItem(storageKey, snapshot);
      lastNotifiedSnapshotRef.current = snapshot;
    },
    [storageKey]
  );

  const showBrowserNotification = useCallback(
    async (snapshot, nextCounts) => {
      if (!browserNotificationsSupported || Notification.permission !== 'granted' || !nextCounts.alertCount) return;

      const savedSnapshot = safeStorage.getItem(storageKey) || '';
      if (savedSnapshot === snapshot) return;

      const body = getNotificationBody(nextCounts);
      const title = nextCounts.overdue > 0 ? 'ServiFleet overdue reminders' : 'ServiFleet reminder alert';
      const options = {
        body,
        tag: snapshot,
        renotify: false,
        requireInteraction: false,
        icon: '/autopulse.png',
        badge: '/autopulse.png',
        data: { url: '/reminders' },
      };

      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration?.showNotification) {
            await registration.showNotification(title, options);
            persistSnapshot(snapshot);
            return;
          }
        }

        const notification = new Notification(title, options);
        notification.onclick = () => {
          window.focus();
          window.location.href = '/reminders';
          notification.close();
        };
        persistSnapshot(snapshot);
      } catch {
        // Ignore notification failures so the alert center stays non-blocking.
      }
    },
    [browserNotificationsSupported, persistSnapshot, storageKey]
  );

  const loadReminders = useCallback(
    async ({ silent = false } = {}) => {
      if (!isAuthenticated || !user) {
        setReminders([]);
        setError('');
        setLoading(false);
        setLastSyncedAt(null);
        return;
      }

      const token = ++loadTokenRef.current;
      if (!silent) setLoading(true);
      setError('');

      try {
        const data = await fetchAllReminders();
        if (loadTokenRef.current !== token) return;

        setReminders(data);
        currentRemindersRef.current = data;
        setLastSyncedAt(new Date().toISOString());

        const snapshot = getAlertSnapshot(data);
        if (Notification.permission === 'granted' && snapshot) {
          await showBrowserNotification(snapshot, {
            dueToday: data.filter((reminder) => isDueTodayReminder(reminder)).length,
            overdue: data.filter((reminder) => isOverdueReminder(reminder)).length,
            alertCount: data.filter((reminder) => isDueTodayReminder(reminder) || isOverdueReminder(reminder)).length,
          });
        } else if (!snapshot) {
          persistSnapshot('');
        }
      } catch (fetchError) {
        if (loadTokenRef.current !== token) return;
        setError(fetchError.response?.data?.message || 'Unable to load reminders.');
      } finally {
        if (loadTokenRef.current === token && !silent) {
          setLoading(false);
        }
      }
    },
    [isAuthenticated, persistSnapshot, showBrowserNotification, user]
  );

  const requestNotificationPermission = useCallback(async () => {
    if (!browserNotificationsSupported) {
      setNotificationPermission('unsupported');
      return 'unsupported';
    }

    if (Notification.permission === 'granted') {
      setNotificationPermission('granted');
      const snapshot = getAlertSnapshot(currentRemindersRef.current);
      if (snapshot) {
        persistSnapshot('');
        await showBrowserNotification(snapshot, {
          dueToday: currentRemindersRef.current.filter((reminder) => isDueTodayReminder(reminder)).length,
          overdue: currentRemindersRef.current.filter((reminder) => isOverdueReminder(reminder)).length,
          alertCount: currentRemindersRef.current.filter((reminder) => isDueTodayReminder(reminder) || isOverdueReminder(reminder)).length,
        });
      }
      return 'granted';
    }

    const result = await Notification.requestPermission();
    setNotificationPermission(result);
    if (result === 'granted') {
      const snapshot = getAlertSnapshot(currentRemindersRef.current);
      if (snapshot) {
        persistSnapshot('');
        await showBrowserNotification(snapshot, {
          dueToday: currentRemindersRef.current.filter((reminder) => isDueTodayReminder(reminder)).length,
          overdue: currentRemindersRef.current.filter((reminder) => isOverdueReminder(reminder)).length,
          alertCount: currentRemindersRef.current.filter((reminder) => isDueTodayReminder(reminder) || isOverdueReminder(reminder)).length,
        });
      }
    }
    return result;
  }, [browserNotificationsSupported, persistSnapshot, showBrowserNotification]);

  useEffect(() => {
    if (!browserNotificationsSupported) {
      setNotificationPermission('unsupported');
      return undefined;
    }
    setNotificationPermission(Notification.permission);
    return undefined;
  }, [browserNotificationsSupported]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setReminders([]);
      setError('');
      setLoading(false);
      setLastSyncedAt(null);
      currentRemindersRef.current = [];
      persistSnapshot('');
      return undefined;
    }

    const storedSnapshot = safeStorage.getItem(storageKey) || '';
    lastNotifiedSnapshotRef.current = storedSnapshot;

    loadReminders();

    timerRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadReminders({ silent: true });
      }
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadReminders({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, loadReminders, persistSnapshot, storageKey, user]);

  const value = useMemo(
    () => ({
      reminders,
      alertReminders,
      counts,
      loading,
      error,
      lastSyncedAt,
      browserNotificationsSupported,
      notificationPermission,
      requestNotificationPermission,
      refreshReminders: () => loadReminders({ silent: false }),
      setNotificationPermission,
    }),
    [
      alertReminders,
      browserNotificationsSupported,
      counts,
      error,
      lastSyncedAt,
      loading,
      loadReminders,
      notificationPermission,
      reminders,
      requestNotificationPermission,
    ]
  );

  return <ReminderAlertsContext.Provider value={value}>{children}</ReminderAlertsContext.Provider>;
};

export const useReminderAlerts = () => {
  const context = useContext(ReminderAlertsContext);
  if (!context) {
    throw new Error('useReminderAlerts must be used within ReminderAlertsProvider');
  }
  return context;
};
