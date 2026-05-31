import React from 'react';

const SearchInput = ({ value, onChange, placeholder = 'Search...', className = '' }) => (
  <div className={`input-group ${className}`}>
    <span className="input-group-text bg-white border-end-0">
      <i className="bi bi-search"></i>
    </span>
    <input
      type="search"
      className="form-control border-start-0"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  </div>
);

export default SearchInput;
