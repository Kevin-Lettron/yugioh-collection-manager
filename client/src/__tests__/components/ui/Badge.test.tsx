import { render, screen } from '@testing-library/react';
import Badge from '../../../components/ui/Badge';

describe('Badge Component', () => {
  describe('Rendering', () => {
    it('renders children correctly', () => {
      render(<Badge>Test Badge</Badge>);
      expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });

    it('renders as a span element', () => {
      render(<Badge>Badge</Badge>);
      expect(screen.getByText('Badge').tagName).toBe('SPAN');
    });

    it('applies base styles', () => {
      render(<Badge>Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('inline-flex', 'items-center', 'font-semibold', 'rounded-full', 'border');
    });
  });

  describe('Banlist Status Variants', () => {
    it('renders Forbidden variant with correct colors', () => {
      render(<Badge variant="Forbidden">Forbidden</Badge>);
      const badge = screen.getByText('Forbidden');
      expect(badge).toHaveClass('bg-red-100', 'text-red-800', 'border-red-200');
    });

    it('renders Limited variant with correct colors', () => {
      render(<Badge variant="Limited">Limited</Badge>);
      const badge = screen.getByText('Limited');
      expect(badge).toHaveClass('bg-orange-100', 'text-orange-800', 'border-orange-200');
    });

    it('renders Semi-Limited variant with correct colors', () => {
      render(<Badge variant="Semi-Limited">Semi-Limited</Badge>);
      const badge = screen.getByText('Semi-Limited');
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800', 'border-yellow-200');
    });

    it('renders Unlimited variant with correct colors', () => {
      render(<Badge variant="Unlimited">Unlimited</Badge>);
      const badge = screen.getByText('Unlimited');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800', 'border-green-200');
    });
  });

  describe('Generic Variants', () => {
    it('renders default variant (default)', () => {
      render(<Badge>Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-200');
    });

    it('renders default variant explicitly', () => {
      render(<Badge variant="default">Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-200');
    });

    it('renders success variant with correct colors', () => {
      render(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText('Success');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800', 'border-green-200');
    });

    it('renders warning variant with correct colors', () => {
      render(<Badge variant="warning">Warning</Badge>);
      const badge = screen.getByText('Warning');
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800', 'border-yellow-200');
    });

    it('renders error variant with correct colors', () => {
      render(<Badge variant="error">Error</Badge>);
      const badge = screen.getByText('Error');
      expect(badge).toHaveClass('bg-red-100', 'text-red-800', 'border-red-200');
    });

    it('renders info variant with correct colors', () => {
      render(<Badge variant="info">Info</Badge>);
      const badge = screen.getByText('Info');
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-200');
    });
  });

  describe('Sizes', () => {
    it('renders small size correctly', () => {
      render(<Badge size="sm">Small</Badge>);
      const badge = screen.getByText('Small');
      expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');
    });

    it('renders medium size (default) correctly', () => {
      render(<Badge>Medium</Badge>);
      const badge = screen.getByText('Medium');
      expect(badge).toHaveClass('px-2.5', 'py-1', 'text-sm');
    });

    it('renders medium size explicitly', () => {
      render(<Badge size="md">Medium</Badge>);
      const badge = screen.getByText('Medium');
      expect(badge).toHaveClass('px-2.5', 'py-1', 'text-sm');
    });

    it('renders large size correctly', () => {
      render(<Badge size="lg">Large</Badge>);
      const badge = screen.getByText('Large');
      expect(badge).toHaveClass('px-3', 'py-1.5', 'text-base');
    });
  });

  describe('Combining Variants and Sizes', () => {
    it('combines Forbidden variant with small size', () => {
      render(<Badge variant="Forbidden" size="sm">Forbidden Small</Badge>);
      const badge = screen.getByText('Forbidden Small');
      expect(badge).toHaveClass('bg-red-100', 'text-red-800', 'px-2', 'py-0.5', 'text-xs');
    });

    it('combines Limited variant with large size', () => {
      render(<Badge variant="Limited" size="lg">Limited Large</Badge>);
      const badge = screen.getByText('Limited Large');
      expect(badge).toHaveClass('bg-orange-100', 'text-orange-800', 'px-3', 'py-1.5', 'text-base');
    });

    it('combines success variant with medium size', () => {
      render(<Badge variant="success" size="md">Success Medium</Badge>);
      const badge = screen.getByText('Success Medium');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800', 'px-2.5', 'py-1', 'text-sm');
    });
  });

  describe('Custom Props', () => {
    it('accepts custom className', () => {
      render(<Badge className="custom-class">Custom</Badge>);
      expect(screen.getByText('Custom')).toHaveClass('custom-class');
    });

    it('merges custom className with default classes', () => {
      render(<Badge className="my-custom" variant="info">Info</Badge>);
      const badge = screen.getByText('Info');
      expect(badge).toHaveClass('my-custom', 'bg-blue-100');
    });

    it('spreads additional HTML attributes', () => {
      render(
        <Badge
          data-testid="custom-badge"
          id="badge-1"
          title="Badge tooltip"
        >
          Badge
        </Badge>
      );
      const badge = screen.getByTestId('custom-badge');
      expect(badge).toHaveAttribute('id', 'badge-1');
      expect(badge).toHaveAttribute('title', 'Badge tooltip');
    });

    it('supports onClick handler', () => {
      const handleClick = jest.fn();
      render(<Badge onClick={handleClick}>Clickable</Badge>);
      screen.getByText('Clickable').click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('supports aria-label', () => {
      render(<Badge aria-label="Card status: banned">Forbidden</Badge>);
      expect(screen.getByText('Forbidden')).toHaveAttribute('aria-label', 'Card status: banned');
    });

    it('supports role attribute', () => {
      render(<Badge role="status">Status</Badge>);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('YuGiOh Banlist Use Cases', () => {
    it('displays forbidden card status', () => {
      render(<Badge variant="Forbidden">Pot of Greed</Badge>);
      const badge = screen.getByText('Pot of Greed');
      expect(badge).toHaveClass('bg-red-100', 'text-red-800');
    });

    it('displays limited card status', () => {
      render(<Badge variant="Limited">Monster Reborn</Badge>);
      const badge = screen.getByText('Monster Reborn');
      expect(badge).toHaveClass('bg-orange-100', 'text-orange-800');
    });

    it('displays semi-limited card status', () => {
      render(<Badge variant="Semi-Limited">Called by the Grave</Badge>);
      const badge = screen.getByText('Called by the Grave');
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });

    it('displays unlimited card status', () => {
      render(<Badge variant="Unlimited">Blue-Eyes White Dragon</Badge>);
      const badge = screen.getByText('Blue-Eyes White Dragon');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('renders multiple badges for different cards', () => {
      render(
        <div>
          <Badge variant="Forbidden">Card A</Badge>
          <Badge variant="Limited">Card B</Badge>
          <Badge variant="Semi-Limited">Card C</Badge>
        </div>
      );

      expect(screen.getByText('Card A')).toHaveClass('bg-red-100');
      expect(screen.getByText('Card B')).toHaveClass('bg-orange-100');
      expect(screen.getByText('Card C')).toHaveClass('bg-yellow-100');
    });
  });

  describe('Complex Content', () => {
    it('renders with icon content', () => {
      render(
        <Badge variant="error">
          <span data-testid="icon">!</span>
          Error
        </Badge>
      );
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('renders numeric content', () => {
      render(<Badge variant="info">42</Badge>);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders count badges', () => {
      render(<Badge variant="error" size="sm">99+</Badge>);
      const badge = screen.getByText('99+');
      expect(badge).toHaveClass('text-xs', 'bg-red-100');
    });
  });
});
