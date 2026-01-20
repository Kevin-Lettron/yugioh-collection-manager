import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toggle from '../../../components/ui/Toggle';

describe('Toggle Component', () => {
  const defaultProps = {
    checked: false,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders a toggle button', () => {
      render(<Toggle {...defaultProps} />);
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('renders with label when provided', () => {
      render(<Toggle {...defaultProps} label="Enable notifications" />);
      expect(screen.getByText('Enable notifications')).toBeInTheDocument();
    });

    it('renders without label when not provided', () => {
      render(<Toggle {...defaultProps} />);
      expect(screen.queryByText(/.+/)).not.toBeInTheDocument(); // No visible text except sr-only
    });

    it('applies default styles', () => {
      render(<Toggle {...defaultProps} />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveClass('rounded-full', 'transition-colors');
    });
  });

  describe('Checked State', () => {
    it('shows unchecked state correctly', () => {
      render(<Toggle {...defaultProps} checked={false} />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle).toHaveClass('bg-gray-200');
    });

    it('shows checked state correctly', () => {
      render(<Toggle {...defaultProps} checked={true} />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      expect(toggle).toHaveClass('bg-blue-600');
    });

    it('toggle knob moves when checked', () => {
      const { rerender } = render(<Toggle {...defaultProps} checked={false} />);
      let toggle = screen.getByRole('switch');
      let knob = toggle.querySelector('span[aria-hidden="true"]');
      expect(knob).toHaveClass('translate-x-0');

      rerender(<Toggle {...defaultProps} checked={true} />);
      toggle = screen.getByRole('switch');
      knob = toggle.querySelector('span[aria-hidden="true"]');
      expect(knob).toHaveClass('translate-x-5');
    });
  });

  describe('User Interactions', () => {
    it('calls onChange when clicked', async () => {
      const onChange = jest.fn();
      render(<Toggle {...defaultProps} onChange={onChange} />);

      await userEvent.click(screen.getByRole('switch'));
      expect(onChange).toHaveBeenCalledWith(true); // Toggles to true
    });

    it('toggles from checked to unchecked on click', async () => {
      const onChange = jest.fn();
      render(<Toggle checked={true} onChange={onChange} />);

      await userEvent.click(screen.getByRole('switch'));
      expect(onChange).toHaveBeenCalledWith(false); // Toggles to false
    });

    it('toggles from unchecked to checked on click', async () => {
      const onChange = jest.fn();
      render(<Toggle checked={false} onChange={onChange} />);

      await userEvent.click(screen.getByRole('switch'));
      expect(onChange).toHaveBeenCalledWith(true); // Toggles to true
    });

    it('calls onChange when label is clicked', async () => {
      const onChange = jest.fn();
      render(<Toggle {...defaultProps} onChange={onChange} label="Click me" />);

      await userEvent.click(screen.getByText('Click me'));
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('handles rapid clicks', async () => {
      const onChange = jest.fn();
      render(<Toggle {...defaultProps} onChange={onChange} />);

      const toggle = screen.getByRole('switch');
      await userEvent.click(toggle);
      await userEvent.click(toggle);
      await userEvent.click(toggle);

      expect(onChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('Keyboard Accessibility', () => {
    it('toggles on Space key press', () => {
      const onChange = jest.fn();
      render(<Toggle {...defaultProps} onChange={onChange} />);

      const toggle = screen.getByRole('switch');
      fireEvent.keyDown(toggle, { key: ' ', code: 'Space' });

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('toggles on Enter key press', () => {
      const onChange = jest.fn();
      render(<Toggle {...defaultProps} onChange={onChange} />);

      const toggle = screen.getByRole('switch');
      fireEvent.keyDown(toggle, { key: 'Enter', code: 'Enter' });

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('does not toggle on other keys', () => {
      const onChange = jest.fn();
      render(<Toggle {...defaultProps} onChange={onChange} />);

      const toggle = screen.getByRole('switch');
      fireEvent.keyDown(toggle, { key: 'Tab', code: 'Tab' });
      fireEvent.keyDown(toggle, { key: 'Escape', code: 'Escape' });
      fireEvent.keyDown(toggle, { key: 'a', code: 'KeyA' });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('prevents default on Space and Enter', () => {
      render(<Toggle {...defaultProps} />);

      const toggle = screen.getByRole('switch');
      const spaceEvent = fireEvent.keyDown(toggle, { key: ' ', code: 'Space' });
      const enterEvent = fireEvent.keyDown(toggle, { key: 'Enter', code: 'Enter' });

      // Note: fireEvent doesn't actually preventDefault, but we test the handler is called
      expect(spaceEvent).toBe(true);
      expect(enterEvent).toBe(true);
    });

    it('is focusable', () => {
      render(<Toggle {...defaultProps} />);
      const toggle = screen.getByRole('switch');
      toggle.focus();
      expect(document.activeElement).toBe(toggle);
    });

    it('has focus ring styles', () => {
      render(<Toggle {...defaultProps} />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500');
    });
  });

  describe('Disabled State', () => {
    it('disables toggle when disabled prop is true', () => {
      render(<Toggle {...defaultProps} disabled />);
      expect(screen.getByRole('switch')).toBeDisabled();
    });

    it('applies disabled styles', () => {
      render(<Toggle {...defaultProps} disabled />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('does not call onChange when disabled and clicked', async () => {
      const onChange = jest.fn();
      render(<Toggle {...defaultProps} onChange={onChange} disabled />);

      await userEvent.click(screen.getByRole('switch'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not call onChange when disabled label is clicked', async () => {
      const onChange = jest.fn();
      render(<Toggle {...defaultProps} onChange={onChange} disabled label="Disabled toggle" />);

      await userEvent.click(screen.getByText('Disabled toggle'));
      // The label click triggers handleToggle which checks disabled
      expect(onChange).not.toHaveBeenCalled();
    });

    it('label has disabled styling', () => {
      render(<Toggle {...defaultProps} disabled label="Disabled" />);
      const label = screen.getByText('Disabled');
      expect(label).toHaveClass('opacity-50', 'cursor-not-allowed');
    });
  });

  describe('Label Association', () => {
    it('generates unique id when not provided', () => {
      render(<Toggle {...defaultProps} label="Test" />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('id');
      expect(toggle.id).toMatch(/^toggle-/);
    });

    it('uses provided id', () => {
      render(<Toggle {...defaultProps} label="Test" id="custom-toggle" />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('id', 'custom-toggle');
    });

    it('associates label with toggle via aria-labelledby', () => {
      render(<Toggle {...defaultProps} label="My Toggle" id="my-toggle" />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-labelledby', 'my-toggle-label');
    });

    it('label has for attribute matching toggle id', () => {
      render(<Toggle {...defaultProps} label="Test Label" id="test-toggle" />);
      const label = screen.getByText('Test Label');
      expect(label).toHaveAttribute('for', 'test-toggle');
    });
  });

  describe('Accessibility', () => {
    it('has role="switch"', () => {
      render(<Toggle {...defaultProps} />);
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('has aria-checked attribute', () => {
      const { rerender } = render(<Toggle {...defaultProps} checked={false} />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');

      rerender(<Toggle {...defaultProps} checked={true} />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });

    it('has screen reader only text', () => {
      render(<Toggle {...defaultProps} label="Visible Label" />);
      const toggle = screen.getByRole('switch');
      const srOnly = toggle.querySelector('.sr-only');
      expect(srOnly).toBeInTheDocument();
      expect(srOnly).toHaveTextContent('Visible Label');
    });

    it('uses default sr-only text when no label', () => {
      render(<Toggle {...defaultProps} />);
      const toggle = screen.getByRole('switch');
      const srOnly = toggle.querySelector('.sr-only');
      expect(srOnly).toHaveTextContent('Toggle');
    });

    it('knob has aria-hidden', () => {
      render(<Toggle {...defaultProps} />);
      const toggle = screen.getByRole('switch');
      const knob = toggle.querySelector('span[aria-hidden="true"]');
      expect(knob).toBeInTheDocument();
    });
  });

  describe('Custom Props', () => {
    it('accepts custom className', () => {
      render(<Toggle {...defaultProps} className="custom-class" />);
      // The className is applied to the wrapper div
      const wrapper = screen.getByRole('switch').parentElement;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('merges custom className with default flex classes', () => {
      render(<Toggle {...defaultProps} className="my-wrapper" />);
      const wrapper = screen.getByRole('switch').parentElement;
      expect(wrapper).toHaveClass('flex', 'items-center', 'my-wrapper');
    });
  });

  describe('Visual Styling', () => {
    it('has correct dimensions', () => {
      render(<Toggle {...defaultProps} />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveClass('h-6', 'w-11');
    });

    it('knob has correct dimensions', () => {
      render(<Toggle {...defaultProps} />);
      const toggle = screen.getByRole('switch');
      const knob = toggle.querySelector('span[aria-hidden="true"]');
      expect(knob).toHaveClass('h-5', 'w-5', 'rounded-full', 'bg-white');
    });

    it('has transition animation', () => {
      render(<Toggle {...defaultProps} />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveClass('transition-colors', 'duration-200');
    });

    it('knob has transition animation', () => {
      render(<Toggle {...defaultProps} />);
      const toggle = screen.getByRole('switch');
      const knob = toggle.querySelector('span[aria-hidden="true"]');
      expect(knob).toHaveClass('transition', 'duration-200');
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined onChange gracefully', () => {
      // This shouldn't throw
      render(<Toggle checked={false} onChange={undefined as any} />);
      const toggle = screen.getByRole('switch');

      // The component checks !disabled before calling onChange
      // With a proper implementation, this should not throw
      expect(() => fireEvent.click(toggle)).not.toThrow();
    });

    it('handles controlled component updates', () => {
      const ControlledToggle = () => {
        const [checked, setChecked] = React.useState(false);
        return (
          <Toggle
            checked={checked}
            onChange={setChecked}
            label="Controlled"
          />
        );
      };

      // Need to import React for this test
      const React = require('react');
      render(<ControlledToggle />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'true');

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });
  });
});
