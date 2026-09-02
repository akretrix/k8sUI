import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReadOnlyToggle } from './ReadOnlyToggle';

describe('ReadOnlyToggle Component (Safety Tests)', () => {
  it('renders Read-Only Mode locked by default with shield lock icon', () => {
    render(<ReadOnlyToggle isReadOnly={true} environment="Production" onToggle={vi.fn()} />);
    expect(screen.getByText('READ-ONLY')).toBeInTheDocument();
  });

  it('shows confirmation safeguard modal when attempting to unlock write access on Production', () => {
    const handleToggle = vi.fn();
    render(<ReadOnlyToggle isReadOnly={true} environment="Production" onToggle={handleToggle} />);

    // Click toggle button
    fireEvent.click(screen.getByRole('button', { name: /Read-Only Mode Active/i }));

    // Expect critical production safeguard prompt
    expect(screen.getByText('Unlock Write Access to Production?')).toBeInTheDocument();
    expect(screen.getByText(/You are attempting to enable mutating operations/i)).toBeInTheDocument();

    // Confirm unlocking
    fireEvent.click(screen.getByText('Unlock Write Mode'));
    expect(handleToggle).toHaveBeenCalledWith(true);
  });

  it('allows locking back to Read-Only immediately without confirmation modal', () => {
    const handleToggle = vi.fn();
    render(<ReadOnlyToggle isReadOnly={false} environment="Production" onToggle={handleToggle} />);

    // Click to lock
    fireEvent.click(screen.getByRole('button', { name: /Write Mode Active/i }));
    expect(handleToggle).toHaveBeenCalledWith(false);
  });
});
