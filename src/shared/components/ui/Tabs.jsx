import React from 'react';

const Tabs = ({ items = [], value, onChange }) => (
  <div className="ui-tabs" role="tablist">
    {items.map((item) => (
      <button
        key={item.value}
        type="button"
        className={`ui-tabs__item ${item.value === value ? 'is-active' : ''}`}
        onClick={() => onChange?.(item.value)}
        role="tab"
        aria-selected={item.value === value}
      >
        {item.icon && <i className={`bi ${item.icon}`} aria-hidden="true" />}
        <span>{item.label}</span>
      </button>
    ))}
  </div>
);

export default Tabs;
