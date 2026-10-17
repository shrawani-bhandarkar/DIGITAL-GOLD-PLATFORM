import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/apiClient.js';

const adminUser = {
  id: 12,
  email: 'admin@digitalgold.demo',
  name: 'Admin',
  roleId: 'ADMIN',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderLogin() {
  return render(
    <MemoryRouter
      initialEntries={['/login']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('admin authentication flow', () => {
  let authenticatedUser;
  let fetchMock;

  beforeEach(() => {
    authenticatedUser = null;
    fetchMock = vi.fn(async (path, options = {}) => {
      if (path === '/api/auth/session') {
        return jsonResponse({ user: authenticatedUser });
      }
      if (path === '/api/auth/login') {
        const credentials = JSON.parse(options.body);
        if (credentials.email === adminUser.email && credentials.password === 'Admin123!') {
          authenticatedUser = adminUser;
          return jsonResponse({ user: adminUser });
        }
        return jsonResponse({ message: 'Email or password is incorrect.' }, 401);
      }
      if (path === '/api/admin/profile') {
        return authenticatedUser
          ? jsonResponse({ user: authenticatedUser })
          : jsonResponse({ message: 'Authentication is required.' }, 401);
      }
      if (path === '/api/auth/logout') {
        authenticatedUser = null;
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ message: 'Unexpected request.' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('validates credentials, restores the session, authorizes a protected request, and logs out', async () => {
    const user = userEvent.setup();
    const loginView = renderLogin();

    await screen.findByRole('heading', { name: 'Welcome back' });
    await user.type(screen.getByRole('textbox', { name: 'Email address' }), adminUser.email);
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'wrong');
    await user.click(screen.getByRole('button', { name: /Sign in to workspace/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');

    await user.clear(screen.getByLabelText('Password', { selector: 'input' }));
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'Admin123!');
    await user.click(screen.getByRole('button', { name: /Sign in to workspace/ }));
    expect(await screen.findByRole('heading', { name: 'Good morning, Admin' })).toBeInTheDocument();

    await expect(apiRequest('/api/admin/profile')).resolves.toEqual({ user: adminUser });
    const loginCall = fetchMock.mock.calls.find(([path, options]) => (
      path === '/api/auth/login' && JSON.parse(options.body).password === 'Admin123!'
    ));
    expect(JSON.parse(loginCall[1].body)).toEqual({
      email: adminUser.email,
      password: 'Admin123!',
    });
    expect(loginCall[1].credentials).toBe('include');
    expect(screen.queryByText('Admin123!')).not.toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);

    loginView.unmount();
    renderLogin();
    expect(await screen.findByRole('heading', { name: 'Good morning, Admin' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /admin@digitalgold.demo/ }));
    await user.click(within(document.querySelector('.profile-popover')).getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    await expect(apiRequest('/api/admin/profile')).rejects.toThrow('Authentication is required.');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }));
  });
});
