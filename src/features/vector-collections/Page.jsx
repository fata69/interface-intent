import { PageHeader, StatusStrip } from '../../templates/components/PageHeader';
import { VectorCollectionPanel } from './components/VectorCollectionPanel';
import { vectorCollectionPage } from './config';

export function VectorCollectionsPage({ data, apiStatus, loading, loadData }) {
  const statusWarning = apiStatus.includes('gagal') || apiStatus.includes('belum');
  const collectionCount = data.semanticSearches?.length || 0;

  return (
    <div className="vector-page">
      <PageHeader
        config={vectorCollectionPage}
        eyebrow="n8n PGVector"
        countLabel={`${collectionCount} collections`}
        onRefresh={loadData}
      />
      <StatusStrip warning={statusWarning}>{loading ? 'Memuat data collection...' : apiStatus}</StatusStrip>
      <VectorCollectionPanel collections={data.semanticSearches || []} loading={loading} loadData={loadData} />
    </div>
  );
}
