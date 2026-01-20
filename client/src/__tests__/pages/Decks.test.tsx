import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Decks from '../../pages/Decks';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

// Mock modules
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

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

const mockedApi = api as jest.Mocked<typeof api>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedToast = toast as jest.Mocked<typeof toast>;

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('Decks Page', () => {
  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockDecks = [
    {
      id: 1,
      user_id: 1,
      name: 'Dark Magician Deck',
      is_public: true,
      respect_banlist: true,
      created_at: new Date(),
      updated_at: new Date(),
      main_deck: [
        { id: 1, deck_id: 1, card_id: 1, quantity: 3, is_extra_deck: false, created_at: new Date() },
        { id: 2, deck_id: 1, card_id: 2, quantity: 37, is_extra_deck: false, created_at: new Date() },
      ],
      extra_deck: [
        { id: 3, deck_id: 1, card_id: 3, quantity: 5, is_extra_deck: true, created_at: new Date() },
      ],
      likes_count: 10,
      comments_count: 5,
    },
    {
      id: 2,
      user_id: 1,
      name: 'Blue-Eyes Deck',
      is_public: false,
      respect_banlist: false,
      created_at: new Date(),
      updated_at: new Date(),
      main_deck: [
        { id: 4, deck_id: 2, card_id: 4, quantity: 20, is_extra_deck: false, created_at: new Date() },
      ],
      extra_deck: [],
      likes_count: 0,
      comments_count: 0,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      updateUser: jest.fn(),
    });
    mockedApi.get.mockResolvedValue({ data: mockDecks });
  });

  describe('Rendering', () => {
    it('renders the decks page', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('My Decks')).toBeInTheDocument();
      });
    });

    it('renders navigation links', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('Collection')).toBeInTheDocument();
        expect(screen.getByText('Decks')).toBeInTheDocument();
        expect(screen.getByText('Social')).toBeInTheDocument();
      });
    });

    it('displays the username', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });
    });

    it('renders Create Deck button', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /create deck/i })).toBeInTheDocument();
      });
    });

    it('displays deck count', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('2 deck(s)')).toBeInTheDocument();
      });
    });
  });

  describe('Deck List', () => {
    it('displays deck names', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician Deck')).toBeInTheDocument();
        expect(screen.getByText('Blue-Eyes Deck')).toBeInTheDocument();
      });
    });

    it('displays main deck card count', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('40 cards')).toBeInTheDocument(); // 3 + 37
        expect(screen.getByText('20 cards')).toBeInTheDocument();
      });
    });

    it('displays extra deck card count', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('5 cards')).toBeInTheDocument();
        expect(screen.getByText('0 cards')).toBeInTheDocument();
      });
    });

    it('displays public badge for public decks', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        const publicBadges = screen.getAllByText('Public');
        expect(publicBadges.length).toBeGreaterThan(0);
      });
    });

    it('shows banlist compliance status', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('Compliant')).toBeInTheDocument();
        expect(screen.getByText('Ignored')).toBeInTheDocument();
      });
    });

    it('displays likes count', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument();
      });
    });

    it('displays comments count', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('displays empty state when no decks', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText(/you don't have any decks yet/i)).toBeInTheDocument();
        expect(
          screen.getByRole('link', { name: /create your first deck/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('renders banlist compliance filter', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByLabelText(/banlist compliance/i)).toBeInTheDocument();
      });
    });

    it('renders visibility filter', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByLabelText(/visibility/i)).toBeInTheDocument();
      });
    });

    it('filters by banlist compliance', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByLabelText(/banlist compliance/i)).toBeInTheDocument();
      });

      await userEvent.selectOptions(
        screen.getByLabelText(/banlist compliance/i),
        'true'
      );

      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledWith('/decks', {
          params: expect.objectContaining({ respect_banlist: true }),
        });
      });
    });

    it('filters by visibility', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByLabelText(/visibility/i)).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByLabelText(/visibility/i), 'true');

      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledWith('/decks', {
          params: expect.objectContaining({ is_public: true }),
        });
      });
    });

    it('clears filter when selecting "All Decks"', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByLabelText(/banlist compliance/i)).toBeInTheDocument();
      });

      // First select a filter
      await userEvent.selectOptions(
        screen.getByLabelText(/banlist compliance/i),
        'true'
      );

      // Then clear it
      await userEvent.selectOptions(screen.getByLabelText(/banlist compliance/i), '');

      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledWith('/decks', {
          params: expect.objectContaining({ respect_banlist: undefined }),
        });
      });
    });
  });

  describe('Deck Actions', () => {
    it('navigates to deck view when View button is clicked', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician Deck')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await userEvent.click(viewButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/decks/1');
    });

    it('navigates to deck edit when Edit button is clicked', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician Deck')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await userEvent.click(editButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/decks/1/edit');
    });
  });

  describe('Delete Deck', () => {
    it('shows confirmation when deleting deck', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician Deck')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await userEvent.click(deleteButtons[0]);

      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to delete this deck?'
      );
      confirmSpy.mockRestore();
    });

    it('deletes deck when confirmed', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      mockedApi.delete.mockResolvedValue({ data: {} });
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician Deck')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockedApi.delete).toHaveBeenCalledWith('/decks/1');
        expect(mockedToast.success).toHaveBeenCalledWith('Deck deleted successfully');
      });

      confirmSpy.mockRestore();
    });

    it('removes deck from list after deletion', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      mockedApi.delete.mockResolvedValue({ data: {} });
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician Deck')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('Dark Magician Deck')).not.toBeInTheDocument();
      });

      confirmSpy.mockRestore();
    });

    it('does not delete deck when cancelled', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician Deck')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await userEvent.click(deleteButtons[0]);

      expect(mockedApi.delete).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('handles delete error gracefully', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedApi.delete.mockRejectedValue(new Error('Delete failed'));

      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician Deck')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      // Deck should still be in the list
      expect(screen.getByText('Dark Magician Deck')).toBeInTheDocument();

      confirmSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator while fetching', async () => {
      let resolvePromise: (value: unknown) => void;
      mockedApi.get.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }) as any
      );

      renderWithRouter(<Decks />);

      // Loading indicator should be visible
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();

      // Resolve the promise
      resolvePromise!({ data: [] });
    });

    it('hides loading indicator after fetch', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
      });
    });
  });

  describe('Deck Card Validation', () => {
    it('shows green color for valid main deck count', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician Deck')).toBeInTheDocument();
      });

      // 40 cards (3 + 37) should be green
      const mainDeckCount = screen.getByText('40 cards');
      expect(mainDeckCount).toHaveClass('text-green-600');
    });

    it('shows red color for invalid main deck count', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('Blue-Eyes Deck')).toBeInTheDocument();
      });

      // 20 cards should be red (under 40)
      const mainDeckCount = screen.getByText('20 cards');
      expect(mainDeckCount).toHaveClass('text-red-600');
    });

    it('shows green color for valid extra deck count', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician Deck')).toBeInTheDocument();
      });

      // 5 cards should be green (under 15)
      const extraDeckCount = screen.getByText('5 cards');
      expect(extraDeckCount).toHaveClass('text-green-600');
    });
  });

  describe('Create Deck Link', () => {
    it('links to new deck page', async () => {
      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /create deck/i })).toHaveAttribute(
          'href',
          '/decks/new'
        );
      });
    });
  });

  describe('Logout', () => {
    it('calls logout when logout button is clicked', async () => {
      const mockLogout = jest.fn();
      mockedUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: mockLogout,
        updateUser: jest.fn(),
      });

      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /logout/i }));

      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles API error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedApi.get.mockRejectedValue(new Error('API Error'));

      renderWithRouter(<Decks />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
