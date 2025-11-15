export interface ManagedFile {
  id: string;
  file: File;
  state: 'unprocessed' | 'compressing' | 'compressed' | 'error';
  compressedFile?: File | Blob;
  error?: string;
  progress: number;
}
