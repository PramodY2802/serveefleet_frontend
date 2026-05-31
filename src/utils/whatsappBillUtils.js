import { formatDateIST } from './dateUtils.js';

const DEFAULT_SHOP_NAME = 'AutoPulse Garage';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatMoney = (value) => currencyFormatter.format(toNumber(value));

const safeText = (value) => {
  if (value === null || value === undefined) return '-';
  const text = String(value).trim();
  return text || '-';
};

const pickValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '-';
};

const formatQuantity = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : '-';
};

const formatPhone = (value) => {
  const text = String(value ?? '').trim();
  return text || '-';
};

const formatMakeModel = (make, model) => {
  const makeText = safeText(make);
  const modelText = safeText(model);

  if (makeText === '-' && modelText === '-') return '-';
  if (makeText === '-') return modelText;
  if (modelText === '-') return makeText;
  return `${makeText} / ${modelText}`;
};

const resolveShopInfo = (bill = {}) => ({
  name: pickValue(
    bill.shop?.name,
    bill.garage?.name,
    bill.workshop?.name,
    bill.company?.name,
    bill.companyName,
    bill.serviceCenter?.name,
    DEFAULT_SHOP_NAME
  ),
  phone: pickValue(
    bill.shop?.phone,
    bill.shop?.contactNumber,
    bill.garage?.phone,
    bill.garage?.contactNumber,
    bill.workshop?.phone,
    bill.workshop?.contactNumber,
    bill.company?.phone,
    bill.company?.contactNumber,
    bill.contactNumber
  ),
  address: pickValue(
    bill.shop?.address,
    bill.garage?.address,
    bill.workshop?.address,
    bill.company?.address,
    bill.address
  ),
});

const resolveBillItems = (bill = {}) => {
  const sourceItems = Array.isArray(bill.billItems)
    ? bill.billItems
    : Array.isArray(bill.items)
      ? bill.items
      : Array.isArray(bill.serviceSnapshot?.billItems)
        ? bill.serviceSnapshot.billItems
        : Array.isArray(bill.service?.billItems)
          ? bill.service.billItems
          : [];

  if (sourceItems.length > 0) {
    return sourceItems.map((item, index) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice ?? item.price ?? item.amount ?? 0));
      const lineTotal = item.lineTotal !== undefined && item.lineTotal !== null
        ? Math.max(0, Number(item.lineTotal) || 0)
        : quantity * unitPrice;

      return {
        name: pickValue(item.name, item.description, `Item ${index + 1}`),
        itemType: pickValue(item.itemType, item.type, item.category, 'service'),
        quantity,
        unitPrice,
        lineTotal,
      };
    });
  }

  const serviceCost = bill.service?.cost ?? bill.serviceSnapshot?.cost ?? bill.cost;
  if (serviceCost !== undefined && serviceCost !== null && serviceCost !== '') {
    const cost = Math.max(0, Number(serviceCost) || 0);
    return [
      {
        name: pickValue(bill.service?.serviceType, bill.serviceSnapshot?.serviceType, bill.serviceType, 'Service charge'),
        itemType: 'service',
        quantity: 1,
        unitPrice: cost,
        lineTotal: cost,
      },
    ];
  }

  return [];
};

