import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import vehicleService from '../../services/vehicleService.js';
import DataTable from '../../shared/components/DataTable.jsx';
import FormField from '../../shared/components/FormField.jsx';
import Modal from '../../shared/components/Modal.jsx';
import VehiclePlate, { VEHICLE_PLATE_OPTIONS } from '../../shared/components/VehiclePlate.jsx';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Badge, Button, LoadingState, Page, PageHeader } from '../../shared/components/ui/index.js';
import { formatDateTimeIST, getLatestTimestamp } from '../../utils/dateUtils.js';

const emptyVehicleForm = {
  registrationNumber: '',
  plateColor: 'white',
  make: '',
  model: '',
  year: '',
  fuelType: '',
};

const VehiclePage = () => {
  const { customerId } = useParams();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [form, setForm] = useState(emptyVehicleForm);
  const [errors, setErrors] = useState({});
  const toast = useToast();
  const navigate = useNavigate();

  const loadVehicles = useCallback(async () => {
    if (!customerId) return;
    try {
      setLoading(true);
      const data = await vehicleService.list({ customerId });
      setVehicles(data || []);
    } catch (error) {
      toast.addToast(error.response?.data?.message || 'Unable to load vehicles.', 'error');
    } finally {
      setLoading(false);
    }
  }, [customerId, toast]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const openCreateModal = () => {
    setSelectedVehicle(null);
    setForm(emptyVehicleForm);
    setErrors({});
    setModalMode('create');
  };

  const openEditModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    setForm({
      registrationNumber: vehicle.registrationNumber || '',
      plateColor: vehicle.plateColor || 'white',
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year || '',
      fuelType: vehicle.fuelType || '',
    });
    setErrors({});
    setModalMode('edit');
  };

  const closeModal = () => {
    if (saving) return;
    setModalMode(null);
    setSelectedVehicle(null);
    setErrors({});
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!form.registrationNumber.trim() || form.registrationNumber.trim().length < 4) nextErrors.registrationNumber = 'Registration number must be at least 4 characters.';
    if (form.year && (Number(form.year) < 1900 || Number(form.year) > new Date().getFullYear() + 1)) nextErrors.year = 'Enter a realistic vehicle year.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    const payload = {
      customerId,
      registrationNumber: form.registrationNumber.trim().toUpperCase(),
      plateColor: form.plateColor,
      make: form.make.trim() || undefined,
      model: form.model.trim() || undefined,
      year: form.year ? Number(form.year) : undefined,
      fuelType: form.fuelType.trim() || undefined,
    };

    try {
      setSaving(true);
      if (modalMode === 'edit' && selectedVehicle) {
        await vehicleService.update(selectedVehicle.id || selectedVehicle._id, payload);
        toast.addToast('Vehicle updated successfully.', 'success');
      } else {
        await vehicleService.create(payload);
        toast.addToast('Vehicle added successfully.', 'success');
      }
      closeModal();
      await loadVehicles();
    } catch (error) {
      toast.addToast(error.response?.data?.message || 'Unable to save vehicle.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vehicle) => {
    const confirmed = window.confirm(`Delete vehicle ${vehicle.registrationNumber || vehicle.model || ''}? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const id = vehicle.id || vehicle._id;
      setDeletingId(id);
      await vehicleService.remove(id);
      toast.addToast('Vehicle deleted successfully.', 'success');
      await loadVehicles();
    } catch (error) {
      toast.addToast(error.response?.data?.message || 'Unable to delete vehicle.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const columns = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (vehicle) => (
        <div>
          <strong>{vehicle.model || vehicle.registrationNumber || 'Unnamed vehicle'}</strong>
          <p className="ui-card__description">
            {vehicle.registrationNumber ? <VehiclePlate value={vehicle.registrationNumber} plateColor={vehicle.plateColor} /> : 'No registration information'}
          </p>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (vehicle) => <Badge tone={vehicle.isActive === false ? 'destructive' : 'muted'}>{vehicle.isActive === false ? 'Inactive' : 'Available'}</Badge> },
    { key: 'lastUpdated', label: 'Last Updated', render: (vehicle) => formatDateTimeIST(getLatestTimestamp(vehicle)) },
    {
      key: 'actions',
      label: 'Actions',
      render: (vehicle) => (
        <div className="row-actions">
          <Button size="sm" variant="outline" icon="bi-wrench-adjustable" onClick={() => navigate(`/vehicles/${vehicle._id || vehicle.id}/services`)}>
            Services
          </Button>
          <Button size="sm" variant="ghost" icon="bi-pencil" onClick={() => openEditModal(vehicle)}>
            Edit
          </Button>
          {/*
          <Button size="sm" variant="destructive" icon="bi-trash" loading={deletingId === (vehicle.id || vehicle._id)} onClick={() => handleDelete(vehicle)}>
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
        title="Vehicle Fleet"
        description="Add and maintain vehicles assigned to the selected customer."
        actions={
          <>
            <Button variant="outline" icon="bi-arrow-left" onClick={() => navigate('/customers')}>Back to customers</Button>
            <Button icon="bi-plus-lg" onClick={openCreateModal}>Add vehicle</Button>
          </>
        }
      />
      {loading ? (
        <LoadingState title="Loading vehicles" />
      ) : (
        <DataTable columns={columns} data={vehicles} rowKey="_id" emptyTitle="No vehicles found" emptyDescription="No vehicles were found for this customer." />
      )}

      <Modal
        open={Boolean(modalMode)}
        title={modalMode === 'edit' ? 'Edit vehicle' : 'Add vehicle'}
        onClose={closeModal}
        disableClose={saving}
        footer={
          <>
            <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button type="submit" form="vehicle-form" loading={saving} disabled={saving}>{modalMode === 'edit' ? 'Save changes' : 'Create vehicle'}</Button>
          </>
        }
      >
        <form id="vehicle-form" className="form-grid" onSubmit={handleSubmit}>
          <FormField className="form-field--full" label="Registration number" name="registrationNumber" value={form.registrationNumber} onChange={updateField} error={errors.registrationNumber} placeholder="MH12AB1234" required disabled={saving} />
          <FormField label="Number plate color" name="plateColor" as="select" value={form.plateColor} onChange={updateField} disabled={saving}>
            {VEHICLE_PLATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.description}
              </option>
            ))}
          </FormField>
          <FormField label="Make" name="make" value={form.make} onChange={updateField} placeholder="Tata" disabled={saving} />
          <FormField label="Model" name="model" value={form.model} onChange={updateField} placeholder="Ace" disabled={saving} />
          <FormField label="Year" name="year" type="number" value={form.year} onChange={updateField} error={errors.year} placeholder="2024" disabled={saving} />
          <FormField label="Fuel type" name="fuelType" value={form.fuelType} onChange={updateField} placeholder="Diesel" disabled={saving} />
        </form>
      </Modal>
    </Page>
  );
};

export default VehiclePage;
