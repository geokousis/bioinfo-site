import DOMPurify from 'dompurify';
import { useMemo } from 'react';

type FormattedTextProps = {
  text: string;
  className?: string;
};

const ALLOWED_TAGS = [
  'strong', 'b', 'em', 'i', 'u', 'br', 'p', 'span', 'div',
  'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'style'];
const SAFE_URI_PATTERN = /^(?:(?:https?|mailto|tel):|\/|#)/i;

export function FormattedText({ text, className = '' }: FormattedTextProps) {
  const formattedHtml = useMemo(() => {
    if (!text) return '';

    let result = text;

    // Convert **bold** to <strong>
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Convert URLs to clickable links (only if not already inside an <a> tag)
    // This regex matches http:// and https:// URLs
    result = result.replace(
      /(?<!href=["'])(?<!>)(https?:\/\/[^\s<>"']+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>'
    );

    // Don't replace newlines inside HTML tags (preserve list structure)
    // Only replace newlines that are NOT inside <ul>, <ol>, or alignment divs
    const hasHtmlTags = /<(ul|ol|div)/.test(result);
    if (!hasHtmlTags) {
      // Convert newlines to <br /> only if no HTML structure exists
      result = result.replace(/\n/g, '<br />');
    }

    return DOMPurify.sanitize(result, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: SAFE_URI_PATTERN,
    });
  }, [text]);

  return (
    <div
      className={`${className} formatted-text`}
      dangerouslySetInnerHTML={{ __html: formattedHtml }}
    />
  );
}
