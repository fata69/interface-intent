import { DatabaseZap, FileSearch, UploadCloud } from 'lucide-react';

export const vectorCollectionPage = {
  title: 'Vector Collections',
  singular: 'Vector Collection',
  icon: DatabaseZap,
  description: 'Kelola upload dan file knowledge per collection.',
  fields: [],
  columns: [],
};

export const vectorKnowledgeUploadPage = {
  title: 'Upload Knowledge',
  singular: 'Knowledge Upload',
  icon: UploadCloud,
  description: 'Pilih collection target lalu upload Text atau PDF.',
  fields: [],
  columns: [],
};

export const vectorCollectionFilesPage = {
  title: 'Collection Knowledge',
  singular: 'Collection Knowledge',
  icon: FileSearch,
  description: 'Lihat isi knowledge aktif yang tersimpan per collection.',
  fields: [],
  columns: [],
};
