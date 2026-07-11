import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ErrorBanner } from './ErrorBanner';
import { useAppStore } from '../store/useAppStore';

describe('ErrorBanner', () => {
  beforeEach(() => {
    useAppStore.setState({
      tasks: [],
      topThree: [],
      isLoading: false,
      error: null,
      userId: 'test-user',
    });
  });

  it('renders nothing when there is no error', () => {
    const { container } = render(<ErrorBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('displays the error message when error state is set', () => {
    useAppStore.setState({ error: 'Failed to create task' });

    render(<ErrorBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to create task');
  });

  it('uses role="alert" for accessibility', () => {
    useAppStore.setState({ error: 'Something went wrong' });

    render(<ErrorBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('includes a dismiss button', () => {
    useAppStore.setState({ error: 'Network error' });

    render(<ErrorBanner />);
    expect(screen.getByRole('button', { name: /dismiss error/i })).toBeInTheDocument();
  });

  it('calls clearError when dismiss button is clicked', () => {
    const clearErrorMock = vi.fn();
    useAppStore.setState({ error: 'Delete failed', clearError: clearErrorMock } as any);

    render(<ErrorBanner />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss error/i }));

    expect(clearErrorMock).toHaveBeenCalled();
  });

  it('auto-dismisses when error is cleared (re-renders to null)', () => {
    useAppStore.setState({ error: 'Temporary error' });

    const { rerender } = render(<ErrorBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Simulate successful retry clearing the error
    act(() => {
      useAppStore.setState({ error: null });
    });
    rerender(<ErrorBanner />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('displays specific error messages for save failures (Req 1.6)', () => {
    useAppStore.setState({ error: 'Failed to create task' });

    render(<ErrorBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to create task');
  });

  it('displays specific error messages for delete failures (Req 6.5)', () => {
    useAppStore.setState({ error: 'Failed to delete task' });

    render(<ErrorBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to delete task');
  });
});
