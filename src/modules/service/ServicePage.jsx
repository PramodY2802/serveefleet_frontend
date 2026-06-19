import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import serviceService from '../../services/serviceService.js';
import reminderService from '../../services/reminderService.js';
import billingService from '../../services/billingService.js';
import DataTable from '../../shared/components/DataTable.jsx';
import FormField from '../../shared/components/FormField.jsx';
import Modal from '../../shared/components/Modal.jsx';
import VehiclePlate from '../../shared/components/VehiclePlate.jsx';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Badge, Button, LoadingState, Page, PageHeader } from '../../shared/components/ui/index.js';
import { formatDateIST, formatDateTimeIST, getLatestTimestamp } from '../../utils/dateUtils.js';

const formatDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const formatTimeInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const combineDateAndTime = (dateValue, timeValue, timezone = DEFAULT_TIMEZONE) => {
  if (!dateValue) return null;
  const normalizedTime = timeValue || '00:00';
  const date = new Date(`${dateValue}T${normalizedTime}:00`);
  if (Number.isNaN(date.getTime())) return null;
  return {
    remindAt: date.toISOString(),
    timezone: timezone || DEFAULT_TIMEZONE,
  };
};

const splitDateTime = (value) => ({
  date: formatDateInput(value),
  time: formatTimeInput(value),
});

const createServiceItemKey = (serviceId, item, index = 0) => {
  const normalized = `${serviceId || 'draft'}-${index}-${String(item?.name || item?.description || '').trim().toLowerCase()}-${String(item?.itemType || item?.type || 'part').trim().toLowerCase()}`;
  const slug = normalized.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'item';
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  return `srvitem_${slug}_${suffix}`;
};

const DEFAULT_SERVICE_INTERVAL_KM = 5000;
const DEFAULT_SERVICE_INTERVAL_DAYS = 180;
const BILL_ITEM_TYPES = [
  { value: 'part', label: 'Part' },
  { value: 'labour', label: 'Labour' },
  { value: 'service', label: 'Service' },
  { value: 'accessory', label: 'Accessory' },
];

const DEFAULT_TIMEZONE =
  (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';

const createBillItem = (overrides = {}) => ({
  id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(16).slice(2)}`),
  serviceItemKey:
    overrides.serviceItemKey ||
    `srvitem_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
  name: '',
  itemType: 'service',
  quantity: 1,
  unitPrice: '',
  partReminderEnabled: false,
  partReminderId: '',
  partReminderDate: '',
  partReminderTime: '',
  partReminderDueOdometer: '',
  partReminderNotes: '',
  partReminderTimezone: DEFAULT_TIMEZONE,
  ...overrides,
});

const createReminderOnlyPart = (overrides = {}) => createBillItem({
  itemType: overrides.itemType || 'part',
  quantity: overrides.quantity ?? 1,
  unitPrice: overrides.unitPrice ?? '',
  partReminderEnabled: overrides.partReminderEnabled ?? true,
  partReminderId: overrides.partReminderId || '',
  partReminderDate: overrides.partReminderDate || '',
  partReminderTime: overrides.partReminderTime || '',
  partReminderDueOdometer: overrides.partReminderDueOdometer || '',
  partReminderNotes: overrides.partReminderNotes || '',
  partReminderTimezone: overrides.partReminderTimezone || DEFAULT_TIMEZONE,
  ...overrides,
});

const formatOdometerValue = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toLocaleString('en-IN');
};

const formatMoneyValue = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '0.00';
};

const addDays = (dateValue, days) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

const getServiceInterval = (serviceType) => {
  const normalized = String(serviceType || '').toLowerCase();

  if (/(oil|lubric|engine)/.test(normalized)) {
    return { km: 5000, days: 180, label: 'routine oil service' };
  }

  if (/(brake)/.test(normalized)) {
    return { km: 10000, days: 365, label: 'brake service' };
  }

  if (/(tyre|tire|wheel|alignment)/.test(normalized)) {
    return { km: 10000, days: 365, label: 'tyre and wheel service' };
  }

  if (/(inspection|check)/.test(normalized)) {
    return { km: 15000, days: 365, label: 'inspection interval' };
  }

  return { km: DEFAULT_SERVICE_INTERVAL_KM, days: DEFAULT_SERVICE_INTERVAL_DAYS, label: 'standard maintenance' };
};

const buildSuggestedSchedule = ({ serviceType, serviceDate, serviceOdometer }) => {
  const odometer = Number(serviceOdometer);
  if (!Number.isFinite(odometer) || odometer < 0 || !serviceDate) return null;

  const currentServiceDate = new Date(serviceDate);
  if (Number.isNaN(currentServiceDate.getTime())) return null;

  const interval = getServiceInterval(serviceType);
  const nextServiceDueDate = addDays(currentServiceDate, interval.days);
  if (!nextServiceDueDate) return null;

  return {
    nextServiceOdometer: Math.round(odometer + interval.km),
    nextServiceDue: formatDateInput(nextServiceDueDate),
    intervalLabel: interval.label,
  };
};

const calculateBillingPreview = (billItems = [], discountAmount = 0, gstRate = 0) => {
  const normalizedItems = billItems.map((item) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    const lineTotal = quantity * unitPrice;

    return {
      ...item,
      quantity,
      unitPrice,
      lineTotal,
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const safeDiscount = Math.max(0, Math.min(Number(discountAmount) || 0, subtotal));
  const taxableAmount = Math.max(0, subtotal - safeDiscount);
  const taxAmount = taxableAmount * (Math.max(0, Number(gstRate) || 0) / 100);
  const grandTotal = taxableAmount + taxAmount;

  return {
    billItems: normalizedItems,
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(safeDiscount.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    grandTotal: Number(grandTotal.toFixed(2)),
  };
};

const buildBillItemsFromService = (service) => {
  const existingItems = Array.isArray(service.billItems)
    ? service.billItems
    : Array.isArray(service.items)
      ? service.items
      : Array.isArray(service.serviceSnapshot?.billItems)
        ? service.serviceSnapshot.billItems
        : [];
  if (existingItems.length > 0) {
    return existingItems.map((item, index) =>
      createBillItem({
        id: item.id || item._id || item.id,
        serviceItemKey: item.serviceItemKey || createServiceItemKey(service._id || service.id, item, index),
        name: item.name || item.description || '',
        itemType: item.itemType || item.type || item.category || 'service',
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice ?? item.price ?? item.amount ?? item.lineTotal ?? item.totalAmount ?? item.total ?? 0,
      })
    );
  }

  if (service.cost !== undefined && service.cost !== null && service.cost !== '') {
    return [
      createBillItem({
        name: service.description || service.serviceType || 'Service charge',
        itemType: 'service',
        quantity: 1,
        unitPrice: service.cost,
      }),
    ];
  }

  return [createBillItem()];
};

const buildBillingSnapshot = (billItems = [], discountAmount = 0, gstRate = 0, currency = 'INR') => {
  const preview = calculateBillingPreview(billItems, discountAmount, gstRate);
  const taxableAmount = Math.max(0, preview.subtotal - preview.discountAmount);
  const normalizedCurrency = currency || 'INR';
  const taxAmount = Number(preview.taxAmount.toFixed(2));
  const cgstAmount = Number((taxAmount / 2).toFixed(2));
  const sgstAmount = Number((taxAmount - cgstAmount).toFixed(2));

  return {
    pricingSummary: {
      subtotal: preview.subtotal,
      discountAmount: preview.discountAmount,
      taxAmount,
      grandTotal: preview.grandTotal,
      currency: normalizedCurrency,
      gstRate: Number(gstRate) || 0,
    },
    taxBreakdown: {
      taxableAmount,
      gstRate: Number(gstRate) || 0,
      cgstAmount,
      sgstAmount,
      igstAmount: 0,
      taxAmount,
    },
    preview,
  };
};

const createEmptyServiceForm = () => {
  const baseForm = {
    serviceType: '',
    serviceDate: formatDateInput(new Date()),
    serviceOdometer: '',
    description: '',
    nextServiceDue: '',
    nextServiceOdometer: '',
    billItems: [createBillItem()],
    reminderOnlyParts: [],
    fullServiceReminderEnabled: false,
    fullServiceReminderId: '',
    fullServiceReminderDate: '',
    fullServiceReminderTime: '',
    fullServiceReminderDueOdometer: '',
    fullServiceReminderNotes: '',
    fullServiceReminderTimezone: DEFAULT_TIMEZONE,
    discountAmount: '0',
    gstRate: '18',
    pricingSummary: {},
    taxBreakdown: {},
  };

  const billingSnapshot = buildBillingSnapshot(baseForm.billItems, baseForm.discountAmount, baseForm.gstRate);
  return {
    ...baseForm,
    pricingSummary: billingSnapshot.pricingSummary,
    taxBreakdown: billingSnapshot.taxBreakdown,
  };
};

const HISTORY_LIMIT = 8;
const SERVICE_TYPE_HISTORY_LIMIT = 10;
const suggestionPanelStyle = {
  position: 'absolute',
  zIndex: 20,
  left: 0,
  right: 0,
  top: 'calc(100% + 8px)',
  overflow: 'hidden',
  borderRadius: '16px',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  background: 'var(--ui-surface, #fff)',
  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.14)',
};

const suggestionSectionStyle = {
  padding: '0.5rem 0',
  maxHeight: '240px',
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
};

const suggestionItemStyle = {
  width: '100%',
  border: '0',
  borderRadius: 0,
  background: 'transparent',
  color: 'var(--ui-text, #0f172a)',
  textDecoration: 'none',
  padding: '0.7rem 1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.65rem',
  justifyContent: 'flex-start',
  textAlign: 'left',
  lineHeight: 1.2,
  minHeight: '44px',
};

const suggestionHeadingStyle = {
  padding: '0 1rem 0.45rem',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ui-muted, #64748b)',
};

const suggestionDividerStyle = {
  borderTop: '1px solid rgba(148, 163, 184, 0.18)',
};

const getStoredHistory = (storageKey) => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : [];
  } catch {
    return [];
  }
};

