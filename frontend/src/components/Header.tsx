import { useThemeStore, type ThemeMode } from '../store/useThemeStore';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '💻' },
];

/**
 * Header – app navigation bar with branding and theme toggle.
 */
export function Header() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__brand">
          <div className="header__logo" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 48 46" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"
                fill="currentColor"
                className="header__logo-path"
              />
            </svg>
          </div>
          <span className="header__title">AI Smart Todo</span>
        </div>

        <div className="header__theme-toggle" role="radiogroup" aria-label="Theme selection">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`header__theme-btn${mode === option.value ? ' header__theme-btn--active' : ''}`}
              onClick={() => setMode(option.value)}
              aria-label={`${option.label} theme`}
              aria-checked={mode === option.value}
              role="radio"
              title={option.label}
            >
              <span className="header__theme-icon">{option.icon}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
