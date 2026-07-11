import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QuadrantView } from './QuadrantView';
import type { Task } from '../types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    taskId: crypto.randomUUID(),
    description: 'Test task',
    quadrant: 'schedule',
    priorityScore: 50,
    status: 'incomplete',
    createdAt: '2024-01-15T10:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

describe('QuadrantView', () => {
  describe('Requirement 7.5 - Empty state invitation prompt', () => {
    it('shows invitation prompt when no tasks exist', () => {
      render(<QuadrantView tasks={[]} />);

      expect(screen.getByTestId('quadrant-view-empty')).toBeInTheDocument();
      expect(
        screen.getByText(/add your first task/i)
      ).toBeInTheDocument();
    });

    it('does not show quadrant grid when no tasks exist', () => {
      render(<QuadrantView tasks={[]} />);

      expect(screen.queryByTestId('quadrant-view')).not.toBeInTheDocument();
    });
  });

  describe('Requirement 7.1 - Quadrant grouping and order', () => {
    it('renders all four quadrants in correct order: Do First, Schedule, Delegate, Eliminate', () => {
      const tasks = [makeTask({ quadrant: 'do-first' })];
      render(<QuadrantView tasks={tasks} />);

      const panels = screen.getAllByRole('region');
      expect(panels).toHaveLength(4);
      expect(panels[0]).toHaveAttribute('aria-label', 'Do First quadrant');
      expect(panels[1]).toHaveAttribute('aria-label', 'Schedule quadrant');
      expect(panels[2]).toHaveAttribute('aria-label', 'Delegate quadrant');
      expect(panels[3]).toHaveAttribute('aria-label', 'Eliminate quadrant');
    });

    it('groups tasks by their quadrant', () => {
      const tasks = [
        makeTask({ taskId: '1', quadrant: 'do-first', description: 'Urgent task' }),
        makeTask({ taskId: '2', quadrant: 'schedule', description: 'Plan task' }),
        makeTask({ taskId: '3', quadrant: 'delegate', description: 'Delegate task' }),
        makeTask({ taskId: '4', quadrant: 'eliminate', description: 'Drop task' }),
      ];

      render(<QuadrantView tasks={tasks} />);

      const doFirstPanel = screen.getByTestId('quadrant-do-first');
      expect(within(doFirstPanel).getByText('Urgent task')).toBeInTheDocument();

      const schedulePanel = screen.getByTestId('quadrant-schedule');
      expect(within(schedulePanel).getByText('Plan task')).toBeInTheDocument();

      const delegatePanel = screen.getByTestId('quadrant-delegate');
      expect(within(delegatePanel).getByText('Delegate task')).toBeInTheDocument();

      const eliminatePanel = screen.getByTestId('quadrant-eliminate');
      expect(within(eliminatePanel).getByText('Drop task')).toBeInTheDocument();
    });
  });

  describe('Requirement 7.2 - Sorting within quadrants', () => {
    it('sorts tasks by priorityScore descending', () => {
      const tasks = [
        makeTask({ taskId: '1', quadrant: 'do-first', description: 'Low', priorityScore: 60 }),
        makeTask({ taskId: '2', quadrant: 'do-first', description: 'High', priorityScore: 95 }),
        makeTask({ taskId: '3', quadrant: 'do-first', description: 'Mid', priorityScore: 80 }),
      ];

      render(<QuadrantView tasks={tasks} />);

      const doFirstPanel = screen.getByTestId('quadrant-do-first');
      const items = within(doFirstPanel).getAllByRole('listitem');

      expect(items[0]).toHaveTextContent('High');
      expect(items[1]).toHaveTextContent('Mid');
      expect(items[2]).toHaveTextContent('Low');
    });

    it('breaks ties by createdAt descending (most recent first)', () => {
      const tasks = [
        makeTask({
          taskId: '1',
          quadrant: 'schedule',
          description: 'Older',
          priorityScore: 70,
          createdAt: '2024-01-10T10:00:00.000Z',
        }),
        makeTask({
          taskId: '2',
          quadrant: 'schedule',
          description: 'Newer',
          priorityScore: 70,
          createdAt: '2024-01-15T10:00:00.000Z',
        }),
      ];

      render(<QuadrantView tasks={tasks} />);

      const schedulePanel = screen.getByTestId('quadrant-schedule');
      const items = within(schedulePanel).getAllByRole('listitem');

      expect(items[0]).toHaveTextContent('Newer');
      expect(items[1]).toHaveTextContent('Older');
    });
  });

  describe('Requirement 7.3 - Task display', () => {
    it('displays task description, quadrant label, and priority score', () => {
      const task = makeTask({
        taskId: 'abc',
        quadrant: 'do-first',
        description: 'Finish report',
        priorityScore: 88,
      });

      render(<QuadrantView tasks={[task]} />);

      const taskEl = screen.getByTestId('task-abc');
      expect(taskEl).toHaveTextContent('Finish report');
      expect(taskEl).toHaveTextContent('Do First');
      expect(taskEl).toHaveTextContent('Score: 88');
    });
  });

  describe('Requirement 7.4 - Placeholder for empty quadrants', () => {
    it('shows placeholder in quadrants with no tasks', () => {
      // Only add a task to do-first, other quadrants should show placeholders
      const tasks = [makeTask({ quadrant: 'do-first' })];

      render(<QuadrantView tasks={tasks} />);

      expect(screen.getByTestId('placeholder-schedule')).toHaveTextContent('No tasks in this quadrant');
      expect(screen.getByTestId('placeholder-delegate')).toHaveTextContent('No tasks in this quadrant');
      expect(screen.getByTestId('placeholder-eliminate')).toHaveTextContent('No tasks in this quadrant');
      expect(screen.queryByTestId('placeholder-do-first')).not.toBeInTheDocument();
    });

    it('shows all four quadrants even when tasks exist only in one', () => {
      const tasks = [makeTask({ quadrant: 'eliminate' })];

      render(<QuadrantView tasks={tasks} />);

      expect(screen.getByTestId('quadrant-do-first')).toBeInTheDocument();
      expect(screen.getByTestId('quadrant-schedule')).toBeInTheDocument();
      expect(screen.getByTestId('quadrant-delegate')).toBeInTheDocument();
      expect(screen.getByTestId('quadrant-eliminate')).toBeInTheDocument();
    });
  });

  describe('Multiple tasks per quadrant', () => {
    it('handles multiple tasks distributed across quadrants', () => {
      const tasks = [
        makeTask({ taskId: '1', quadrant: 'do-first', description: 'Task A', priorityScore: 90 }),
        makeTask({ taskId: '2', quadrant: 'do-first', description: 'Task B', priorityScore: 85 }),
        makeTask({ taskId: '3', quadrant: 'schedule', description: 'Task C', priorityScore: 60 }),
        makeTask({ taskId: '4', quadrant: 'eliminate', description: 'Task D', priorityScore: 10 }),
      ];

      render(<QuadrantView tasks={tasks} />);

      const doFirstPanel = screen.getByTestId('quadrant-do-first');
      const doFirstItems = within(doFirstPanel).getAllByRole('listitem');
      expect(doFirstItems).toHaveLength(2);

      const schedulePanel = screen.getByTestId('quadrant-schedule');
      const scheduleItems = within(schedulePanel).getAllByRole('listitem');
      expect(scheduleItems).toHaveLength(1);

      expect(screen.getByTestId('placeholder-delegate')).toBeInTheDocument();
    });
  });
});
