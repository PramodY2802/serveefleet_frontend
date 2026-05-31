// SearchPage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { Link, useNavigate } from 'react-router-dom';
import VehiclePlate from '../shared/components/VehiclePlate.jsx';
import { formatDateTimeIST, getLatestTimestamp, sortByLatestUpdated } from '../utils/dateUtils.js';


const backendUrl = process.env.REACT_APP_BACKEND_URL; 

const getLegacyAccessToken = () => {
  try {
    const session = JSON.parse(localStorage.getItem('servifleet_auth') || '{}');
    return session.accessToken || localStorage.getItem('token') || '';
  } catch {
    return localStorage.getItem('token') || '';
  }
};

const SearchPage = () => {
  const [search, setSearch] = useState("");
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const token = getLegacyAccessToken();
      const res = await axios.get(`${backendUrl}/api/services/search/customers-vehicles`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setData(res.data);
      setFiltered(res.data);
    } catch (err) {
      console.error("Failed to fetch customer/vehicle data", err);
    }
  };

  const handleSearch = (e) => {
    const keyword = e.target.value.toLowerCase();
    setSearch(keyword);

    const filteredData = data.filter(
      (item) =>
        item.name?.toLowerCase().includes(keyword) ||
        item.email?.toLowerCase().includes(keyword) ||
        item.phone?.toLowerCase().includes(keyword) ||
        item.registrationNumber?.toLowerCase().includes(keyword)
    );

    setFiltered(filteredData);
    setCurrentPage(1); // reset to first page on new search
  };

  const sortedFiltered = sortByLatestUpdated(filtered);

  const exportToExcel = () => {
    const exportData = filtered.map(
      ({ name, email, phone, vehicleNumber, make, model, fuelType }) => ({
        Name: name,
        Email: email,
        Phone: phone,
        "Vehicle No": vehicleNumber || "N/A",
        Make: make || "-",
        Model: model || "-",
        Fuel: fuelType || "-",
      })
    );

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SearchData");
    XLSX.writeFile(workbook, "CustomerVehicleSearch.xlsx");
  };

  // Pagination logic
  const totalPages = Math.ceil(sortedFiltered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedFiltered.slice(startIndex, startIndex + itemsPerPage);

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

      <hr />

     <div className=" p-3 rounded mb-4">
  <h4 className="heading text-info mb-3 text-center">
    <i className="bi bi-search me-2"></i>Customer & Vehicle Search
  </h4>

<hr />
  <div className="d-flex gap-2 flex-wrap">
    <input
      type="text"
      className="form-control w-50"
      placeholder="Search by name, email, phone, vehicle..."
      value={search}
      onChange={handleSearch}
    />
    <button className="btn btn-outline-info m-auto" onClick={exportToExcel}>
      <i className="bi bi-download me-1"></i> Excel
    </button>
  </div>
</div>


      <div className="table-responsive shadow-sm rounded">
        <table className="table table-hover table-bordered table-striped align-middle text-center">
          <thead className="table-dark">
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Vehicle No</th>
              <th>Make</th>
              <th>Model</th>
              <th>Fuel</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((item, index) => (
                <tr key={index}>
                  <td>{item.name}</td>
                  <td>{item.email}</td>
                  <td>{item.phone}</td>
                  <td>{item.vehicleNumber ? <VehiclePlate value={item.vehicleNumber} plateColor={item.plateColor} /> : "N/A"}</td>
                  <td>{item.make || "-"}</td>
                  <td>{item.model || "-"}</td>
                  <td>{item.fuelType || "-"}</td>
                  <td>{formatDateTimeIST(getLatestTimestamp(item))}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center">
                  No results found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-3">
          <ul className="pagination justify-content-center">
            {[...Array(totalPages)].map((_, i) => (
              <li
                key={i}
                className={`page-item ${currentPage === i + 1 ? "active" : ""}`}
              >
                <button className="page-link" onClick={() => setCurrentPage(i + 1)}>
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
};

export default SearchPage;
