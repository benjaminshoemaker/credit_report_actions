import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LandingRoute from '../LandingRoute';
import { renderWithProviders } from '../../test-utils';

describe('LandingRoute', () => {
  it('requires TOS acceptance before proceeding', async () => {
    renderWithProviders(<LandingRoute />);

    const checkbox = screen.getByRole('checkbox');
    const continueButton = screen.getByRole('button', { name: /continue/i });

    expect((continueButton as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(checkbox);

    expect((continueButton as HTMLButtonElement).disabled).toBe(false);
  });
});
