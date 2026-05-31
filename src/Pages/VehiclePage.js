import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import VehiclePlate from '../shared/components/VehiclePlate.jsx';
import { formatDateTimeIST, getLatestTimestamp, sortByLatestUpdated } from '../utils/dateUtils.js';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const VehiclePage = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentVehicleId, setCurrentVehicleId] = useState(null);
  const [formData, setFormData] = useState({
    registrationNumber: "",
    plateColor: "white",
    make: "",
    model: "",
    year: "",
    fuelType: "",
  });

  const fetchCustomerAndVehicles = async () => {
    try {
      const customerRes = await axios.get(
        `${backendUrl}/api/customers/single/${customerId}`
      );

      setCustomer(customerRes.data);

      const vehicleRes = await axios.get(
        `${backendUrl}/api/vehicles/${customerId}`
      );

      setVehicles(vehicleRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCustomerAndVehicles();
  }, []);

  const handleEdit = (vehicle) => {
    setFormData({
      registrationNumber: vehicle.registrationNumber,
      plateColor: vehicle.plateColor || "white",
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      fuelType: vehicle.fuelType,
    });
    setCurrentVehicleId(vehicle._id);
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = async (vehicleId) => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });

    if (confirm.isConfirmed) {
      try {
        await axios.delete(`${backendUrl}/api/vehicles/${vehicleId}`);

        Swal.fire("Deleted!", "Vehicle has been deleted.", "success");
        fetchCustomerAndVehicles();
      } catch (err) {
        console.error(err);
        Swal.fire("Error", "Failed to delete vehicle", "error");
      }
    }
  };

  const handleSubmit = async () => {
    const { registrationNumber, make, model, year, fuelType } = formData;
    if (!registrationNumber || !make || !model || !year || !fuelType) {
      return Swal.fire("Error", "All fields are required", "error");
    }

    try {
      if (editMode) {
        await axios.put(
          `${backendUrl}/api/vehicles/${currentVehicleId}`,
          formData
        );

        Swal.fire("Success", "Vehicle updated", "success");
      } else {
        await axios.post(`${backendUrl}/api/vehicles/`, {
          ...formData,
          userId: customerId,
        });

        Swal.fire("Success", "Vehicle added", "success");
      }

      setShowModal(false);
      setEditMode(false);
      setCurrentVehicleId(null);
      setFormData({
        registrationNumber: "",
        plateColor: "white",
        make: "",
        model: "",
        year: "",
        fuelType: "",
      });
      fetchCustomerAndVehicles();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to submit vehicle data", "error");
    }
  };

  const sortedVehicles = sortByLatestUpdated(vehicles);

  return (
    <div className="container py-4">
      {/* 🔝 Top Bar */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
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

      {/* 👤 Customer Info */}
      {customer && (
        <div className="glass-card mb-4">
          <div className="d-flex align-items-center mb-3">
            <i className="bi bi-person-circle me-3 fs-2 text-primary"></i>
            <div>
              <h5 className="mb-0">Customer Information</h5>
              {/* <small className="text-muted">
  ID: {typeof customer._id === "string" ? customer._id.slice(-5) : "N/A"}
</small> */}
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 info-row">
              <i className="bi bi-person-fill info-icon"></i>
              <strong>Name:</strong> {customer.name}
            </div>
            <div className="col-md-6 info-row">
              <i className="bi bi-envelope-fill info-icon"></i>
              <strong>Email:</strong> {customer.email}
            </div>
            <div className="col-md-6 info-row">
              <i className="bi bi-telephone-fill info-icon"></i>
              <strong>Phone:</strong> {customer.phone}
            </div>
            <div className="col-md-6 info-row">
              <i className="bi bi-geo-alt-fill info-icon"></i>
              <strong>Address:</strong> {customer.address}
            </div>
          </div>
        </div>
      )}

      <hr />

      {/* 🚘 Vehicles Header */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h5 className="text-secondary fw-bolder">Vehicles</h5>
        <button
          className="btn btn-info"
          onClick={() => {
            setShowModal(true);
            setEditMode(false);
            setFormData({
              registrationNumber: "",
              plateColor: "white",
              make: "",
              model: "",
              year: "",
              fuelType: "",
            });
          }}
        >
          <i className="bi bi-plus-circle me-2"></i> Add Vehicle
        </button>
      </div>

      {/* 🔍 Search */}
      <div className="mb-3">
        <input
          type="text"
          className="form-control w-75 mx-auto"
          placeholder="Search by Registration, Make, Model..."
          onChange={(e) => {
            const search = e.target.value.toLowerCase();
            const filtered = vehicles.filter(
              (v) =>
                v.registrationNumber.toLowerCase().includes(search) ||
                v.make.toLowerCase().includes(search) ||
                v.model.toLowerCase().includes(search)
            );
            setVehicles(search ? filtered : vehicles);
            if (!search) fetchCustomerAndVehicles(); // Reset if input cleared
          }}
        />
      </div>

      <hr />

      {/* 📋 Vehicle Table */}
      <div className="table-responsive">
        <table className="table table-striped table-hover align-middle">
          <thead className="table-dark text-center">
            <tr>
              <th>#</th>
              <th>Registration</th>
              <th>Make</th>
              <th>Model</th>
              <th>Year</th>
              <th>Fuel</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedVehicles.map((v, index) => (
              <tr key={index} className="text-center">
                <td>
                  {typeof v._id === "string" ? v._id.slice(-5) : index + 1}
                </td>
                <td><VehiclePlate value={v.registrationNumber} plateColor={v.plateColor} /></td>
                <td>{v.make}</td>
                <td>{v.model}</td>
                <td>{v.year}</td>
                <td>{v.fuelType}</td>
                <td>{formatDateTimeIST(getLatestTimestamp(v))}</td>
                <td className="d-flex justify-content-center">
                  <button
                    onClick={() => navigate(`/services/${v._id}`)}
                    className="btn btn-sm btn-outline-info me-1"
                    title="View Services"
                  >
                    <i className="bi bi-eye"></i>
                  </button>
                  <button
                    className="btn btn-sm btn-outline-warning me-1"
                    title="Edit"
                    onClick={() => handleEdit(v)}
                  >
                    <i className="bi bi-pencil-square"></i>
                  </button>
                  {/*
                  <button
                    className="btn btn-sm btn-outline-danger"
                    title="Delete"
                    onClick={() => handleDelete(v._id)}
                  >
                    <i className="bi bi-trash3"></i>
                  </button>
                  */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🧾 Modal Form */}
      {showModal && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editMode ? "Update Vehicle" : "Add Vehicle"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowModal(false);
                    setEditMode(false);
                    setFormData({
                      registrationNumber: "",
                      plateColor: "white",
                      make: "",
                      model: "",
                      year: "",
                      fuelType: "",
                    });
                  }}
                ></button>
              </div>
              <div className="modal-body">
                {[
                  "registrationNumber",
                  "plateColor",
                  "make",
                  "model",
                  "year",
                  "fuelType",
                ].map((field, idx) => (
                  field === "plateColor" ? (
                    <select
                      key={idx}
                      className="form-select mb-2"
                      value={formData[field]}
                      onChange={(e) =>
                        setFormData({ ...formData, [field]: e.target.value })
                      }
                    >
                      <option value="white">White - Private Vehicle</option>
                      <option value="yellow">Yellow - Commercial Vehicle</option>
                      <option value="black">Black - Rental Vehicle</option>
                      <option value="green">Green - Electric Vehicle</option>
                      <option value="red">Red - Temporary Registration</option>
                    </select>
                  ) : (
                    <input
                      key={idx}
                      type={field === "year" ? "number" : "text"}
                      className="form-control mb-2"
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      value={formData[field]}
                      onChange={(e) =>
                        setFormData({ ...formData, [field]: e.target.value })
                      }
                    />
                  )
                ))}
              </div>
              <div className="modal-footer justify-content-center">
                <button
                  className="btn btn-secondary w-25"
                  onClick={() => {
                    setShowModal(false);
                    setEditMode(false);
                    setFormData({
                      registrationNumber: "",
                      plateColor: "white",
                      make: "",
                      model: "",
                      year: "",
                      fuelType: "",
                    });
                  }}
                >
                  Cancel
                </button>
                <button className="btn btn-primary w-25" onClick={handleSubmit}>
                  {editMode ? "Update" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehiclePage;