const resolveInvoiceData = (bill = {}) => {
  const safeBill = bill || {};
  const billingSummary = safeBill.pricingSummary || safeBill.totals || safeBill.summary || safeBill.serviceSnapshot?.pricingSummary || safeBill.service?.pricingSummary || {};
  const taxBreakdown = safeBill.taxBreakdown || safeBill.serviceSnapshot?.taxBreakdown || safeBill.service?.taxBreakdown || {};

  const billItems = resolveBillItems(safeBill);
  const subtotal = toNumber(billingSummary.subtotal ?? billingSummary.serviceCharge ?? billItems.reduce((sum, item) => sum + toNumber(item.lineTotal), 0));
  const discountAmount = toNumber(billingSummary.discountAmount ?? 0);
  const taxAmount = toNumber(billingSummary.taxAmount ?? taxBreakdown.taxAmount ?? 0);
  const grandTotal = toNumber(billingSummary.grandTotal ?? billingSummary.totalAmount ?? subtotal - discountAmount + taxAmount);

  return {
    shop: resolveShopInfo(safeBill),
    billNumber: pickValue(safeBill.billNumber, safeBill.invoiceNumber, safeBill.referenceNumber, safeBill.number),
    createdOn: formatDateIST(safeBill.createdAt || safeBill.created_at),
    customer: {
      name: pickValue(safeBill.customer?.name, safeBill.customer?.fullName, safeBill.customerName, safeBill.customer?.companyName),
      phone: formatPhone(safeBill.customer?.phone || safeBill.customer?.mobile || safeBill.customer?.whatsappNumber),
    },
    vehicle: {
      number: pickValue(safeBill.vehicle?.registrationNumber, safeBill.vehicle?.vehicleNumber, safeBill.vehicleNumber, safeBill.registrationNumber),
      make: pickValue(safeBill.vehicle?.make, safeBill.vehicle?.brand, safeBill.vehicleMake, safeBill.make),
      model: pickValue(safeBill.vehicle?.model, safeBill.vehicleModel, safeBill.model),
    },
    service: {
      date: formatDateIST(safeBill.serviceSnapshot?.serviceDate || safeBill.service?.serviceDate || safeBill.serviceDate),
      type: pickValue(safeBill.serviceSnapshot?.serviceType, safeBill.service?.serviceType, safeBill.serviceType, 'Service'),
      odometer: safeBill.serviceSnapshot?.serviceOdometer ?? safeBill.service?.serviceOdometer ?? safeBill.serviceOdometer,
      nextDueDate: formatDateIST(safeBill.serviceSnapshot?.nextServiceDue || safeBill.service?.nextServiceDue || safeBill.nextServiceDue || safeBill.vehicle?.nextServiceDue),
      nextDueOdometer: safeBill.serviceSnapshot?.nextServiceOdometer ?? safeBill.service?.nextServiceOdometer ?? safeBill.nextServiceOdometer,
    },
    billItems,
    summary: {
      subtotal,
      taxAmount,
      discountAmount,
      grandTotal,
      currency: billingSummary.currency || safeBill.currency || 'INR',
    },
  };
};

const formatInvoiceItemsBlock = (billItems = []) => {
  if (!billItems.length) {
    return 'No itemized lines available.';
  }

  const columns = {
    name: 24,
    type: 10,
    qty: 5,
    unit: 13,
    total: 13,
  };

  const header = [
    'Item'.padEnd(columns.name),
    'Type'.padEnd(columns.type),
    'Qty'.padStart(columns.qty),
    'Unit Price'.padStart(columns.unit),
    'Line Total'.padStart(columns.total),
  ].join('  ');

  const rows = billItems.map((item) => [
    safeText(item.name).slice(0, columns.name).padEnd(columns.name),
    safeText(item.itemType).slice(0, columns.type).padEnd(columns.type),
    formatQuantity(item.quantity).padStart(columns.qty),
    formatMoney(item.unitPrice).padStart(columns.unit),
    formatMoney(item.lineTotal).padStart(columns.total),
  ].join('  '));

  return ['```', header, ...rows, '```'].join('\n');
};

export const buildWhatsAppInvoiceMessage = (bill = {}) => {
  const invoice = resolveInvoiceData(bill);

  return [
    '*AutoPulse Service Invoice*',
    '────────────────────────────',
    '*Customer Details*',
    `Name: ${invoice.customer.name}`,
    `Phone: ${invoice.customer.phone}`,
    `Vehicle: ${invoice.vehicle.number}`,
    `Make/Model: ${formatMakeModel(invoice.vehicle.make, invoice.vehicle.model)}`,
    '',
    '*Service Details*',
    `Invoice No: ${invoice.billNumber}`,
    `Generated On: ${invoice.createdOn}`,
    `Service Date: ${invoice.service.date}`,
    `Service Type: ${invoice.service.type}`,
    `Current Odometer: ${invoice.service.odometer !== undefined && invoice.service.odometer !== null && invoice.service.odometer !== '' ? `${toNumber(invoice.service.odometer).toLocaleString('en-IN')} km` : '-'}`,
    `Next Service Due: ${invoice.service.nextDueDate}`,
    `Next Service Odometer: ${invoice.service.nextDueOdometer !== undefined && invoice.service.nextDueOdometer !== null && invoice.service.nextDueOdometer !== '' ? `${toNumber(invoice.service.nextDueOdometer).toLocaleString('en-IN')} km` : '-'}`,
    '',
    '*Itemized Billing*',
    formatInvoiceItemsBlock(invoice.billItems),
    '',
    '*Pricing Summary*',
    `Subtotal: ${formatMoney(invoice.summary.subtotal)}`,
    `GST/Tax: ${formatMoney(invoice.summary.taxAmount)}`,
    `Discount: ${formatMoney(invoice.summary.discountAmount)}`,
    `Grand Total: ${formatMoney(invoice.summary.grandTotal)}`,
    '',
    'Thank you for choosing our service.',
    'Please visit again.',
  ].join('\n');
};

export const buildWhatsappInvoiceData = resolveInvoiceData;
