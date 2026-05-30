import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { uploadDocument } from '@/services/api';
import { LoadingSpinner } from '@/components/Common/LoadingSpinner';
import type { DocumentSummary } from '@/types';

interface Props {
  onUploaded: (doc: DocumentSummary) => void;
}

export function UploadForm({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File must be under 50 MB');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const result = await uploadDocument(file, setProgress);
      toast.success(`Uploaded "${file.name}" — ${result.chunks} chunks`);
      onUploaded({
        filename: file.name,
        chunks: result.chunks,
        uploaded_at: new Date().toISOString(),
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Documents
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-brand-500 bg-brand-600/10'
            : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'
        } ${uploading ? 'cursor-not-allowed' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {uploading ? (
          <div className="space-y-2">
            <LoadingSpinner className="mx-auto" />
            <p className="text-xs text-slate-400">Uploading… {progress}%</p>
            <div className="w-full bg-slate-700 rounded-full h-1">
              <div
                className="bg-brand-500 h-1 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-2xl">📄</div>
            <p className="text-sm text-slate-300 font-medium">
              Drop PDF here
            </p>
            <p className="text-xs text-slate-500">or click to browse (max 50 MB)</p>
          </div>
        )}
      </div>
    </div>
  );
}
