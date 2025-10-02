import { Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { FacultyMember } from '../types';
import { FormattedText } from './FormattedText';

type FacultyDetailOverlayProps = {
  faculty: FacultyMember;
  localeLabel: string;
  onClose: () => void;
};

export function FacultyDetailOverlay({ faculty, localeLabel, onClose }: FacultyDetailOverlayProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Trigger enter animation on mount
    const id = window.setTimeout(() => setOpen(true), 10);
    return () => window.clearTimeout(id);
  }, []);

  const handleClose = () => {
    // Animate out then notify parent to unmount
    setOpen(false);
    window.setTimeout(() => onClose(), 200);
  };

  return (
    <div className={`fixed inset-0 z-[65] flex transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex-1 bg-black/60" onClick={handleClose} />
      <aside className={`relative w-full max-w-3xl h-full bg-white overflow-y-auto border-l border-gray-200 transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs uppercase tracking-wide text-gray-500">
              <Users className="h-4 w-4" />
              <span>{localeLabel}</span>
            </div>
            <h2 className="text-xl font-serif font-bold text-gray-900 mt-2">{faculty.name}</h2>
            <p className="text-xs text-gray-500 mt-1">{faculty.title}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"
            aria-label="Close faculty profile"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-6 space-y-6">
          {faculty.photoDataUrl && (
            <img
              src={faculty.photoDataUrl}
              alt={faculty.name}
              className="w-full h-auto max-h-[70vh] max-w-md mx-auto object-contain border border-gray-200 bg-gray-100"
            />
          )}
          {faculty.summary && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Summary</h3>
              <FormattedText
                text={faculty.summary}
                className="text-sm text-gray-700 leading-relaxed"
              />
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Specialty</h3>
              <p className="text-sm text-gray-700">{faculty.specialty}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Education</h3>
              <p className="text-sm text-gray-700">{faculty.education}</p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Profile</h3>
            <FormattedText
              text={faculty.bio ?? faculty.research}
              className="text-sm text-gray-700 leading-relaxed"
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
