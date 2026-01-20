import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import Login from '../../pages/Login';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock useAuth hook
jest.mock('../../context/AuthContext', () => ({
  ...jest.requireActual('../../context/AuthContext'),
  useAuth: jest.fn(),
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedToast = toast as jest.Mocked<typeof toast>;

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('Login Page', () => {
  const mockLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: mockLogin,
      register: jest.fn(),
      logout: jest.fn(),
      updateUser: jest.fn(),
    });
  });

  describe('Rendering', () => {
    it('renders the login form', () => {
      renderWithRouter(<Login />);

      expect(screen.getByText('YuGiOh Manager')).toBeInTheDocument();
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    it('renders email input', () => {
      renderWithRouter(<Login />);

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    });

    it('renders password input', () => {
      renderWithRouter(<Login />);

      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    });

    it('renders sign in button', () => {
      renderWithRouter(<Login />);

      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('renders link to register page', () => {
      renderWithRouter(<Login />);

      expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute(
        'href',
        '/register'
      );
    });
  });

  describe('Form Validation', () => {
    it('shows error when submitting empty form', async () => {
      renderWithRouter(<Login />);

      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(mockedToast.error).toHaveBeenCalledWith('Please fill in all fields');
    });

    it('shows error when email is empty', async () => {
      renderWithRouter(<Login />);

      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(mockedToast.error).toHaveBeenCalledWith('Please fill in all fields');
    });

    it('shows error when password is empty', async () => {
      renderWithRouter(<Login />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(mockedToast.error).toHaveBeenCalledWith('Please fill in all fields');
    });

    it('shows error for invalid email format', async () => {
      renderWithRouter(<Login />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'invalid-email');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(mockedToast.error).toHaveBeenCalledWith('Please enter a valid email address');
    });

    it('accepts valid email formats', async () => {
      mockLogin.mockResolvedValue(undefined);
      renderWithRouter(<Login />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(mockedToast.error).not.toHaveBeenCalledWith(
        'Please enter a valid email address'
      );
    });
  });

  describe('Form Submission', () => {
    it('calls login with email and password', async () => {
      mockLogin.mockResolvedValue(undefined);
      renderWithRouter(<Login />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('shows success toast on successful login', async () => {
      mockLogin.mockResolvedValue(undefined);
      renderWithRouter(<Login />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockedToast.success).toHaveBeenCalledWith('Welcome back!');
      });
    });

    it('navigates to collection page on successful login', async () => {
      mockLogin.mockResolvedValue(undefined);
      renderWithRouter(<Login />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/collection');
      });
    });

    it('handles login failure gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));
      renderWithRouter(<Login />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      // Should not navigate on failure
      expect(mockNavigate).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Loading State', () => {
    it('shows loading state during submission', async () => {
      let resolveLogin: () => void;
      mockLogin.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveLogin = resolve;
          })
      );

      renderWithRouter(<Login />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Button should show loading text
      expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument();

      // Resolve the login
      resolveLogin!();
    });

    it('disables form inputs during submission', async () => {
      let resolveLogin: () => void;
      mockLogin.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveLogin = resolve;
          })
      );

      renderWithRouter(<Login />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Inputs should be disabled
      expect(screen.getByLabelText(/email address/i)).toBeDisabled();
      expect(screen.getByLabelText(/password/i)).toBeDisabled();

      // Resolve the login
      resolveLogin!();
    });

    it('disables submit button during submission', async () => {
      let resolveLogin: () => void;
      mockLogin.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveLogin = resolve;
          })
      );

      renderWithRouter(<Login />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Button should be disabled
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();

      // Resolve the login
      resolveLogin!();
    });

    it('re-enables form after failed submission', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockLogin.mockRejectedValue(new Error('Login failed'));
      renderWithRouter(<Login />);

      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).not.toBeDisabled();
        expect(screen.getByLabelText(/password/i)).not.toBeDisabled();
        expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('User Interaction', () => {
    it('updates email input value on change', async () => {
      renderWithRouter(<Login />);

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'user@example.com');

      expect(emailInput).toHaveValue('user@example.com');
    });

    it('updates password input value on change', async () => {
      renderWithRouter(<Login />);

      const passwordInput = screen.getByLabelText(/password/i);
      await userEvent.type(passwordInput, 'mypassword');

      expect(passwordInput).toHaveValue('mypassword');
    });

    it('password input is type password', () => {
      renderWithRouter(<Login />);

      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('email input is type email', () => {
      renderWithRouter(<Login />);

      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('submits form on Enter key press', async () => {
      mockLogin.mockResolvedValue(undefined);
      renderWithRouter(<Login />);

      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'test@example.com');

      const passwordInput = screen.getByLabelText(/password/i);
      await userEvent.type(passwordInput, 'password123{enter}');

      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  describe('Accessibility', () => {
    it('has labels associated with inputs', () => {
      renderWithRouter(<Login />);

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);

      expect(emailInput).toHaveAttribute('id', 'email');
      expect(passwordInput).toHaveAttribute('id', 'password');
    });

    it('submit button is focusable', () => {
      renderWithRouter(<Login />);

      const button = screen.getByRole('button', { name: /sign in/i });
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it('form elements are in correct tab order', async () => {
      renderWithRouter(<Login />);

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);

      await userEvent.tab();
      expect(document.activeElement).toBe(passwordInput);

      await userEvent.tab();
      expect(document.activeElement).toBe(submitButton);
    });
  });

  describe('Styling', () => {
    it('applies gradient background', () => {
      const { container } = renderWithRouter(<Login />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('bg-gradient-to-br');
    });

    it('form container has rounded corners and shadow', () => {
      renderWithRouter(<Login />);

      const form = screen.getByRole('button', { name: /sign in/i }).closest('form');
      const container = form?.parentElement;

      expect(container).toHaveClass('rounded-lg', 'shadow-2xl');
    });

    it('submit button has primary styling', () => {
      renderWithRouter(<Login />);

      const button = screen.getByRole('button', { name: /sign in/i });
      expect(button).toHaveClass('bg-blue-600', 'text-white');
    });
  });
});
