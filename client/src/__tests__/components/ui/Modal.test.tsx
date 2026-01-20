import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../../../components/ui/Modal';

describe('Modal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<Modal {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders title when provided', () => {
      render(<Modal {...defaultProps} title="Test Title" />);
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('renders footer when provided', () => {
      render(
        <Modal
          {...defaultProps}
          footer={<button>Save</button>}
        />
      );
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('renders close button by default', () => {
      render(<Modal {...defaultProps} title="Title" />);
      expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument();
    });

    it('hides close button when showCloseButton is false', () => {
      render(<Modal {...defaultProps} showCloseButton={false} />);
      expect(screen.queryByRole('button', { name: /close modal/i })).not.toBeInTheDocument();
    });
  });

  describe('Modal Sizes', () => {
    it('applies small size class', () => {
      render(<Modal {...defaultProps} size="sm" />);
      const dialog = screen.getByRole('dialog');
      const modalContent = dialog.querySelector('.max-w-sm');
      expect(modalContent).toBeInTheDocument();
    });

    it('applies medium size class (default)', () => {
      render(<Modal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      const modalContent = dialog.querySelector('.max-w-md');
      expect(modalContent).toBeInTheDocument();
    });

    it('applies large size class', () => {
      render(<Modal {...defaultProps} size="lg" />);
      const dialog = screen.getByRole('dialog');
      const modalContent = dialog.querySelector('.max-w-lg');
      expect(modalContent).toBeInTheDocument();
    });

    it('applies extra large size class', () => {
      render(<Modal {...defaultProps} size="xl" />);
      const dialog = screen.getByRole('dialog');
      const modalContent = dialog.querySelector('.max-w-xl');
      expect(modalContent).toBeInTheDocument();
    });
  });

  describe('Close Modal', () => {
    it('calls onClose when close button is clicked', async () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} title="Title" />);

      await userEvent.click(screen.getByRole('button', { name: /close modal/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked (default behavior)', async () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      const overlay = screen.getByRole('dialog');
      await userEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when overlay is clicked and closeOnOverlayClick is false', async () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} closeOnOverlayClick={false} />);

      const overlay = screen.getByRole('dialog');
      await userEvent.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not call onClose when clicking modal content (not overlay)', async () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      await userEvent.click(screen.getByText('Modal content'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Escape Key', () => {
    it('calls onClose when Escape key is pressed (default behavior)', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when Escape is pressed and closeOnEscape is false', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} closeOnEscape={false} />);

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not respond to Escape when modal is closed', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} isOpen={false} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('ignores other key presses', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Enter', code: 'Enter' });
      fireEvent.keyDown(document, { key: 'Tab', code: 'Tab' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Body Scroll Lock', () => {
    it('locks body scroll when modal opens', () => {
      render(<Modal {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('unlocks body scroll when modal closes', () => {
      const { rerender } = render(<Modal {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');

      rerender(<Modal {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe('unset');
    });

    it('restores body scroll on unmount', () => {
      const { unmount } = render(<Modal {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');

      unmount();
      expect(document.body.style.overflow).toBe('unset');
    });
  });

  describe('Focus Management', () => {
    it('focuses first focusable element when modal opens', async () => {
      render(
        <Modal {...defaultProps} title="Title">
          <button>First Button</button>
          <button>Second Button</button>
        </Modal>
      );

      await waitFor(() => {
        // The close button should be focused first since it appears first
        const closeButton = screen.getByRole('button', { name: /close modal/i });
        expect(document.activeElement).toBe(closeButton);
      });
    });
  });

  describe('Accessibility', () => {
    it('has role="dialog"', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal="true"', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby when title is provided', () => {
      render(<Modal {...defaultProps} title="Modal Title" />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('does not have aria-labelledby when title is not provided', () => {
      render(<Modal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).not.toHaveAttribute('aria-labelledby');
    });

    it('close button has aria-label', () => {
      render(<Modal {...defaultProps} title="Title" />);
      expect(screen.getByRole('button', { name: /close modal/i })).toHaveAttribute(
        'aria-label',
        'Close modal'
      );
    });
  });

  describe('Animation and Styling', () => {
    it('applies backdrop blur effect', () => {
      render(<Modal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('backdrop-blur-sm');
    });

    it('applies overlay background', () => {
      render(<Modal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('bg-black', 'bg-opacity-50');
    });

    it('applies transition classes', () => {
      render(<Modal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('transition-opacity');
    });
  });

  describe('Header and Footer', () => {
    it('renders header with title and close button', () => {
      render(<Modal {...defaultProps} title="Header Title" />);
      const header = screen.getByText('Header Title').closest('div');
      expect(header).toHaveClass('border-b');
    });

    it('renders footer with border', () => {
      render(
        <Modal
          {...defaultProps}
          footer={<div data-testid="footer-content">Footer</div>}
        />
      );
      const footer = screen.getByTestId('footer-content').closest('div');
      expect(footer).toHaveClass('border-t');
    });

    it('renders header when showCloseButton is true even without title', () => {
      render(<Modal {...defaultProps} showCloseButton />);
      expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument();
    });

    it('does not render header section when no title and showCloseButton is false', () => {
      render(<Modal {...defaultProps} showCloseButton={false} />);
      const dialog = screen.getByRole('dialog');
      // The modal should not have a header section with border-b
      const headerSection = dialog.querySelector('.border-b');
      expect(headerSection).not.toBeInTheDocument();
    });
  });

  describe('Complex Content', () => {
    it('renders form content correctly', () => {
      render(
        <Modal {...defaultProps}>
          <form data-testid="modal-form">
            <input type="text" placeholder="Name" />
            <button type="submit">Submit</button>
          </form>
        </Modal>
      );

      expect(screen.getByTestId('modal-form')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    });

    it('allows interaction with form elements', async () => {
      render(
        <Modal {...defaultProps}>
          <input type="text" placeholder="Type here" />
        </Modal>
      );

      const input = screen.getByPlaceholderText('Type here');
      await userEvent.type(input, 'Hello');
      expect(input).toHaveValue('Hello');
    });
  });

  describe('Multiple Modals', () => {
    it('only renders one modal when multiple are mounted with different isOpen states', () => {
      render(
        <>
          <Modal isOpen={true} onClose={() => {}}>Modal 1</Modal>
          <Modal isOpen={false} onClose={() => {}}>Modal 2</Modal>
        </>
      );

      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs).toHaveLength(1);
      expect(screen.getByText('Modal 1')).toBeInTheDocument();
      expect(screen.queryByText('Modal 2')).not.toBeInTheDocument();
    });
  });
});
