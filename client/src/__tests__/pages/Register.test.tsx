import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Register from '../../pages/Register';
import { useAuth } from '../../context/AuthContext';
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

describe('Register Page', () => {
  const mockRegister = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: jest.fn(),
      register: mockRegister,
      logout: jest.fn(),
      updateUser: jest.fn(),
    });
  });

  describe('Rendering', () => {
    it('renders the registration form', () => {
      renderWithRouter(<Register />);

      expect(screen.getByText('YuGiOh Manager')).toBeInTheDocument();
      expect(screen.getByText('Create your account')).toBeInTheDocument();
    });

    it('renders username input', () => {
      renderWithRouter(<Register />);

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Choose a username')).toBeInTheDocument();
    });

    it('renders email input', () => {
      renderWithRouter(<Register />);

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    });

    it('renders password input', () => {
      renderWithRouter(<Register />);

      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('At least 6 characters')).toBeInTheDocument();
    });

    it('renders confirm password input', () => {
      renderWithRouter(<Register />);

      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Re-enter your password')).toBeInTheDocument();
    });

    it('renders sign up button', () => {
      renderWithRouter(<Register />);

      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    });

    it('renders link to login page', () => {
      renderWithRouter(<Register />);

      expect(screen.getByText(/already have an account\?/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
        'href',
        '/login'
      );
    });
  });

  describe('Form Validation', () => {
    it('shows error when submitting empty form', async () => {
      renderWithRouter(<Register />);

      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(mockedToast.error).toHaveBeenCalledWith('Please fill in all fields');
    });

    it('shows error when username is too short', async () => {
      renderWithRouter(<Register />);

      await userEvent.type(screen.getByLabelText(/username/i), 'ab');
      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(mockedToast.error).toHaveBeenCalledWith(
        'Username must be at least 3 characters'
      );
    });

    it('shows error for invalid email format', async () => {
      renderWithRouter(<Register />);

      await userEvent.type(screen.getByLabelText(/username/i), 'testuser');
      await userEvent.type(screen.getByLabelText(/email address/i), 'invalid-email');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(mockedToast.error).toHaveBeenCalledWith(
        'Please enter a valid email address'
      );
    });

    it('shows error when password is too short', async () => {
      renderWithRouter(<Register />);

      await userEvent.type(screen.getByLabelText(/username/i), 'testuser');
      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), '12345');
      await userEvent.type(screen.getByLabelText(/confirm password/i), '12345');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(mockedToast.error).toHaveBeenCalledWith(
        'Password must be at least 6 characters'
      );
    });

    it('shows error when passwords do not match', async () => {
      renderWithRouter(<Register />);

      await userEvent.type(screen.getByLabelText(/username/i), 'testuser');
      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'different456');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(mockedToast.error).toHaveBeenCalledWith('Passwords do not match');
    });

    it('validates all fields are present', async () => {
      renderWithRouter(<Register />);

      // Only fill username
      await userEvent.type(screen.getByLabelText(/username/i), 'testuser');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(mockedToast.error).toHaveBeenCalledWith('Please fill in all fields');
    });

    it('validates fields in correct order', async () => {
      renderWithRouter(<Register />);

      // Fill all but with short username
      await userEvent.type(screen.getByLabelText(/username/i), 'ab');
      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'pass'); // Also short
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'pass');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      // Should show username error first
      expect(mockedToast.error).toHaveBeenCalledWith(
        'Username must be at least 3 characters'
      );
    });
  });

  describe('Form Submission', () => {
    const fillValidForm = async () => {
      await userEvent.type(screen.getByLabelText(/username/i), 'testuser');
      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123');
    };

    it('calls register with correct data', async () => {
      mockRegister.mockResolvedValue(undefined);
      renderWithRouter(<Register />);

      await fillValidForm();
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(mockRegister).toHaveBeenCalledWith(
        'testuser',
        'test@example.com',
        'password123'
      );
    });

    it('shows success toast on successful registration', async () => {
      mockRegister.mockResolvedValue(undefined);
      renderWithRouter(<Register />);

      await fillValidForm();
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => {
        expect(mockedToast.success).toHaveBeenCalledWith('Account created successfully!');
      });
    });

    it('navigates to collection page on successful registration', async () => {
      mockRegister.mockResolvedValue(undefined);
      renderWithRouter(<Register />);

      await fillValidForm();
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/collection');
      });
    });

    it('handles registration failure gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockRegister.mockRejectedValue(new Error('Email already exists'));
      renderWithRouter(<Register />);

      await fillValidForm();
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Loading State', () => {
    const fillValidForm = async () => {
      await userEvent.type(screen.getByLabelText(/username/i), 'testuser');
      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123');
    };

    it('shows loading state during submission', async () => {
      let resolveRegister: () => void;
      mockRegister.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveRegister = resolve;
          })
      );

      renderWithRouter(<Register />);

      await fillValidForm();
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(screen.getByRole('button', { name: /creating account/i })).toBeInTheDocument();

      resolveRegister!();
    });

    it('disables all form inputs during submission', async () => {
      let resolveRegister: () => void;
      mockRegister.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveRegister = resolve;
          })
      );

      renderWithRouter(<Register />);

      await fillValidForm();
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(screen.getByLabelText(/username/i)).toBeDisabled();
      expect(screen.getByLabelText(/email address/i)).toBeDisabled();
      expect(screen.getByLabelText(/^password$/i)).toBeDisabled();
      expect(screen.getByLabelText(/confirm password/i)).toBeDisabled();

      resolveRegister!();
    });

    it('disables submit button during submission', async () => {
      let resolveRegister: () => void;
      mockRegister.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveRegister = resolve;
          })
      );

      renderWithRouter(<Register />);

      await fillValidForm();
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();

      resolveRegister!();
    });

    it('re-enables form after failed submission', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockRegister.mockRejectedValue(new Error('Registration failed'));
      renderWithRouter(<Register />);

      await fillValidForm();
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).not.toBeDisabled();
        expect(screen.getByLabelText(/email address/i)).not.toBeDisabled();
        expect(screen.getByLabelText(/^password$/i)).not.toBeDisabled();
        expect(screen.getByLabelText(/confirm password/i)).not.toBeDisabled();
        expect(screen.getByRole('button', { name: /sign up/i })).not.toBeDisabled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('User Interaction', () => {
    it('updates all input values on change', async () => {
      renderWithRouter(<Register />);

      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      await userEvent.type(usernameInput, 'newuser');
      await userEvent.type(emailInput, 'new@example.com');
      await userEvent.type(passwordInput, 'secret123');
      await userEvent.type(confirmInput, 'secret123');

      expect(usernameInput).toHaveValue('newuser');
      expect(emailInput).toHaveValue('new@example.com');
      expect(passwordInput).toHaveValue('secret123');
      expect(confirmInput).toHaveValue('secret123');
    });

    it('password inputs are type password', () => {
      renderWithRouter(<Register />);

      expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
      expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute(
        'type',
        'password'
      );
    });

    it('username input is type text', () => {
      renderWithRouter(<Register />);

      expect(screen.getByLabelText(/username/i)).toHaveAttribute('type', 'text');
    });

    it('email input is type email', () => {
      renderWithRouter(<Register />);

      expect(screen.getByLabelText(/email address/i)).toHaveAttribute('type', 'email');
    });
  });

  describe('Password Matching', () => {
    it('accepts matching passwords', async () => {
      mockRegister.mockResolvedValue(undefined);
      renderWithRouter(<Register />);

      await userEvent.type(screen.getByLabelText(/username/i), 'testuser');
      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'samepassword');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'samepassword');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(mockedToast.error).not.toHaveBeenCalledWith('Passwords do not match');
      expect(mockRegister).toHaveBeenCalled();
    });

    it('rejects passwords that differ by case', async () => {
      renderWithRouter(<Register />);

      await userEvent.type(screen.getByLabelText(/username/i), 'testuser');
      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'Password123');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(mockedToast.error).toHaveBeenCalledWith('Passwords do not match');
    });

    it('rejects passwords that differ by whitespace', async () => {
      renderWithRouter(<Register />);

      await userEvent.type(screen.getByLabelText(/username/i), 'testuser');
      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123 ');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(mockedToast.error).toHaveBeenCalledWith('Passwords do not match');
    });
  });

  describe('Accessibility', () => {
    it('has labels associated with inputs', () => {
      renderWithRouter(<Register />);

      expect(screen.getByLabelText(/username/i)).toHaveAttribute('id', 'username');
      expect(screen.getByLabelText(/email address/i)).toHaveAttribute('id', 'email');
      expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('id', 'password');
      expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute(
        'id',
        'confirmPassword'
      );
    });

    it('form elements are in correct tab order', async () => {
      renderWithRouter(<Register />);

      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /sign up/i });

      usernameInput.focus();
      expect(document.activeElement).toBe(usernameInput);

      await userEvent.tab();
      expect(document.activeElement).toBe(emailInput);

      await userEvent.tab();
      expect(document.activeElement).toBe(passwordInput);

      await userEvent.tab();
      expect(document.activeElement).toBe(confirmInput);

      await userEvent.tab();
      expect(document.activeElement).toBe(submitButton);
    });
  });

  describe('Edge Cases', () => {
    it('handles exact minimum username length', async () => {
      mockRegister.mockResolvedValue(undefined);
      renderWithRouter(<Register />);

      await userEvent.type(screen.getByLabelText(/username/i), 'abc'); // Exactly 3 chars
      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), 'password123');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(mockedToast.error).not.toHaveBeenCalledWith(
        'Username must be at least 3 characters'
      );
      expect(mockRegister).toHaveBeenCalled();
    });

    it('handles exact minimum password length', async () => {
      mockRegister.mockResolvedValue(undefined);
      renderWithRouter(<Register />);

      await userEvent.type(screen.getByLabelText(/username/i), 'testuser');
      await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/^password$/i), '123456'); // Exactly 6 chars
      await userEvent.type(screen.getByLabelText(/confirm password/i), '123456');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      expect(mockedToast.error).not.toHaveBeenCalledWith(
        'Password must be at least 6 characters'
      );
      expect(mockRegister).toHaveBeenCalled();
    });
  });
});
