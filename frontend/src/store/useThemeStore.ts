import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem('ai-todo-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return 'system';
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const resolvedTheme =
    mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode;

  root.setAttribute('data-theme', resolvedTheme);
  try {
    localStorage.setItem('ai-todo-theme', mode);
  } catch {
    // localStorage unavailable
  }
}

export const useThemeStore = create<ThemeState>((set) => {
  const initialMode = getStoredTheme();
  // Apply immediately on store creation
  applyTheme(initialMode);

  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const currentMode = useThemeStore.getState().mode;
    if (currentMode === 'system') {
      applyTheme('system');
    }
  });

  return {
    mode: initialMode,
    setMode: (mode: ThemeMode) => {
      applyTheme(mode);
      set({ mode });
    },
  };
});
