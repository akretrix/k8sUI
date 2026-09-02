import { describe, it, expect } from 'vitest';
import { normalizeAnsi, stripAnsi, renderAnsiLine } from './ansiRenderer';
import { render } from '@testing-library/react';

describe('ansiRenderer', () => {
  it('normalizes corrupted or alternate escape prefixes', () => {
    expect(normalizeAnsi('\\x1b[32mhello\\x1b[0m')).toBe('\u001b[32mhello\u001b[0m');
    expect(normalizeAnsi('\uFFFD[32mhello\uFFFD[0m')).toBe('\u001b[32mhello\u001b[0m');
  });

  it('strips ANSI codes for plain text search and filtering', () => {
    const raw = '\u001b[32m[Nest] 46  - \u001b[39m09/02/2026, 5:47:06 PM \u001b[32mLOG\u001b[39m';
    expect(stripAnsi(raw)).toBe('[Nest] 46  - 09/02/2026, 5:47:06 PM LOG');
  });

  it('renders colored spans for standard ANSI color codes', () => {
    const raw = '\u001b[32m[Nest] 46\u001b[39m';
    const { container } = render(<div>{renderAnsiLine(raw)}</div>);
    const span = container.querySelector('span');
    expect(span).toBeTruthy();
    expect(span?.style.color).toBe('rgb(0, 187, 0)');
    expect(span?.textContent).toBe('[Nest] 46');
  });

  it('highlights search queries inside ANSI formatted text', () => {
    const raw = '\u001b[38;5;3m[RouterExplorer] route\u001b[39m';
    const { container } = render(<div>{renderAnsiLine(raw, 'RouterExplorer')}</div>);
    const mark = container.querySelector('mark');
    expect(mark).toBeTruthy();
    expect(mark?.textContent).toBe('RouterExplorer');
  });

  it('renders plain text gracefully when no ANSI codes exist', () => {
    const raw = 'Simple plain log message';
    const { container } = render(<div>{renderAnsiLine(raw, 'plain')}</div>);
    const mark = container.querySelector('mark');
    expect(mark).toBeTruthy();
    expect(mark?.textContent).toBe('plain');
    expect(container.textContent).toBe('Simple plain log message');
  });
});
