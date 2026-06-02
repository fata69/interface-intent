import { ArrowDown, ArrowUp, ArrowUpDown, Boxes, ChevronLeft, ChevronRight, Eye, Pencil, Trash2 } from 'lucide-react';
import { renderValue } from '../../utils/resourceUtils.jsx';

function SortIcon({ active, direction }) {
  if (!active) return <ArrowUpDown size={13} />;
  return direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
}

export function ResourceTable({ resource, config, data, rows, pagination, sort, canUpdate, canRemove, onSort, onView, onEdit, onDelete }) {
  const loadedRows = Array.isArray(data[resource]) ? data[resource].length : 0;
  const emptyMessage = loadedRows ? 'Tidak ada data untuk filter ini.' : 'Belum ada data.';

  return (
    <>
      <div className="table-wrap">
        <table className={`resource-table resource-${resource}`}>
          <thead>
            <tr>
              {config.columns.map((column) => {
                const sortable = column === 'id';
                const active = sort?.column === column;
                if (!sortable) return <th key={column} className={`col-${column}`}>{column.replaceAll('_', ' ')}</th>;

                return (
                  <th key={column} className={`col-${column}`}>
                    <button
                      className={active ? 'sort-header active' : 'sort-header'}
                      type="button"
                      onClick={() => onSort(column)}
                      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      title={`Sort by ${column.replaceAll('_', ' ')}`}
                    >
                      <span>{column.replaceAll('_', ' ')}</span>
                      <SortIcon active={active} direction={sort?.direction} />
                    </button>
                  </th>
                );
              })}
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id ?? row.uuid} className="clickable-row" onClick={() => onView(row)}>
                {config.columns.map((column) => (
                  <td key={column} className={`cell-${column}`}>{renderValue(resource, row, column, data)}</td>
                ))}
                <td className="row-actions" onClick={(event) => event.stopPropagation()}>
                  <button className="ghost-button" onClick={() => onView(row)} title="View details">
                    <Eye size={16} />
                  </button>
                  <button className="ghost-button" onClick={() => onEdit(row)} title={canUpdate ? 'Edit' : 'Endpoint update belum tersedia'} disabled={!canUpdate}>
                    <Pencil size={16} />
                  </button>
                  <button className="ghost-button danger" onClick={() => onDelete(row)} title={canRemove ? 'Delete' : 'Endpoint delete belum tersedia'} disabled={!canRemove}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={config.columns.length + 1} className="empty-state">
                  <Boxes size={28} />
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-pagination">
        <div className="pagination-meta">
          <label className="rows-per-page">
            <span>Rows per page</span>
            <select value={pagination.pageSize} onChange={(event) => pagination.setPageSize(event.target.value)}>
              {pagination.pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <span>Showing {pagination.start} to {pagination.end} of {pagination.totalRows} records</span>
        </div>
        <div className="pagination-controls">
          <button className="pagination-button" type="button" onClick={pagination.firstPage} disabled={!pagination.canPrevious}>First</button>
          <button className="pagination-button icon" type="button" onClick={pagination.previousPage} disabled={!pagination.canPrevious} title="Previous page">
            <ChevronLeft size={16} />
          </button>
          {pagination.pages.map((pageNumber) => (
            <button
              key={pageNumber}
              className={pageNumber === pagination.page ? 'pagination-button active' : 'pagination-button'}
              type="button"
              onClick={() => pagination.goToPage(pageNumber)}
              aria-current={pageNumber === pagination.page ? 'page' : undefined}
            >
              {pageNumber}
            </button>
          ))}
          <button className="pagination-button icon" type="button" onClick={pagination.nextPage} disabled={!pagination.canNext} title="Next page">
            <ChevronRight size={16} />
          </button>
          <button className="pagination-button" type="button" onClick={pagination.lastPage} disabled={!pagination.canNext}>Last</button>
        </div>
      </div>
    </>
  );
}
