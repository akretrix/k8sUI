import React from 'react';
import anser from 'anser';

/**
 * Normalizes ANSI escape sequences in case characters were corrupted,
 * or replacement characters like \uFFFD were used in transport.
 */
export function normalizeAnsi(input: string): string {
  if (!input) return '';
  let normalized = input.replace(/[\uFFFD\u009B]\[/g, '\u001b[');
  normalized = normalized.replace(/\\x1b\[/gi, '\u001b[').replace(/\\u001b\[/gi, '\u001b[');
  return normalized;
}

/**
 * Strips all ANSI codes from a string to obtain pure plain text.
 */
export function stripAnsi(input: string): string {
  if (!input) return '';
  return anser.ansiToText(normalizeAnsi(input));
}

/**
 * Renders an ANSI-formatted log line into colorful, accessible React elements,
 * preserving search query highlighting without breaking ANSI formatting.
 */
export function renderAnsiLine(
  rawLine: string,
  searchQuery = '',
  caseSensitive = false,
  isRegex = false
): React.ReactNode {
  const line = normalizeAnsi(rawLine);
  const trimmedQuery = searchQuery.trim();

  const highlightContent = (text: string, keyPrefix: string): React.ReactNode => {
    if (!trimmedQuery) return text;
    try {
      const regex = isRegex
        ? new RegExp(`(${trimmedQuery})`, caseSensitive ? 'g' : 'gi')
        : new RegExp(`(${trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, caseSensitive ? 'g' : 'gi');

      const parts = text.split(regex);
      if (parts.length <= 1) return text;

      return parts.map((part, i) => {
        const isMatch = isRegex
          ? new RegExp(`^${trimmedQuery}$`, caseSensitive ? '' : 'i').test(part)
          : caseSensitive
          ? part === trimmedQuery
          : part.toLowerCase() === trimmedQuery.toLowerCase();

        return isMatch ? (
          <mark
            key={`${keyPrefix}-${i}`}
            className="bg-amber-400/40 text-amber-100 px-0.5 rounded font-bold border-b border-amber-400"
          >
            {part}
          </mark>
        ) : (
          part
        );
      });
    } catch {
      return text;
    }
  };

  // If there are no ANSI escape codes, return plain highlighted text
  if (!line.includes('\u001b')) {
    return highlightContent(line, 'plain');
  }

  // Parse ANSI escape sequences
  const bundles = anser.ansiToJson(line, {
    json: true,
    remove_empty: true,
    use_classes: false,
  });

  if (!bundles || bundles.length === 0) {
    return highlightContent(line, 'fallback');
  }

  return bundles.map((bundle: any, index: number) => {
    const style: React.CSSProperties = {};

    if (bundle.fg) {
      // Dark blue adjustment for dark mode readability
      if (bundle.fg === '0, 0, 187') {
        style.color = 'rgb(96, 165, 250)';
      } else {
        style.color = `rgb(${bundle.fg})`;
      }
    }
    if (bundle.bg) {
      style.backgroundColor = `rgb(${bundle.bg})`;
    }
    if (bundle.decorations?.includes('bold')) {
      style.fontWeight = 700;
    }
    if (bundle.decorations?.includes('italic')) {
      style.fontStyle = 'italic';
    }
    if (bundle.decorations?.includes('underline')) {
      style.textDecoration = 'underline';
    }
    if (bundle.isInverted) {
      const prevFg = style.color || '#e5e7eb';
      const prevBg = style.backgroundColor || 'transparent';
      style.color = prevBg === 'transparent' ? '#07090E' : prevBg;
      style.backgroundColor = prevFg;
    }

    return (
      <span key={`bundle-${index}`} style={style}>
        {highlightContent(bundle.content, `b-${index}`)}
      </span>
    );
  });
}
