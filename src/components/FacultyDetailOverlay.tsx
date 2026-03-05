import { X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { FacultyMember } from '../types';
import { FormattedText } from './FormattedText';
import { resolveAppUrl } from '../lib/url';
import { useOverlayDialog } from '../hooks/useOverlayDialog';

type FacultyDetailOverlayProps = {
  faculty: FacultyMember;
  onClose: () => void;
};

export function FacultyDetailOverlay({ faculty, onClose }: FacultyDetailOverlayProps) {
  const [open, setOpen] = useState(false);
  const isClosingRef = useRef(false);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const titleId = useId();

  const handleClose = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }
    isClosingRef.current = true;
    setOpen(false);
    closeTimerRef.current = window.setTimeout(() => onClose(), 150);
  }, [onClose]);

  const panelRef = useOverlayDialog({ onRequestClose: handleClose });

  useEffect(() => {
    // Trigger enter animation immediately
    requestAnimationFrame(() => setOpen(true));
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={`fixed inset-0 z-[65] flex transition-opacity duration-150 ${open ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex-1 bg-black/60" onClick={handleClose} />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full max-w-3xl h-full bg-white overflow-y-auto border-l border-gray-200 transition-transform duration-150 ease-out focus:outline-none ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 id={titleId} className="text-xl font-serif font-bold text-gray-900">{faculty.name}</h2>
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
              src={resolveAppUrl(faculty.photoDataUrl)}
              alt={faculty.name}
              className="w-auto h-auto max-h-[20vh] sm:max-h-[50vh] md:max-h-[60vh] max-w-[150px] sm:max-w-xs md:max-w-md mx-auto object-contain border border-gray-200 bg-gray-100"
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
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Specialty</h3>
            <p className="text-sm text-gray-700">{faculty.specialty}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Research Focus</h3>
            <FormattedText
              text={faculty.research}
              className="text-sm text-gray-700 leading-relaxed"
            />
          </div>
          {faculty.courses && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Courses</h3>
              <FormattedText
                text={faculty.courses}
                className="text-sm text-gray-700 leading-relaxed"
              />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
