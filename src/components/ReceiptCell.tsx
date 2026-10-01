import React, { useState } from 'react';
import { Paperclip, Image as ImageIcon } from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';
import { ReceiptAttachment } from '../types';
import {
  processReceiptImages,
  normalizeAttachments,
} from '../utils/receiptUtils';

interface ReceiptCellProps {
  receiptNo: string;
  attachments?: ReceiptAttachment[];
  receiptImage?: string; // backwards compatibility
  receiptImageName?: string; // backwards compatibility
  description?: string;
  date?: string;
  amount?: number | string;
  isIncome?: boolean;
  category?: string;
  onUpdateReceipt?: (receiptNo: string, attachments: ReceiptAttachment[]) => void;
  // Legacy individual callbacks fallback
  onUpdateReceiptNo?: (val: string) => void;
  onUpdateReceiptImage?: (dataUrl?: string, fileName?: string) => void;
  size?: 'xs' | 'sm';
  ariaLabel?: string;
  isReadOnly?: boolean;
}

export const ReceiptCell: React.FC<ReceiptCellProps> = ({
  receiptNo,
  attachments = [],
  receiptImage,
  receiptImageName,
  description,
  date,
  amount,
  isIncome = false,
  category,
  onUpdateReceipt,
  onUpdateReceiptNo,
  onUpdateReceiptImage,
  size = 'xs',
  ariaLabel = 'Receipt Ref',
  isReadOnly = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Normalize attachments
  const normalizedAttachments = normalizeAttachments({
    attachments,
    receiptImage,
    receiptImageName,
  });

  const count = normalizedAttachments.length;
  const hasAttachments = count > 0;

  // Handle direct drag-and-drop on the cell (supports multiple files)
  const handleDragOver = (e: React.DragEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      try {
        const newAttachments = await processReceiptImages(files);
        if (newAttachments.length > 0) {
          const combined = [...normalizedAttachments, ...newAttachments];
          if (onUpdateReceipt) {
            onUpdateReceipt(receiptNo, combined);
          } else {
            if (onUpdateReceiptImage) {
              onUpdateReceiptImage(combined[0]?.url, combined[0]?.name);
            }
          }
        }
      } catch (err) {
        console.error('Failed to attach dropped receipts', err);
      }
    }
  };

  const handleReceiptNoInputChange = (val: string) => {
    if (onUpdateReceipt) {
      onUpdateReceipt(val, normalizedAttachments);
    } else if (onUpdateReceiptNo) {
      onUpdateReceiptNo(val);
    }
  };

  const handleSaveModal = (newNo: string, newAttachments: ReceiptAttachment[]) => {
    if (onUpdateReceipt) {
      onUpdateReceipt(newNo, newAttachments);
    } else {
      if (onUpdateReceiptNo && newNo !== receiptNo) {
        onUpdateReceiptNo(newNo);
      }
      if (onUpdateReceiptImage) {
        const primary = newAttachments[0];
        onUpdateReceiptImage(primary?.url, primary?.name);
      }
    }
  };

  const pySize = size === 'sm' ? 'py-1' : 'py-1';
  const textSize = size === 'sm' ? 'text-xs' : 'text-[11px]';

  const tooltipTitle = hasAttachments
    ? `${count} receipt ${count === 1 ? 'proof' : 'proofs'} attached:\n${normalizedAttachments
        .map((a, i) => `${i + 1}. ${a.name}`)
        .join('\n')}\nClick to view, zoom or add more.`
    : 'Attach receipt images / proof of payment (drag & drop supported)';

  return (
    <>
      <div
        className={`relative flex items-center rounded transition-all ${
          isDragOver ? 'ring-2 ring-emerald-500 bg-emerald-950/40' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="text"
          aria-label={ariaLabel}
          placeholder="OR # / Ref"
          value={receiptNo || ''}
          readOnly={isReadOnly}
          onChange={(e) => handleReceiptNoInputChange(e.target.value)}
          className={`w-full bg-neutral-950/60 border border-neutral-800 rounded px-2 pr-7 ${pySize} ${textSize} font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 focus:bg-neutral-900 ${
            isReadOnly ? 'cursor-default bg-transparent border-0' : ''
          }`}
        />

        {/* Attachment button inside input */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded transition-colors cursor-pointer flex items-center justify-center ${
            hasAttachments
              ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/70'
              : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/80'
          }`}
          title={tooltipTitle}
        >
          {hasAttachments ? (
            <div className="relative flex items-center justify-center">
              <ImageIcon className="w-3.5 h-3.5" />
              {count > 1 ? (
                <span className="absolute -top-1.5 -right-2 px-1 py-0.2 bg-emerald-500 text-neutral-950 font-bold font-mono text-[9px] rounded-full leading-none shadow-xs">
                  {count}
                </span>
              ) : (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              )}
            </div>
          ) : (
            <Paperclip className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Proof modal */}
      {isModalOpen && (
        <ReceiptModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          receiptNo={receiptNo}
          attachments={normalizedAttachments}
          receiptImage={receiptImage}
          receiptImageName={receiptImageName}
          description={description}
          date={date}
          amount={amount}
          isIncome={isIncome}
          category={category}
          onSave={handleSaveModal}
        />
      )}
    </>
  );
};
