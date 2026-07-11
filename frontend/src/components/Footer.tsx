/**
 * Footer – minimal app footer with branding.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner">
        <p className="footer__text">
          Built with AI to make your day productive
        </p>
        <p className="footer__copyright">
          © {year} AI Smart Todo. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
