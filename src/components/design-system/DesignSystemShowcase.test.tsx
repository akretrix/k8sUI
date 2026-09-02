import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DesignSystemShowcase } from './DesignSystemShowcase';

describe('DesignSystemShowcase Component', () => {
  it('renders design system modal when open with tabs and color swatches', () => {
    const handleClose = vi.fn();
    render(<DesignSystemShowcase isOpen={true} onClose={handleClose} />);

    // Header title
    expect(screen.getByText(/Multiplatform Design System & Asset Suite/i)).toBeInTheDocument();

    // Tabs
    expect(screen.getByText('Brand & Semantic Colors')).toBeInTheDocument();
    expect(screen.getByText('Logo & Wordmark Suite')).toBeInTheDocument();
    expect(screen.getByText('Multiplatform App Icons')).toBeInTheDocument();
    expect(screen.getByText('State Illustrations')).toBeInTheDocument();
    expect(screen.getByText('Code & CSS Tokens')).toBeInTheDocument();

    // Core color swatch
    expect(screen.getByText('#326CE5')).toBeInTheDocument();
    expect(screen.getByText('Primary 500')).toBeInTheDocument();
  });

  it('switches between tabs and shows illustrations and code snippets', () => {
    render(<DesignSystemShowcase isOpen={true} onClose={vi.fn()} />);

    // Switch to Logo & Wordmark Suite tab
    fireEvent.click(screen.getByText('Logo & Wordmark Suite'));
    expect(screen.getByText('1. Full Horizontal Lockup')).toBeInTheDocument();
    expect(screen.getByText('2. Compact Symbol (1:1)')).toBeInTheDocument();

    // Switch to State Illustrations tab
    fireEvent.click(screen.getByText('State Illustrations'));
    expect(screen.getByText('1. No Clusters Connected')).toBeInTheDocument();
    expect(screen.getByText('2. Pods Crashing / Alert State')).toBeInTheDocument();
    expect(screen.getByText('3. Deployment Rolling Update')).toBeInTheDocument();
    expect(screen.getByText('4. All Systems Operational')).toBeInTheDocument();

    // Switch to Code & CSS Tokens tab
    fireEvent.click(screen.getByText('Code & CSS Tokens'));
    expect(screen.getByText(/CSS Custom Properties \(:root Tokens\)/i)).toBeInTheDocument();
  });
});
