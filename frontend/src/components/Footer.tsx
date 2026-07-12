/**
 * Footer – minimal app footer with branding and social link.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner">
        <p className="footer__text">
          Crafted by{' '}
          <a
            href="https://www.linkedin.com/in/md-mostafa/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer__social-link"
            aria-label="Mostafa on LinkedIn"
          >
            Mostafa
          </a>
          {' '}— powered by AI to simplify your day
        </p>
        <p className="footer__copyright">
          © {year} PriorityLens. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
