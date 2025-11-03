import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.tsx';

describe('App', () => {
  it('renders the landing page by default', () => {
    render(<App />);
    expect(screen.getByText(/kick off your aprcut analysis/i)).toBeTruthy();
  });
});
