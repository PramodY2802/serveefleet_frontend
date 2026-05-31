import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import billingService from '../../services/billingService.js';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Badge, Button, LoadingState, Page, PageHeader } from '../../shared/components/ui/index.js';
import { buildWhatsAppInvoiceMessage } from '../../utils/whatsappBillUtils.js';
import './billing.css';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatWhatsappNumber = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const statusToneMap = {
  draft: 'muted',
  issued: 'primary',
  sent: 'warning',
  viewed: 'warning',
  paid: 'success',
  cancelled: 'destructive',
  pending: 'warning',
  partial: 'warning',
};

const BillPreviewPage = () => {
  const { billId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const loadBill = async () => {
      try {
        setLoading(true);
        setLoadFailed(false);
        const response = await billingService.get(billId);
        if (!active) return;

        const nextBill = response?.data?.data ?? response?.data ?? response;
        setBill(nextBill || null);
      } catch (error) {
        if (!active) return;
        setLoadFailed(true);
        toast.addToast(error.response?.data?.message || 'Unable to load bill preview.', 'error');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadBill();
    return () => {
      active = false;
    };
  }, [billId, toast]);

  const billItems = useMemo(
    () => bill?.billItems || bill?.items || bill?.serviceSnapshot?.billItems || bill?.service?.billItems || [],
    [bill]
  );

  const pricingSummary = useMemo(
    () => bill?.pricingSummary || bill?.totals || bill?.summary || bill?.serviceSnapshot?.pricingSummary || bill?.service?.pricingSummary || {},
    [bill]
  );

  const taxBreakdown = useMemo(
    () => bill?.taxBreakdown || bill?.serviceSnapshot?.taxBreakdown || bill?.service?.taxBreakdown || {},
    [bill]
  );

  const paymentStatus = bill?.payment?.status || bill?.status || 'issued';
  const customerName = bill?.customer?.name || 'Customer';
  const vehicleNumber = bill?.vehicle?.registrationNumber || 'N/A';
  const serviceType = bill?.serviceSnapshot?.serviceType || bill?.service?.serviceType || 'Service';
  const serviceDate = formatDate(bill?.serviceSnapshot?.serviceDate || bill?.service?.serviceDate);
  const serviceOdometer = bill?.serviceSnapshot?.serviceOdometer ?? bill?.service?.serviceOdometer;
  const nextServiceDue = formatDate(bill?.serviceSnapshot?.nextServiceDue || bill?.service?.nextServiceDue || bill?.nextServiceDue || bill?.vehicle?.nextServiceDue);
  const nextServiceOdometer = bill?.serviceSnapshot?.nextServiceOdometer ?? bill?.service?.nextServiceOdometer;
  const subtotal = toNumber(pricingSummary.subtotal ?? pricingSummary.serviceCharge ?? 0);
  const discountAmount = toNumber(pricingSummary.discountAmount ?? 0);
  const taxAmount = toNumber(pricingSummary.taxAmount ?? taxBreakdown.taxAmount ?? 0);
  const grandTotal = toNumber(pricingSummary.grandTotal ?? pricingSummary.totalAmount ?? subtotal - discountAmount + taxAmount);
  const currency = pricingSummary.currency || bill?.currency || 'INR';
  const statusTone = statusToneMap[paymentStatus] || 'primary';

  const invoiceMessage = useMemo(() => buildWhatsAppInvoiceMessage(bill), [bill]);

  const handleSendOnWhatsApp = () => {
    const mobile = formatWhatsappNumber(bill?.customer?.phone || bill?.customer?.mobile || bill?.customer?.whatsappNumber);
    if (!mobile) {
      toast.addToast('Customer mobile number is missing for WhatsApp sharing.', 'error');
      return;
    }

    const whatsappUrl = `https://wa.me/${mobile}?text=${encodeURIComponent(invoiceMessage)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <Page>
        <LoadingState title="Loading bill preview" description="Please wait while we fetch the invoice details." />
      </Page>
    );
  }

  if (loadFailed || !bill) {
    return (
      <Page>
        <PageHeader
          title="Bill Preview"
          description="The requested bill could not be loaded."
          actions={<Button variant="outline" onClick={handleBack}>Back</Button>}
        />
        <div className="invoice-shell">
          <div className="invoice-section">
            <h3>Bill preview unavailable</h3>
            <p>Try opening the bill again from the service record or create a new invoice.</p>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Bill Preview"
        description="Review the itemized invoice, print it, or share it on WhatsApp."
        actions={
          <div className="billing-page__actions">
            <Button variant="outline" icon="bi-arrow-left" onClick={handleBack}>
              Back
            </Button>
            <Button variant="outline" icon="bi-printer" onClick={handlePrint}>
              Print Bill
            </Button>
            <Button icon="bi-whatsapp" onClick={handleSendOnWhatsApp}>
              Send on WhatsApp
            </Button>
          </div>
        }
      />

      <div className="billing-page billing-page--preview">
        <section className="invoice-shell billing-page__main">
          <div className="invoice-header" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <p className="invoice-kicker">Invoice</p>
              <h1 style={{ margin: 0 }}>{bill.billNumber || bill.invoiceNumber || `#${bill.id || bill._id}`}</h1>
              <p style={{ margin: '0.35rem 0 0', color: 'var(--ui-text-muted, #667085)' }}>
                Generated on {formatDate(bill.createdAt || bill.created_at)}
              </p>
            </div>
            <Badge tone={statusTone}>{paymentStatus}</Badge>
          </div>

          <div
            className="invoice-meta-grid"
            style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              marginTop: '1.25rem',
            }}
          >
            <div className="invoice-panel">
              <p className="section-label">Customer</p>
              <h3>{bill.customer?.name || 'N/A'}</h3>
              <p>{bill.customer?.phone || bill.customer?.mobile || 'No mobile number'}</p>
              <p>{bill.customer?.email || 'No email'}</p>
            </div>
            <div className="invoice-panel">
              <p className="section-label">Vehicle</p>
              <h3>{bill.vehicle?.registrationNumber || 'N/A'}</h3>
              <p>
                {bill.vehicle?.make || 'Vehicle'} {bill.vehicle?.model || ''}{bill.vehicle?.year ? ` | ${bill.vehicle.year}` : ''}
              </p>
              <p>{bill.vehicle?.fuelType || 'Fuel type not available'}</p>
            </div>
            <div className="invoice-panel">
              <p className="section-label">Service</p>
              <h3>{serviceType}</h3>
              <p>{bill.serviceSnapshot?.description || bill.service?.description || 'No service description available.'}</p>
              <p>Service date: {serviceDate}</p>
              <p>Service odometer: {serviceOdometer !== undefined && serviceOdometer !== null ? `${toNumber(serviceOdometer)} km` : 'Not recorded'}</p>
              <p>Next service due: {nextServiceDue}</p>
              <p>Next service odometer: {nextServiceOdometer !== undefined && nextServiceOdometer !== null ? `${toNumber(nextServiceOdometer)} km` : 'Not scheduled'}</p>
            </div>
          </div>

          <div className="invoice-section" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0 }}>Bill Items</h2>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--ui-text-muted, #667085)' }}>
                  Itemized billing from the workshop invoice.
                </p>
              </div>
            </div>

            <div className="invoice-table-wrap" style={{ marginTop: '1rem' }}>
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th className="text-end">Qty</th>
                    <th className="text-end">Unit Price</th>
                    <th className="text-end">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {billItems.length > 0 ? (
                    billItems.map((item, index) => {
                      const quantity = toNumber(item.quantity || 1);
                      const unitPrice = toNumber(item.unitPrice || item.price || 0);
                      const lineTotal = toNumber(item.lineTotal ?? item.totalAmount ?? quantity * unitPrice);

                      return (
                        <tr key={`${item.id || item._id || item.name || 'item'}-${index}`}>
                          <td>{item.name || item.description || `Item ${index + 1}`}</td>
                          <td>{item.itemType || 'service'}</td>
                          <td className="text-end">{quantity}</td>
                          <td className="text-end">{formatCurrency(unitPrice)}</td>
                          <td className="text-end">{formatCurrency(lineTotal)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '1rem' }}>
                        No itemized lines available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {(bill.notes || bill.serviceSnapshot?.notes) && (
            <div className="invoice-section" style={{ marginTop: '1.5rem' }}>
              <h2 style={{ marginTop: 0 }}>Notes</h2>
              <p style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{bill.notes || bill.serviceSnapshot?.notes}</p>
            </div>
          )}
        </section>

        <aside className="invoice-shell billing-page__sidebar">
          <div className="invoice-section">
            <h2 style={{ marginTop: 0 }}>Summary</h2>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <span>Subtotal</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <span>Discount</span>
                <strong>- {formatCurrency(discountAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <span>GST / Tax</span>
                <strong>{formatCurrency(taxAmount)}</strong>
              </div>
              <div style={{ borderTop: '1px solid var(--ui-border, rgba(0, 0, 0, 0.08))', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <span>Grand total</span>
                <strong>{formatCurrency(grandTotal)}</strong>
              </div>
            </div>
          </div>

          <div className="invoice-section" style={{ marginTop: '1rem' }}>
            <p className="section-label">Payment status</p>
            <Badge tone={statusTone}>{paymentStatus}</Badge>
            <p style={{ marginBottom: 0, color: 'var(--ui-text-muted, #667085)' }}>
              Use this status to track collection and delivery.
            </p>
          </div>

          <div className="invoice-section" style={{ marginTop: '1rem' }}>
            <p className="section-label">Next service due</p>
            <h3 style={{ marginTop: 0 }}>{nextServiceDue}</h3>
            <p style={{ marginBottom: 0, color: 'var(--ui-text-muted, #667085)' }}>
              Next service odometer: {nextServiceOdometer !== undefined && nextServiceOdometer !== null ? `${toNumber(nextServiceOdometer)} km` : 'Not scheduled'}
            </p>
          </div>

          <div className="invoice-section" style={{ marginTop: '1rem' }}>
            <p className="section-label">Currency</p>
            <h3 style={{ marginTop: 0 }}>{currency}</h3>
            <p style={{ marginBottom: 0, color: 'var(--ui-text-muted, #667085)' }}>
              Pricing is sourced from the backend summary.
            </p>
          </div>
        </aside>
      </div>
    </Page>
  );
};

export default BillPreviewPage;
