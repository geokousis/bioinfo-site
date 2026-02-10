import { Download, FileText, Megaphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { AnnouncementItem } from '../types';
import { FormattedText } from './FormattedText';

type AnnouncementDetailOverlayProps = {
  announcement: AnnouncementItem;
  localeLabel: string;
  onClose: () => void;
};

export function AnnouncementDetailOverlay({ announcement, localeLabel, onClose }: AnnouncementDetailOverlayProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Trigger enter animation immediately
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const handleClose = () => {
    setOpen(false);
    window.setTimeout(() => onClose(), 150);
  };

  return (
    <div className={`fixed inset-0 z-[65] flex transition-opacity duration-150 ${open ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex-1 bg-black/60" onClick={handleClose} />
      <aside className={`relative w-full max-w-3xl h-full bg-white overflow-y-auto border-l border-gray-200 transition-transform duration-150 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs uppercase tracking-wide text-gray-500">
              <Megaphone className="h-4 w-4" />
              <span>{localeLabel}</span>
            </div>
            <h2 className="text-xl font-serif font-bold text-gray-900 mt-2">{announcement.title}</h2>
            <p className="text-xs text-gray-500 mt-1">{announcement.date}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"
            aria-label="Close announcement"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Summary</h3>
            <FormattedText
              text={announcement.summary}
              className="text-sm text-gray-700 leading-relaxed"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Full Announcement</h3>
            <FormattedText
              text={announcement.body}
              className="text-sm text-gray-700 leading-relaxed space-y-3"
            />
          </div>
          {announcement.attachments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Attachments</h3>
              <div className="space-y-2">
                {announcement.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.dataUrl}
                    download={attachment.name}
                    className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 hover:border-gray-900"
                  >
                    <span className="flex items-center space-x-2 truncate">
                      <FileText className="h-4 w-4" />
                      <span className="truncate">{attachment.name}</span>
                    </span>
                    <Download className="h-4 w-4 text-gray-600" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
