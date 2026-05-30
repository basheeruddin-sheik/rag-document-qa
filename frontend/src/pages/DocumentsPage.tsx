import { useEffect, useState, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { listDocuments, deleteDocument, uploadDocument } from '@/services/api';
import { LoadingSpinner } from '@/components/Common/LoadingSpinner';
import type { DocumentSummary } from '@/types';

type SortField = 'date' | 'name' | 'chunks';
type SortDir = 'asc' | 'desc';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatBytes(chunks: number) {
  // rough estimate: each chunk ≈ 500 chars ≈ 500 bytes
  const bytes = chunks * 500;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    listDocuments()
      .then(setDocs)
      .catch(() => toast.error('Could not load documents'))
      .finally(() => setLoading(false));
  }, []);

  // ── Filter + Sort ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = docs.filter((d) => d.filename.toLowerCase().includes(q));

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.filename.localeCompare(b.filename);
      if (sortField === 'chunks') cmp = a.chunks - b.chunks;
      if (sortField === 'date') cmp = new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [docs, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="text-slate-700">↕</span>;
    return <span className="text-brand-400">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // ── Upload ───────────────────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') { toast.error('Only PDF files are supported'); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error('File must be under 50 MB'); return; }

    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadDocument(file, setUploadProgress);
      toast.success(`Uploaded "${file.name}" — ${result.chunks} chunks`);
      setDocs((prev) => [
        { filename: file.name, chunks: result.chunks, uploaded_at: new Date().toISOString() },
        ...prev.filter((d) => d.filename !== file.name),
      ]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete "${filename}" and all its chunks?`)) return;
    setDeleting(filename);
    try {
      await deleteDocument(filename);
      setDocs((prev) => prev.filter((d) => d.filename !== filename));
      toast.success(`Deleted "${filename}"`);
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(null); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950 flex-shrink-0">
        <h1 className="text-sm font-semibold text-slate-300">My Documents</h1>

        {/* Upload button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <button
            onClick={() => !uploading && fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
          >
            {uploading ? (
              <><LoadingSpinner size="sm" className="text-white" /> Uploading {uploadProgress}%</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg> Upload PDF</>
            )}
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto p-6"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        {/* Drag overlay */}
        {dragging && (
          <div className="fixed inset-0 z-50 bg-brand-600/20 border-4 border-dashed border-brand-500 flex items-center justify-center pointer-events-none">
            <p className="text-2xl font-bold text-brand-400">Drop PDF to upload</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : docs.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
              <span className="text-3xl">📄</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-300 mb-2">No documents yet</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-xs">
              Upload a PDF to get started. Your documents will appear here and be searchable via chat.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition"
            >
              Upload your first PDF
            </button>
          </div>
        ) : (
          <>
            {/* Search + sort bar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by filename…"
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">✕</button>
                )}
              </div>

              <p className="text-sm text-slate-500">
                {filtered.length === docs.length
                  ? `${docs.length} document${docs.length !== 1 ? 's' : ''}`
                  : `${filtered.length} of ${docs.length} documents`}
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-500 text-sm">No documents match "<span className="text-slate-300">{search}</span>"</p>
                <button onClick={() => setSearch('')} className="text-brand-400 text-sm mt-2 hover:underline">Clear search</button>
              </div>
            ) : (
              /* Documents table */
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <button onClick={() => toggleSort('name')} className="text-left flex items-center gap-1 hover:text-slate-300">
                    File name {sortIcon('name')}
                  </button>
                  <button onClick={() => toggleSort('chunks')} className="flex items-center gap-1 hover:text-slate-300">
                    Chunks {sortIcon('chunks')}
                  </button>
                  <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-slate-300">
                    Uploaded {sortIcon('date')}
                  </button>
                  <span />
                </div>

                {/* Rows */}
                {filtered.map((doc, i) => (
                  <div
                    key={doc.filename}
                    className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-4 ${
                      i < filtered.length - 1 ? 'border-b border-slate-800' : ''
                    } hover:bg-slate-800/50 transition group`}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 group-hover:border-slate-600 transition">
                        <span className="text-base">📄</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate" title={doc.filename}>
                          {doc.filename}
                        </p>
                        <p className="text-xs text-slate-500">{formatBytes(doc.chunks)}</p>
                      </div>
                    </div>

                    {/* Chunks */}
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 bg-slate-800 border border-slate-700 text-xs text-slate-400 rounded-full">
                        {doc.chunks} chunks
                      </span>
                    </div>

                    {/* Date */}
                    <p className="text-sm text-slate-500 whitespace-nowrap">
                      {formatDate(doc.uploaded_at)}
                    </p>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(doc.filename)}
                      disabled={deleting === doc.filename}
                      className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition disabled:opacity-40"
                      title="Delete document"
                    >
                      {deleting === doc.filename ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
