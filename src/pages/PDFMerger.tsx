import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import {
  FileText, Upload, Zap, BrainCircuit, Download, Trash2,
  CheckCircle, AlertCircle, RefreshCw, ArrowRight, GripVertical,
  FileOutput, Scissors, Shrink, Image, Plus, X, Clock,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  file: File;  // Actual File object for multipart upload
  file_id?: string;  // Server-assigned after upload
  storage_path?: string;
}

interface MergeResult {
  output_name: string;
  size_kb: number;
  pages_merged?: number;
  storage_url?: string;
  download_url?: string;
  ai_order?: number[];
  ai_reasoning?: string;
  errors?: string[];
  compression_ratio?: number;
  images_compressed?: number;
  quality_used?: number;
  images?: Array<{
    name: string;
    page: number;
    size_kb: number;
    dimensions: string;
  }>;
}

type CommandType = 'merge_pdfs' | 'smart_merge' | 'split_pdf' | 'compress_pdf' | 'pdf_to_images';

// ── Constants ──────────────────────────────────────────────────────────────

const COMMANDS: { id: CommandType; label: string; icon: React.ComponentType<{ className?: string }>; description: string; ai: boolean; color: string }[] = [
  { id: 'merge_pdfs', label: 'Merge', icon: FileOutput, description: 'Combine PDFs in order', ai: false, color: 'text-brand-primary' },
  { id: 'smart_merge', label: 'Smart Merge', icon: BrainCircuit, description: 'AI orders & renames', ai: true, color: 'text-violet-400' },
  { id: 'split_pdf', label: 'Split', icon: Scissors, description: 'Split by page ranges', ai: false, color: 'text-sky-400' },
  { id: 'compress_pdf', label: 'Compress', icon: Shrink, description: 'Reduce file size', ai: false, color: 'text-amber-400' },
  { id: 'pdf_to_images', label: 'To Images', icon: Image, description: 'Convert pages to PNG', ai: false, color: 'text-emerald-400' },
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILES = 10;

// ═══════════════════════════════════════════════════════════════════════════

export default function PDFMerger() {
  const { restEndpoint, masterToken } = useStore();
  const base = restEndpoint.replace(/\/+$/, '');

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [command, setCommand] = useState<CommandType>('merge_pdfs');
  const [splitPages, setSplitPages] = useState('1-3,4-6');
  const [compressQuality, setCompressQuality] = useState(50);
  const [imagePages, setImagePages] = useState('all');
  const [outputName, setOutputName] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<MergeResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCommand = COMMANDS.find(c => c.id === command)!;

  // ── Auth headers for multipart (no Content-Type — browser sets it with boundary) ──
  const authHeaders: Record<string, string> = {};
  if (masterToken) authHeaders['Authorization'] = `Bearer ${masterToken}`;

  // ── File Handling ────────────────────────────────────────────────────────

  const processFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: UploadedFile[] = [];
    let hasErrors = false;

    Array.from(fileList).forEach(file => {
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
        toast.error(`${file.name} is not a PDF`);
        hasErrors = true;
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 25MB limit`);
        hasErrors = true;
        return;
      }
      if (files.length + newFiles.length >= MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} files allowed`);
        hasErrors = true;
        return;
      }

      newFiles.push({
        id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        file: file,
      });
    });

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles].slice(0, MAX_FILES));
      toast.success(`${newFiles.length} PDF(s) added`);
    }
  }, [files.length]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setResult(null);
  };

  const clearFiles = () => {
    setFiles([]);
    setResult(null);
  };

  // ── Upload files via multipart ───────────────────────────────────────────

  const uploadFiles = async (): Promise<string[]> => {
    const formData = new FormData();
    let count = 0;

    files.forEach(f => {
      if (!f.file_id) {
        formData.append('files', f.file, f.name);
        count++;
      }
    });

    if (count === 0) {
      // All files already uploaded — return existing file_ids
      return files.map(f => f.file_id!);
    }

    formData.append('command', 'upload_only');
    formData.append('workspace_id', 'default');

    const resp = await fetch(`${base}/plugins/pdf_merger/upload`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || err.detail || `Upload failed (HTTP ${resp.status})`);
    }

    const data = await resp.json();
    
    // Map returned file_ids back to our local files
    const returnedFiles = data.files || [];
    setFiles(prev => prev.map(f => {
      const match = returnedFiles.find((rf: any) => rf.filename === f.name);
      if (match) {
        return { ...f, file_id: match.file_id, storage_path: match.storage_path };
      }
      return f;
    }));

    return returnedFiles.map((rf: any) => rf.file_id);
  };

  // ── Execute Command ──────────────────────────────────────────────────────

  const executeCommand = async () => {
    if (files.length === 0) {
      toast.error('Please upload at least one PDF');
      return;
    }

    const needsMultiple = command === 'merge_pdfs' || command === 'smart_merge';
    if (needsMultiple && files.length < 2) {
      toast.error('Merge requires at least 2 PDFs');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Step 1: Upload files via multipart
      setUploading(true);
      let fileIds: string[];
      try {
        fileIds = await uploadFiles();
      } catch (err: any) {
        toast.error(err.message || 'Upload failed');
        setLoading(false);
        setUploading(false);
        return;
      }
      setUploading(false);

      // Step 2: Execute the command with file_ids
      const params: Record<string, any> = { file_ids: fileIds };

      if (command === 'split_pdf') params.pages = splitPages;
      if (command === 'compress_pdf') params.quality = compressQuality;
      if (command === 'pdf_to_images') params.pages = imagePages;
      if (command === 'smart_merge') params.brand_id = 'default';
      if (outputName) params.output_name = outputName;

      const res = await fetch(`${base}/plugins/pdf_merger/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          command,
          workspace_id: 'default',
          params,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setResult(data.data);
        toast.success(data.message || 'Operation completed');
      } else {
        toast.error(data.error || 'Operation failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Request failed');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  // ── Drag & Drop ──────────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // ═════════════════════════════════════════════════════════════════════════

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-5 pb-24">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
          <FileText className="w-5 h-5 text-brand-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">PDF Merger</h1>
          <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
            Merge · Split · Compress · Convert — with optional AI assistance
          </p>
        </div>
      </div>

      {/* Command Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {COMMANDS.map(cmd => (
          <button
            key={cmd.id}
            onClick={() => { setCommand(cmd.id); setResult(null); }}
            className={cn(
              'p-3 rounded-xl border text-center transition-all',
              command === cmd.id
                ? 'bg-brand-primary/10 border-brand-primary shadow-lg shadow-brand-primary/10'
                : 'bg-brand-surface border-brand-border/50 hover:border-brand-primary/30',
            )}>
            <cmd.icon className={cn('w-5 h-5 mx-auto mb-1', command === cmd.id ? cmd.color : 'text-brand-text-muted')} />
            <span className={cn('text-[10px] font-mono font-bold block', command === cmd.id ? 'text-white' : 'text-brand-text-muted')}>
              {cmd.label}
            </span>
            {cmd.ai && (
              <span className="text-[8px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                AI
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer',
          dragOver
            ? 'border-brand-primary bg-brand-primary/5'
            : 'border-brand-border/50 bg-brand-surface/30 hover:border-brand-primary/30',
        )}
        onClick={() => fileInputRef.current?.click()}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />
        <Upload className="w-10 h-10 text-brand-text-muted mx-auto mb-3 opacity-50" />
        <p className="text-sm text-white font-bold">Drop PDFs here or click to upload</p>
        <p className="text-[10px] text-brand-text-muted font-mono mt-1">Max 25MB per file · Up to {MAX_FILES} files · Multipart upload</p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-mono font-bold uppercase text-brand-text-muted tracking-wider">
              {files.length} file{files.length > 1 ? 's' : ''} · {formatSize(files.reduce((s, f) => s + f.size, 0))}
              {files.some(f => f.file_id) && (
                <span className="text-emerald-400 ml-2">● {files.filter(f => f.file_id).length} uploaded</span>
              )}
            </h3>
            <button onClick={clearFiles} className="text-[9px] font-mono text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Clear all
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {files.map((file, i) => (
              <div key={file.id} className="flex items-center gap-3 py-2 px-3 bg-brand-elevated/30 rounded-lg group">
                <GripVertical className="w-3 h-3 text-brand-text-muted opacity-30 flex-shrink-0" />
                <span className="text-[9px] font-mono text-brand-text-muted w-6 flex-shrink-0">{i + 1}.</span>
                <FileText className="w-4 h-4 text-brand-primary flex-shrink-0" />
                <span className="text-xs text-white truncate flex-1">{file.name}</span>
                <span className="text-[9px] font-mono text-brand-text-muted flex-shrink-0">{formatSize(file.size)}</span>
                {file.file_id ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                )}
                <button onClick={() => removeFile(file.id)} className="opacity-0 group-hover:opacity-100 text-brand-text-muted hover:text-red-400 transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Output Name (for merge commands) */}
      {(command === 'merge_pdfs' || command === 'smart_merge') && files.length > 0 && (
        <div className="bg-brand-surface border border-brand-border/50 rounded-xl p-4">
          <label className="text-[10px] font-mono font-bold uppercase text-brand-text-muted block mb-2">Output Filename (optional)</label>
          <input
            type="text"
            value={outputName}
            onChange={e => setOutputName(e.target.value)}
            placeholder="e.g., combined-report.pdf"
            className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl px-3 py-2.5 text-sm text-brand-text font-mono focus:outline-none focus:border-brand-primary/50"
          />
        </div>
      )}

      {/* Command-specific Options */}
      {command === 'split_pdf' && files.length > 0 && (
        <div className="bg-brand-surface border border-brand-border/50 rounded-xl p-4">
          <label className="text-[10px] font-mono font-bold uppercase text-brand-text-muted block mb-2">Page Ranges</label>
          <input
            type="text"
            value={splitPages}
            onChange={e => setSplitPages(e.target.value)}
            placeholder="e.g., 1-3,4-6,7-10"
            className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl px-3 py-2.5 text-sm text-brand-text font-mono focus:outline-none focus:border-brand-primary/50"
          />
          <p className="text-[9px] text-brand-text-muted font-mono mt-1.5">Comma-separated ranges: "1-3,4-6" or single pages: "1,3,5"</p>
        </div>
      )}

      {command === 'compress_pdf' && files.length > 0 && (
        <div className="bg-brand-surface border border-brand-border/50 rounded-xl p-4">
          <label className="text-[10px] font-mono font-bold uppercase text-brand-text-muted block mb-2">
            Quality: {compressQuality}%
          </label>
          <input
            type="range"
            min="10"
            max="90"
            value={compressQuality}
            onChange={e => setCompressQuality(parseInt(e.target.value))}
            className="w-full accent-brand-primary"
          />
          <div className="flex justify-between text-[9px] font-mono text-brand-text-muted mt-1">
            <span>Smallest</span>
            <span>Best</span>
          </div>
        </div>
      )}

      {command === 'pdf_to_images' && files.length > 0 && (
        <div className="bg-brand-surface border border-brand-border/50 rounded-xl p-4">
          <label className="text-[10px] font-mono font-bold uppercase text-brand-text-muted block mb-2">Pages to Convert</label>
          <input
            type="text"
            value={imagePages}
            onChange={e => setImagePages(e.target.value)}
            placeholder="all or 1-3,5"
            className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl px-3 py-2.5 text-sm text-brand-text font-mono focus:outline-none focus:border-brand-primary/50"
          />
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={executeCommand}
        disabled={files.length === 0 || loading}
        className={cn(
          'w-full py-3 rounded-xl font-bold font-mono uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-2',
          activeCommand.ai
            ? 'bg-violet-500 text-white hover:bg-violet-600 shadow-lg shadow-violet-500/25'
            : 'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-glow-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}>
        {loading ? (
          <>{uploading ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
          ) : (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Processing...</>
          )}</>
        ) : (
          <>{activeCommand.ai ? <BrainCircuit className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
          {activeCommand.label} {files.length > 0 && `(${files.length} file${files.length > 1 ? 's' : ''})`}</>
        )}
      </button>

      {/* Upload progress indicator */}
      {uploading && (
        <div className="bg-brand-surface border border-brand-border/50 rounded-xl p-4 flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-brand-primary animate-spin" />
          <div>
            <p className="text-sm text-white font-bold">Uploading files...</p>
            <p className="text-[10px] text-brand-text-muted font-mono">
              {files.filter(f => f.file_id).length} of {files.length} uploaded
            </p>
          </div>
        </div>
      )}

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">Complete</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <span className="text-[9px] font-mono text-brand-text-muted uppercase">Output</span>
                <p className="text-xs font-bold text-white truncate">{result.output_name}</p>
              </div>
              <div>
                <span className="text-[9px] font-mono text-brand-text-muted uppercase">Size</span>
                <p className="text-xs font-bold text-white">{result.size_kb}KB</p>
              </div>
              {result.pages_merged && (
                <div>
                  <span className="text-[9px] font-mono text-brand-text-muted uppercase">Pages</span>
                  <p className="text-xs font-bold text-white">{result.pages_merged}</p>
                </div>
              )}
              {result.compression_ratio !== undefined && (
                <div>
                  <span className="text-[9px] font-mono text-brand-text-muted uppercase">Compression</span>
                  <p className="text-xs font-bold text-emerald-400">{result.compression_ratio}% smaller</p>
                </div>
              )}
              {result.images_compressed !== undefined && (
                <div>
                  <span className="text-[9px] font-mono text-brand-text-muted uppercase">Images Optimized</span>
                  <p className="text-xs font-bold text-white">{result.images_compressed}</p>
                </div>
              )}
            </div>

            {/* AI Reasoning */}
            {result.ai_reasoning && (
              <div className="bg-violet-500/5 border border-violet-500/10 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <BrainCircuit className="w-3 h-3 text-violet-400" />
                  <span className="text-[9px] font-mono font-bold text-violet-400 uppercase">AI Reasoning</span>
                </div>
                <p className="text-[10px] text-brand-text-muted font-mono">{result.ai_reasoning}</p>
                {result.ai_order && (
                  <p className="text-[9px] text-brand-text-muted font-mono mt-1">
                    Order: {result.ai_order.join(' → ')}
                  </p>
                )}
              </div>
            )}

            {/* Images output */}
            {result.images && result.images.length > 0 && (
              <div className="bg-sky-500/5 border border-sky-500/10 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Image className="w-3 h-3 text-sky-400" />
                  <span className="text-[9px] font-mono font-bold text-sky-400 uppercase">Converted Images</span>
                </div>
                <div className="space-y-1">
                  {result.images.map((img, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-brand-text-muted">{img.name}</span>
                      <span className="text-brand-text-muted">{img.dimensions} · {img.size_kb}KB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {result.errors && result.errors.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 mb-3">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-[10px] text-red-400 font-mono">{err}</p>
                ))}
              </div>
            )}

            {/* Download */}
            {(result.storage_url || result.download_url) && (
              <a
                href={result.storage_url || result.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[10px] font-mono font-bold text-brand-primary hover:underline">
                <Download className="w-3.5 h-3.5" /> Download Output
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
