import { useAppStore } from '../store/useAppStore';

/**
 * ErrorBanner – displays a non-blocking error message at the top of the app.
 * Auto-dismisses when the error state is cleared (e.g., on successful retry).
 *
 * Requirements: 1.6, 6.5
 */
export function ErrorBanner() {
  const error = useAppStore((s) => s.error);
  const clearError = useAppStore((s) => s.clearError);

  if (!error) {
    return null;
  }

  return (
    <div className="error-banner" role="alert">
      <span className="error-banner__message">{error}</span>
      <button
        type="button"
        className="error-banner__dismiss"
        onClick={clearError}
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  );
}
