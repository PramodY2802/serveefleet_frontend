import React from 'react';

export const VEHICLE_PLATE_OPTIONS = [
  { value: 'white', label: 'White', description: 'Private Vehicle' },
  { value: 'yellow', label: 'Yellow', description: 'Commercial Vehicle' },
  { value: 'black', label: 'Black', description: 'Rental Vehicle' },
  { value: 'green', label: 'Green', description: 'Electric Vehicle' },
  { value: 'red', label: 'Red', description: 'Temporary Registration' },
];

const PLATE_CLASS_BY_COLOR = {
  white: 'vehicle-plate--white',
  yellow: 'vehicle-plate--yellow',
  black: 'vehicle-plate--black',
  green: 'vehicle-plate--green',
  red: 'vehicle-plate--red',
};

export const normalizeVehiclePlateColor = (value) => {
  const color = String(value || '').trim().toLowerCase();
  return PLATE_CLASS_BY_COLOR[color] ? color : 'white';
};

export const getVehiclePlateLabel = (value) => {
  const color = normalizeVehiclePlateColor(value);
  return VEHICLE_PLATE_OPTIONS.find((option) => option.value === color) || VEHICLE_PLATE_OPTIONS[0];
};

const VehiclePlate = ({ value, plateColor = 'white', fallback = 'Not provided', className = '', title }) => {
  if (!value) {
    return <span className={`vehicle-plate vehicle-plate--empty ${className}`.trim()}>{fallback}</span>;
  }

  const color = normalizeVehiclePlateColor(plateColor);
  const label = getVehiclePlateLabel(color);
  const plateText = String(value).trim().toUpperCase();

  return (
    <span
      className={`vehicle-plate ${PLATE_CLASS_BY_COLOR[color]} ${className}`.trim()}
      title={title || `${plateText} - ${label.label} ${label.description}`}
      aria-label={`${plateText} - ${label.label} ${label.description}`}
    >
      {plateText}
    </span>
  );
};

export default VehiclePlate;
