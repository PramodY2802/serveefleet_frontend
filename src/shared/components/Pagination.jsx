import React from 'react';
import Button from './ui/Button.jsx';

const Pagination = ({ page, pages, onChange }) => {
  if (pages <= 1) return null;

  const items = [];
  for (let index = 1; index <= pages; index += 1) {
    items.push(<Button key={index} variant={index === page ? 'primary' : 'outline'} size="sm" onClick={() => onChange(index)}>{index}</Button>);
  }

  return (
    <nav className="pagination-nav" aria-label="Pagination">
      <Button variant="outline" size="sm" icon="bi-chevron-left" iconOnly aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)} />
      {items}
      <Button variant="outline" size="sm" icon="bi-chevron-right" iconOnly aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)} />
    </nav>
  );
};

export default Pagination;
