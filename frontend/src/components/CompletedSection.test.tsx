import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompletedSection } from './CompletedSection';
import { useAppStore } from '../store/useAppStore';
import type { Task } from '../types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    taskId: 'task-1',
    description: 'Test task',
    quadrant: 'do-first',
    priorityScore: 80,
    status: 'incomplete',
    createdAt: '2024-01-01T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

describe('CompletedSection', () => {
  beforeEach(() => {
    useAppStore.setState({
      tasks: [],
      topThree: [],
      isLoading: false,
      error: null,
      userId: 'test-user',
    });
  });

  it('renders nothing when there are no completed tasks', () => {
    useAppStore.setState({
      tasks: [makeTask({ status: 'incomplete' })],
    });

    const { container } = render(<CompletedSection />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a toggle button showing the count of completed tasks', () => {
    useAppStore.setState({
      tasks: [
        makeTask({ taskId: '1', status: 'complete', completedAt: '2024-01-02T00:00:00.000Z' }),
        makeTask({ taskId: '2', status: 'complete', completedAt: '2024-01-03T00:00:00.000Z' }),
        makeTask({ taskId: '3', status: 'incomplete' }),
      ],
    });

    render(<CompletedSection />);
    expect(screen.getByRole('button', { name: /completed \(2\)/i })).toBeInTheDocument();
  });

  it('starts collapsed and does not show task list', () => {
    useAppStore.setState({
      tasks: [
        makeTask({ taskId: '1', status: 'complete', completedAt: '2024-01-02T00:00:00.000Z' }),
      ],
    });

    render(<CompletedSection />);
    const toggle = screen.getByRole('button', { name: /completed/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('expands on click to show completed tasks', () => {
    useAppStore.setState({
      tasks: [
        makeTask({ taskId: '1', description: 'Done task', status: 'complete', completedAt: '2024-01-02T00:00:00.000Z' }),
      ],
    });

    render(<CompletedSection />);
    const toggle = screen.getByRole('button', { name: /completed/i });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Done task')).toBeInTheDocument();
  });

  it('collapses when clicking toggle again', () => {
    useAppStore.setState({
      tasks: [
        makeTask({ taskId: '1', description: 'Done task', status: 'complete', completedAt: '2024-01-02T00:00:00.000Z' }),
      ],
    });

    render(<CompletedSection />);
    const toggle = screen.getByRole('button', { name: /completed/i });

    fireEvent.click(toggle); // expand
    fireEvent.click(toggle); // collapse

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Done task')).not.toBeInTheDocument();
  });

  it('displays completed tasks with strikethrough styling class', () => {
    useAppStore.setState({
      tasks: [
        makeTask({ taskId: '1', description: 'Strikethrough task', status: 'complete', completedAt: '2024-01-02T00:00:00.000Z' }),
      ],
    });

    render(<CompletedSection />);
    fireEvent.click(screen.getByRole('button', { name: /completed/i }));

    const description = screen.getByText('Strikethrough task');
    expect(description).toHaveClass('completed-section__description');
  });

  it('includes a restore button for each completed task', () => {
    useAppStore.setState({
      tasks: [
        makeTask({ taskId: '1', description: 'Task A', status: 'complete', completedAt: '2024-01-02T00:00:00.000Z' }),
        makeTask({ taskId: '2', description: 'Task B', status: 'complete', completedAt: '2024-01-03T00:00:00.000Z' }),
      ],
    });

    render(<CompletedSection />);
    fireEvent.click(screen.getByRole('button', { name: /completed/i }));

    expect(screen.getByRole('button', { name: /restore task: task a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restore task: task b/i })).toBeInTheDocument();
  });

  it('calls restoreTask when restore button is clicked', () => {
    const restoreMock = vi.fn();
    useAppStore.setState({
      tasks: [
        makeTask({ taskId: 'abc', description: 'Restore me', status: 'complete', completedAt: '2024-01-02T00:00:00.000Z' }),
      ],
    });
    // Override restoreTask action
    useAppStore.setState({ restoreTask: restoreMock } as any);

    render(<CompletedSection />);
    fireEvent.click(screen.getByRole('button', { name: /completed/i }));
    fireEvent.click(screen.getByRole('button', { name: /restore task: restore me/i }));

    expect(restoreMock).toHaveBeenCalledWith('abc');
  });
});
