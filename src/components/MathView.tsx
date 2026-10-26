'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathViewProps {
  math: string;
  displayMode?: boolean;
  className?: string;
}

export function MathView({ math, displayMode = false, className = '' }: MathViewProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `<code class="text-rose-400 font-mono">${math}</code>`;
    }
  }, [math, displayMode]);

  return (
    <span
      className={`katex-container inline-block ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
