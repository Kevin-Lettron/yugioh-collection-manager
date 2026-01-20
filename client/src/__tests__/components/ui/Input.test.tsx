import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Input from '../../../components/ui/Input';

describe('Input Component', () => {
  describe('Rendering', () => {
    it('renders an input element', () => {
      render(<Input />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders with placeholder', () => {
      render(<Input placeholder="Enter text..." />);
      expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument();
    });

    it('renders with default styles', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('rounded-lg', 'border', 'px-4', 'py-2');
    });
  });

  describe('Label', () => {
    it('renders label when provided', () => {
      render(<Input label="Username" />);
      expect(screen.getByText('Username')).toBeInTheDocument();
    });

    it('associates label with input', () => {
      render(<Input label="Email" id="email-input" />);
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Email');
      expect(label).toHaveAttribute('for', 'email-input');
      expect(input).toHaveAttribute('id', 'email-input');
    });

    it('generates unique id when not provided', () => {
      render(<Input label="Test Label" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('id');
      expect(input.id).toMatch(/^input-/);
    });

    it('has proper label styling', () => {
      render(<Input label="Styled Label" />);
      const label = screen.getByText('Styled Label');
      expect(label).toHaveClass('text-sm', 'font-medium', 'text-gray-700');
    });
  });

  describe('Error State', () => {
    it('displays error message when error prop is provided', () => {
      render(<Input error="This field is required" />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('applies error styling to input', () => {
      render(<Input error="Error message" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-red-500');
    });

    it('sets aria-invalid to true when error exists', () => {
      render(<Input error="Error" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('error message has role alert', () => {
      render(<Input error="Error message" />);
      expect(screen.getByRole('alert')).toHaveTextContent('Error message');
    });

    it('associates error with input via aria-describedby', () => {
      render(<Input error="Error" id="test-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'test-input-error');
    });

    it('error message has red styling', () => {
      render(<Input error="Error text" />);
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveClass('text-red-600');
    });
  });

  describe('Helper Text', () => {
    it('displays helper text when provided', () => {
      render(<Input helperText="Enter your email address" />);
      expect(screen.getByText('Enter your email address')).toBeInTheDocument();
    });

    it('hides helper text when error is present', () => {
      render(
        <Input
          helperText="This is helper text"
          error="This is an error"
        />
      );
      expect(screen.queryByText('This is helper text')).not.toBeInTheDocument();
      expect(screen.getByText('This is an error')).toBeInTheDocument();
    });

    it('helper text has proper styling', () => {
      render(<Input helperText="Help text" />);
      expect(screen.getByText('Help text')).toHaveClass('text-sm', 'text-gray-500');
    });

    it('associates helper text with input via aria-describedby', () => {
      render(<Input helperText="Help" id="help-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'help-input-helper');
    });
  });

  describe('Icons', () => {
    it('renders left icon when provided', () => {
      const LeftIcon = () => <span data-testid="left-icon">L</span>;
      render(<Input leftIcon={<LeftIcon />} />);
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('renders right icon when provided', () => {
      const RightIcon = () => <span data-testid="right-icon">R</span>;
      render(<Input rightIcon={<RightIcon />} />);
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });

    it('renders both icons when provided', () => {
      const LeftIcon = () => <span data-testid="left-icon">L</span>;
      const RightIcon = () => <span data-testid="right-icon">R</span>;
      render(<Input leftIcon={<LeftIcon />} rightIcon={<RightIcon />} />);
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });

    it('adds left padding when left icon is present', () => {
      const LeftIcon = () => <span>L</span>;
      render(<Input leftIcon={<LeftIcon />} />);
      expect(screen.getByRole('textbox')).toHaveClass('pl-10');
    });

    it('adds right padding when right icon is present', () => {
      const RightIcon = () => <span>R</span>;
      render(<Input rightIcon={<RightIcon />} />);
      expect(screen.getByRole('textbox')).toHaveClass('pr-10');
    });

    it('adds both paddings when both icons are present', () => {
      const LeftIcon = () => <span>L</span>;
      const RightIcon = () => <span>R</span>;
      render(<Input leftIcon={<LeftIcon />} rightIcon={<RightIcon />} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pl-10', 'pr-10');
    });
  });

  describe('Disabled State', () => {
    it('disables input when disabled prop is true', () => {
      render(<Input disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('applies disabled styling', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:bg-gray-100');
    });

    it('does not allow typing when disabled', async () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test');
      expect(input).toHaveValue('');
    });
  });

  describe('User Interactions', () => {
    it('updates value on user input', async () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Hello World');
      expect(input).toHaveValue('Hello World');
    });

    it('calls onChange handler', async () => {
      const handleChange = jest.fn();
      render(<Input onChange={handleChange} />);
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'a');
      expect(handleChange).toHaveBeenCalled();
    });

    it('calls onFocus handler', () => {
      const handleFocus = jest.fn();
      render(<Input onFocus={handleFocus} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it('calls onBlur handler', () => {
      const handleBlur = jest.fn();
      render(<Input onBlur={handleBlur} />);
      const input = screen.getByRole('textbox');
      fireEvent.blur(input);
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it('supports controlled input', () => {
      const { rerender } = render(<Input value="initial" onChange={() => {}} />);
      expect(screen.getByRole('textbox')).toHaveValue('initial');

      rerender(<Input value="updated" onChange={() => {}} />);
      expect(screen.getByRole('textbox')).toHaveValue('updated');
    });
  });

  describe('Accessibility', () => {
    it('has proper focus styles', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('focus:outline-none', 'focus:ring-2');
    });

    it('is focusable', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      input.focus();
      expect(document.activeElement).toBe(input);
    });

    it('has correct aria-invalid for valid input', () => {
      render(<Input />);
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
    });

    it('has no aria-describedby when no error or helper text', () => {
      render(<Input />);
      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
    });
  });

  describe('Ref Forwarding', () => {
    it('forwards ref to the input element', () => {
      const ref = { current: null } as React.RefObject<HTMLInputElement>;
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('allows programmatic focus via ref', () => {
      const ref = { current: null } as React.RefObject<HTMLInputElement>;
      render(<Input ref={ref} />);
      ref.current?.focus();
      expect(document.activeElement).toBe(ref.current);
    });
  });

  describe('Input Types', () => {
    it('renders as text input by default', () => {
      render(<Input />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');
    });

    it('can render as email input', () => {
      render(<Input type="email" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
    });

    it('can render as password input', () => {
      render(<Input type="password" />);
      // Password inputs don't have textbox role
      const input = document.querySelector('input[type="password"]');
      expect(input).toBeInTheDocument();
    });

    it('can render as number input', () => {
      render(<Input type="number" />);
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });
  });

  describe('Custom Props', () => {
    it('spreads additional props to input', () => {
      render(
        <Input
          data-testid="custom-input"
          maxLength={10}
          autoComplete="email"
        />
      );
      const input = screen.getByTestId('custom-input');
      expect(input).toHaveAttribute('maxLength', '10');
      expect(input).toHaveAttribute('autoComplete', 'email');
    });

    it('accepts custom className', () => {
      render(<Input className="custom-class" />);
      expect(screen.getByRole('textbox')).toHaveClass('custom-class');
    });

    it('merges custom className with default classes', () => {
      render(<Input className="my-custom-class" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('my-custom-class', 'rounded-lg');
    });
  });
});
