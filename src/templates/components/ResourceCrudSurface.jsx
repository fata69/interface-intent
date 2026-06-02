import { ConfirmationModal } from './ConfirmationModal';
import { DetailDrawer } from './DetailDrawer';
import { PageError } from './PageError';
import { ResourceModal } from './ResourceModal';
import { ResourceTable } from './ResourceTable';
import { ResourceToolbar } from './ResourceToolbar';
import { UnavailablePanel } from './UnavailablePanel';

export function ResourceCrudSurface({ resource, data, loading, crud, toolbarSlot, children }) {
  const { capabilities, config } = crud;

  return (
    <>
      <PageError errors={!crud.modal ? crud.errors : []} />

      <section className="data-panel">
        {children || (
          <>
            <ResourceToolbar
              config={config}
              query={crud.query}
              onQueryChange={crud.setQuery}
              onCreate={crud.openCreate}
              disabled={loading || crud.busy}
              canCreate={capabilities.canCreate}
            >
              {toolbarSlot}
            </ResourceToolbar>

            {!capabilities.canRead ? (
              <UnavailablePanel config={config} canCreate={capabilities.canCreate} />
            ) : (
              <ResourceTable
                resource={resource}
                config={config}
                data={data}
                rows={crud.paginatedRows}
                pagination={crud.pagination}
                sort={crud.sort}
                canUpdate={capabilities.canUpdate}
                canRemove={capabilities.canRemove}
                onSort={crud.setSort}
                onView={crud.openDrawer}
                onEdit={crud.openEdit}
                onDelete={crud.deleteRow}
              />
            )}
          </>
        )}
      </section>

      <ResourceModal
        modal={crud.modal}
        form={crud.form}
        errors={crud.errors}
        visibleFields={crud.visibleFormFields}
        data={data}
        busy={crud.busy}
        onChangeField={crud.updateFormField}
        onFormatJson={crud.formatJsonField}
        onClose={() => crud.setModal(null)}
        onSubmit={crud.saveForm}
      />

      <DetailDrawer
        drawer={crud.drawer}
        data={data}
        onClose={() => crud.setDrawer(null)}
        onEdit={(row) => {
          crud.setDrawer(null);
          crud.openEdit(row);
        }}
      />

      <ConfirmationModal
        confirmation={crud.confirmation}
        onCancel={() => crud.setConfirmation(null)}
        onConfirm={crud.confirmDelete}
      />
    </>
  );
}
