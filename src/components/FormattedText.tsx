import { useMemo } from 'react';

type FormattedTextProps = {
  text: string;
  className?: string;
};

export function FormattedText({ text, className = '' }: FormattedTextProps) {
  const formattedHtml = useMemo(() => {
    if (!text) return '';
    
    let result = text;
    
    // Convert **bold** to <strong>
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Don't replace newlines inside HTML tags (preserve list structure)
    // Only replace newlines that are NOT inside <ul>, <ol>, or alignment divs
    const hasHtmlTags = /<(ul|ol|div)/.test(result);
    if (!hasHtmlTags) {
      // Convert newlines to <br /> only if no HTML structure exists
      result = result.replace(/\n/g, '<br />');
    }
    
    return result;
  }, [text]);

  return (
    <div
      className={`${className} formatted-text`}
      dangerouslySetInnerHTML={{ __html: formattedHtml }}
      style={{
        // Add list styling
        ['--list-style' as any]: 'inside'
      }}
    />
  );
}
