import { useState, type FormEvent } from 'react';
import { useAppStore } from '../store/useAppStore';
import './TaskInput.css';

const MAX_LENGTH = 500;

/**
 * Validates a task description after trimming.
 * Returns an error message if invalid, or null if valid.
 */
function validateDescription(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return 'Task description is required (1–500 characters).';
  }
  if (trimmed.length > MAX_LENGTH) {
    return `Task description must be between 1 and ${MAX_LENGTH} characters.`;
  }
  return null;
}

/**
 * TaskInput component – accepts a task description and submits it.
 *
 * Requirements: 1.2, 1.3, 1.4, 1.5, 1.6
 */
export function TaskInput() {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addTask = useAppStore((s) => s.addTask);

  const trimmedLength = input.trim().length;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const trimmed = input.trim();
    const validationError = validateDescription(input);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await addTask(trimmed);
      // Req 1.5: Clear input on successful creation
      setInput('');
    } catch {
      // Req 1.6: Preserve input on failure; store sets the global error
      setError('Task could not be saved. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="task-input" onSubmit={handleSubmit}>
      <div className="task-input__field-wrapper">
        <label htmlFor="task-description" className="task-input__label">
          New Task
        </label>
        <input
          id="task-description"
          type="text"
          className="task-input__input"
          placeholder="What needs to be done?"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (error) setError(null);
          }}
          maxLength={600}
          aria-describedby="task-input-hint"
          aria-invalid={error ? true : undefined}
          disabled={isSubmitting}
        />
        <div className="task-input__meta">
          <span
            id="task-input-hint"
            className={`task-input__counter${trimmedLength > MAX_LENGTH ? ' task-input__counter--over' : ''}`}
          >
            {trimmedLength}/{MAX_LENGTH}
          </span>
        </div>
      </div>

      {error && (
        <p className="task-input__error" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="task-input__submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Adding…' : 'Add Task'}
      </button>
    </form>
  );
}
