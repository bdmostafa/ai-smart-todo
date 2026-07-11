import { it, expect } from 'vitest';

it('checks localStorage descriptor', () => {
  const desc = Object.getOwnPropertyDescriptor(window, 'localStorage');
  console.log('descriptor:', desc);
  const globalDesc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  console.log('globalThis descriptor:', globalDesc);
  expect(true).toBe(true);
});
