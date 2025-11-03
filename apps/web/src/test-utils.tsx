import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import { AppStateProvider } from './state/app-state';
import { AuthProvider } from './auth/auth-context';

type RenderOptions = {
  route?: string;
  path?: string;
  children?: ReactNode;
};

export const renderWithProviders = (
  ui: ReactElement,
  { route = '/', path = '/' }: RenderOptions = {}
) : RenderResult =>
  render(
    <AuthProvider>
      <AppStateProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={ui} />
          </Routes>
        </MemoryRouter>
      </AppStateProvider>
    </AuthProvider>
  );
