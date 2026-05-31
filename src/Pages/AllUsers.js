import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../styles/allUsers.css";
import axios from "axios";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const AllUsers = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isUpdate, setIsUpdate] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  console.log(token);

  const fetchCustomer = async () => {
    try {
      if (!currentUser?.id || !token) return;

      const res = await axios.get(
        `${backendUrl}/api/customers/${currentUser.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setUsers(res.data);
      setFilteredUsers(res.data);
    } catch (error) {
      console.error("Fetch Error:", error);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, []);

  useEffect(() => {
    const lower = searchTerm.toLowerCase();
    const filtered = users.filter(
      (u) =>
        u?.name?.toLowerCase().includes(lower) ||
        u?.email?.toLowerCase().includes(lower)
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${backendUrl}/api/customers/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      Swal.fire("Deleted!", "Customer has been deleted.", "success");
      fetchCustomer();
    } catch (error) {
      console.error("Delete Error:", error);
      Swal.fire("Error", "Could not delete customer.", "error");
    }
  };

  const handleSubmitUser = async () => {
    const { name, email, phone, address } = formData;
    if (!name || !email || !phone || !address) {
      return Swal.fire({
        icon: "error",
        title: "All fields required",
        text: "Please fill all fields.",
      });
    }

    try {
      let response;
      if (isUpdate && selectedUserId) {
        response = await axios.put(
          `${backendUrl}/api/customers/${selectedUserId}`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } else {
        response = await axios.post(`${backendUrl}/api/customers/`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      Swal.fire({
        icon: "success",
        title: isUpdate ? "Updated!" : "Added!",
        timer: 1500,
        showConfirmButton: false,
      });

      setShowModal(false);
      resetForm();
      fetchCustomer();
    } catch (error) {
      console.error("Submit Error:", error);
      Swal.fire("Error", "Something went wrong.", "error");
    }
  };

  const handleEdit = (user) => {
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
    });
    setIsUpdate(true);
    setSelectedUserId(user._id);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ name: "", email: "", phone: "", address: "" });
    setIsUpdate(false);
    setSelectedUserId(null);
  };

  return (
    <div className="users-container container-fluid py-4">
      {/* 🔝 Back & Logout at top */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex justify-content-between w-100">
          <div>
            <button
              className="btn btn-outline-info d-flex align-items-center gap-2"
              onClick={() => window.history.back()}
            >
              <i className="bi bi-arrow-left"></i> Back
            </button>
          </div>
          <div>
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
        </div>
      </div>

      <hr />

      <h5 className="text-center text-info mb-4 heading">Customer Details</h5>

      <hr />

      <div className="d-flex justify-content-end align-items-center mb-4 flex-wrap">
        <div className="d-flex gap-2">
          <div className="input-group search" style={{ maxWidth: "300px" }}>
            <span className="input-group-text bg-white">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            className="btn btn-outline-success"
            onClick={() => window.print()}
          >
            <i className="bi bi-download"></i>
          </button>
          <button
            className="btn btn-outline-primary"
            onClick={() => setShowModal(true)}
          >
            <i className="bi bi-plus-lg"></i> {isUpdate ? "" : ""}
          </button>
        </div>
      </div>

      <div className="users-grid row m-auto">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <div className="col-md-4 mb-3" key={user._id}>
              <div className="user-card  p-3 border rounded shadow-sm h-100">
                <u>
                  {" "}
                  <h5>{user.name}</h5>
                </u>
                <p>
                  <i className="bi bi-envelope-fill me-2"></i>
                  {user.email}
                </p>
                <p>
                  <i className="bi bi-telephone-fill me-2"></i>
                  {user.phone}
                </p>
                <p>
                  <i className="bi bi-geo-alt-fill me-2"></i>
                  {user.address}
                </p>

                <div className="d-flex justify-content-around mt-4 border-top pt-3">
                  <button
                    className="btn btn-outline-info me-2"
                    onClick={() => navigate(`/vehicles/${user._id}`)}
                  >
                    <i className="bi bi-truck"></i>
                  </button>

                  <a
                    href={`https://wa.me/${user.phone}`}
                    className="btn btn-outline-success btn-sm "
                    target="_blank"
                    rel="noopener noreferrer"
                    title="WhatsApp"
                  >
                    <i className="bi bi-whatsapp"></i>
                  </a>

                  <button
                    className="btn btn-outline-primary btn-sm"
                    title="Edit"
                    onClick={() => handleEdit(user)}
                  >
                    <i className="bi bi-pencil-fill"></i>
                  </button>

                  {/*
                  <button
                    className="btn btn-outline-danger btn-sm"
                    title="Delete"
                    onClick={() =>
                      Swal.fire({
                        title: "Are you sure?",
                        text: "You won't be able to revert this!",
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonColor: "#3085d6",
                        cancelButtonColor: "#d33",
                        confirmButtonText: "Yes, delete it!",
                      }).then((result) => {
                        if (result.isConfirmed) {
                          handleDelete(user._id);
                        }
                      })
                    }
                  >
                    <i className="bi bi-trash-fill"></i>
                  </button>
                  */}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted">No users found.</p>
        )}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {isUpdate ? "Update Customer" : "Add Customer"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control mb-2"
                  placeholder="Name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
                <input
                  type="email"
                  className="form-control mb-2"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
                <input
                  type="text"
                  className="form-control mb-2"
                  placeholder="Phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
                <textarea
                  className="form-control mb-2"
                  placeholder="Address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                ></textarea>
              </div>
              <div className="modal-footer justify-content-center">
                <button
                  type="button"
                  className="btn btn-secondary w-25"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary w-25"
                  onClick={handleSubmitUser}
                >
                  {isUpdate ? "Update" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllUsers;
