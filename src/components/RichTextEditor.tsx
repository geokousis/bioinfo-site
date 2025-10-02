import { Bold, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered } from 'lucide-react';
import { ChangeEvent, useRef, useState } from 'react';
import { FormattedText } from './FormattedText';

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  placeholder?: string;
};

export function RichTextEditor({ value, onChange, label, className, placeholder }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  const wrapSelection = (before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    if (selectedText) {
      const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
      onChange(newText);
      
      // Restore selection after state update
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + before.length, end + before.length);
      }, 0);
    }
  };

  const addAlignmentTag = (alignment: 'left' | 'center' | 'right') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    if (selectedText) {
      const tag = `<div style="text-align: ${alignment};">${selectedText}</div>`;
      const newText = value.substring(0, start) + tag + value.substring(end);
      onChange(newText);
      
      setTimeout(() => {
        textarea.focus();
      }, 0);
    }
  };

  const addBulletList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    if (selectedText) {
      const lines = selectedText.split('\n').filter(line => line.trim());
      if (lines.length === 0) return;
      const bulletList = '<ul>\n' + lines.map(line => `  <li>${line.trim()}</li>`).join('\n') + '\n</ul>';
      const newText = value.substring(0, start) + bulletList + value.substring(end);
      onChange(newText);
      
      setTimeout(() => {
        textarea.focus();
      }, 0);
    }
  };

  const addNumberedList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    if (selectedText) {
      const lines = selectedText.split('\n').filter(line => line.trim());
      if (lines.length === 0) return;
      const numberedList = '<ol>\n' + lines.map(line => `  <li>${line.trim()}</li>`).join('\n') + '\n</ol>';
      const newText = value.substring(0, start) + numberedList + value.substring(end);
      onChange(newText);
      
      setTimeout(() => {
        textarea.focus();
      }, 0);
    }
  };

  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-semibold text-gray-700">{label}</label>}
      
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-gray-50 border border-gray-300 rounded-t-md">
        <button
          type="button"
          onClick={() => wrapSelection('**', '**')}
          className="p-1.5 hover:bg-gray-200 rounded transition-colors"
          title="Bold (select text first)"
        >
          <Bold className="h-4 w-4 text-gray-700" />
        </button>
        
        <button
          type="button"
          onClick={() => wrapSelection('<u>', '</u>')}
          className="p-1.5 hover:bg-gray-200 rounded transition-colors"
          title="Underline (select text first)"
        >
          <Underline className="h-4 w-4 text-gray-700" />
        </button>
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <button
          type="button"
          onClick={() => addAlignmentTag('left')}
          className="p-1.5 hover:bg-gray-200 rounded transition-colors"
          title="Align Left (select text first)"
        >
          <AlignLeft className="h-4 w-4 text-gray-700" />
        </button>
        
        <button
          type="button"
          onClick={() => addAlignmentTag('center')}
          className="p-1.5 hover:bg-gray-200 rounded transition-colors"
          title="Align Center (select text first)"
        >
          <AlignCenter className="h-4 w-4 text-gray-700" />
        </button>
        
        <button
          type="button"
          onClick={() => addAlignmentTag('right')}
          className="p-1.5 hover:bg-gray-200 rounded transition-colors"
          title="Align Right (select text first)"
        >
          <AlignRight className="h-4 w-4 text-gray-700" />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={addBulletList}
          className="p-1.5 hover:bg-gray-200 rounded transition-colors"
          title="Bullet List (select lines first)"
        >
          <List className="h-4 w-4 text-gray-700" />
        </button>

        <button
          type="button"
          onClick={addNumberedList}
          className="p-1.5 hover:bg-gray-200 rounded transition-colors"
          title="Numbered List (select lines first)"
        >
          <ListOrdered className="h-4 w-4 text-gray-700" />
        </button>

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(false)}
            className={`text-xs px-2 py-1 rounded ${!showPreview ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className={`text-xs px-2 py-1 rounded ${showPreview ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Textarea or Preview */}
      {showPreview ? (
        <div className="w-full rounded-b-md border border-t-0 border-gray-300 px-3 py-2 text-sm min-h-[128px] bg-white">
          <FormattedText text={value} className="text-gray-700" />
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className || 'w-full rounded-b-md border border-t-0 border-gray-300 px-3 py-2 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900'}
        />
      )}
    </div>
  );
}
