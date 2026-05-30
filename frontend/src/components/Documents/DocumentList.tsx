import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { listDocuments, deleteDocument } from '@/services/api';
import { LoadingSpinner } from '@/components/Common/LoadingSpinner';
import type { DocumentSummary } from '@/types';

interface Props {
  docs: DocumentSummary[];
  setDocs: React.Dispatch<React.SetStateAction<DocumentSummary[]>>;
}

export function DocumentList({ docs, setDocs }: Props) {
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    listDocuments()
      .then(setDocs)
      .catch(() => toast.error('Could not load documents'))
      .finally(() => setLoading(false));
  }, [setDocs]);

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete "${filename}" and all its chunks?`)) return;
    setDeleting(filename);
    try {
      await deleteDocument(filename);
      setDocs((prev) => prev.filter((d) => d.filename !== filename));
      toast.success(`Deleted "${filename}"`);
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-slate-500 text-sm">No documents yet</p>
        <p className="text-slate-600 text-xs mt-1">Upload a PDF above to get started</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {docs.map((doc) => (
        <li
          key={doc.filename}
          className="flex items-start justify-between gap-2 group p-2.5 rounded-lg hover:bg-slate-800 transition"
        >
          <div className="flex items-start gap-2 min-w-0">
            <span className="text-base flex-shrink-0 mt-0.5">📄</span>
            <div className="min-w-0">
              <p className="text-sm text-slate-200 font-medium truncate" title={doc.filename}>
                {doc.filename}
              </p>
              <p className="text-xs text-slate-500">
                {doc.chunks} chunks · {new Date(doc.uploaded_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleDelete(doc.filename)}
            disabled={deleting === doc.filename}
            className="flex-shrink-0 p-1 text-slate-600 hover:text-red-400 disabled:opacity-40 transition opacity-0 group-hover:opacity-100"
            title="Delete document"
          >
            {deleting === doc.filename ? (
              <LoadingSpinner size="sm" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
