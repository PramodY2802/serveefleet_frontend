import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import customerService from '../../services/customerService.js';
import DataTable from '../../shared/components/DataTable.jsx';
import FormField from '../../shared/components/FormField.jsx';
import Modal from '../../shared/components/Modal.jsx';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Badge, Button, LoadingState, Page, PageHeader } from '../../shared/components/ui/index.js';
import { formatDateTimeIST, getLatestTimestamp } from '../../utils/dateUtils.js';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
};

const CustomerPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const toast = useToast();
  const navigate = useNavigate();

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await customerService.list();
      setCustomers(data || []);
    } catch (error) {
      toast.addToast(error.response?.data?.message || 'Unable to load customers.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const openCreateModal = () => {
    setSelectedCustomer(null);
    setForm(emptyForm);
    setErrors({});
    setModalMode('create');
  };

  const openEditModal = (customer) => {
    setSelectedCustomer(customer);
    setForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
    });
    setErrors({});
    setModalMode('edit');
  };

  const closeModal = () => {
    if (saving) return;
    setModalMode(null);
    setSelectedCustomer(null);
    setErrors({});
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  };

  const handlePickContact = async () => {
    if (!navigator.contacts?.select) {
      toast.addToast(
        'Contact picker is not supported in this browser. Please enter the phone number manually.',
        'warning'
      );
      return;
    }

    try {
      setContactLoading(true);
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      const contact = contacts?.[0];
      if (!contact) return;

      const phoneValue = Array.isArray(contact.tel) ? contact.tel[0] : contact.tel;
      const nameValue = Array.isArray(contact.name) ? contact.name[0] : contact.name;

      setForm((current) => ({
        ...current,
        phone: phoneValue || current.phone,
        name: current.name || nameValue || current.name,
      }));
    } catch (error) {
      if (error?.name !== 'AbortError') {
        toast.addToast('Unable to read contacts. Please try again.', 'error');
      }
    } finally {
      setContactLoading(false);
    }
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!form.name.trim() || form.name.trim().length < 2) nextErrors.name = 'Enter at least 2 characters.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (form.phone.trim() && form.phone.trim().length < 8) nextErrors.phone = 'Phone number must be at least 8 digits.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
    };

    try {
      setSaving(true);
      if (modalMode === 'edit' && selectedCustomer) {
        await customerService.update(selectedCustomer.id || selectedCustomer._id, payload);
        toast.addToast('Customer updated successfully.', 'success');
      } else {
        await customerService.create(payload);
        toast.addToast('Customer added successfully.', 'success');
      }
      closeModal();
      await loadCustomers();
    } catch (error) {
      toast.addToast(error.response?.data?.message || 'Unable to save customer.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getWhatsAppLink = (phone) => {
    if (!phone) return null;
    const digits = phone.replace(/[^\d+]/g, '');
    if (!digits) return null;

    let normalized = digits;
    if (!normalized.startsWith('+')) {
      const cleaned = normalized.replace(/^0+/, '');
      normalized = cleaned.length === 10 ? `91${cleaned}` : cleaned;
    }

    return `https://wa.me/${encodeURIComponent(normalized)}`;
  };

  const handleWhatsApp = (customer) => {
    const url = getWhatsAppLink(customer.phone);
    if (!url) {
      toast.addToast('Customer phone number is not available for WhatsApp.', 'warning');
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  const handleDelete = async (customer) => {
    const confirmed = window.confirm(`Delete ${customer.name || 'this customer'}? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const id = customer.id || customer._id;
      setDeletingId(id);
      await customerService.remove(id);
      toast.addToast('Customer deleted successfully.', 'success');
      await loadCustomers();
    } catch (error) {
      toast.addToast(error.response?.data?.message || 'Unable to delete customer.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Customer',
      render: (customer) => (
        <div>
          <strong>{customer.name || customer.companyName || 'Unnamed customer'}</strong>
          <p className="ui-card__description">{customer.email || customer.phone || 'No contact details'}</p>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (customer) => customer.phone || 'Not provided' },
    { key: 'status', label: 'Status', render: (customer) => <Badge tone="success">{customer.status || 'Active'}</Badge> },
    { key: 'lastUpdated', label: 'Last Updated', render: (customer) => formatDateTimeIST(getLatestTimestamp(customer)) },
    {
      key: 'actions',
      label: 'Actions',
      render: (customer) => (
        <div className="row-actions">
          <Button size="sm" variant="outline" icon="bi-truck" onClick={() => navigate(`/customers/${customer._id || customer.id}/vehicles`)}>
            Vehicles
          </Button>
          <Button size="sm" variant="ghost" icon="bi-whatsapp" onClick={() => handleWhatsApp(customer)} disabled={!customer.phone}>
            WhatsApp
          </Button>
          <Button size="sm" variant="ghost" icon="bi-pencil" onClick={() => openEditModal(customer)}>
            Edit
          </Button>
          {/*
          <Button size="sm" variant="destructive" icon="bi-trash" loading={deletingId === (customer.id || customer._id)} onClick={() => handleDelete(customer)}>
            Delete
          </Button>
          */}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Customers"
        description="Create and manage customer accounts before assigning vehicles and service history."
        actions={<Button icon="bi-plus-lg" onClick={openCreateModal}>Add customer</Button>}
      />
      {loading ? (
        <LoadingState title="Loading customers" />
      ) : (
        <DataTable columns={columns} data={customers} rowKey="_id" emptyTitle="No customers found" emptyDescription="Customer records will appear here once they are available." />
      )}

      <Modal
        open={Boolean(modalMode)}
        title={modalMode === 'edit' ? 'Edit customer' : 'Add customer'}
        onClose={closeModal}
        disableClose={saving}
        footer={
          <>
            <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button type="submit" form="customer-form" loading={saving} disabled={saving}>{modalMode === 'edit' ? 'Save changes' : 'Create customer'}</Button>
          </>
        }
      >
        <form id="customer-form" className="form-grid" onSubmit={handleSubmit}>
          <FormField className="form-field--full" label="Customer name" name="name" value={form.name} onChange={updateField} error={errors.name} placeholder="Acme Logistics" required disabled={saving} />
          <FormField label="Email" name="email" type="email" value={form.email} onChange={updateField} error={errors.email} placeholder="ops@example.com" required disabled={saving} />
          <FormField
            label="Phone"
            name="phone"
            value={form.phone}
            onChange={updateField}
            error={errors.phone}
            placeholder="9876543210"
            disabled={saving}
            helperText="Tap the contact icon to import a saved contact if your browser supports it."
            action={
              <Button
                type="button"
                variant="ghost"
                icon="bi-person-lines-fill"
                iconOnly
                onClick={handlePickContact}
                loading={contactLoading}
                disabled={saving}
                aria-label="Pick phone contact"
              />
            }
          />
          <FormField className="form-field--full" as="textarea" rows={3} label="Address" name="address" value={form.address} onChange={updateField} placeholder="Customer billing or service address" disabled={saving} />
        </form>
      </Modal>
    </Page>
  );
};

export default CustomerPage;
