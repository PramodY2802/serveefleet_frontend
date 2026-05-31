import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import VehiclePlate from '../shared/components/VehiclePlate.jsx';
import { formatDateIST, formatDateTimeIST, getLatestTimestamp, sortByLatestUpdated } from '../utils/dateUtils.js';

const backendUrl = process.env.REACT_APP_BACKEND_URL;


const ServicePage = () => {
  const { vehicleId } = useParams();
  const navigate = useNavigate();

  const [vehicle, setVehicle] = useState(null);
  const [services, setServices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [formData, setFormData] = useState({
    serviceDate: "",
    serviceType: "",
    description: "",
    cost: "",
    nextServiceDue: "",
  });
  const [searchTerm, setSearchTerm] = useState("");

  const fetchVehicleAndServices = async () => {
    try {
      const vehicleRes = await await axios.get(`${backendUrl}/api/vehicles/single/${vehicleId}`)
;
      setVehicle(vehicleRes.data);

     const serviceRes = await axios.get(`${backendUrl}/api/services/${vehicleId}`);
      setServices(serviceRes.data);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch data", "error");
    }
  };

  useEffect(() => {
    fetchVehicleAndServices();
  }, []);

  const handleInputChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const getServicePayload = () => ({
    vehicleId,
    serviceDate: formData.serviceDate || undefined,
    serviceType: formData.serviceType,
    description: formData.description,
    cost: formData.cost,
    nextServiceDue: formData.nextServiceDue || undefined,
  });

  const handleSaveService = async () => {
    const { serviceType, description, cost } = formData;
    if (!serviceType || !description || !cost) {
      return Swal.fire(
        "Warning",
        "Please fill in all required fields",
        "warning"
      );
    }

    try {
      if (editMode && editingServiceId) {
        await axios.put(
          `${backendUrl}/api/services/${editingServiceId}`,
          getServicePayload()
        );
        Swal.fire("Success", "Service updated", "success");
      } else {
        const res = await axios.post(`${backendUrl}/api/services`, getServicePayload());
        Swal.fire("Success", "Service added", "success");
        if (res.data?.whatsappUrl) window.open(res.data.whatsappUrl, "_blank");
      }

      setShowModal(false);
      setEditMode(false);
      setEditingServiceId(null);
      setFormData({
        serviceDate: "",
        serviceType: "",
        description: "",
        cost: "",
        nextServiceDue: "",
      });
      fetchVehicleAndServices();
    } catch (err) {
      console.error(err);
      const message =
        err.response?.data?.message ||
        err.response?.data?.details ||
        "Failed to save service";
      Swal.fire("Error", message, "error");
    }
  };

  const handleDeleteService = async (id) => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });

    if (confirm.isConfirmed) {
      try {
        await axios.delete(`${backendUrl}/api/services/${id}`);
        Swal.fire("Deleted", "Service deleted successfully", "success");
        fetchVehicleAndServices();
      } catch (err) {
        console.error(err);
        Swal.fire("Error", "Failed to delete service", "error");
      }
    }
  };

  const filteredServices = services.filter(
    (s) =>
      s.serviceType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedServices = sortByLatestUpdated(filteredServices);

  return (
    <div className="container py-4">
      {/* 🔝 Back & Logout */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <button
          className="btn btn-outline-info d-flex align-items-center gap-2"
          onClick={() => navigate(-1)}
        >
          <i className="bi bi-arrow-left"></i> Back
        </button>
        <button
          className="btn btn-outline-danger d-flex align-items-center gap-2"
          onClick={() => {
            localStorage.clear();
            navigate("/login");
          }}
        >
          <i className="bi bi-box-arrow-right"></i> Logout
        </button>
      </div>

      {/* 🚘 Vehicle Info Card */}
 {vehicle && (
  <div className="glass-card mb-4">
    <div className="d-flex align-items-center mb-3">
      <i className="bi bi-truck-front-fill me-3 fs-2 text-primary"></i>
      <div>
        <h5 className="mb-0">Vehicle Information</h5>
        {/* <small className="text-muted">ID: {typeof vehicle._id === "string" ? vehicle._id.slice(-5) : "N/A"}</small> */}
      </div>
    </div>

    <div className="row">
      <div className="col-md-6 info-row">
        <i className="bi bi-upc-scan info-icon"></i>
        <strong>Registration:</strong> {vehicle.registrationNumber ? <VehiclePlate value={vehicle.registrationNumber} plateColor={vehicle.plateColor} /> : 'Unknown'}
      </div>
      <div className="col-md-6 info-row">
        <i className="bi bi-building info-icon"></i>
        <strong>Make:</strong> {vehicle.make}
      </div>
      <div className="col-md-6 info-row">
        <i className="bi bi-box-seam info-icon"></i>
        <strong>Model:</strong> {vehicle.model}
      </div>
      <div className="col-md-6 info-row">
        <i className="bi bi-calendar3 info-icon"></i>
        <strong>Year:</strong> {vehicle.year}
      </div>
      <div className="col-md-6 info-row">
        <i className="bi bi-fuel-pump info-icon"></i>
        <strong>Fuel Type:</strong> {vehicle.fuelType}
      </div>
    </div>
  </div>
)}

<hr />

      {/* 🛠 Header + Search + Add */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h5 className="text-secondary fw-bolder">Service History</h5>
        <button
          className="btn btn-info"
          onClick={() => {
            setEditMode(false);
            setFormData({
              serviceDate: "",
              serviceType: "",
              description: "",
              cost: "",
              nextServiceDue: "",
            });
            setShowModal(true);
          }}
        >
          <i className="bi bi-plus-circle me-2"></i> Add Service
        </button>
      </div>

      <input
        type="text"
        className="form-control mb-3 w-75 mx-auto"
        placeholder="Search service type or description..."
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <hr />

      {/* 📋 Table */}
      <div className="table-responsive">
        <table className="table table-striped table-hover align-middle">
          <thead className="table-dark text-center">
            <tr>
              <th>ID</th>
              <th>Service Date</th>
              <th>Type</th>
              <th>Description</th>
              <th>Cost</th>
              <th>Next Due</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedServices.length > 0 ? (
              displayedServices.map((s) => (
                <tr key={s._id} className="text-center">
                  <td>{typeof s._id === "string" ? s._id.slice(-5) : s._id}</td>
                  <td>{formatDateIST(s.serviceDate)}</td>
                  <td>{s.serviceType}</td>
                  <td>{s.description}</td>
                  <td>₹{s.cost}</td>
                  <td>
                    {s.nextServiceDue
                      ? formatDateIST(s.nextServiceDue)
                      : "-"}
                  </td>
                  <td>{formatDateTimeIST(getLatestTimestamp(s))}</td>
                  <td className="d-flex justify-content-center">
                    <button
                      className="btn btn-sm btn-outline-warning me-1"
                      title="Edit"
                      onClick={() => {
                        setEditMode(true);
                        setEditingServiceId(s._id);
                        setFormData({
                          serviceDate: s.serviceDate?.split("T")[0] || "",
                          serviceType: s.serviceType,
                          description: s.description,
                          cost: s.cost,
                          nextServiceDue: s.nextServiceDue?.split("T")[0] || "",
                        });
                        setShowModal(true);
                      }}
                    >
                      <i className="bi bi-pencil-square"></i>
                    </button>
                    {/*
                    <button
                      className="btn btn-sm btn-outline-danger"
                      title="Delete"
                      onClick={() => handleDeleteService(s._id)}
                    >
                      <i className="bi bi-trash3"></i>
                    </button>
                    */}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center">
                  No service records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ✨ Modal */}
      {showModal && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editMode ? "Edit Service" : "Add Service"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  {["serviceDate", "nextServiceDue", "serviceType", "cost"].map(
                    (field, i) => (
                      <div className="col-md-6" key={i}>
                        <label className="form-label">
                          {field.replace(/([A-Z])/g, " $1")}
                        </label>
                        <input
                          type={
                            field === "serviceDate" || field === "nextServiceDue"
                              ? "date"
                              : field === "cost"
                              ? "number"
                              : "text"
                          }
                          name={field}
                          value={formData[field]}
                          onChange={handleInputChange}
                          className="form-control"
                        />
                      </div>
                    )
                  )}
                  <div className="col-12">
                    <label className="form-label">Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="form-control"
                      rows="3"
                    ></textarea>
                  </div>
                </div>
              </div>
              <div className="modal-footer justify-content-center">
                <button
                  className="btn btn-secondary w-25"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-info w-25"
                  onClick={handleSaveService}
                >
                  {editMode ? "Update Service" : "Add Service"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicePage;