const getStoredJson = (storageKey) => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getStoredString = (storageKey) => {
  if (typeof window === 'undefined') return '';

  try {
    return window.sessionStorage.getItem(storageKey) || '';
  } catch {
    return '';
  }
};

const getServiceRecordId = (serviceRecord) => {
  if (!serviceRecord) return '';
  if (typeof serviceRecord === 'string') return serviceRecord;

  return (
    serviceRecord.id ||
    serviceRecord._id ||
    serviceRecord.newService?.id ||
    serviceRecord.newService?._id ||
    serviceRecord.service?.id ||
    serviceRecord.service?._id ||
    ''
  );
};

const getServiceTypeValues = (service) => {
  const values = [service.serviceType, service.title, service.category];

  return values
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);
};

  const getServiceSearchValues = (service) => {
  const values = [
    service.serviceType,
    service.title,
    service.category,
    service.description,
    service.billItems?.map((item) => item.name).join(' '),
    service.serviceOdometer,
    service.nextServiceOdometer,
    service.vehicle?.registrationNumber,
    service.vehicle?.customer?.name,
    service.vehicle?.customer?.email,
      service.customer?.name,
    service.customer?.email,
  ];

  return values
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);
};

const ServicePage = () => {
  const { vehicleId } = useParams();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [form, setForm] = useState(() => createEmptyServiceForm());
  const [errors, setErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [serviceTypeHistory, setServiceTypeHistory] = useState([]);
  const [showServiceTypeSuggestions, setShowServiceTypeSuggestions] = useState(false);
  const [scheduleOverrides, setScheduleOverrides] = useState({
    nextServiceDue: false,
    nextServiceOdometer: false,
  });
  const [serviceReminders, setServiceReminders] = useState([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [recentCreatedService, setRecentCreatedService] = useState(null);
  const [billGeneratingServiceId, setBillGeneratingServiceId] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();
  const searchBoxRef = useRef(null);
  const serviceTypeBoxRef = useRef(null);
  const reminderLoadTokenRef = useRef(0);
  const reminderSnapshotRef = useRef({
    fullService: null,
    partsById: new Map(),
    partsByKey: new Map(),
  });

  const historyStorageKey = useMemo(
    () => `service-search-history:${vehicleId || 'all'}`,
    [vehicleId]
  );
  const pendingBillStorageKey = useMemo(
    () => `service-pending-bill:${vehicleId || 'all'}`,
    [vehicleId]
  );
  const suggestedSchedule = useMemo(
    () => buildSuggestedSchedule(form),
    [form.serviceDate, form.serviceOdometer, form.serviceType]
  );
  const billingPreview = useMemo(
    () => calculateBillingPreview(form.billItems, form.discountAmount, form.gstRate),
    [form.billItems, form.discountAmount, form.gstRate]
  );
  const billingSnapshot = useMemo(
    () => buildBillingSnapshot(form.billItems, form.discountAmount, form.gstRate, form.pricingSummary?.currency || 'INR'),
    [form.billItems, form.discountAmount, form.gstRate, form.pricingSummary?.currency]
  );

  const loadServices = useCallback(async () => {
    if (!vehicleId) return;
    try {
      setLoading(true);
      const data = await serviceService.list({ vehicleId });
      setServices(data || []);
    } catch (error) {
      toast.addToast(error.response?.data?.message || 'Unable to load service records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [vehicleId, toast]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useEffect(() => {
    setSearchHistory(getStoredHistory(historyStorageKey));
    setSearchTerm('');
    setShowSuggestions(false);
  }, [historyStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(`service-type-history:${vehicleId || 'all'}`);
      const parsed = raw ? JSON.parse(raw) : [];
      setServiceTypeHistory(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : []);
    } catch {
      setServiceTypeHistory([]);
    }
  }, [vehicleId]);

  useEffect(() => {
    const storedPendingBill = getStoredJson(pendingBillStorageKey);
    if (storedPendingBill && typeof storedPendingBill === 'object') {
      setRecentCreatedService(storedPendingBill.newService || storedPendingBill.service || storedPendingBill);
    }
  }, [pendingBillStorageKey]);

  const closeSearchSuggestions = useCallback(() => {
    setShowSuggestions(false);
  }, []);

  const closeServiceTypeSuggestions = useCallback(() => {
    setShowServiceTypeSuggestions(false);
  }, []);

  const closeAllSuggestionPopups = useCallback(() => {
    closeSearchSuggestions();
    closeServiceTypeSuggestions();
  }, [closeSearchSuggestions, closeServiceTypeSuggestions]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!(event.target instanceof Node)) return;

      const clickedInsideSearch = searchBoxRef.current?.contains(event.target);
      const clickedInsideServiceType = serviceTypeBoxRef.current?.contains(event.target);

      if (clickedInsideSearch || clickedInsideServiceType) return;
      closeAllSuggestionPopups();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeAllSuggestionPopups();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [closeAllSuggestionPopups]);

  const saveSearchTermToHistory = useCallback(
    (term) => {
      const normalized = term.trim();
      if (!normalized || typeof window === 'undefined') return;

      try {
        const nextHistory = [
          normalized,
          ...searchHistory.filter((item) => item.toLowerCase() !== normalized.toLowerCase()),
        ].slice(0, HISTORY_LIMIT);

        setSearchHistory(nextHistory);
        window.localStorage.setItem(historyStorageKey, JSON.stringify(nextHistory));
      } catch {
        // Ignore storage failures so search still works.
      }
    },
    [historyStorageKey, searchHistory]
  );

  const saveServiceTypeToHistory = useCallback(
    (term) => {
      const normalized = term.trim();
      if (!normalized || typeof window === 'undefined') return;

      try {
        const storageKey = `service-type-history:${vehicleId || 'all'}`;
        const nextHistory = [
          normalized,
          ...serviceTypeHistory.filter((item) => item.toLowerCase() !== normalized.toLowerCase()),
        ].slice(0, SERVICE_TYPE_HISTORY_LIMIT);

        setServiceTypeHistory(nextHistory);
        window.localStorage.setItem(storageKey, JSON.stringify(nextHistory));
      } catch {
        // Ignore storage failures so saving still works.
      }
    },
    [serviceTypeHistory, vehicleId]
  );

  const normalizeReminderComparable = useCallback((reminder = {}) => ({
    remindAt: reminder.remindAt ? new Date(reminder.remindAt).toISOString() : '',
    timezone: reminder.timezone || '',
    dueOdometer: reminder.dueOdometer === null || reminder.dueOdometer === undefined || reminder.dueOdometer === ''
      ? ''
      : String(reminder.dueOdometer),
    title: reminder.title || '',
    notes: reminder.notes || '',
    channel: JSON.stringify(reminder.channel || { inApp: true, email: false, push: false }),
  }), []);

  const isReminderComparableEqual = useCallback((left, right) => {
    const leftComparable = normalizeReminderComparable(left);
    const rightComparable = normalizeReminderComparable(right);
    return Object.keys(leftComparable).every((key) => leftComparable[key] === rightComparable[key]);
  }, [normalizeReminderComparable]);

  const buildManualOverrideUpdate = useCallback((existingReminder, reminderPayload, snapshot) => {
    if (!existingReminder) return reminderPayload;
    if (!existingReminder.manualOverride) return reminderPayload;
    if (!snapshot) return reminderPayload;

    if (isReminderComparableEqual(reminderPayload, snapshot)) {
      return null;
    }

    const current = normalizeReminderComparable(reminderPayload);
    const baseline = normalizeReminderComparable(snapshot);
    const updates = {};

    Object.keys(current).forEach((key) => {
      if (current[key] !== baseline[key]) {
        if (key === 'channel') {
          updates.channel = reminderPayload.channel;
          return;
        }

        if (key === 'remindAt') {
          updates.remindAt = reminderPayload.remindAt;
          return;
        }

        if (key === 'timezone') {
          updates.timezone = reminderPayload.timezone;
          return;
        }

        if (key === 'dueOdometer') {
          updates.dueOdometer = reminderPayload.dueOdometer;
          return;
        }

        if (key === 'title') {
          updates.title = reminderPayload.title;
          return;
        }

        if (key === 'notes') {
          updates.notes = reminderPayload.notes;
        }
      }
    });

    return Object.keys(updates).length ? updates : null;
  }, [isReminderComparableEqual, normalizeReminderComparable]);

  const loadServiceReminders = useCallback(
    async (serviceId) => {
      if (!serviceId) {
        setServiceReminders([]);
        return [];
      }

      const loadToken = reminderLoadTokenRef.current + 1;
      reminderLoadTokenRef.current = loadToken;

      try {
        setRemindersLoading(true);
        const response = await reminderService.listReminders({ serviceId, limit: 100, sort: 'remindAt' });
        const reminders = Array.isArray(response?.data) ? response.data : [];
        if (reminderLoadTokenRef.current !== loadToken) return reminders;
        setServiceReminders(reminders);

        const activeReminders = reminders.filter((reminder) => reminder.status !== 'CANCELLED');
        const fullServiceReminder = activeReminders.find(
          (reminder) => reminder.reminderType === 'FULL_SERVICE'
        );
        const partReminders = activeReminders.filter((reminder) => reminder.reminderType === 'PART');
        const partsById = new Map();
        const partsByKey = new Map();

        if (fullServiceReminder) {
          reminderSnapshotRef.current.fullService = {
            ...fullServiceReminder,
            id: fullServiceReminder.id || fullServiceReminder._id || '',
          };
        } else {
          reminderSnapshotRef.current.fullService = null;
        }

        partReminders.forEach((reminder) => {
          const reminderId = reminder.id || reminder._id || '';
          const serviceItemKey = String(reminder.serviceItemKey || '').trim();
          if (reminderId) {
            partsById.set(reminderId, { ...reminder, id: reminderId });
          }
          if (serviceItemKey) {
            partsByKey.set(serviceItemKey, { ...reminder, id: reminderId });
          }
        });
        reminderSnapshotRef.current.partsById = partsById;
        reminderSnapshotRef.current.partsByKey = partsByKey;

        setForm((current) => {
          const next = { ...current };

          if (fullServiceReminder) {
            const reminderDateTime = splitDateTime(fullServiceReminder.remindAt);
            next.fullServiceReminderEnabled = true;
            next.fullServiceReminderId = fullServiceReminder.id || fullServiceReminder._id || '';
            next.fullServiceReminderDate = reminderDateTime.date;
            next.fullServiceReminderTime = reminderDateTime.time;
            next.fullServiceReminderDueOdometer = fullServiceReminder.dueOdometer ?? '';
            next.fullServiceReminderNotes = fullServiceReminder.notes || '';
            next.fullServiceReminderTimezone = fullServiceReminder.timezone || DEFAULT_TIMEZONE;
          }

          const partReminders = activeReminders.filter((reminder) => reminder.reminderType === 'PART');
          const matchedReminderIds = new Set();

          next.billItems = (next.billItems || []).map((item, index) => {
            const itemName = String(item.name || '').trim().toLowerCase();
            const itemType = String(item.itemType || '').trim().toLowerCase();
            const matchedReminder = partReminders.find((reminder) => {
              if (matchedReminderIds.has(reminder.id || reminder._id)) return false;
              const reminderKey = String(reminder.serviceItemKey || '').trim();
              const reminderName = String(reminder.sourceItemName || '').trim().toLowerCase();
              const reminderType = String(reminder.sourceItemType || '').trim().toLowerCase();
              return (
                (reminderKey && reminderKey === item.serviceItemKey) ||
                (reminderName && reminderName === itemName && (!reminderType || reminderType === itemType))
              );
            });

            if (!matchedReminder) return item;
            matchedReminderIds.add(matchedReminder.id || matchedReminder._id);
            const reminderDateTime = splitDateTime(matchedReminder.remindAt);
            return {
              ...item,
              serviceItemKey: matchedReminder.serviceItemKey || item.serviceItemKey || createServiceItemKey(serviceId, item, index),
              partReminderEnabled: true,
              partReminderId: matchedReminder.id || matchedReminder._id || '',
              partReminderDate: reminderDateTime.date,
              partReminderTime: reminderDateTime.time,
              partReminderDueOdometer: matchedReminder.dueOdometer ?? '',
              partReminderNotes: matchedReminder.notes || '',
              partReminderTimezone: matchedReminder.timezone || DEFAULT_TIMEZONE,
            };
          });

          next.reminderOnlyParts = partReminders
            .filter((reminder) => !matchedReminderIds.has(reminder.id || reminder._id))
            .map((reminder, index) => {
              const reminderDateTime = splitDateTime(reminder.remindAt);
              return createReminderOnlyPart({
                id: reminder.id || reminder._id || `reminder-only-${index}`,
                serviceItemKey: reminder.serviceItemKey || createServiceItemKey(serviceId, reminder, index),
                name: reminder.sourceItemName || '',
                itemType: reminder.sourceItemType || 'part',
                partReminderEnabled: true,
                partReminderId: reminder.id || reminder._id || '',
                partReminderDate: reminderDateTime.date,
                partReminderTime: reminderDateTime.time,
                partReminderDueOdometer: reminder.dueOdometer ?? '',
                partReminderNotes: reminder.notes || '',
                partReminderTimezone: reminder.timezone || DEFAULT_TIMEZONE,
              });
            });

          return next;
        });

        return reminders;
      } catch (error) {
        if (reminderLoadTokenRef.current !== loadToken) return [];
        toast.addToast(error.response?.data?.message || 'Unable to load reminders for this service.', 'error');
        setServiceReminders([]);
        return [];
      } finally {
        if (reminderLoadTokenRef.current === loadToken) {
          setRemindersLoading(false);
        }
      }
    },
    [toast]
  );

  const openCreateModal = () => {
    setSelectedService(null);
    setForm(createEmptyServiceForm());
    setServiceReminders([]);
    reminderSnapshotRef.current = {
      fullService: null,
      partsById: new Map(),
      partsByKey: new Map(),
    };
    setScheduleOverrides({
      nextServiceDue: false,
      nextServiceOdometer: false,
    });
    setErrors({});
    setModalMode('create');
  };

  const openEditModal = (service) => {
    const serviceBillItems = buildBillItemsFromService(service);
    const discountAmount = service.pricingSummary?.discountAmount ?? service.totals?.discountAmount ?? '0';
    const gstRate = service.pricingSummary?.gstRate ?? service.taxBreakdown?.gstRate ?? '18';
    const serviceBillingSnapshot = buildBillingSnapshot(
      serviceBillItems,
      discountAmount,
      gstRate,
      service.pricingSummary?.currency || service.currency || 'INR'
    );

    setSelectedService(service);
    setForm({
      serviceType: service.serviceType || '',
      serviceDate: formatDateInput(service.serviceDate || service.createdAt),
      serviceOdometer: service.serviceOdometer ?? '',
      description: service.description || '',
      nextServiceDue: formatDateInput(service.nextServiceDue),
      nextServiceOdometer: service.nextServiceOdometer ?? '',
      billItems: serviceBillItems,
      reminderOnlyParts: [],
      fullServiceReminderEnabled: false,
      fullServiceReminderId: '',
      fullServiceReminderDate: '',
      fullServiceReminderTime: '',
      fullServiceReminderDueOdometer: '',
      fullServiceReminderNotes: '',
      fullServiceReminderTimezone: DEFAULT_TIMEZONE,
      discountAmount,
      gstRate,
      pricingSummary: service.pricingSummary || serviceBillingSnapshot.pricingSummary,
      taxBreakdown: service.taxBreakdown || serviceBillingSnapshot.taxBreakdown,
    });
    void loadServiceReminders(service._id || service.id);
    setScheduleOverrides({
      nextServiceDue: false,
      nextServiceOdometer: false,
    });
    setErrors({});
    setModalMode('edit');
  };

  const closeModal = (force = false) => {
    if (saving && !force) return;
    reminderLoadTokenRef.current += 1;
    setModalMode(null);
    setSelectedService(null);
    setServiceReminders([]);
    reminderSnapshotRef.current = {
      fullService: null,
      partsById: new Map(),
      partsByKey: new Map(),
    };
    setRemindersLoading(false);
    setScheduleOverrides({
      nextServiceDue: false,
      nextServiceOdometer: false,
    });
    setErrors({});
  };

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;
    setForm((current) => {
      const next = { ...current, [name]: nextValue };

      if (name === 'serviceType' || name === 'serviceDate' || name === 'serviceOdometer') {
        const suggestion = buildSuggestedSchedule(next);
        if (suggestion) {
          if (!scheduleOverrides.nextServiceDue) {
            next.nextServiceDue = suggestion.nextServiceDue;
          }
          if (!scheduleOverrides.nextServiceOdometer) {
            next.nextServiceOdometer = String(suggestion.nextServiceOdometer);
          }
        }
      }

      if (['serviceType', 'serviceDate', 'serviceOdometer', 'discountAmount', 'gstRate'].includes(name)) {
        const billingState = buildBillingSnapshot(next.billItems, next.discountAmount, next.gstRate, next.pricingSummary?.currency || 'INR');
        next.pricingSummary = billingState.pricingSummary;
        next.taxBreakdown = billingState.taxBreakdown;
      }

      return next;
    });

    if (name === 'nextServiceDue') {
      setScheduleOverrides((current) => ({
        ...current,
        nextServiceDue: nextValue !== '',
      }));
    }

    if (name === 'nextServiceOdometer') {
      setScheduleOverrides((current) => ({
        ...current,
        nextServiceOdometer: nextValue !== '',
      }));
    }

    setErrors((current) => ({ ...current, [name]: '' }));
  };

  const updateBillItemField = (index, field, value) => {
    setForm((current) => {
      const nextBillItems = current.billItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      );
      const billingState = buildBillingSnapshot(nextBillItems, current.discountAmount, current.gstRate, current.pricingSummary?.currency || 'INR');
      return {
        ...current,
        billItems: nextBillItems,
        pricingSummary: billingState.pricingSummary,
        taxBreakdown: billingState.taxBreakdown,
      };
    });
    setErrors((current) => ({ ...current, [`billItems.${index}.${field}`]: '' }));
  };

  const addReminderOnlyPart = () => {
    setForm((current) => ({
      ...current,
      reminderOnlyParts: [...(current.reminderOnlyParts || []), createReminderOnlyPart()],
    }));
  };

  const updateReminderOnlyPartField = (index, field, value) => {
    setForm((current) => {
      const nextReminderOnlyParts = (current.reminderOnlyParts || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      );
      return {
        ...current,
        reminderOnlyParts: nextReminderOnlyParts,
      };
    });
    setErrors((current) => ({ ...current, [`reminderOnlyParts.${index}.${field}`]: '' }));
  };

  const removeReminderOnlyPart = (index) => {
    setForm((current) => {
      const nextReminderOnlyParts = (current.reminderOnlyParts || []).filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        reminderOnlyParts: nextReminderOnlyParts,
      };
    });
  };

  const buildReminderPayload = (base, overrides = {}) => {
    const dateTime = combineDateAndTime(base.date, base.time, base.timezone || DEFAULT_TIMEZONE);
    if (!dateTime) return null;

    return {
      remindAt: dateTime.remindAt,
      timezone: dateTime.timezone,
      dueOdometer: base.dueOdometer !== '' && base.dueOdometer !== null && base.dueOdometer !== undefined
        ? Number(base.dueOdometer)
        : undefined,
      title: base.title?.trim() || undefined,
      notes: base.notes?.trim() || undefined,
      channel: base.channel || { inApp: true, email: false, push: false },
      ...overrides,
    };
  };

  const buildFullServiceReminderPayload = (serviceRecord) => {
    if (!form.fullServiceReminderEnabled) return null;
    if (!serviceRecord?.id && !serviceRecord?._id) return null;

    return buildReminderPayload({
      date: form.fullServiceReminderDate,
      time: form.fullServiceReminderTime,
      timezone: form.fullServiceReminderTimezone || DEFAULT_TIMEZONE,
      dueOdometer: form.fullServiceReminderDueOdometer,
      notes: form.fullServiceReminderNotes,
      title: form.fullServiceReminderNotes?.trim() ? 'Full service reminder' : 'Full service reminder',
    }, {
      reminderType: 'FULL_SERVICE',
      serviceId: serviceRecord.id || serviceRecord._id,
      vehicleId: serviceRecord.vehicle?.id || serviceRecord.vehicle?._id || serviceRecord.vehicleId || vehicleId,
      customerId: serviceRecord.customer?.id || serviceRecord.vehicle?.customer?.id || serviceRecord.customerId,
    });
  };

  const buildReminderSyncPayload = (existingReminder, reminderPayload) => {
    if (!existingReminder) return reminderPayload;

    const snapshot = existingReminder.reminderType === 'FULL_SERVICE'
      ? reminderSnapshotRef.current.fullService
      : existingReminder.id
        ? reminderSnapshotRef.current.partsById.get(existingReminder.id)
        : null;

    return buildManualOverrideUpdate(existingReminder, reminderPayload, snapshot);
  };

  const buildPartReminderPayload = (item, serviceRecord) => {
    if (!item?.partReminderEnabled) return null;
    const name = String(item.name || '').trim();
    if (!name) return { error: 'Part reminder item name is required.' };

    const payload = buildReminderPayload({
      date: item.partReminderDate,
      time: item.partReminderTime,
      timezone: item.partReminderTimezone || DEFAULT_TIMEZONE,
      dueOdometer: item.partReminderDueOdometer,
      notes: item.partReminderNotes,
      title: `${name} reminder`,
    }, {
      reminderType: 'PART',
      serviceId: serviceRecord.id || serviceRecord._id,
      vehicleId: serviceRecord.vehicle?.id || serviceRecord.vehicle?._id || serviceRecord.vehicleId || vehicleId,
      customerId: serviceRecord.customer?.id || serviceRecord.vehicle?.customer?.id || serviceRecord.customerId,
      serviceItemKey: item.serviceItemKey,
      sourceItemName: name,
      sourceItemType: item.itemType || 'part',
      sourceItemSnapshot: {
        name,
        itemType: item.itemType || 'part',
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        lineTotal: Number(item.quantity || 1) * Number(item.unitPrice || 0),
        isBillable: Boolean(item.isBillable ?? true),
      },
    });

    if (!payload) return { error: `Reminder date and time are required for ${name}.` };
    return payload;
  };

  const addBillItem = () => {
    setForm((current) => {
      const nextBillItems = [createBillItem(), ...current.billItems];
      const billingState = buildBillingSnapshot(nextBillItems, current.discountAmount, current.gstRate, current.pricingSummary?.currency || 'INR');
      return {
        ...current,
        billItems: nextBillItems,
        pricingSummary: billingState.pricingSummary,
        taxBreakdown: billingState.taxBreakdown,
      };
    });
  };

  const removeBillItem = (index) => {
    setForm((current) => {
      const nextBillItems = current.billItems.filter((_, itemIndex) => itemIndex !== index);
      const normalizedBillItems = nextBillItems.length > 0 ? nextBillItems : [createBillItem()];
      const billingState = buildBillingSnapshot(normalizedBillItems, current.discountAmount, current.gstRate, current.pricingSummary?.currency || 'INR');
      return {
        ...current,
        billItems: normalizedBillItems,
        pricingSummary: billingState.pricingSummary,
        taxBreakdown: billingState.taxBreakdown,
      };
    });
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!form.serviceType.trim() || form.serviceType.trim().length < 2) nextErrors.serviceType = 'Service type must be at least 2 characters.';
    if (form.serviceOdometer !== '' && Number(form.serviceOdometer) < 0) nextErrors.serviceOdometer = 'Odometer reading cannot be negative.';
    if (form.nextServiceOdometer !== '' && Number(form.nextServiceOdometer) < 0) nextErrors.nextServiceOdometer = 'Next service odometer cannot be negative.';
    if (form.discountAmount !== '' && Number(form.discountAmount) < 0) nextErrors.discountAmount = 'Discount cannot be negative.';
    if (form.gstRate !== '' && Number(form.gstRate) < 0) nextErrors.gstRate = 'GST cannot be negative.';

    if (form.fullServiceReminderEnabled) {
      if (!form.fullServiceReminderDate) nextErrors.fullServiceReminderDate = 'Reminder date is required.';
      if (!form.fullServiceReminderTime) nextErrors.fullServiceReminderTime = 'Reminder time is required.';
      if (form.fullServiceReminderDueOdometer !== '' && Number(form.fullServiceReminderDueOdometer) < 0) {
        nextErrors.fullServiceReminderDueOdometer = 'Reminder odometer cannot be negative.';
      }
    }

    form.billItems.forEach((item, index) => {
      if (!String(item.name || '').trim()) {
        nextErrors[`billItems.${index}.name`] = 'Item name is required.';
      }
      if (Number(item.quantity) < 1) {
        nextErrors[`billItems.${index}.quantity`] = 'Quantity must be at least 1.';
      }
      if (Number(item.unitPrice) < 0) {
        nextErrors[`billItems.${index}.unitPrice`] = 'Unit price cannot be negative.';
      }
      if (item.partReminderEnabled) {
        if (!String(item.name || '').trim()) {
          nextErrors[`billItems.${index}.partReminderName`] = 'Item name is required for reminders.';
        }
        if (!item.partReminderDate) {
          nextErrors[`billItems.${index}.partReminderDate`] = 'Reminder date is required.';
        }
        if (!item.partReminderTime) {
          nextErrors[`billItems.${index}.partReminderTime`] = 'Reminder time is required.';
        }
        if (item.partReminderDueOdometer !== '' && Number(item.partReminderDueOdometer) < 0) {
          nextErrors[`billItems.${index}.partReminderDueOdometer`] = 'Reminder odometer cannot be negative.';
        }
      }
    });

    (form.reminderOnlyParts || []).forEach((item, index) => {
      if (!String(item.name || '').trim()) {
        nextErrors[`reminderOnlyParts.${index}.name`] = 'Part name is required.';
      }
      if (item.partReminderEnabled) {
        if (!item.partReminderDate) {
          nextErrors[`reminderOnlyParts.${index}.partReminderDate`] = 'Reminder date is required.';
        }
        if (!item.partReminderTime) {
          nextErrors[`reminderOnlyParts.${index}.partReminderTime`] = 'Reminder time is required.';
        }
        if (item.partReminderDueOdometer !== '' && Number(item.partReminderDueOdometer) < 0) {
          nextErrors[`reminderOnlyParts.${index}.partReminderDueOdometer`] = 'Reminder odometer cannot be negative.';
        }
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;
    if (modalMode === 'edit' && remindersLoading) {
      toast.addToast('Please wait for reminders to finish loading before saving.', 'warning');
      return;
    }

    const normalizedBillItems = billingSnapshot.preview.billItems.map((item, index) => ({
      name: String(item.name || '').trim(),
      itemType: item.itemType || 'service',
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      lineTotal: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
      serviceItemKey: form.billItems[index]?.serviceItemKey || createServiceItemKey(vehicleId, item, index),
    }));

    const payload = {
      vehicleId,
      serviceType: form.serviceType.trim(),
      serviceDate: form.serviceDate || undefined,
      serviceOdometer: form.serviceOdometer !== '' ? Number(form.serviceOdometer) : undefined,
      description: form.description.trim() || undefined,
      nextServiceDue: form.nextServiceDue || undefined,
      nextServiceOdometer: form.nextServiceOdometer !== '' ? Number(form.nextServiceOdometer) : undefined,
      billItems: normalizedBillItems,
      pricingSummary: billingSnapshot.pricingSummary,
      taxBreakdown: billingSnapshot.taxBreakdown,
    };

    const syncRemindersForService = async (serviceRecord) => {
      if (!serviceRecord) return { created: 0, updated: 0, cancelled: 0 };

      const activeReminders = (serviceReminders || []).filter((reminder) => reminder.status !== 'CANCELLED');
      const remindersById = new Map(activeReminders.map((reminder) => [reminder.id || reminder._id, reminder]));
      const usedReminderIds = new Set();
      let created = 0;
      let updated = 0;
      let cancelled = 0;

      const upsertReminder = async (existingReminder, reminderPayload) => {
        if (existingReminder?.id || existingReminder?._id) {
          await reminderService.updateReminder(existingReminder.id || existingReminder._id, reminderPayload);
          usedReminderIds.add(existingReminder.id || existingReminder._id);
          updated += 1;
          return;
        }

        await reminderService.createReminder(reminderPayload);
        created += 1;
      };

      const cancelReminder = async (existingReminder, cancelReason) => {
        if (!existingReminder?.id && !existingReminder?._id) return;
        await reminderService.cancelReminder(existingReminder.id || existingReminder._id, { cancelReason });
        usedReminderIds.add(existingReminder.id || existingReminder._id);
        cancelled += 1;
      };

      const buildExistingReminderLookup = (item, rowType) => {
        if (item.partReminderId && remindersById.has(item.partReminderId)) {
          return remindersById.get(item.partReminderId);
        }

        return activeReminders.find((reminder) => {
          const reminderId = reminder.id || reminder._id;
          if (usedReminderIds.has(reminderId)) return false;
          if (reminder.reminderType !== 'PART') return false;
          if (item.serviceItemKey && reminder.serviceItemKey === item.serviceItemKey) return true;
          if (rowType === 'reminder-only') return false;
          if (!item.serviceItemKey) {
            return String(reminder.sourceItemName || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase();
          }
          return false;
        });
      };

      const fullServiceReminder = activeReminders.find(
        (reminder) =>
          reminder.reminderType === 'FULL_SERVICE' &&
          String(reminder.serviceId || '') === String(getServiceRecordId(serviceRecord))
      );
      const fullServicePayload = form.fullServiceReminderEnabled ? buildFullServiceReminderPayload(serviceRecord) : null;

      if (fullServicePayload) {
        const updatePayload = buildReminderSyncPayload(fullServiceReminder, fullServicePayload);
        if (updatePayload) {
          await upsertReminder(fullServiceReminder, updatePayload);
        } else if (!fullServiceReminder) {
          await upsertReminder(null, fullServicePayload);
        } else {
          usedReminderIds.add(fullServiceReminder.id || fullServiceReminder._id);
        }
      } else if (fullServiceReminder) {
        await cancelReminder(fullServiceReminder, 'USER_CANCELLED');
      }

      const combinedRows = [
        ...(form.billItems || []).map((item, index) => ({ rowType: 'bill', item: { ...item, isBillable: true }, index })),
        ...(form.reminderOnlyParts || []).map((item, index) => ({ rowType: 'reminder-only', item: { ...item, isBillable: false }, index })),
      ];

      for (const { rowType, item, index } of combinedRows) {
        const name = String(item.name || '').trim();
        const serviceItemKey = item.serviceItemKey || createServiceItemKey(getServiceRecordId(serviceRecord), item, index);
        const existingReminder = buildExistingReminderLookup(item, rowType);

        if (!item.partReminderEnabled) {
          if (existingReminder) {
            await cancelReminder(existingReminder, 'USER_CANCELLED');
          }
          continue;
        }

        if (!name) {
          throw new Error('Part reminder item name is required.');
        }

        const reminderPayload = buildPartReminderPayload({ ...item, name, serviceItemKey, isBillable: rowType === 'bill' }, serviceRecord);

        if (reminderPayload?.error) {
          throw new Error(reminderPayload.error);
        }

        const updatePayload = buildReminderSyncPayload(existingReminder, reminderPayload);
        if (updatePayload) {
          await upsertReminder(existingReminder, updatePayload);
        } else if (!existingReminder) {
          await upsertReminder(null, reminderPayload);
        } else {
          usedReminderIds.add(existingReminder.id || existingReminder._id);
        }
      }

      const stalePartReminders = activeReminders.filter((reminder) => {
        const reminderId = reminder.id || reminder._id;
        return reminder.reminderType === 'PART' && !usedReminderIds.has(reminderId);
      });

      for (const reminder of stalePartReminders) {
        await cancelReminder(reminder, 'SOURCE_ITEM_REMOVED');
      }

      return { created, updated, cancelled };
    };

    try {
      setSaving(true);
      let savedService;
      const isEditing = modalMode === 'edit' && selectedService;

      if (isEditing) {
        savedService = await serviceService.update(selectedService.id || selectedService._id, payload);
        toast.addToast('Service record updated successfully.', 'success');
      } else {
        savedService = await serviceService.create(payload);
        toast.addToast('Service record added successfully.', 'success');
      }

      const nextService = savedService?.newService || savedService?.service || savedService;

      try {
        const reminderSummary = await syncRemindersForService(nextService);
        if ((reminderSummary.created + reminderSummary.updated + reminderSummary.cancelled) > 0) {
          toast.addToast(
            `Reminder sync complete: ${reminderSummary.created} created, ${reminderSummary.updated} updated, ${reminderSummary.cancelled} cancelled.`,
            'success'
          );
        }
      } catch (reminderError) {
        toast.addToast(reminderError.message || 'Service saved, but reminder sync failed.', 'warning');
      }

      if (!isEditing) {
        setRecentCreatedService(nextService);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(pendingBillStorageKey, JSON.stringify({
            serviceId: getServiceRecordId(nextService),
            service: nextService,
          }));
        }
      }

      saveServiceTypeToHistory(payload.serviceType);
      closeModal(true);
      await loadServices();
    } catch (error) {
      toast.addToast(error.response?.data?.message || error.message || 'Unable to save service record.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service) => {
    const confirmed = window.confirm(`Delete ${service.serviceType || 'this service record'}? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const id = service.id || service._id;
      setDeletingId(id);
      await serviceService.remove(id);
      toast.addToast('Service record deleted successfully.', 'success');
      await loadServices();
    } catch (error) {
      toast.addToast(error.response?.data?.message || 'Unable to delete service record.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredServices = useMemo(() => {
    if (!normalizedSearchTerm) return services;

    return services.filter((service) =>
      getServiceSearchValues(service).some((value) =>
        value.toLowerCase().includes(normalizedSearchTerm)
      )
    );
  }, [services, normalizedSearchTerm]);

  const suggestionItems = useMemo(() => {
    if (!searchTerm.trim()) return [];

    const seen = new Set();
    const matches = [];

    for (const service of services) {
      for (const value of getServiceSearchValues(service)) {
        const normalized = value.trim();
        if (!normalized) continue;
        if (!normalized.toLowerCase().includes(normalizedSearchTerm)) continue;
        if (seen.has(normalized.toLowerCase())) continue;

        seen.add(normalized.toLowerCase());
        matches.push(normalized);
        if (matches.length >= 8) return matches;
      }
    }

    return matches;
  }, [normalizedSearchTerm, searchTerm, services]);

  const matchingHistory = useMemo(() => {
    if (!showSuggestions) return searchHistory;
    if (!searchTerm.trim()) return searchHistory;

    return searchHistory.filter((item) => item.toLowerCase().includes(normalizedSearchTerm));
  }, [normalizedSearchTerm, searchHistory, searchTerm, showSuggestions]);

  const serviceTypeSuggestions = useMemo(() => {
    const currentTerm = form.serviceType.trim().toLowerCase();
    const seen = new Set();
    const matches = [];

    for (const service of services) {
      for (const value of getServiceTypeValues(service)) {
        const normalized = value.trim();
        const lower = normalized.toLowerCase();
        if (!normalized) continue;
        if (currentTerm && !lower.includes(currentTerm)) continue;
        if (seen.has(lower)) continue;

        seen.add(lower);
        matches.push(normalized);
        if (matches.length >= 8) return matches;
      }
    }

    return matches;
  }, [form.serviceType, services]);

  const matchingServiceTypeHistory = useMemo(() => {
    const currentTerm = form.serviceType.trim().toLowerCase();
    if (!showServiceTypeSuggestions) return serviceTypeHistory;
    if (!currentTerm) return serviceTypeHistory;

    return serviceTypeHistory.filter((item) => item.toLowerCase().includes(currentTerm));
  }, [form.serviceType, serviceTypeHistory, showServiceTypeSuggestions]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setShowSuggestions(true);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const term = searchTerm.trim();
    if (!term) {
      setShowSuggestions(false);
      return;
    }

    saveSearchTermToHistory(term);
    closeSearchSuggestions();
  };

  const handleSuggestionSelect = (value) => {
    setSearchTerm(value);
    closeSearchSuggestions();
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    closeSearchSuggestions();
  };

  const handleGenerateBill = async (serviceRecord = recentCreatedService) => {
    const storedPending = getStoredJson(pendingBillStorageKey);
    const serviceId =
      getServiceRecordId(serviceRecord) ||
      storedPending?.serviceId ||
      getServiceRecordId(storedPending?.service) ||
      getStoredString(pendingBillStorageKey);

    if (!serviceId) {
      toast.addToast('No saved service record was found to generate a bill.', 'warning');
      return;
    }

    try {
      setBillGeneratingServiceId(serviceId);
      const bill = await billingService.generateFromService(serviceId);
      toast.addToast('Bill generated successfully.', 'success');
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(pendingBillStorageKey);
      }
      setRecentCreatedService(null);
      navigate(`/bills/${bill.id || bill._id}/preview`);
    } catch (error) {
      toast.addToast(error.response?.data?.message || 'Unable to generate bill.', 'error');
    } finally {
      setBillGeneratingServiceId(null);
    }
  };

  const handleViewBill = async (serviceRecord) => {
    const serviceId = getServiceRecordId(serviceRecord);
    if (!serviceId) {
      toast.addToast('No service record was found for this bill.', 'warning');
      return;
    }

    try {
      setBillGeneratingServiceId(serviceId);
      try {
        const existingBill = await billingService.getByService(serviceId);
        if (existingBill?.id || existingBill?._id) {
          navigate(`/bills/${existingBill.id || existingBill._id}/preview`);
          return;
        }
      } catch (lookupError) {
        if (lookupError.response?.status !== 404) {
          throw lookupError;
        }
      }

      const generatedBill = await billingService.generateFromService(serviceId);
      toast.addToast('Bill generated successfully.', 'success');
      navigate(`/bills/${generatedBill.id || generatedBill._id}/preview`);
    } catch (error) {
      toast.addToast(error.response?.data?.message || 'Unable to open bill.', 'error');
    } finally {
      setBillGeneratingServiceId(null);
    }
  };

  const handleServiceTypeSelect = (value) => {
    setForm((current) => {
      const next = { ...current, serviceType: value };
      const suggestion = buildSuggestedSchedule(next);
      if (suggestion) {
        if (!scheduleOverrides.nextServiceDue) {
          next.nextServiceDue = suggestion.nextServiceDue;
        }
        if (!scheduleOverrides.nextServiceOdometer) {
          next.nextServiceOdometer = String(suggestion.nextServiceOdometer);
        }
      }
      return next;
    });
    setErrors((current) => ({ ...current, serviceType: '' }));
    closeServiceTypeSuggestions();
  };

  const applySuggestedSchedule = () => {
    if (!suggestedSchedule) return;

    setForm((current) => ({
      ...current,
      nextServiceDue: suggestedSchedule.nextServiceDue,
      nextServiceOdometer: String(suggestedSchedule.nextServiceOdometer),
    }));

    setScheduleOverrides({
      nextServiceDue: false,
      nextServiceOdometer: false,
    });
  };

  const columns = [
    {
      key: 'title',
      label: 'Service',
      render: (service) => (
        <div>
          <strong>{service.serviceType || service.title || 'Service record'}</strong>
          <p className="ui-card__description">{service.description || 'No service description available.'}</p>
        </div>
      ),
    },
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (service) => (
        service.vehicle?.registrationNumber ? (
          <VehiclePlate value={service.vehicle.registrationNumber} plateColor={service.vehicle.plateColor} />
        ) : (
          '-'
        )
      ),
    },
    {
      key: 'serviceOdometer',
      label: 'Odometer',
      render: (service) => (
        service.serviceOdometer !== undefined && service.serviceOdometer !== null
          ? `${formatOdometerValue(service.serviceOdometer)} km`
          : '-'
      ),
    },
    { key: 'date', label: 'Date', render: (service) => formatDateIST(service.serviceDate || service.createdAt) },
    {
      key: 'nextService',
      label: 'Next service',
      render: (service) => {
        const nextParts = [];
        if (service.nextServiceOdometer !== undefined && service.nextServiceOdometer !== null) {
          nextParts.push(`${formatOdometerValue(service.nextServiceOdometer)} km`);
        }
        if (service.nextServiceDue) {
          nextParts.push(formatDateIST(service.nextServiceDue));
        }

        return nextParts.length > 0 ? <div>{nextParts.join(' | ')}</div> : '-';
      },
    },
    {
      key: 'billTotal',
      label: 'Bill total',
      render: (service) => {
        const total = service.pricingSummary?.grandTotal ?? service.totals?.grandTotal ?? service.cost;
        return total !== undefined && total !== null ? `${formatMoneyValue(total)}` : '-';
      },
    },
    { key: 'status', label: 'Status', render: (service) => <Badge tone={service.isActive === false ? 'destructive' : 'primary'}>{service.isActive === false ? 'Inactive' : 'Recorded'}</Badge> },
    { key: 'lastUpdated', label: 'Last Updated', render: (service) => formatDateTimeIST(getLatestTimestamp(service)) },
    {
      key: 'actions',
      label: 'Actions',
      render: (service) => (
        <div className="row-actions">
          <Button
            size="sm"
            variant="outline"
            icon="bi-receipt"
            loading={billGeneratingServiceId === getServiceRecordId(service)}
            onClick={() => handleViewBill(service)}
          >
            Bill
          </Button>
          <Button size="sm" variant="ghost" icon="bi-pencil" onClick={() => openEditModal(service)}>
            Edit
          </Button>
          {/*
          <Button size="sm" variant="destructive" icon="bi-trash" loading={deletingId === (service.id || service._id)} onClick={() => handleDelete(service)}>
            Delete
          </Button>
          */}
        </div>
      ),
    },
  ];

  const toolbar = (
    <form className="form-grid span-12" onSubmit={handleSearchSubmit}>
      <div className="form-field form-field--full" ref={searchBoxRef} style={{ position: 'relative' }}>
        <label htmlFor="service-search" className="form-field__label">
          Search records
        </label>
        <div className="form-field__control-shell">
          <input
            id="service-search"
            name="service-search"
            type="search"
            className="form-field__control"
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={() => {
              closeServiceTypeSuggestions();
              setShowSuggestions(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                closeSearchSuggestions();
              }
            }}
            placeholder="Search by service type, description, customer, or plate"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            autoComplete="off"
          />
        </div>
        {showSuggestions && (suggestionItems.length > 0 || searchHistory.length > 0) && (
          <div style={suggestionPanelStyle} role="listbox" aria-label="Service search suggestions">
            {suggestionItems.length > 0 && (
              <div style={suggestionSectionStyle}>
                <div style={suggestionHeadingStyle}>
                  Suggestions
                </div>
                <div style={{ display: 'grid' }}>
                  {suggestionItems.map((item) => (
                    <button
                      key={`suggestion-${item}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSuggestionSelect(item)}
                      className="btn btn-link"
                      role="option"
                      style={suggestionItemStyle}
                    >
                      <i className="bi bi-search" style={{ flexShrink: 0, color: 'var(--ui-accent, #0d6efd)' }} />
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {matchingHistory.length > 0 && (
              <div style={{ ...suggestionSectionStyle, ...(suggestionItems.length > 0 ? suggestionDividerStyle : {}) }}>
                <div style={suggestionHeadingStyle}>
                  Recent searches
                </div>
                <div style={{ display: 'grid' }}>
                  {matchingHistory.map((item) => (
                    <button
                      key={`history-${item}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSuggestionSelect(item)}
                      className="btn btn-link"
                      role="option"
                      style={suggestionItemStyle}
                    >
                      <i className="bi bi-clock-history" style={{ flexShrink: 0, color: 'var(--ui-accent, #0d6efd)' }} />
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="form-actions form-field--full">
        <Button type="submit" icon="bi-search" loading={loading}>
          Search
        </Button>
        <Button type="button" variant="outline" onClick={handleClearSearch}>
          Clear
        </Button>
      </div>
    </form>
  );

  return (
    <Page>
      <PageHeader
        title="Service History"
        description="Create, update, and track completed service work for the selected vehicle."
        actions={
          <>
            <Button variant="outline" icon="bi-arrow-left" onClick={() => navigate(-1)}>Back</Button>
            <Button icon="bi-plus-lg" onClick={openCreateModal}>Add service</Button>
          </>
        }
      />
      {recentCreatedService && (
        <div
          className="ui-card"
          style={{
            marginBottom: '1rem',
            border: '1px solid rgba(59, 130, 246, 0.18)',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(255, 255, 255, 0.96))',
          }}
        >
          <div className="ui-card__body" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>Service saved successfully</p>
              <p className="ui-card__description" style={{ margin: '0.25rem 0 0' }}>
                Generate a bill for {recentCreatedService.serviceType || 'this service'} and continue to the invoice preview.
              </p>
            </div>
            <div className="row-actions">
              <Button
                icon="bi-receipt"
                type="button"
                loading={billGeneratingServiceId === getServiceRecordId(recentCreatedService)}
                onClick={() => handleGenerateBill(recentCreatedService)}
              >
                Generate Bill
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRecentCreatedService(null);
                  if (typeof window !== 'undefined') {
                    window.sessionStorage.removeItem(pendingBillStorageKey);
                  }
                }}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
      {loading ? (
        <LoadingState title="Loading service history" />
      ) : (
        <DataTable
          columns={columns}
          data={filteredServices}
          rowKey="id"
          toolbar={toolbar}
          emptyTitle={searchTerm.trim() ? 'No matching service records found' : 'No service records found'}
          emptyDescription={searchTerm.trim() ? 'Try another keyword, use a recent search, or clear the search box.' : 'No service records were found for this vehicle.'}
        />
      )}

      <Modal
        open={Boolean(modalMode)}
        title={modalMode === 'edit' ? 'Edit service record' : 'Add service record'}
        onClose={closeModal}
        disableClose={saving}
        footer={
          <>
            <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button type="submit" form="service-form" loading={saving} disabled={saving}>{modalMode === 'edit' ? 'Save changes' : 'Create service'}</Button>
          </>
        }
      >
        <form id="service-form" className="form-grid" onSubmit={handleSubmit}>
          <div className="form-field form-field--full" ref={serviceTypeBoxRef} style={{ position: 'relative' }}>
            <FormField
              className="form-field--full"
              label="Service type"
              name="serviceType"
              value={form.serviceType}
              onChange={(event) => {
                updateField(event);
                setShowServiceTypeSuggestions(true);
              }}
              onFocus={() => {
                closeSearchSuggestions();
                setShowServiceTypeSuggestions(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  closeServiceTypeSuggestions();
                }
              }}
              error={errors.serviceType}
              placeholder="Oil change"
              required
              disabled={saving}
              autoComplete="off"
            />

            {showServiceTypeSuggestions && (serviceTypeSuggestions.length > 0 || serviceTypeHistory.length > 0) && (
              <div style={suggestionPanelStyle} role="listbox" aria-label="Service type suggestions">
                {serviceTypeSuggestions.length > 0 && (
                  <div style={suggestionSectionStyle}>
                    <div style={suggestionHeadingStyle}>
                      Suggestions
                    </div>
                    <div style={{ display: 'grid' }}>
                      {serviceTypeSuggestions.map((item) => (
                        <button
                          key={`service-type-suggestion-${item}`}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleServiceTypeSelect(item)}
                          className="btn btn-link"
                          role="option"
                          style={suggestionItemStyle}
                        >
                          <i className="bi bi-search" style={{ flexShrink: 0, color: 'var(--ui-accent, #0d6efd)' }} />
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {matchingServiceTypeHistory.length > 0 && (
                  <div
                    style={{
                      ...suggestionSectionStyle,
                      ...(serviceTypeSuggestions.length > 0 ? suggestionDividerStyle : {}),
                    }}
                  >
                    <div style={suggestionHeadingStyle}>
                      Recent service types
                    </div>
                    <div style={{ display: 'grid' }}>
                      {matchingServiceTypeHistory.map((item) => (
                        <button
                          key={`service-type-history-${item}`}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleServiceTypeSelect(item)}
                          className="btn btn-link"
                          role="option"
                          style={suggestionItemStyle}
                        >
                          <i className="bi bi-clock-history" style={{ flexShrink: 0, color: 'var(--ui-accent, #0d6efd)' }} />
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <FormField label="Service date" name="serviceDate" type="date" value={form.serviceDate} onChange={updateField} disabled={saving} />
          <FormField
            label="Current odometer reading"
            name="serviceOdometer"
            type="number"
            min="0"
            step="1"
            value={form.serviceOdometer}
            onChange={updateField}
            error={errors.serviceOdometer}
            placeholder="125000"
            disabled={saving}
          />
          {suggestedSchedule && (
            <div
              className="ui-card"
              style={{
                gridColumn: '1 / -1',
                border: '1px solid rgba(59, 130, 246, 0.18)',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(255, 255, 255, 0.98))',
              }}
            >
              <div className="ui-card__body" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>Suggested next service</p>
                  <p className="ui-card__description" style={{ margin: '0.25rem 0 0' }}>
                    Based on this {suggestedSchedule.intervalLabel}, we suggest {formatOdometerValue(suggestedSchedule.nextServiceOdometer)} km and {formatDateIST(suggestedSchedule.nextServiceDue)}.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={applySuggestedSchedule}>
                  Use suggestion
                </Button>
              </div>
            </div>
          )}
          <FormField
            label="Next service odometer"
            name="nextServiceOdometer"
            type="number"
            min="0"
            step="1"
            value={form.nextServiceOdometer}
            onChange={updateField}
            error={errors.nextServiceOdometer}
            placeholder="130000"
            disabled={saving}
          />
          <div className="form-field form-field--full">
            <div className="form-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="form-field__label" style={{ marginBottom: 0 }}>Bill items</span>
                <p className="ui-card__description" style={{ margin: '0.25rem 0 0' }}>
                  Add parts, labour, service, or accessory lines for this invoice.
                </p>
              </div>
              <Button type="button" variant="outline" icon="bi-plus-lg" onClick={addBillItem} disabled={saving}>
                Add item
              </Button>
            </div>

            <div style={{ display: 'grid', gap: '0.85rem', marginTop: '1rem' }}>
              {form.billItems.map((item, index) => {
                const lineTotal = Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0);

                return (
                  <div
                    key={item.id || index}
                    className="ui-card"
                    style={{
                      border: '1px solid rgba(148, 163, 184, 0.18)',
                      background: 'rgba(255, 255, 255, 0.82)',
                    }}
                  >
                    <div
                      className="ui-card__body"
                      style={{
                        display: 'grid',
                        gap: '0.85rem',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        alignItems: 'end',
                      }}
                    >
                      <FormField
                        label="Item name"
                        name={`billItems.${index}.name`}
                        value={item.name}
                        onChange={(event) => updateBillItemField(index, 'name', event.target.value)}
                        error={errors[`billItems.${index}.name`]}
                        placeholder="Brake pads"
                        disabled={saving}
                      />
                      <label className="form-field">
                        <span className="form-field__label">Item type</span>
                        <select
                          className="form-field__control"
                          value={item.itemType}
                          onChange={(event) => updateBillItemField(index, 'itemType', event.target.value)}
                          disabled={saving}
                        >
                          {BILL_ITEM_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                      </label>
                      <FormField
                        label="Quantity"
                        name={`billItems.${index}.quantity`}
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) => updateBillItemField(index, 'quantity', event.target.value)}
                        error={errors[`billItems.${index}.quantity`]}
                        disabled={saving}
                      />
                      <FormField
                        label="Unit price"
                        name={`billItems.${index}.unitPrice`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) => updateBillItemField(index, 'unitPrice', event.target.value)}
                        error={errors[`billItems.${index}.unitPrice`]}
                        disabled={saving}
                      />
                      <div className="form-field">
                        <span className="form-field__label">Line total</span>
                        <div className="form-field__control-shell" style={{ minHeight: '44px', display: 'flex', alignItems: 'center' }}>
                          <strong>{formatMoneyValue(lineTotal)}</strong>
                        </div>
                      </div>
                      <div className="form-field form-field--full">
                        <label className="form-field__label" htmlFor={`billItems.${index}.partReminderEnabled`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            id={`billItems.${index}.partReminderEnabled`}
                            name={`billItems.${index}.partReminderEnabled`}
                            type="checkbox"
                            checked={Boolean(item.partReminderEnabled)}
                            onChange={(event) => updateBillItemField(index, 'partReminderEnabled', event.target.checked)}
                            disabled={saving}
                          />
                          Add part reminder for this item
                        </label>
                        {item.partReminderEnabled && (
                          <div style={{ display: 'grid', gap: '0.85rem', marginTop: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                            <FormField
                              label="Reminder date"
                              name={`billItems.${index}.partReminderDate`}
                              type="date"
                              value={item.partReminderDate}
                              onChange={(event) => updateBillItemField(index, 'partReminderDate', event.target.value)}
                              error={errors[`billItems.${index}.partReminderDate`]}
                              disabled={saving}
                            />
                            <FormField
                              label="Reminder time"
                              name={`billItems.${index}.partReminderTime`}
                              type="time"
                              value={item.partReminderTime}
                              onChange={(event) => updateBillItemField(index, 'partReminderTime', event.target.value)}
                              error={errors[`billItems.${index}.partReminderTime`]}
                              disabled={saving}
                            />
                            <FormField
                              label="Due odometer"
                              name={`billItems.${index}.partReminderDueOdometer`}
                              type="number"
                              min="0"
                              step="1"
                              value={item.partReminderDueOdometer}
                              onChange={(event) => updateBillItemField(index, 'partReminderDueOdometer', event.target.value)}
                              error={errors[`billItems.${index}.partReminderDueOdometer`]}
                              disabled={saving}
                            />
                            <FormField
                              className="form-field--full"
                              as="textarea"
                              rows={3}
                              label="Reminder notes"
                              name={`billItems.${index}.partReminderNotes`}
                              value={item.partReminderNotes}
                              onChange={(event) => updateBillItemField(index, 'partReminderNotes', event.target.value)}
                              error={errors[`billItems.${index}.partReminderNotes`]}
                              placeholder="Optional reminder notes"
                              disabled={saving}
                            />
                          </div>
                        )}
                      </div>
                      <div className="form-actions">
                        <Button
                          type="button"
                          variant="ghost"
                          icon="bi-trash"
                          onClick={() => removeBillItem(index)}
                          disabled={saving || form.billItems.length === 1}
                        >
                          Remove Item
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="ui-card"
              style={{
                marginTop: '1rem',
                border: '1px solid rgba(16, 185, 129, 0.18)',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(255, 255, 255, 0.98))',
              }}
            >
              <div className="ui-card__body" style={{ display: 'grid', gap: '0.85rem' }}>
                <div className="form-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="form-field__label" style={{ marginBottom: 0 }}>Reminder-only parts</span>
                    <p className="ui-card__description" style={{ margin: '0.25rem 0 0' }}>
                      Add reminder-only parts here. These do not affect the bill total.
                    </p>
                  </div>
                  <Button type="button" variant="outline" icon="bi-plus-lg" onClick={addReminderOnlyPart} disabled={saving}>
                    Add reminder-only part
                  </Button>
                </div>

                {remindersLoading && (
                  <p className="form-field__helper" style={{ margin: 0 }}>
                    Loading existing reminders...
                  </p>
                )}

                {(form.reminderOnlyParts || []).length === 0 ? (
                  <p className="ui-card__description" style={{ margin: 0 }}>
                    No reminder-only parts added yet.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: '0.85rem' }}>
                    {form.reminderOnlyParts.map((item, index) => (
                      <div
                        key={item.id || item.serviceItemKey || index}
                        className="ui-card"
                        style={{
                          border: '1px solid rgba(148, 163, 184, 0.18)',
                          background: 'rgba(255, 255, 255, 0.82)',
                        }}
                      >
                        <div className="ui-card__body" style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                          <FormField
                            className="form-field--full"
                            label="Part name"
                            name={`reminderOnlyParts.${index}.name`}
                            value={item.name}
                            onChange={(event) => updateReminderOnlyPartField(index, 'name', event.target.value)}
                            error={errors[`reminderOnlyParts.${index}.name`]}
                            placeholder="Brake pads"
                            disabled={saving}
                          />
                          <div className="form-field form-field--full">
                            <label className="form-field__label" htmlFor={`reminderOnlyParts.${index}.partReminderEnabled`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input
                                id={`reminderOnlyParts.${index}.partReminderEnabled`}
                                name={`reminderOnlyParts.${index}.partReminderEnabled`}
                                type="checkbox"
                                checked={Boolean(item.partReminderEnabled)}
                                onChange={(event) => updateReminderOnlyPartField(index, 'partReminderEnabled', event.target.checked)}
                                disabled={saving}
                              />
                              Enable reminder
                            </label>
                          </div>
                          {item.partReminderEnabled && (
                            <>
                              <FormField
                                label="Reminder date"
                                name={`reminderOnlyParts.${index}.partReminderDate`}
                                type="date"
                                value={item.partReminderDate}
                                onChange={(event) => updateReminderOnlyPartField(index, 'partReminderDate', event.target.value)}
                                error={errors[`reminderOnlyParts.${index}.partReminderDate`]}
                                disabled={saving}
                              />
                              <FormField
                                label="Reminder time"
                                name={`reminderOnlyParts.${index}.partReminderTime`}
                                type="time"
                                value={item.partReminderTime}
                                onChange={(event) => updateReminderOnlyPartField(index, 'partReminderTime', event.target.value)}
                                error={errors[`reminderOnlyParts.${index}.partReminderTime`]}
                                disabled={saving}
                              />
                              <FormField
                                label="Due odometer"
                                name={`reminderOnlyParts.${index}.partReminderDueOdometer`}
                                type="number"
                                min="0"
                                step="1"
                                value={item.partReminderDueOdometer}
                                onChange={(event) => updateReminderOnlyPartField(index, 'partReminderDueOdometer', event.target.value)}
                                error={errors[`reminderOnlyParts.${index}.partReminderDueOdometer`]}
                                disabled={saving}
                              />
                              <FormField
                                className="form-field--full"
                                as="textarea"
                                rows={3}
                                label="Reminder notes"
                                name={`reminderOnlyParts.${index}.partReminderNotes`}
                                value={item.partReminderNotes}
                                onChange={(event) => updateReminderOnlyPartField(index, 'partReminderNotes', event.target.value)}
                                error={errors[`reminderOnlyParts.${index}.partReminderNotes`]}
                                placeholder="Optional reminder notes"
                                disabled={saving}
                              />
                            </>
                          )}
                          <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
                            <Button
                              type="button"
                              variant="ghost"
                              icon="bi-trash"
                              onClick={() => removeReminderOnlyPart(index)}
                              disabled={saving}
                            >
                              Remove part
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div
              className="ui-card"
              style={{
                marginTop: '1rem',
                border: '1px solid rgba(59, 130, 246, 0.18)',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(255, 255, 255, 0.98))',
              }}
            >
              <div className="ui-card__body" style={{ display: 'grid', gap: '0.8rem' }}>
                <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                  <FormField
                    label="Discount"
                    name="discountAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discountAmount}
                    onChange={updateField}
                    error={errors.discountAmount}
                    disabled={saving}
                  />
                  <FormField
                    label="GST (%)"
                    name="gstRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.gstRate}
                    onChange={updateField}
                    error={errors.gstRate}
                    disabled={saving}
                  />
                </div>

                <div style={{ display: 'grid', gap: '0.55rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                  <div className="invoice-panel">
                    <p className="invoice-panel__label">Subtotal</p>
                    <h3 style={{ marginBottom: 0 }}>{formatMoneyValue(billingPreview.subtotal)}</h3>
                  </div>
                  <div className="invoice-panel">
                    <p className="invoice-panel__label">Discount</p>
                    <h3 style={{ marginBottom: 0 }}>{formatMoneyValue(billingPreview.discountAmount)}</h3>
                  </div>
                  <div className="invoice-panel">
                    <p className="invoice-panel__label">GST</p>
                    <h3 style={{ marginBottom: 0 }}>{formatMoneyValue(billingPreview.taxAmount)}</h3>
                  </div>
                  <div className="invoice-panel">
                    <p className="invoice-panel__label">Grand total</p>
                    <h3 style={{ marginBottom: 0 }}>{formatMoneyValue(billingPreview.grandTotal)}</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <FormField label="Next service due" name="nextServiceDue" type="date" value={form.nextServiceDue} onChange={updateField} disabled={saving} />

          <div className="ui-card" style={{ border: '1px solid rgba(59, 130, 246, 0.18)', background: 'rgba(255, 255, 255, 0.92)' }}>
            <div className="ui-card__body" style={{ display: 'grid', gap: '0.85rem' }}>
              <div className="form-field">
                <label className="form-field__label" htmlFor="fullServiceReminderEnabled" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    id="fullServiceReminderEnabled"
                    name="fullServiceReminderEnabled"
                    type="checkbox"
                    checked={form.fullServiceReminderEnabled}
                    onChange={updateField}
                    disabled={saving}
                  />
                  Enable full service reminder
                </label>
                <p className="form-field__helper" style={{ marginTop: '0.25rem' }}>
                  Schedule a reminder for the whole vehicle/service cycle.
                </p>
              </div>

              {form.fullServiceReminderEnabled && (
                <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                  <FormField
                    label="Reminder date"
                    name="fullServiceReminderDate"
                    type="date"
                    value={form.fullServiceReminderDate}
                    onChange={updateField}
                    error={errors.fullServiceReminderDate}
                    disabled={saving}
                  />
                  <FormField
                    label="Reminder time"
                    name="fullServiceReminderTime"
                    type="time"
                    value={form.fullServiceReminderTime}
                    onChange={updateField}
                    error={errors.fullServiceReminderTime}
                    disabled={saving}
                  />
                  <FormField
                    label="Due odometer"
                    name="fullServiceReminderDueOdometer"
                    type="number"
                    min="0"
                    step="1"
                    value={form.fullServiceReminderDueOdometer}
                    onChange={updateField}
                    error={errors.fullServiceReminderDueOdometer}
                    placeholder="130000"
                    disabled={saving}
                  />
                  <FormField
                    className="form-field--full"
                    as="textarea"
                    rows={3}
                    label="Reminder notes"
                    name="fullServiceReminderNotes"
                    value={form.fullServiceReminderNotes}
                    onChange={updateField}
                    error={errors.fullServiceReminderNotes}
                    placeholder="Optional reminder notes"
                    disabled={saving}
                  />
                </div>
              )}
              {remindersLoading && (
                <p className="form-field__helper" style={{ margin: 0 }}>
                  Loading existing reminders...
                </p>
              )}
            </div>
          </div>

          <FormField className="form-field--full" as="textarea" rows={4} label="Description" name="description" value={form.description} onChange={updateField} placeholder="Work completed, parts replaced, notes for next visit" disabled={saving} />
        </form>
      </Modal>
    </Page>
  );
};

export default ServicePage;
