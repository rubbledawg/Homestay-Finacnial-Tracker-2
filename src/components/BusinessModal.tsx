import React, { useState, useEffect } from 'react';
import { BusinessTracker } from '../types';
import { generateId } from '../utils/formatters';
import {
  FolderPlus,
  FolderEdit,
  X,
  Building2,
  Hotel,
  Car,
  Utensils,
  ShoppingBag,
  Briefcase,
  Layers,
  Trash2,
} from 'lucide-react';

interface BusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (business: BusinessTracker) => void;
  onDelete?: (businessId: string) => void;
  editingBusiness?: BusinessTracker | null;
  canDelete?: boolean;
}

const CATEGORIES = [
  { label: 'Airbnb / Vacation Rental', icon: Hotel },
  { label: 'Real Estate / Property', icon: Building2 },
  { label: 'Vehicle / Car Rental', icon: Car },
  { label: 'Food & Beverage / Cafe', icon: Utensils },
  { label: 'Retail & Ecommerce', icon: ShoppingBag },
  { label: 'Services / Consulting', icon: Briefcase },
  { label: 'Other Business Venture', icon: Layers },
];

export const BusinessModal: React.FC<BusinessModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingBusiness,
  canDelete = false,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Airbnb / Vacation Rental');
  const [description, setDescription] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (editingBusiness) {
      setName(editingBusiness.name);
      setCategory(editingBusiness.category || 'Airbnb / Vacation Rental');
      setDescription(editingBusiness.description || '');
      setConfirmDelete(false);
    } else {
      setName('');
      setCategory('Airbnb / Vacation Rental');
      setDescription('');
      setConfirmDelete(false);
    }
  }, [editingBusiness, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const tracker: BusinessTracker = {
      id: editingBusiness ? editingBusiness.id : `biz-${generateId()}`,
      name: name.trim(),
      category,
      currency: 'PHP',
      description: description.trim(),
      createdAt: editingBusiness ? editingBusiness.createdAt : Date.now(),
    };

    onSave(tracker);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/70 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              {editingBusiness ? (
                <FolderEdit className="w-4 h-4" />
              ) : (
                <FolderPlus className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                {editingBusiness ? 'Edit Business Tracker' : 'Add New Business Tracker'}
              </h2>
              <p className="text-[11px] text-neutral-400">
                Manage separate ledger and financial operations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Tracker Name */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Business / Property Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Siargao Villa 2, Car Rental, Laundry Shop..."
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
              autoFocus
            />
          </div>

          {/* Business Category */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Business Category
            </label>
            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.label;
                return (
                  <button
                    type="button"
                    key={cat.label}
                    onClick={() => setCategory(cat.label)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors border ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-600/70 text-emerald-300 font-medium'
                        : 'bg-neutral-950/40 border-neutral-800/80 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-850'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-neutral-400'}`} />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Description / Notes <span className="text-[11px] text-neutral-500">(Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Unit 202 beachfront property, partner venture"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Currency Indicator */}
          <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] flex items-center justify-between text-neutral-400">
            <span>Tracking Currency</span>
            <span className="font-mono font-medium text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
              Philippine Peso (₱ PHP)
            </span>
          </div>

          {/* Danger zone: Delete Business */}
          {editingBusiness && canDelete && onDelete && (
            <div className="pt-2 border-t border-neutral-800">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-1.5 px-3 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg border border-rose-900/40 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete this Business Tracker</span>
                </button>
              ) : (
                <div className="p-3 bg-rose-950/30 border border-rose-900/60 rounded-lg space-y-2">
                  <p className="text-[11px] text-rose-300">
                    Are you sure you want to delete &quot;{editingBusiness.name}&quot; and all its records?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onDelete(editingBusiness.id)}
                      className="flex-1 py-1 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium transition-colors"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {editingBusiness ? (
                <>
                  <FolderEdit className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              ) : (
                <>
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Create Tracker</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
