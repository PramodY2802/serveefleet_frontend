import React, { useMemo } from 'react';
import { Card } from './ui/Card.jsx';
import { EmptyState } from './ui/StateBlocks.jsx';
import { sortByLatestUpdated } from '../../utils/dateUtils.js';

const DataTable = ({ columns, data = [], rowKey = 'id', toolbar, emptyTitle = 'No records found', emptyDescription = 'Try changing filters or adding a new record.' }) => {
  const sortedData = useMemo(() => sortByLatestUpdated(data), [data]);

  return (
    <Card className="table-shell">
      {toolbar && <div className="ui-card__body table-toolbar">{toolbar}</div>}
      <div className="table-scroll">
        <table className="ui-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key || column.label} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              sortedData.map((item, index) => (
                <tr key={item[rowKey] || item._id || index}>
                  {columns.map((column) => (
                    <td key={column.key || column.label}>{column.render ? column.render(item) : item[column.key]}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default DataTable;
