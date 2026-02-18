import { useMemo } from 'react';

type FormattedTextProps = {
  text: string;
  className?: string;
};

// Allowlist of safe HTML tags/attributes for formatted content.
const ALLOWED_TAGS = new Set([
  'strong', 'b', 'em', 'i', 'u', 'br', 'p', 'span', 'div',
  'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);
const ALLOWED_ATTR = new Set(['href', 'target', 'rel', 'class', 'style']);

const SAFE_HREF_PATTERN = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

const sanitizeHtml = (html: string): string => {
  if (typeof window === 'undefined') {
    return html;
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const sanitizeNode = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        continue;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      const element = child as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tagName)) {
        const fragment = document.createDocumentFragment();
        while (element.firstChild) {
          fragment.appendChild(element.firstChild);
        }
        element.replaceWith(fragment);
        sanitizeNode(fragment);
        continue;
      }

      for (const attribute of Array.from(element.attributes)) {
        const attrName = attribute.name.toLowerCase();
        if (!ALLOWED_ATTR.has(attrName)) {
          element.removeAttribute(attribute.name);
          continue;
        }

        if (attrName === 'href' && !SAFE_HREF_PATTERN.test(attribute.value.trim())) {
          element.removeAttribute('href');
        }
      }

      if (tagName === 'a') {
        element.setAttribute('rel', 'noopener noreferrer');
        if (!element.getAttribute('target')) {
          element.setAttribute('target', '_blank');
        }
      }

      sanitizeNode(element);
    }
  };

  sanitizeNode(container);
  return container.innerHTML;
};

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

    return sanitizeHtml(result);
  }, [text]);

  return (
    <div
      className={`${className} formatted-text`}
      dangerouslySetInnerHTML={{ __html: formattedHtml }}
    />
  );
}
