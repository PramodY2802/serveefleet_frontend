import React, { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../styles/allUsers.css"; // Optional: Your custom styling

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [isUpdate, setIsUpdate] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchUsers = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user || !user._id) return;

      const res = await axios.get(
        `${backendUrl}/api/customers/user/${user._id}`
      );

      setUsers(res.data);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async () => {
    const { name, email, phone, address } = formData;
    if (!name || !email || !phone || !address) {
      return Swal.fire("All fields are required!", "", "warning");
    }

    const user = JSON.parse(localStorage.getItem("user"));
    console.log(user);
    if (!user || !user._id) return;

    try {
      if (isUpdate) {
        const res = await axios.put(
          `${backendUrl}/api/customers/${selectedUserId}`,
          formData
        );

        setUsers(users.map((u) => (u._id === selectedUserId ? res.data : u)));
        Swal.fire("Updated successfully!", "", "success");
      } else {
        const res = await axios.post(`${backendUrl}/api/customers/`, {
          ...formData,
          userId: user._id,
        });

        setUsers([...users, res.data]);
        Swal.fire("User added!", "", "success");
      }

      setFormData({ name: "", email: "", phone: "", address: "" });
      setSelectedUserId(null);
      setIsUpdate(false);
      setShowModal(false);
    } catch (err) {
      console.error("Error submitting user:", err);
      Swal.fire("Error occurred!", "", "error");
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${backendUrl}/api/customers/${id}`);

      setUsers(users.filter((user) => user._id !== id));
      Swal.fire("Deleted!", "", "success");
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  const handleEdit = (user) => {
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
    });
    setSelectedUserId(user._id);
    setIsUpdate(true);
    setShowModal(true);
  };

  return (
    <div className="container mt-4">
      <h3 className="text-center mb-4">User Management</h3>

      <div className="d-flex justify-content-end mb-3">
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-circle me-2"></i> Add User
        </button>
      </div>

      <div className="row">
        {users.map((user) => (
          <div className="col-md-4 mb-3" key={user._id}>
            <div className="card shadow-sm p-3">
              <h5>{user.name}</h5>
              <p>
                <i className="bi bi-envelope"></i> {user.email}
              </p>
              <p>
                <i className="bi bi-telephone"></i> {user.phone}
              </p>
              <p>
                <i className="bi bi-geo-alt"></i> {user.address}
              </p>
              <div className="d-flex justify-content-between">
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => handleEdit(user)}
                >
                  <i className="bi bi-pencil-square"></i>
                </button>
                {/*
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => handleDelete(user._id)}
                >
                  <i className="bi bi-trash"></i>
                </button>
                */}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content p-3">
              <h5 className="text-center mb-3">
                {isUpdate ? "Update User" : "Add User"}
              </h5>

              <input
                type="text"
                placeholder="Name"
                className="form-control mb-2"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
              <input
                type="email"
                placeholder="Email"
                className="form-control mb-2"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Phone"
                className="form-control mb-2"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Address"
                className="form-control mb-3"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />

              <div className="d-flex justify-content-between">
                <button
                  className="btn btn-secondary w-50 me-2"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({
                      name: "",
                      email: "",
                      phone: "",
                      address: "",
                    });
                    setIsUpdate(false);
                    setSelectedUserId(null);
                  }}
                >
                  Cancel
                </button>
                <button className="btn btn-success w-50" onClick={handleSubmit}>
                  {isUpdate ? "Update" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
