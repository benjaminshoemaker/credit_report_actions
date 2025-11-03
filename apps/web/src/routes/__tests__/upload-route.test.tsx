import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn()
  };
});

import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as RouterDom from 'react-router-dom';
import UploadRoute from '../UploadRoute';
import { renderWithProviders } from '../../test-utils';
import passFixture from '../../../test-fixtures/equifax-pass.txt?raw';
import lowCoverageFixture from '../../../test-fixtures/equifax-low-coverage.txt?raw';
import betaPassFixture from '../../../test-fixtures/experian-beta-pass.txt?raw';
import betaFailFixture from '../../../test-fixtures/transunion-beta-fail.txt?raw';

const createFile = (name: string, type: string, size = 1024) => {
  const file = new File(['a'.repeat(10)], name, { type });
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false
  });
  return file;
};

describe('UploadRoute', () => {
  const useNavigateMock = RouterDom.useNavigate as unknown as Mock;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows error when file exceeds constraints', async () => {
    renderWithProviders(<UploadRoute />, { route: '/upload', path: '/upload' });

    const fileInput = screen.getAllByLabelText(/select reports/i)[0] as HTMLInputElement;
    const invalidFile = createFile('image.png', 'image/png');

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(await screen.findByText(/only pdf uploads up to 20mb/i)).toBeTruthy();
  });

  it('rejects files larger than 20MB', async () => {
    renderWithProviders(<UploadRoute />, { route: '/upload', path: '/upload' });

    const fileInput = screen.getAllByLabelText(/select reports/i)[0] as HTMLInputElement;
    const bigFile = createFile('large.pdf', 'application/pdf', 21 * 1024 * 1024);

    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    expect(await screen.findByText(/only pdf uploads up to 20mb/i)).toBeTruthy();
  });

  it('requires bureau selection for each file', async () => {
    renderWithProviders(<UploadRoute />, { route: '/upload', path: '/upload' });

    const fileInput = screen.getAllByLabelText(/select reports/i)[0] as HTMLInputElement;
    const validFile = createFile('report.pdf', 'application/pdf', 1024);

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    expect(screen.getByText(/select a bureau before continuing/i)).toBeTruthy();

    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'equifax');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText(/select a bureau before continuing/i)).toBeNull();

    const continueButtons = screen.getAllByRole('button', { name: /continue to review/i });
    expect(continueButtons[0]).toHaveProperty('disabled', false);
  });

  it('navigates directly to review when thresholds pass', async () => {
    const navigateMock = vi.fn();
    useNavigateMock.mockReturnValue(navigateMock);
    renderWithProviders(<UploadRoute />, { route: '/upload', path: '/upload' });

    const textarea = screen.getByLabelText(/paste equifax text/i);
    fireEvent.change(textarea, { target: { value: passFixture } });

    const continueButton = screen.getAllByRole('button', { name: /continue to review/i })[0];
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/review');
    });
  });

  it('routes to manual review when coverage fails', async () => {
    const navigateMock = vi.fn();
    useNavigateMock.mockReturnValue(navigateMock);
    renderWithProviders(<UploadRoute />, { route: '/upload', path: '/upload' });

    const textarea = screen.getByLabelText(/paste equifax text/i);
    fireEvent.change(textarea, { target: { value: lowCoverageFixture } });

    const continueButton = screen.getAllByRole('button', { name: /continue to review/i })[0];
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/manual-review');
    });
  });

  it('navigates to review when Experian beta thresholds pass', async () => {
    const navigateMock = vi.fn();
    useNavigateMock.mockReturnValue(navigateMock);
    renderWithProviders(<UploadRoute />, { route: '/upload', path: '/upload' });

    const fileInput = screen.getAllByLabelText(/select reports/i)[0] as HTMLInputElement;
    const validFile = createFile('experian.pdf', 'application/pdf', 1024);
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'experian');

    const textarea = screen.getByLabelText(/paste equifax text/i);
    fireEvent.change(textarea, { target: { value: betaPassFixture } });

    const continueButton = screen.getAllByRole('button', { name: /continue to review/i })[0];
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/review');
    });
  });

  it('routes to manual review when beta thresholds fail', async () => {
    const navigateMock = vi.fn();
    useNavigateMock.mockReturnValue(navigateMock);
    renderWithProviders(<UploadRoute />, { route: '/upload', path: '/upload' });

    const fileInput = screen.getAllByLabelText(/select reports/i)[0] as HTMLInputElement;
    const validFile = createFile('transunion.pdf', 'application/pdf', 1024);
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'transunion');

    const textarea = screen.getByLabelText(/paste equifax text/i);
    fireEvent.change(textarea, { target: { value: betaFailFixture } });

    const continueButton = screen.getAllByRole('button', { name: /continue to review/i })[0];
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/manual-review');
    });
  });
});
