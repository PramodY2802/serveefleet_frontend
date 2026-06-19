import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import billingService from '../../services/billingService.js';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Badge, Button, LoadingState, Page, PageHeader } from '../../shared/components/ui/index.js';
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

const addDays = (value, days) => {
  const baseDate = value ? new Date(value) : new Date();
  if (Number.isNaN(baseDate.getTime())) return null;
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const numberWords = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const tensWords = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const formatUnderHundred = (value) => {
  if (value < 20) return numberWords[value];
  return `${tensWords[Math.floor(value / 10)]}${value % 10 ? ` ${numberWords[value % 10]}` : ''}`;
};

const formatAmountInWords = (value) => {
  const amount = Math.round(Number(value) || 0);
  if (!amount) return 'Zero Rupees';

  const parts = [];
  let remaining = amount;
  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  const lakh = Math.floor(remaining / 100000);
  remaining %= 100000;
  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;
  const hundred = Math.floor(remaining / 100);
  remaining %= 100;

  if (crore) parts.push(`${formatUnderHundred(crore)} Crore`);
  if (lakh) parts.push(`${formatUnderHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${formatUnderHundred(thousand)} Thousand`);
  if (hundred) parts.push(`${numberWords[hundred]} Hundred`);
  if (remaining) parts.push(formatUnderHundred(remaining));

  return `${parts.join(' ')} Rupees`;
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

const sanitizeFileName = (value) =>
  String(value || 'bill')
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

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
  const invoiceRef = useRef(null);

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

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
  const nextServiceDue = formatDate(bill?.serviceSnapshot?.nextServiceDue || bill?.service?.nextServiceDue || bill?.nextServiceDue || bill?.vehicle?.nextServiceDue);
  const nextServiceOdometer = bill?.serviceSnapshot?.nextServiceOdometer ?? bill?.service?.nextServiceOdometer;
  const subtotal = toNumber(pricingSummary.subtotal ?? pricingSummary.serviceCharge ?? 0);
  const discountAmount = toNumber(pricingSummary.discountAmount ?? 0);
  const taxAmount = toNumber(pricingSummary.taxAmount ?? taxBreakdown.taxAmount ?? 0);
  const grandTotal = toNumber(pricingSummary.grandTotal ?? pricingSummary.totalAmount ?? subtotal - discountAmount + taxAmount);
  const currency = pricingSummary.currency || bill?.currency || 'INR';
  const statusTone = statusToneMap[paymentStatus] || 'primary';

  const invoiceNumber = bill?.billNumber || bill?.invoiceNumber || `#${bill?.id || bill?._id || 'bill'}`;
  const invoiceFileName = sanitizeFileName(`bill-${invoiceNumber}`);
  const invoiceCreatedAt = bill?.createdAt || bill?.created_at;
  const invoiceDate = formatDate(invoiceCreatedAt);
  const dueDate = formatDate(bill?.dueDate || bill?.payment?.dueDate || addDays(invoiceCreatedAt, 7));
  const shopName = 'AutoPulse';
  const totalAmountInWords = formatAmountInWords(grandTotal);

  const captureBillImage = async () => {
    const invoiceElement = invoiceRef.current;
    if (!invoiceElement || isGeneratingImage) {
      return null;
    }

    setIsGeneratingImage(true);
    invoiceElement.classList.add('invoice-capture-safe');

    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const canvas = await html2canvas(invoiceElement, {
        backgroundColor: '#ffffff',
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });

      const dataUrl = canvas.toDataURL('image/png');
      setGeneratedImageUrl(dataUrl);
      return dataUrl;
    } catch (error) {
      console.error('Bill image generation failed:', error);
      toast.addToast('Unable to generate the bill image. Please try again.', 'error');
      return null;
    } finally {
      invoiceElement.classList.remove('invoice-capture-safe');
      setIsGeneratingImage(false);
    }
  };

  const triggerDownload = (dataUrl) => {
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${invoiceFileName}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleGenerateBillImage = async () => {
    const dataUrl = await captureBillImage();
    if (dataUrl) {
      toast.addToast('Bill image generated successfully.', 'success');
    }
  };

  const handleDownloadBillImage = async () => {
    const dataUrl = generatedImageUrl || await captureBillImage();
    if (dataUrl) {
      triggerDownload(dataUrl);
      toast.addToast('Bill image download started.', 'success');
    }
  };

  const handleSendOnWhatsApp = () => {
    const mobile = formatWhatsappNumber(bill?.customer?.phone || bill?.customer?.mobile || bill?.customer?.whatsappNumber);
    if (!mobile) {
      toast.addToast('Customer mobile number is missing for WhatsApp sharing.', 'error');
      return;
    }

    const shortMessage = `Hi ${customerName}, your bill ${invoiceNumber} for ${vehicleNumber} is ready. Total: ${formatCurrency(grandTotal)}. Please review the invoice image and attach the downloaded file before sending.`;
    const whatsappUrl = `https://wa.me/${mobile}?text=${encodeURIComponent(shortMessage)}`;
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
            <Button variant="outline" icon="bi-image" loading={isGeneratingImage} onClick={handleGenerateBillImage}>
              Generate Bill Image
            </Button>
            <Button variant="outline" icon="bi-download" loading={isGeneratingImage} onClick={handleDownloadBillImage}>
              Download Bill Image
            </Button>
            <Button icon="bi-whatsapp" onClick={handleSendOnWhatsApp}>
              Send on WhatsApp
            </Button>
            <Button variant="outline" icon="bi-printer" onClick={handlePrint}>
              Print Bill
            </Button>
          </div>
        }
      />

      <div className="billing-page billing-page--preview">
        <section className="invoice-shell billing-page__main invoice-receipt" ref={invoiceRef}>
          <header className="invoice-receipt__header">
            <div className="invoice-receipt__brand">
              <img className="invoice-receipt__logo" src="/autopulse.png" alt="AutoPulse logo" />
              <div>
                <h1>{shopName}</h1>
              </div>
            </div>
          </header>

          <div className="invoice-receipt__meta">
            <span>Invoice No.: {invoiceNumber}</span>
            <span>Invoice Date: {invoiceDate}</span>
            <span>Due Date: {dueDate}</span>
          </div>

          <section className="invoice-receipt__bill-to">
            <p>BILL TO</p>
            <strong>{customerName}</strong>
            <span>{bill.customer?.phone || bill.customer?.mobile || 'No mobile number'}</span>
            <span>{vehicleNumber} {bill.vehicle?.make || bill.vehicle?.model ? `- ${bill.vehicle?.make || ''} ${bill.vehicle?.model || ''}` : ''}</span>
          </section>

          <table className="invoice-table invoice-receipt__table">
            <thead>
              <tr>
                <th>ITEMS</th>
                <th className="text-end">QTY.</th>
                <th className="text-end">RATE</th>
                <th className="text-end">AMOUNT</th>
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
                      <td className="text-end">{quantity}</td>
                      <td className="text-end">{formatCurrency(unitPrice)}</td>
                      <td className="text-end">{formatCurrency(lineTotal)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="invoice-receipt__empty">No itemized lines available.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="invoice-receipt__subtotal">
            <span>SUBTOTAL</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>

          <footer className="invoice-receipt__footer">
            <div className="invoice-receipt__terms">
              <strong>TERMS AND CONDITIONS</strong>
              <span>1. Goods once sold will not be taken back or exchanged.</span>
              <span>2. All disputes are subject to local jurisdiction only.</span>
              {(bill.notes || bill.serviceSnapshot?.notes) && <span>{bill.notes || bill.serviceSnapshot?.notes}</span>}
            </div>
            <div className="invoice-receipt__totals">
              <div>
                <span>Total Amount</span>
                <strong>{formatCurrency(grandTotal)}</strong>
              </div>
              <div>
                <span>Received Amount</span>
                <strong>{formatCurrency(bill?.payment?.receivedAmount || 0)}</strong>
              </div>
              <div className="invoice-receipt__words">
                <span>Total Amount (in words)</span>
                <strong>{totalAmountInWords}</strong>
              </div>
            </div>
          </footer>
        </section>

        <aside className="invoice-shell billing-page__sidebar">
          <div className="invoice-section billing-page__helper-card">
            <p className="section-label">Bill image workflow</p>
            <h2 style={{ marginTop: 0 }}>Generate, download, then share</h2>
            <p className="billing-page__helper-text">
              The image export captures only the invoice area on the left. WhatsApp opens with a short message only, so download the image and attach it manually before sending.
            </p>
            {generatedImageUrl ? (
              <>
                <div className="billing-page__image-preview">
                  <img src={generatedImageUrl} alt="Generated bill preview" className="billing-page__image" />
                </div>
                <Button variant="outline" icon="bi-download" loading={isGeneratingImage} className="billing-page__sidebar-button" onClick={handleDownloadBillImage}>
                  Download Bill Image
                </Button>
              </>
            ) : (
              <p className="billing-page__helper-note">
                No image has been generated yet. Use <strong>Generate Bill Image</strong> to create a preview first.
              </p>
            )}
          </div>

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
