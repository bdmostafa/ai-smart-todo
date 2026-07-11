/**
 * FutureFeatures – highlights upcoming features to excite users.
 */

const FEATURES = [
  {
    icon: '🔐',
    title: 'Smart Authentication',
    description: 'Secure login with social accounts and passkeys',
  },
  {
    icon: '🔄',
    title: 'Recurring Tasks',
    description: 'Auto-generate daily, weekly, or custom repeating tasks',
  },
  {
    icon: '🗓️',
    title: 'Natural Language Dates',
    description: 'Say "by Friday" and AI sets the deadline for you',
  },
  {
    icon: '👥',
    title: 'Team Collaboration',
    description: 'Share boards, delegate tasks, and track team progress',
  },
  {
    icon: '📱',
    title: 'Mobile App',
    description: 'Native iOS & Android apps with offline support',
  },
  {
    icon: '📊',
    title: 'Productivity Analytics',
    description: 'Track patterns, streaks, and completion insights over time',
  },
  {
    icon: '🌐',
    title: 'Offline Mode',
    description: 'Create and manage tasks without internet — syncs when back online',
  },
  {
    icon: '🤖',
    title: 'AI Task Breakdown',
    description: 'Automatically split complex tasks into actionable sub-tasks',
  },
];

export function FutureFeatures() {
  return (
    <section className="future-features" aria-labelledby="future-heading">
      <div className="future-features__header">
        <span className="future-features__badge">Coming Soon</span>
        <h2 id="future-heading" className="future-features__title">
          What's Next
        </h2>
        <p className="future-features__subtitle">
          We're building the future of AI-powered productivity. Here's what's on the horizon.
        </p>
      </div>

      <ul className="future-features__grid" role="list">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="future-features__card">
            <span className="future-features__icon" aria-hidden="true">
              {feature.icon}
            </span>
            <h3 className="future-features__card-title">{feature.title}</h3>
            <p className="future-features__card-desc">{feature.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
