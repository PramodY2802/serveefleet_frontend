import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import serviceService from '../../services/serviceService.js';
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

const DEFAULT_SERVICE_INTERVAL_KM = 5000;
const DEFAULT_SERVICE_INTERVAL_DAYS = 180;
const BILL_ITEM_TYPES = [
  { value: 'part', label: 'Part' },
  { value: 'labour', label: 'Labour' },
  { value: 'service', label: 'Service' },
  { value: 'accessory', label: 'Accessory' },
];

const createBillItem = (overrides = {}) => ({
  id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(16).slice(2)}`),
  name: '',
  itemType: 'service',
  quantity: 1,
  unitPrice: '',
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
    subtotal,
    discountAmount: safeDiscount,
    taxAmount,
    grandTotal,
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
    return existingItems.map((item) =>
      createBillItem({
        id: item.id || item._id || item.id,
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

  return {
    pricingSummary: {
      subtotal: preview.subtotal,
      discountAmount: preview.discountAmount,
      taxAmount: preview.taxAmount,
      grandTotal: preview.grandTotal,
      currency: normalizedCurrency,
      gstRate: Number(gstRate) || 0,
    },
    taxBreakdown: {
      taxableAmount,
      gstRate: Number(gstRate) || 0,
      cgstAmount: Number((preview.taxAmount / 2).toFixed(2)),
      sgstAmount: Number((preview.taxAmount / 2).toFixed(2)),
      igstAmount: 0,
      taxAmount: Number(preview.taxAmount.toFixed(2)),
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
  const [recentCreatedService, setRecentCreatedService] = useState(null);
  const [billGeneratingServiceId, setBillGeneratingServiceId] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();
  const searchBoxRef = useRef(null);
  const serviceTypeBoxRef = useRef(null);

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

  const openCreateModal = () => {
    setSelectedService(null);
    setForm(createEmptyServiceForm());
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
      discountAmount,
      gstRate,
      pricingSummary: service.pricingSummary || serviceBillingSnapshot.pricingSummary,
      taxBreakdown: service.taxBreakdown || serviceBillingSnapshot.taxBreakdown,
    });
    setScheduleOverrides({
      nextServiceDue: false,
      nextServiceOdometer: false,
    });
    setErrors({});
    setModalMode('edit');
  };

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setModalMode(null);
    setSelectedService(null);
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
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    const payload = {
      vehicleId,
      serviceType: form.serviceType.trim(),
      serviceDate: form.serviceDate || undefined,
      serviceOdometer: form.serviceOdometer !== '' ? Number(form.serviceOdometer) : undefined,
      description: form.description.trim() || undefined,
      nextServiceDue: form.nextServiceDue || undefined,
      nextServiceOdometer: form.nextServiceOdometer !== '' ? Number(form.nextServiceOdometer) : undefined,
      billItems: billingSnapshot.preview.billItems.map((item) => ({
        name: String(item.name || '').trim(),
        itemType: item.itemType || 'service',
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        lineTotal: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
      })),
      pricingSummary: billingSnapshot.pricingSummary,
      taxBreakdown: billingSnapshot.taxBreakdown,
    };

    try {
      setSaving(true);
      if (modalMode === 'edit' && selectedService) {
        await serviceService.update(selectedService.id || selectedService._id, payload);
        toast.addToast('Service record updated successfully.', 'success');
      } else {
        const createdService = await serviceService.create(payload);
        toast.addToast('Service record added successfully.', 'success');
        const nextService = createdService?.newService || createdService?.service || createdService;
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
      toast.addToast(error.response?.data?.message || 'Unable to save service record.', 'error');
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

          <FormField className="form-field--full" as="textarea" rows={4} label="Description" name="description" value={form.description} onChange={updateField} placeholder="Work completed, parts replaced, notes for next visit" disabled={saving} />
        </form>
      </Modal>
    </Page>
  );
};

export default ServicePage;
