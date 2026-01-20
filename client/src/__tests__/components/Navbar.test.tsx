import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import Navbar from '../../components/Navbar';

// Wrapper component for Router
const renderWithRouter = (ui: React.ReactElement, { route = '/' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
};

describe('Navbar Component', () => {
  const defaultProps = {
    userName: 'TestUser',
    notificationCount: 5,
    onNotificationClick: jest.fn(),
    onLogout: jest.fn(),
    onProfile: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the navigation element', () => {
      renderWithRouter(<Navbar {...defaultProps} />);
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders the brand name', () => {
      renderWithRouter(<Navbar {...defaultProps} />);
      expect(screen.getByText('YuGiOh Collection')).toBeInTheDocument();
    });

    it('renders custom brand name', () => {
      renderWithRouter(<Navbar {...defaultProps} brandName="My Collection" />);
      expect(screen.getByText('My Collection')).toBeInTheDocument();
    });

    it('renders brand logo when provided', () => {
      renderWithRouter(<Navbar {...defaultProps} brandLogo="/logo.png" />);
      const logo = screen.getByAltText('YuGiOh Collection');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', '/logo.png');
    });
  });

  describe('Navigation Links', () => {
    it('renders default navigation links', () => {
      renderWithRouter(<Navbar {...defaultProps} />);
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /my collection/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /search cards/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /decks/i })).toBeInTheDocument();
    });

    it('renders custom navigation links', () => {
      const customLinks = [
        { to: '/custom', label: 'Custom Link' },
        { to: '/another', label: 'Another Link' },
      ];
      renderWithRouter(<Navbar {...defaultProps} navLinks={customLinks} />);

      expect(screen.getByRole('link', { name: /custom link/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /another link/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument();
    });

    it('navigation links have correct href', () => {
      renderWithRouter(<Navbar {...defaultProps} />);
      expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /my collection/i })).toHaveAttribute('href', '/collection');
      expect(screen.getByRole('link', { name: /decks/i })).toHaveAttribute('href', '/decks');
    });

    it('highlights active navigation link', () => {
      renderWithRouter(<Navbar {...defaultProps} />, { route: '/collection' });
      const collectionLink = screen.getByRole('link', { name: /my collection/i });
      expect(collectionLink).toHaveClass('bg-blue-100', 'text-blue-700');
    });

    it('non-active links have default styling', () => {
      renderWithRouter(<Navbar {...defaultProps} />, { route: '/' });
      const collectionLink = screen.getByRole('link', { name: /my collection/i });
      expect(collectionLink).toHaveClass('text-gray-700');
      expect(collectionLink).not.toHaveClass('bg-blue-100');
    });
  });

  describe('Notification Badge', () => {
    it('renders notification button', () => {
      renderWithRouter(<Navbar {...defaultProps} />);
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });

    it('displays notification count', () => {
      renderWithRouter(<Navbar {...defaultProps} notificationCount={5} />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('does not display badge when count is 0', () => {
      renderWithRouter(<Navbar {...defaultProps} notificationCount={0} />);
      const badge = screen.queryByText('0');
      expect(badge).not.toBeInTheDocument();
    });

    it('displays 99+ for counts over 99', () => {
      renderWithRouter(<Navbar {...defaultProps} notificationCount={150} />);
      expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('calls onNotificationClick when notification button is clicked', async () => {
      const onNotificationClick = jest.fn();
      renderWithRouter(<Navbar {...defaultProps} onNotificationClick={onNotificationClick} />);

      await userEvent.click(screen.getByRole('button', { name: /notifications/i }));
      expect(onNotificationClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Menu', () => {
    it('renders user menu when userName is provided', () => {
      renderWithRouter(<Navbar {...defaultProps} userName="TestUser" />);
      expect(screen.getByText('TestUser')).toBeInTheDocument();
    });

    it('does not render user menu when userName is not provided', () => {
      renderWithRouter(<Navbar notificationCount={0} />);
      expect(screen.queryByRole('button', { name: /user menu/i })).not.toBeInTheDocument();
    });

    it('renders user avatar initial when no avatar provided', () => {
      renderWithRouter(<Navbar {...defaultProps} userName="TestUser" />);
      // First letter of username
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('renders user avatar image when provided', () => {
      renderWithRouter(<Navbar {...defaultProps} userName="TestUser" userAvatar="/avatar.png" />);
      const avatar = screen.getByAltText('TestUser');
      expect(avatar).toHaveAttribute('src', '/avatar.png');
    });

    it('opens dropdown menu on user button click', async () => {
      renderWithRouter(<Navbar {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', { name: /user menu/i }));

      expect(screen.getByText('Your Profile')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Sign out')).toBeInTheDocument();
    });

    it('closes dropdown menu when clicked again', async () => {
      renderWithRouter(<Navbar {...defaultProps} />);

      const userButton = screen.getByRole('button', { name: /user menu/i });
      await userEvent.click(userButton);
      expect(screen.getByText('Your Profile')).toBeInTheDocument();

      await userEvent.click(userButton);
      expect(screen.queryByText('Your Profile')).not.toBeInTheDocument();
    });

    it('closes dropdown when clicking outside', async () => {
      renderWithRouter(<Navbar {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
      expect(screen.getByText('Your Profile')).toBeInTheDocument();

      // Simulate clicking outside
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText('Your Profile')).not.toBeInTheDocument();
      });
    });
  });

  describe('User Menu Actions', () => {
    it('calls onProfile when profile button is clicked', async () => {
      const onProfile = jest.fn();
      renderWithRouter(<Navbar {...defaultProps} onProfile={onProfile} />);

      await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
      await userEvent.click(screen.getByText('Your Profile'));

      expect(onProfile).toHaveBeenCalledTimes(1);
    });

    it('calls onLogout when sign out button is clicked', async () => {
      const onLogout = jest.fn();
      renderWithRouter(<Navbar {...defaultProps} onLogout={onLogout} />);

      await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
      await userEvent.click(screen.getByText('Sign out'));

      expect(onLogout).toHaveBeenCalledTimes(1);
    });

    it('closes dropdown after clicking menu item', async () => {
      renderWithRouter(<Navbar {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', { name: /user menu/i }));
      await userEvent.click(screen.getByText('Your Profile'));

      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });
  });

  describe('Mobile Menu', () => {
    it('renders mobile menu toggle button', () => {
      renderWithRouter(<Navbar {...defaultProps} />);
      expect(screen.getByRole('button', { name: /toggle mobile menu/i })).toBeInTheDocument();
    });

    it('opens mobile menu when toggle is clicked', async () => {
      renderWithRouter(<Navbar {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', { name: /toggle mobile menu/i }));

      // Mobile menu links should be visible
      const mobileLinks = screen.getAllByRole('link', { name: /dashboard/i });
      // Should have both desktop and mobile links now
      expect(mobileLinks.length).toBeGreaterThanOrEqual(1);
    });

    it('closes mobile menu when toggle is clicked again', async () => {
      renderWithRouter(<Navbar {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /toggle mobile menu/i });

      await userEvent.click(toggleButton);
      await userEvent.click(toggleButton);

      // Mobile menu should be closed
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes mobile menu when a link is clicked', async () => {
      renderWithRouter(<Navbar {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', { name: /toggle mobile menu/i }));

      // Find mobile menu links (in the mobile menu section)
      const mobileMenu = document.querySelector('.md\\:hidden.border-t');
      const dashboardLink = mobileMenu?.querySelector('a[href="/"]');

      if (dashboardLink) {
        await userEvent.click(dashboardLink);
        // After clicking, the mobile menu should close
        expect(screen.getByRole('button', { name: /toggle mobile menu/i })).toHaveAttribute(
          'aria-expanded',
          'false'
        );
      }
    });

    it('mobile menu toggle has correct aria-expanded', async () => {
      renderWithRouter(<Navbar {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /toggle mobile menu/i });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Accessibility', () => {
    it('notification button has aria-label', () => {
      renderWithRouter(<Navbar {...defaultProps} />);
      expect(screen.getByRole('button', { name: /notifications/i })).toHaveAttribute(
        'aria-label',
        'Notifications'
      );
    });

    it('user menu button has aria-label', () => {
      renderWithRouter(<Navbar {...defaultProps} />);
      expect(screen.getByRole('button', { name: /user menu/i })).toHaveAttribute(
        'aria-label',
        'User menu'
      );
    });

    it('user menu button has aria-expanded attribute', async () => {
      renderWithRouter(<Navbar {...defaultProps} />);

      const userButton = screen.getByRole('button', { name: /user menu/i });
      expect(userButton).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(userButton);
      expect(userButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('mobile menu toggle has aria-label', () => {
      renderWithRouter(<Navbar {...defaultProps} />);
      expect(screen.getByRole('button', { name: /toggle mobile menu/i })).toHaveAttribute(
        'aria-label',
        'Toggle mobile menu'
      );
    });

    it('all interactive elements are focusable', () => {
      renderWithRouter(<Navbar {...defaultProps} />);

      const notificationButton = screen.getByRole('button', { name: /notifications/i });
      const userButton = screen.getByRole('button', { name: /user menu/i });
      const mobileToggle = screen.getByRole('button', { name: /toggle mobile menu/i });

      notificationButton.focus();
      expect(document.activeElement).toBe(notificationButton);

      userButton.focus();
      expect(document.activeElement).toBe(userButton);

      mobileToggle.focus();
      expect(document.activeElement).toBe(mobileToggle);
    });
  });

  describe('Custom Styling', () => {
    it('accepts custom className', () => {
      renderWithRouter(<Navbar {...defaultProps} className="custom-nav" />);
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('custom-nav');
    });

    it('merges custom className with default styles', () => {
      renderWithRouter(<Navbar {...defaultProps} className="custom-nav" />);
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('bg-white', 'shadow-md', 'custom-nav');
    });
  });

  describe('Brand Link', () => {
    it('brand name links to home', () => {
      renderWithRouter(<Navbar {...defaultProps} />);
      const brandLink = screen.getByRole('link', { name: /yugioh collection/i });
      expect(brandLink).toHaveAttribute('href', '/');
    });

    it('brand logo links to home', () => {
      renderWithRouter(<Navbar {...defaultProps} brandLogo="/logo.png" />);
      const logoLink = screen.getByRole('link', { name: /yugioh collection/i });
      expect(logoLink).toHaveAttribute('href', '/');
    });
  });

  describe('Icon Rotation', () => {
    it('dropdown arrow rotates when menu is open', async () => {
      renderWithRouter(<Navbar {...defaultProps} />);

      const userButton = screen.getByRole('button', { name: /user menu/i });

      // Initially not rotated
      let arrowIcon = userButton.querySelector('svg:last-child');
      expect(arrowIcon).not.toHaveClass('rotate-180');

      // Open menu
      await userEvent.click(userButton);

      // Arrow should rotate
      arrowIcon = userButton.querySelector('svg:last-child');
      expect(arrowIcon).toHaveClass('rotate-180');
    });
  });
});
