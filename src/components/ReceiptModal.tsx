import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Trash2,
  ExternalLink,
  Download,
  FileCheck,
  Paperclip,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  Layers,
} from 'lucide-react';
import { ReceiptAttachment } from '../types';
import {
  processReceiptImages,
  normalizeAttachments,
  formatFileSize,
} from '../utils/receiptUtils';
import { formatPHP, parseAmount } from '../utils/formatters';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptNo: string;
  attachments?: ReceiptAttachment[];
  receiptImage?: string; // backwards compatibility fallback
  receiptImageName?: string; // backwards compatibility fallback
  description?: string;
  date?: string;
  amount?: number | string;
  isIncome?: boolean;
  category?: string;
  onSave: (receiptNo: string, attachments: ReceiptAttachment[]) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptNo,
  attachments = [],
  receiptImage,
  receiptImageName,
  description,
  date,
  amount,
  isIncome = false,
  category,
  onSave,
}) => {
  const [currentReceiptNo, setCurrentReceiptNo] = useState(receiptNo || '');
  const [currentAttachments, setCurrentAttachments] = useState<ReceiptAttachment[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showSavedToast, setShowSavedToast] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setCurrentReceiptNo(receiptNo || '');
      const initialAttachments = normalizeAttachments({
        attachments,
        receiptImage,
        receiptImageName,
      });
      setCurrentAttachments(initialAttachments);
      setSelectedIndex(0);
      setZoomLevel(1);
      setRotation(0);
    }
  }, [isOpen, receiptNo, attachments, receiptImage, receiptImageName]);

  // Active attachment
  const activeAttachment = currentAttachments[selectedIndex] || currentAttachments[0];

  // Trigger save to parent and show visual feedback
  const triggerSave = useCallback(
    (newNo: string, newAttachments: ReceiptAttachment[]) => {
      onSave(newNo, newAttachments);
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 2000);
    },
    [onSave]
  );

  // Handle files upload (single or multiple)
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const validFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (validFiles.length === 0) {
        alert('Please upload image files (PNG, JPG, WEBP, SVG, etc.)');
        return;
      }

      setIsProcessing(true);
      try {
        const processed = await processReceiptImages(validFiles);
        if (processed.length > 0) {
          const updated = [...currentAttachments, ...processed];
          setCurrentAttachments(updated);
          // Set selection to the newly added item
          setSelectedIndex(currentAttachments.length);
          setZoomLevel(1);
          setRotation(0);
          triggerSave(currentReceiptNo, updated);
        }
      } catch (err) {
        console.error('Failed to process uploaded receipts', err);
      } finally {
        setIsProcessing(false);
      }
    },
    [currentAttachments, currentReceiptNo, triggerSave]
  );

  // Listen for clipboard paste events (Ctrl+V / Cmd+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            pastedFiles.push(file);
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        handleFiles(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, handleFiles]);

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleReceiptNoChange = (newVal: string) => {
    setCurrentReceiptNo(newVal);
    triggerSave(newVal, currentAttachments);
  };

  // Remove specific attachment
  const handleRemoveAttachment = (indexToRemove: number) => {
    const updated = currentAttachments.filter((_, i) => i !== indexToRemove);
    setCurrentAttachments(updated);
    if (selectedIndex >= updated.length) {
      setSelectedIndex(Math.max(0, updated.length - 1));
    }
    setZoomLevel(1);
    setRotation(0);
    triggerSave(currentReceiptNo, updated);
  };

  // Download active attachment
  const handleDownload = () => {
    if (!activeAttachment) return;
    const link = document.createElement('a');
    link.href = activeAttachment.url;
    link.download = activeAttachment.name || `receipt_${currentReceiptNo || 'proof'}.jpg`;
    link.click();
  };

  // Open full image in new tab
  const handleOpenNewTab = () => {
    if (!activeAttachment) return;
    const win = window.open();
    if (win) {
      win.document.write(
        `<body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${activeAttachment.url}" style="max-width:100%;max-height:100vh;object-fit:contain;" alt="${activeAttachment.name}" /></body>`
      );
    }
  };

  if (!isOpen) return null;

  const numAmount = amount !== undefined && amount !== '' ? parseAmount(amount) : null;
  const count = currentAttachments.length;

  return (
    <div
      id="receipt-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="receipt-modal-card"
        className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 bg-neutral-950/70 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300">
              <Paperclip className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-100">
                  Receipts & Payment Proofs
                </h3>
                {count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300 bg-emerald-950/90 border border-emerald-800/80 px-2 py-0.5 rounded-full font-mono">
                    <FileCheck className="w-3 h-3 text-emerald-400" />
                    {count} {count === 1 ? 'Attachment' : 'Attachments'}
                  </span>
                )}
                {showSavedToast && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.2 rounded animate-fade-in">
                    <Check className="w-3 h-3" /> Auto-Saved
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 truncate max-w-md">
                {description || 'Transaction record'}
                {category ? ` • ${category}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="close-receipt-modal-btn"
              type="button"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-200 p-1 rounded-md hover:bg-neutral-800 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Transaction Summary & Reference Strip */}
        <div className="px-4 py-2 bg-neutral-950/40 border-b border-neutral-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div>
            <span className="text-neutral-500 text-[10px] block font-medium">Date</span>
            <span className="text-neutral-200 font-medium font-mono text-[11px]">
              {date || '—'}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 text-[10px] block font-medium">Amount</span>
            <span
              className={`font-semibold font-mono-numbers text-[11px] ${
                isIncome ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {numAmount !== null ? formatPHP(numAmount) : '—'}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-neutral-500 text-[10px] block font-medium">
              Official Receipt # / Reference #
            </span>
            <input
              id="modal-receipt-ref-input"
              type="text"
              value={currentReceiptNo}
              onChange={(e) => handleReceiptNoChange(e.target.value)}
              placeholder="e.g. OR #10429, GCash Ref 8829, BDO Transfer #4920"
              className="w-full bg-neutral-950/80 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
            />
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="p-4 flex-1 overflow-y-auto min-h-[300px] flex flex-col">
          {count > 0 ? (
            <div className="w-full flex flex-col gap-3">
              {/* Top Thumbnail Gallery Carousel & Quick Add */}
              <div className="w-full bg-neutral-950/70 border border-neutral-800 rounded-lg p-2 flex items-center gap-2 overflow-x-auto">
                <div className="flex items-center gap-1.5 shrink-0 text-neutral-400 text-[10px] font-semibold uppercase tracking-wider pl-1 pr-2 border-r border-neutral-800">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Files ({count}):</span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {currentAttachments.map((att, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={att.id || idx}
                        onClick={() => {
                          setSelectedIndex(idx);
                          setZoomLevel(1);
                          setRotation(0);
                        }}
                        className={`group relative shrink-0 w-20 h-16 rounded-md border overflow-hidden cursor-pointer transition-all flex flex-col items-center justify-center ${
                          isSelected
                            ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-neutral-900'
                            : 'border-neutral-700 hover:border-neutral-500 bg-neutral-950'
                        }`}
                        title={`${att.name} (${formatFileSize(att.size) || 'image'})`}
                      >
                        <img
                          src={att.url}
                          alt={att.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover select-none opacity-90 group-hover:opacity-100"
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-black/75 backdrop-blur-xs text-[9px] text-neutral-200 px-1 py-0.5 truncate font-mono text-center">
                          #{idx + 1}
                        </span>

                        {/* Quick remove button on thumbnail hover */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAttachment(idx);
                          }}
                          className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/80 hover:bg-rose-900 text-neutral-300 hover:text-rose-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove this attachment"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}

                  {/* + Add More button tile */}
                  <button
                    id="add-more-receipt-btn"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 w-20 h-16 rounded-md border border-dashed border-neutral-700 hover:border-emerald-500 hover:bg-emerald-950/20 text-neutral-400 hover:text-emerald-300 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer text-center"
                    title="Add another receipt image or proof"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-medium">+ Add More</span>
                  </button>
                </div>
              </div>

              {/* Active Image Toolbar */}
              <div className="w-full flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-neutral-950/60 border border-neutral-800 rounded-lg text-xs">
                <div className="flex items-center gap-2 text-neutral-300 text-[11px] truncate max-w-[260px] sm:max-w-md">
                  <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-emerald-400 font-mono text-[10px] font-semibold shrink-0">
                    {selectedIndex + 1} of {count}
                  </span>
                  <ImageIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate font-medium">{activeAttachment?.name || 'Receipt Image'}</span>
                  {activeAttachment?.size && (
                    <span className="text-[10px] text-neutral-500 font-mono shrink-0">
                      ({formatFileSize(activeAttachment.size)})
                    </span>
                  )}
                </div>

                {/* Viewer controls */}
                <div className="flex items-center gap-1">
                  {/* Previous / Next buttons */}
                  {count > 1 && (
                    <div className="flex items-center mr-1 border-r border-neutral-800 pr-1 gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : count - 1));
                          setZoomLevel(1);
                          setRotation(0);
                        }}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                        title="Previous attachment"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIndex((prev) => (prev < count - 1 ? prev + 1 : 0));
                          setZoomLevel(1);
                          setRotation(0);
                        }}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                        title="Next attachment"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                    className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-neutral-400 min-w-[32px] text-center">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                    className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                    title="Rotate 90°"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenNewTab}
                    className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                    title="Open Full Image in New Tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                    title="Download Active Receipt"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(selectedIndex)}
                    className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 ml-1 border-l border-neutral-800 pl-1.5"
                    title="Delete this attachment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* High-res Image Preview Stage */}
              <div className="relative w-full bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden flex items-center justify-center p-2 max-h-[420px] min-h-[260px]">
                {activeAttachment && (
                  <img
                    src={activeAttachment.url}
                    alt={activeAttachment.name || 'Receipt proof'}
                    referrerPolicy="no-referrer"
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: 'transform 0.15s ease-out',
                    }}
                    className="max-h-[400px] max-w-full object-contain select-none shadow-sm"
                  />
                )}

                {/* Left / Right overlay arrows when multiple */}
                {count > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : count - 1));
                        setZoomLevel(1);
                        setRotation(0);
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/10 backdrop-blur-xs transition-colors"
                      title="Previous"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIndex((prev) => (prev < count - 1 ? prev + 1 : 0));
                        setZoomLevel(1);
                        setRotation(0);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/10 backdrop-blur-xs transition-colors"
                      title="Next"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Bottom Quick Actions Row */}
              <div className="w-full flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded-lg transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>+ Upload More Files</span>
                </button>

                <div className="text-[11px] text-neutral-500 font-mono">
                  Drag & drop or paste (Ctrl+V) anywhere
                </div>
              </div>
            </div>
          ) : (
            /* Upload Dropzone when no attachments */
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`w-full flex-1 min-h-[260px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-950/30'
                  : 'border-neutral-700 hover:border-neutral-500 bg-neutral-950/50 hover:bg-neutral-950/80'
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 mb-3 shadow-inner">
                <Upload className="w-7 h-7 text-emerald-400" />
              </div>
              <h4 className="text-sm font-semibold text-neutral-100">
                {isProcessing ? 'Processing files...' : 'Upload Receipts & Proof of Payment'}
              </h4>
              <p className="text-xs text-neutral-400 max-w-sm mt-1.5">
                Drag & drop one or more receipts, invoice photos, or payment screenshots, or{' '}
                <span className="text-emerald-400 underline underline-offset-2 font-semibold">
                  browse files
                </span>
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-neutral-500">
                <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                  Multiple files supported
                </span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                  PNG, JPG, WEBP, SVG
                </span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-emerald-400">
                  Ctrl+V / Cmd+V paste
                </span>
              </div>
            </div>
          )}

          {/* Hidden multiple file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
                // Clear input so same file can be re-selected if needed
                e.target.value = '';
              }
            }}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-neutral-950/70 border-t border-neutral-800 flex items-center justify-between gap-2">
          <div className="text-[11px] text-neutral-400 font-mono">
            {count > 0 ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {count} {count === 1 ? 'proof' : 'proofs'} securely saved to entry
              </span>
            ) : (
              'No receipts attached yet'
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="done-receipt-modal-btn"
              type="button"
              onClick={() => {
                triggerSave(currentReceiptNo, currentAttachments);
                onClose();
              }}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done / Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
