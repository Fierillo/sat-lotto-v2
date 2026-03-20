'use client';

import { useState } from 'react';

interface CopyTextProps {
  text: string;
  truncate?: number;
}

export function CopyText({ text, truncate }: CopyTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const displayText = truncate && text.length > truncate
    ? text.slice(0, truncate) + '...'
    : text;

  return (
    <>
      <code
        className={`verify-command ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
      >
        {displayText}
      </code>
      <div className={`copy-status ${copied ? 'show' : ''}`} style={{ opacity: copied ? 1 : 0 }}>
        ¡Copiado! ⚡
      </div>
    </>
  );
}
