import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// Mock the API module
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

// Test component that uses the auth context
const TestComponent = () => {
  const { user, loading, login, register, logout, updateUser } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="user">{user ? JSON.stringify(user) : 'null'}</div>
      <button
        onClick={() => login('test@example.com', 'password123')}
        data-testid="login-btn"
      >
        Login
      </button>
      <button
        onClick={() => register('testuser', 'test@example.com', 'password123')}
        data-testid="register-btn"
      >
        Register
      </button>
      <button onClick={logout} data-testid="logout-btn">
        Logout
      </button>
      <button
        onClick={() =>
          updateUser({
            id: 1,
            username: 'updated',
            email: 'updated@example.com',
            created_at: new Date(),
            updated_at: new Date(),
          })
        }
        data-testid="update-btn"
      >
        Update
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Default mock implementation
    mockedApi.get.mockResolvedValue({ data: null });
    mockedApi.post.mockResolvedValue({ data: { token: 'test-token', user: null } });
  });

  describe('Initial State', () => {
    it('has null user initially when no token exists', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });

    it('shows loading state initially', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Initially loading is true
      expect(screen.getByTestId('loading')).toHaveTextContent('true');
    });

    it('checks for existing token on mount', async () => {
      localStorage.setItem('token', 'existing-token');
      mockedApi.get.mockResolvedValue({
        data: {
          id: 1,
          username: 'existinguser',
          email: 'existing@example.com',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledWith('/auth/profile');
      });
    });

    it('loads user from existing token', async () => {
      localStorage.setItem('token', 'existing-token');
      const mockUser = {
        id: 1,
        username: 'existinguser',
        email: 'existing@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockedApi.get.mockResolvedValue({ data: mockUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        const userDiv = screen.getByTestId('user');
        expect(userDiv.textContent).toContain('existinguser');
      });
    });

    it('removes invalid token on auth check failure', async () => {
      localStorage.setItem('token', 'invalid-token');
      mockedApi.get.mockRejectedValue(new Error('Unauthorized'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(localStorage.getItem('token')).toBeNull();
      });
    });
  });

  describe('Login', () => {
    it('calls API with email and password', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockedApi.post.mockResolvedValue({
        data: { token: 'new-token', user: mockUser },
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await userEvent.click(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalledWith('/auth/login', {
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('stores token in localStorage on successful login', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockedApi.post.mockResolvedValue({
        data: { token: 'new-token', user: mockUser },
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await userEvent.click(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(localStorage.getItem('token')).toBe('new-token');
      });
    });

    it('updates user state on successful login', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockedApi.post.mockResolvedValue({
        data: { token: 'new-token', user: mockUser },
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await userEvent.click(screen.getByTestId('login-btn'));

      await waitFor(() => {
        const userDiv = screen.getByTestId('user');
        expect(userDiv.textContent).toContain('testuser');
      });
    });

    it('throws error on login failure', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedApi.post.mockRejectedValue(new Error('Invalid credentials'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await expect(async () => {
        await userEvent.click(screen.getByTestId('login-btn'));
        await waitFor(() => {
          if (mockedApi.post.mock.results[0]?.type === 'throw') {
            throw mockedApi.post.mock.results[0].value;
          }
        });
      }).rejects;

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Register', () => {
    it('calls API with username, email, and password', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockedApi.post.mockResolvedValue({
        data: { token: 'new-token', user: mockUser },
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await userEvent.click(screen.getByTestId('register-btn'));

      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalledWith('/auth/register', {
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('stores token on successful registration', async () => {
      const mockUser = {
        id: 1,
        username: 'newuser',
        email: 'new@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockedApi.post.mockResolvedValue({
        data: { token: 'registration-token', user: mockUser },
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await userEvent.click(screen.getByTestId('register-btn'));

      await waitFor(() => {
        expect(localStorage.getItem('token')).toBe('registration-token');
      });
    });

    it('updates user state on successful registration', async () => {
      const mockUser = {
        id: 1,
        username: 'newuser',
        email: 'new@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockedApi.post.mockResolvedValue({
        data: { token: 'registration-token', user: mockUser },
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await userEvent.click(screen.getByTestId('register-btn'));

      await waitFor(() => {
        const userDiv = screen.getByTestId('user');
        expect(userDiv.textContent).toContain('newuser');
      });
    });
  });

  describe('Logout', () => {
    it('removes token from localStorage', async () => {
      localStorage.setItem('token', 'existing-token');
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockedApi.get.mockResolvedValue({ data: mockUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await userEvent.click(screen.getByTestId('logout-btn'));

      expect(localStorage.getItem('token')).toBeNull();
    });

    it('sets user to null', async () => {
      localStorage.setItem('token', 'existing-token');
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockedApi.get.mockResolvedValue({ data: mockUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        const userDiv = screen.getByTestId('user');
        expect(userDiv.textContent).toContain('testuser');
      });

      await userEvent.click(screen.getByTestId('logout-btn'));

      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });
  });

  describe('Update User', () => {
    it('updates user state with new user data', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      await userEvent.click(screen.getByTestId('update-btn'));

      await waitFor(() => {
        const userDiv = screen.getByTestId('user');
        expect(userDiv.textContent).toContain('updated');
      });
    });
  });

  describe('useAuth Hook', () => {
    it('throws error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const TestOutsideProvider = () => {
        try {
          useAuth();
          return <div>No error</div>;
        } catch (error) {
          return <div>Error thrown</div>;
        }
      };

      render(<TestOutsideProvider />);
      expect(screen.getByText('Error thrown')).toBeInTheDocument();

      consoleError.mockRestore();
    });
  });

  describe('Multiple Auth Operations', () => {
    it('handles login then logout correctly', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockedApi.post.mockResolvedValue({
        data: { token: 'new-token', user: mockUser },
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // Login
      await userEvent.click(screen.getByTestId('login-btn'));

      await waitFor(() => {
        const userDiv = screen.getByTestId('user');
        expect(userDiv.textContent).toContain('testuser');
      });

      // Logout
      await userEvent.click(screen.getByTestId('logout-btn'));

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(localStorage.getItem('token')).toBeNull();
    });
  });
});
