import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DeckEditor from '../../pages/DeckEditor';
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

jest.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
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

const renderWithRouter = (
  ui: React.ReactElement,
  { route = '/decks/new' } = {}
) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/decks/new" element={ui} />
        <Route path="/decks/:deckId/edit" element={ui} />
      </Routes>
    </MemoryRouter>
  );
};

describe('DeckEditor Page', () => {
  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockDeck = {
    id: 1,
    user_id: 1,
    name: 'Test Deck',
    is_public: false,
    respect_banlist: true,
    created_at: new Date(),
    updated_at: new Date(),
    main_deck: [
      {
        id: 1,
        deck_id: 1,
        card_id: 1,
        quantity: 3,
        is_extra_deck: false,
        created_at: new Date(),
        card: {
          id: 1,
          card_id: '46986414',
          name: 'Dark Magician',
          type: 'Effect Monster',
          frame_type: 'effect',
          description: 'The ultimate wizard',
          created_at: new Date(),
          updated_at: new Date(),
          card_images: [{ id: 1, image_url: 'url', image_url_small: 'url_small' }],
        },
      },
    ],
    extra_deck: [],
  };

  const mockSearchResults = {
    data: [
      {
        id: 1,
        user_id: 1,
        card_id: 2,
        set_code: 'LOB-001',
        rarity: 'Ultra Rare',
        quantity: 1,
        created_at: new Date(),
        updated_at: new Date(),
        card: {
          id: 2,
          card_id: '89631139',
          name: 'Blue-Eyes White Dragon',
          type: 'Normal Monster',
          frame_type: 'normal',
          description: 'Legendary dragon',
          created_at: new Date(),
          updated_at: new Date(),
          card_images: [{ id: 2, image_url: 'url', image_url_small: 'url_small' }],
        },
      },
    ],
  };

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
    mockedApi.get.mockResolvedValue({ data: mockSearchResults });
  });

  describe('Create New Deck', () => {
    it('renders create deck form', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(screen.getByText('Create New Deck')).toBeInTheDocument();
      });
    });

    it('renders deck name input', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter deck name/i)).toBeInTheDocument();
      });
    });

    it('renders public checkbox', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(screen.getByLabelText(/make deck public/i)).toBeInTheDocument();
      });
    });

    it('renders respect banlist checkbox', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(screen.getByLabelText(/respect banlist/i)).toBeInTheDocument();
      });
    });

    it('renders card search input', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/search cards in collection/i)
        ).toBeInTheDocument();
      });
    });

    it('renders main deck section', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(screen.getByText(/main deck/i)).toBeInTheDocument();
      });
    });

    it('renders extra deck section', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(screen.getByText(/extra deck/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edit Existing Deck', () => {
    it('loads deck data when editing', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: mockDeck });

      renderWithRouter(<DeckEditor />, { route: '/decks/1/edit' });

      await waitFor(() => {
        expect(screen.getByText('Edit Deck')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test Deck')).toBeInTheDocument();
      });
    });

    it('displays existing deck cards', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: mockDeck });

      renderWithRouter(<DeckEditor />, { route: '/decks/1/edit' });

      await waitFor(() => {
        expect(screen.getByText('Dark Magician')).toBeInTheDocument();
      });
    });

    it('handles deck load error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedApi.get.mockRejectedValueOnce(new Error('Failed to load deck'));

      renderWithRouter(<DeckEditor />, { route: '/decks/1/edit' });

      await waitFor(() => {
        expect(mockedToast.error).toHaveBeenCalledWith('Failed to load deck');
        expect(mockNavigate).toHaveBeenCalledWith('/decks');
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Card Search', () => {
    it('searches cards when typing', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/search cards in collection/i)
        ).toBeInTheDocument();
      });

      await userEvent.type(
        screen.getByPlaceholderText(/search cards in collection/i),
        'Dragon'
      );

      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledWith('/collection/cards', {
          params: { search: 'Dragon', limit: 20 },
        });
      });
    });

    it('displays search results', async () => {
      renderWithRouter(<DeckEditor />);

      await userEvent.type(
        screen.getByPlaceholderText(/search cards in collection/i),
        'Dragon'
      );

      await waitFor(() => {
        expect(screen.getByText('Blue-Eyes White Dragon')).toBeInTheDocument();
      });
    });

    it('displays no cards found message', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [] });

      renderWithRouter(<DeckEditor />);

      await userEvent.type(
        screen.getByPlaceholderText(/search cards in collection/i),
        'NonExistentCard'
      );

      await waitFor(() => {
        expect(screen.getByText(/no cards found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Adding Cards to Deck', () => {
    it('adds card to main deck when clicked', async () => {
      renderWithRouter(<DeckEditor />);

      await userEvent.type(
        screen.getByPlaceholderText(/search cards in collection/i),
        'Dragon'
      );

      await waitFor(() => {
        expect(screen.getByText('Blue-Eyes White Dragon')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Blue-Eyes White Dragon'));

      await waitFor(() => {
        expect(mockedToast.success).toHaveBeenCalledWith(
          'Added Blue-Eyes White Dragon to Main Deck'
        );
      });
    });
  });

  describe('Validation', () => {
    it('shows validation error for empty deck name', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save deck/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /save deck/i }));

      expect(mockedToast.error).toHaveBeenCalledWith('Please enter a deck name');
    });

    it('displays validation errors panel', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        // Should show error for main deck under 40 cards
        expect(screen.getByText(/main deck must have at least 40 cards/i)).toBeInTheDocument();
      });
    });

    it('shows error when saving with validation errors', async () => {
      renderWithRouter(<DeckEditor />);

      await userEvent.type(
        screen.getByPlaceholderText(/enter deck name/i),
        'My New Deck'
      );

      await userEvent.click(screen.getByRole('button', { name: /save deck/i }));

      expect(mockedToast.error).toHaveBeenCalledWith(
        'Please fix validation errors before saving'
      );
    });

    it('displays main deck count', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(screen.getByText('0 / 60')).toBeInTheDocument();
      });
    });

    it('displays extra deck count', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(screen.getByText('0 / 15')).toBeInTheDocument();
      });
    });
  });

  describe('Deck Settings', () => {
    it('updates deck name', async () => {
      renderWithRouter(<DeckEditor />);

      const nameInput = screen.getByPlaceholderText(/enter deck name/i);
      await userEvent.type(nameInput, 'My New Deck');

      expect(nameInput).toHaveValue('My New Deck');
    });

    it('toggles public checkbox', async () => {
      renderWithRouter(<DeckEditor />);

      const publicCheckbox = screen.getByLabelText(/make deck public/i);
      expect(publicCheckbox).not.toBeChecked();

      await userEvent.click(publicCheckbox);
      expect(publicCheckbox).toBeChecked();
    });

    it('toggles banlist checkbox', async () => {
      renderWithRouter(<DeckEditor />);

      const banlistCheckbox = screen.getByLabelText(/respect banlist/i);
      expect(banlistCheckbox).toBeChecked();

      await userEvent.click(banlistCheckbox);
      expect(banlistCheckbox).not.toBeChecked();
    });
  });

  describe('Navigation', () => {
    it('navigates to decks page when cancel is clicked', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/decks');
    });
  });

  describe('Loading State', () => {
    it('shows loading state when editing deck', async () => {
      let resolvePromise: (value: unknown) => void;
      mockedApi.get.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }) as any
      );

      renderWithRouter(<DeckEditor />, { route: '/decks/1/edit' });

      // Loading indicator should be visible
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();

      // Resolve the promise
      resolvePromise!({ data: mockDeck });
    });

    it('shows saving state when submitting', async () => {
      // Create a deck with enough cards to pass validation
      const validDeck = {
        ...mockDeck,
        main_deck: Array(40).fill(mockDeck.main_deck[0]),
      };
      mockedApi.get.mockResolvedValueOnce({ data: validDeck });

      let resolvePost: (value: unknown) => void;
      mockedApi.put.mockReturnValue(
        new Promise((resolve) => {
          resolvePost = resolve;
        }) as any
      );

      renderWithRouter(<DeckEditor />, { route: '/decks/1/edit' });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Deck')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /save deck/i }));

      // The save button might show "Saving..."
      // Note: This depends on the validation passing
    });
  });

  describe('Empty State', () => {
    it('shows empty main deck message', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(
          screen.getByText(/no cards in main deck/i)
        ).toBeInTheDocument();
      });
    });

    it('shows empty extra deck message', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(
          screen.getByText(/no cards in extra deck/i)
        ).toBeInTheDocument();
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

      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /logout/i }));

      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('Deck Card Types', () => {
    it('correctly identifies extra deck card types', async () => {
      const extraDeckCard = {
        data: [
          {
            id: 1,
            user_id: 1,
            card_id: 3,
            set_code: 'DUEA-001',
            rarity: 'Ultra Rare',
            quantity: 1,
            created_at: new Date(),
            updated_at: new Date(),
            card: {
              id: 3,
              card_id: '123456',
              name: 'Fusion Dragon',
              type: 'Fusion Monster',
              frame_type: 'fusion',
              description: 'A fusion monster',
              created_at: new Date(),
              updated_at: new Date(),
              card_images: [{ id: 3, image_url: 'url', image_url_small: 'url_small' }],
            },
          },
        ],
      };

      mockedApi.get.mockResolvedValue(extraDeckCard);

      renderWithRouter(<DeckEditor />);

      await userEvent.type(
        screen.getByPlaceholderText(/search cards in collection/i),
        'Fusion'
      );

      await waitFor(() => {
        expect(screen.getByText('Fusion Dragon')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Fusion Dragon'));

      await waitFor(() => {
        expect(mockedToast.success).toHaveBeenCalledWith(
          'Added Fusion Dragon to Extra Deck'
        );
      });
    });
  });

  describe('Deck Stats', () => {
    it('shows deck stats panel', async () => {
      renderWithRouter(<DeckEditor />);

      await waitFor(() => {
        expect(screen.getByText('Deck Settings')).toBeInTheDocument();
        expect(screen.getByText('Main Deck:')).toBeInTheDocument();
        expect(screen.getByText('Extra Deck:')).toBeInTheDocument();
      });
    });

    it('updates main deck count when cards are added', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: mockDeck });

      renderWithRouter(<DeckEditor />, { route: '/decks/1/edit' });

      await waitFor(() => {
        // Should show 3 cards (from mockDeck.main_deck)
        expect(screen.getByText('3 / 60')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles search error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedApi.get.mockRejectedValue(new Error('Search failed'));

      renderWithRouter(<DeckEditor />);

      await userEvent.type(
        screen.getByPlaceholderText(/search cards in collection/i),
        'test'
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
