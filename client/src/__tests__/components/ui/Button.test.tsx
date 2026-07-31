import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '../../../components/ui/Button';

describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders children correctly', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('renders with default props', () => {
      render(<Button>Default Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('cyber-btn'); // variante primaire
      expect(button).toHaveClass('px-4', 'py-2'); // taille md
    });
  });

  describe('Variants', () => {
    it('renders primary variant correctly', () => {
      render(<Button variant="primary">Primary</Button>);
      const button = screen.getByRole('button');
      // La primaire n'ajoute aucun modificateur : c'est le .cyber-btn nu (or).
      expect(button).toHaveClass('cyber-btn');
      expect(button).not.toHaveClass('cyber-btn--violet', 'cyber-btn--danger', 'cyber-btn--ghost');
    });

    it('renders secondary variant correctly', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('cyber-btn', 'cyber-btn--violet');
    });

    it('renders danger variant correctly', () => {
      render(<Button variant="danger">Danger</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('cyber-btn', 'cyber-btn--danger');
    });

    it('renders ghost variant correctly', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('cyber-btn', 'cyber-btn--ghost');
    });
  });

  describe('Sizes', () => {
    it('renders small size correctly', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('cyber-btn--sm', 'px-3', 'py-1.5', 'text-xs');
    });

    it('renders medium size correctly', () => {
      render(<Button size="md">Medium</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-4', 'py-2', 'text-sm');
    });

    it('renders large size correctly', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-6', 'py-3', 'text-base');
    });
  });

  describe('Loading State', () => {
    it('displays loading state when isLoading is true', () => {
      render(<Button isLoading>Submit</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('Chargement…')).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    it('shows loading spinner when loading', () => {
      render(<Button isLoading>Submit</Button>);
      const button = screen.getByRole('button');

      // Check for the SVG spinner
      const spinner = button.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('hides original content when loading', () => {
      render(<Button isLoading>Submit</Button>);
      expect(screen.queryByText('Submit')).not.toBeInTheDocument();
    });

    it('shows original content when not loading', () => {
      render(<Button isLoading={false}>Submit</Button>);
      expect(screen.getByText('Submit')).toBeInTheDocument();
      expect(screen.queryByText('Chargement…')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('is disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      // L'etat desactive est porte par .cyber-btn:disabled dans theme.css.
      expect(button).toHaveClass('cyber-btn');
    });

    it('is disabled when isLoading is true', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('does not trigger onClick when disabled', async () => {
      const handleClick = jest.fn();
      render(<Button disabled onClick={handleClick}>Click</Button>);

      const button = screen.getByRole('button');
      await userEvent.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('User Interactions', () => {
    it('calls onClick handler when clicked', async () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      await userEvent.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('handles multiple clicks', async () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole('button');
      await userEvent.click(button);
      await userEvent.click(button);
      await userEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(3);
    });

    it('can be triggered by keyboard (Enter)', async () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Press Enter</Button>);

      const button = screen.getByRole('button');
      button.focus();
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });

      // Native button behavior triggers click on Enter
      await userEvent.type(button, '{enter}');
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper focus styles', () => {
      render(<Button>Focus me</Button>);
      const button = screen.getByRole('button');
      // Le focus est porte par .cyber-btn:focus-visible (contour cyan) dans theme.css.
      expect(button).toHaveClass('cyber-btn');
    });

    it('is focusable', () => {
      render(<Button>Focus me</Button>);
      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('supports aria-busy for loading state', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });

    it('does not have aria-busy when not loading', () => {
      render(<Button>Not Loading</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'false');
    });
  });

  describe('Ref Forwarding', () => {
    it('forwards ref to the button element', () => {
      const ref = { current: null } as React.RefObject<HTMLButtonElement>;
      render(<Button ref={ref}>Ref Button</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('Custom Props', () => {
    it('spreads additional props to button', () => {
      render(
        <Button data-testid="custom-button" aria-label="Custom label">
          Button
        </Button>
      );

      const button = screen.getByTestId('custom-button');
      expect(button).toHaveAttribute('aria-label', 'Custom label');
    });

    it('accepts custom className', () => {
      render(<Button className="custom-class">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });

    it('merges custom className with default classes', () => {
      render(<Button className="custom-class" variant="primary">Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class', 'cyber-btn');
    });
  });

  describe('Button Type', () => {
    it('defaults to button type', () => {
      render(<Button>Button</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });

    it('can be set to submit type', () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('can be set to reset type', () => {
      render(<Button type="reset">Reset</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'reset');
    });
  });
});
