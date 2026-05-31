import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import serviceService from '../../services/serviceService.js';
import DataTable from '../../shared/components/DataTable.jsx';
import FormField from '../../shared/components/FormField.jsx';
import VehiclePlate from '../../shared/components/VehiclePlate.jsx';
import { useToast } from '../../shared/components/ToastProvider.jsx';
import { Badge, Button, LoadingState, Page, PageHeader } from '../../shared/components/ui/index.js';
import { formatDateTimeIST, getLatestTimestamp } from '../../utils/dateUtils.js';

const SearchPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const initialLoadDoneRef = useRef(false);

  const loadServices = useCallback(async (query = '') => {
    try {
      setLoading(true);
      const params = query ? { search: query } : {};
      const data = await serviceService.list(params);
      setServices(data || []);
    } catch (error) {
      toast.addToast('Unable to load records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      return;
    }

    const term = searchTerm.trim();
    const timeoutId = window.setTimeout(() => {
      loadServices(term);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [loadServices, searchTerm]);

  const handleSearch = (event) => {
    event.preventDefault();
    loadServices(searchTerm.trim());
  };

  const getVehicleId = (service) =>
    service.vehicle?._id ||
    service.vehicle?.id ||
    service.vehicleId?._id ||
    service.vehicleId?.id ||
    service.vehicleId ||
    service.vehicle?.vehicleId ||
    '';

  const getCustomerId = (service) =>
    service.vehicle?.customer?._id ||
    service.vehicle?.customer?.id ||
    service.vehicle?.customer?.customerId ||
    service.vehicleId?.userId?._id ||
    service.vehicleId?.userId?.id ||
    service.customer?._id ||
    service.customer?.id ||
    service.customerId ||
    '';

  const openVehicleServices = (service) => {
    const vehicleId = getVehicleId(service);
    if (!vehicleId) {
      toast.addToast('Vehicle details are not available for this record.', 'warning');
      return;
    }

    navigate(`/vehicles/${vehicleId}/services`);
  };

  const openCustomerVehicles = (service) => {
    const customerId = getCustomerId(service);
    if (!customerId) {
      toast.addToast('Customer details are not available for this record.', 'warning');
      return;
    }

    navigate(`/customers/${customerId}/vehicles`);
  };

  const getVehicleLabel = (service) => {
    const vehicle = service.vehicle || service.vehicleId || {};
    const vehicleId = getVehicleId(service);
    const plateNumber = vehicle.registrationNumber || service.registrationNumber || vehicle.number || '';

    if (plateNumber && vehicleId) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => openVehicleServices(service)}
          style={{ padding: 0, minHeight: 'auto', height: 'auto', justifyContent: 'flex-start' }}
        >
          <VehiclePlate value={plateNumber} plateColor={vehicle.plateColor} />
        </Button>
      );
    }

    if (vehicle.registrationNumber) {
      return <VehiclePlate value={vehicle.registrationNumber} plateColor={vehicle.plateColor} />;
    }

    return vehicle.model || vehicle.name || 'Unknown';
  };

  const getCustomerLabel = (service) => {
    const customerName =
      service.vehicle?.customer?.name ||
      service.vehicleId?.userId?.name ||
      service.customer?.name ||
      service.customerName ||
      service.vehicle?.customerName ||
      'Unknown';
    const customerId = getCustomerId(service);

    if (customerId && customerName !== 'Unknown') {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => openCustomerVehicles(service)}
          style={{ padding: 0, minHeight: 'auto', height: 'auto', justifyContent: 'flex-start' }}
        >
          {customerName}
        </Button>
      );
    }

    return (
      customerName
    );
  };

  const getServiceLabel = (service) => {
    const serviceLabel = service.serviceType || service.title || 'Service record';
    const vehicleId = getVehicleId(service);

    if (vehicleId) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => openVehicleServices(service)}
          style={{ padding: 0, minHeight: 'auto', height: 'auto', justifyContent: 'flex-start', fontWeight: 700 }}
        >
          {serviceLabel}
        </Button>
      );
    }

    return <strong>{serviceLabel}</strong>;
  };

  const columns = [
    {
      key: 'title',
      label: 'Service',
      render: (service) => (
        <div>
          {getServiceLabel(service)}
          <p className="ui-card__description">{service.description || 'Missing description.'}</p>
        </div>
      ),
    },
    { key: 'vehicle', label: 'Vehicle', render: (service) => getVehicleLabel(service) },
    { key: 'customer', label: 'Customer', render: (service) => getCustomerLabel(service) },
    { key: 'lastUpdated', label: 'Last Updated', render: (service) => formatDateTimeIST(getLatestTimestamp(service)) },
    { key: 'status', label: 'Status', render: (service) => <Badge tone={service.isActive === false ? 'destructive' : 'primary'}>{service.isActive === false ? 'Inactive' : 'Recorded'}</Badge> },
  ];

  const toolbar = (
    <form className="form-grid span-12" onSubmit={handleSearch}>
      <FormField
        className="form-field--full"
        label="Search records"
        name="service-search"
        type="search"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search by customer, vehicle, or service details"
        helperText="Use names, plate numbers, service details, or status keywords."
      />
      <div className="form-actions form-field--full">
        <Button type="submit" icon="bi-search" loading={loading}>
          Search
        </Button>
        <Button type="button" variant="outline" onClick={() => { setSearchTerm(''); loadServices(); }}>
          Reset
        </Button>
      </div>
    </form>
  );

  return (
    <Page>
      <PageHeader title="Search Service Records" description="Search service history across customers and fleet inventory." />
      {loading && services.length === 0 ? (
        <LoadingState title="Searching records" />
      ) : (
        <DataTable columns={columns} data={services} rowKey="id" toolbar={toolbar} emptyTitle="No matching records" emptyDescription="Try another keyword or reset the search." />
      )}
    </Page>
  );
};

export default SearchPage;
