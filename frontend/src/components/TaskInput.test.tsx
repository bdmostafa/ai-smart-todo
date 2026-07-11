import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskInput } from './TaskInput';
import { useAppStore } from '../store/useAppStore';

// Mock the store
vi.mock('../store/useAppStore');

const mockAddTask = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAppStore).mockImplementation((selector: any) => {
    const state = { addTask: mockAddTask };
    return selector(state);
  });
});

describe('TaskInput', () => {
  describe('rendering', () => {
    it('renders an input field and submit button', () => {
      render(<TaskInput />);
      expect(screen.getByLabelText('New Task')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument();
    });

    it('displays character counter starting at 0/500', () => {
      render(<TaskInput />);
      expect(screen.getByText('0/500')).toBeInTheDocument();
    });
  });

  describe('character counter', () => {
    it('updates counter as user types', () => {
      render(<TaskInput />);
      const input = screen.getByLabelText('New Task');
      fireEvent.change(input, { target: { value: 'Hello' } });
      expect(screen.getByText('5/500')).toBeInTheDocument();
    });

    it('shows trimmed length in counter (ignoring leading/trailing spaces)', () => {
      render(<TaskInput />);
      const input = screen.getByLabelText('New Task');
      fireEvent.change(input, { target: { value: '  Hello  ' } });
      // trimmed "Hello" = 5 chars
      expect(screen.getByText('5/500')).toBeInTheDocument();
    });

    it('highlights counter when trimmed length exceeds 500', () => {
      render(<TaskInput />);
      const input = screen.getByLabelText('New Task');
      const longText = 'a'.repeat(501);
      fireEvent.change(input, { target: { value: longText } });
      const counter = screen.getByText('501/500');
      expect(counter.className).toContain('task-input__counter--over');
    });
  });

  describe('validation - Requirement 1.2, 1.3', () => {
    it('shows error for empty submission', () => {
      render(<TaskInput />);
      fireEvent.click(screen.getByRole('button', { name: /add task/i }));
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Task description is required (1–500 characters).'
      );
      expect(mockAddTask).not.toHaveBeenCalled();
    });

    it('shows error for whitespace-only submission', () => {
      render(<TaskInput />);
      const input = screen.getByLabelText('New Task');
      fireEvent.change(input, { target: { value: '    ' } });
      fireEvent.click(screen.getByRole('button', { name: /add task/i }));
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Task description is required (1–500 characters).'
      );
      expect(mockAddTask).not.toHaveBeenCalled();
    });

    it('shows error for description exceeding 500 chars after trimming', () => {
      render(<TaskInput />);
      const input = screen.getByLabelText('New Task');
      const longText = 'a'.repeat(501);
      fireEvent.change(input, { target: { value: longText } });
      fireEvent.click(screen.getByRole('button', { name: /add task/i }));
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Task description must be between 1 and 500 characters.'
      );
      expect(mockAddTask).not.toHaveBeenCalled();
    });

    it('trims whitespace before validation - accepts valid trimmed input', async () => {
      mockAddTask.mockResolvedValueOnce({ taskId: '1', description: 'Buy milk' });
      render(<TaskInput />);
      const input = screen.getByLabelText('New Task');
      fireEvent.change(input, { target: { value: '  Buy milk  ' } });
      fireEvent.click(screen.getByRole('button', { name: /add task/i }));
      await waitFor(() => {
        expect(mockAddTask).toHaveBeenCalledWith('Buy milk');
      });
    });

    it('clears validation error when user starts typing again', () => {
      render(<TaskInput />);
      const input = screen.getByLabelText('New Task');
      // Trigger validation error
      fireEvent.click(screen.getByRole('button', { name: /add task/i }));
      expect(screen.getByRole('alert')).toBeInTheDocument();
      // Start typing
      fireEvent.change(input, { target: { value: 'x' } });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('successful submission - Requirement 1.4, 1.5', () => {
    it('clears input on successful task creation', async () => {
      mockAddTask.mockResolvedValueOnce({ taskId: '1', description: 'Buy milk' });
      render(<TaskInput />);
      const input = screen.getByLabelText('New Task');
      fireEvent.change(input, { target: { value: 'Buy milk' } });
      fireEvent.click(screen.getByRole('button', { name: /add task/i }));
      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('calls addTask with trimmed description', async () => {
      mockAddTask.mockResolvedValueOnce({ taskId: '2', description: 'Clean house' });
      render(<TaskInput />);
      const input = screen.getByLabelText('New Task');
      fireEvent.change(input, { target: { value: 'Clean house' } });
      fireEvent.click(screen.getByRole('button', { name: /add task/i }));
      await waitFor(() => {
        expect(mockAddTask).toHaveBeenCalledWith('Clean house');
      });
    });
  });

  describe('failed submission - Requirement 1.6', () => {
    it('preserves input text when task creation fails', async () => {
      mockAddTask.mockRejectedValueOnce(new Error('Network error'));
      render(<TaskInput />);
      const input = screen.getByLabelText('New Task');
      fireEvent.change(input, { target: { value: 'Important task' } });
      fireEvent.click(screen.getByRole('button', { name: /add task/i }));
      await waitFor(() => {
        expect(input).toHaveValue('Important task');
      });
    });

    it('shows error message when task creation fails', async () => {
      mockAddTask.mockRejectedValueOnce(new Error('Network error'));
      render(<TaskInput />);
      const input = screen.getByLabelText('New Task');
      fireEvent.change(input, { target: { value: 'Important task' } });
      fireEvent.click(screen.getByRole('button', { name: /add task/i }));
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Task could not be saved. Please try again.'
        );
      });
    });
  });

  describe('submit button state', () => {
    it('disables button and input while submitting', async () => {
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockAddTask.mockReturnValueOnce(pendingPromise);

      render(<TaskInput />);
      const input = screen.getByLabelText('New Task');
      const button = screen.getByRole('button', { name: /add task/i });
      fireEvent.change(input, { target: { value: 'Test task' } });
      fireEvent.click(button);

      expect(button).toBeDisabled();
      expect(input).toBeDisabled();
      expect(button).toHaveTextContent('Adding…');

      // Resolve the promise to clean up
      resolvePromise!({ taskId: '1', description: 'Test task' });
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe('form submission via Enter key', () => {
    it('submits on form submit (Enter key)', async () => {
      mockAddTask.mockResolvedValueOnce({ taskId: '1', description: 'Enter task' });
      render(<TaskInput />);
      const input = screen.getByLabelText('New Task');
      fireEvent.change(input, { target: { value: 'Enter task' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => {
        expect(mockAddTask).toHaveBeenCalledWith('Enter task');
      });
    });
  });
});
