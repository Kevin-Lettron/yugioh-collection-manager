import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Collection from '../../pages/Collection';
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

jest.mock('../../hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: () => ({ current: null }),
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedToast = toast as jest.Mocked<typeof toast>;

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('Collection Page', () => {
  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockCards = [
    {
      id: 1,
      user_id: 1,
      card_id: 1,
      set_code: 'LOB-001',
      rarity: 'Ultra Rare',
      quantity: 2,
      created_at: new Date(),
      updated_at: new Date(),
      card: {
        id: 1,
        card_id: '46986414',
        name: 'Dark Magician',
        type: 'Effect Monster',
        frame_type: 'effect',
        description: 'The ultimate wizard',
        atk: 2500,
        def: 2100,
        level: 7,
        race: 'Spellcaster',
        attribute: 'DARK',
        created_at: new Date(),
        updated_at: new Date(),
        card_images: [{ id: 1, image_url: 'url', image_url_small: 'url_small' }],
      },
    },
    {
      id: 2,
      user_id: 1,
      card_id: 2,
      set_code: 'LOB-002',
      rarity: 'Rare',
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
        atk: 3000,
        def: 2500,
        level: 8,
        race: 'Dragon',
        attribute: 'LIGHT',
        created_at: new Date(),
        updated_at: new Date(),
        card_images: [{ id: 2, image_url: 'url', image_url_small: 'url_small' }],
      },
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
    mockedApi.get.mockResolvedValue({
      data: {
        data: mockCards,
        total: 2,
        page: 1,
        limit: 20,
        total_pages: 1,
      },
    });
  });

  describe('Rendering', () => {
    it('renders the collection page', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByText('My Collection')).toBeInTheDocument();
      });
    });

    it('renders navigation links', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByText('Collection')).toBeInTheDocument();
        expect(screen.getByText('Decks')).toBeInTheDocument();
        expect(screen.getByText('Social')).toBeInTheDocument();
      });
    });

    it('displays the username', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });
    });

    it('renders Add Card button', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add card/i })).toBeInTheDocument();
      });
    });
  });

  describe('Cards Display', () => {
    it('displays card names', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician')).toBeInTheDocument();
        expect(screen.getByText('Blue-Eyes White Dragon')).toBeInTheDocument();
      });
    });

    it('displays card rarities', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByText('Ultra Rare')).toBeInTheDocument();
        expect(screen.getByText('Rare')).toBeInTheDocument();
      });
    });

    it('displays card quantities', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('displays total cards count', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByText(/total: 2 cards/i)).toBeInTheDocument();
      });
    });

    it('displays empty state when no cards', async () => {
      mockedApi.get.mockResolvedValue({
        data: {
          data: [],
          total: 0,
          page: 1,
          limit: 20,
          total_pages: 0,
        },
      });

      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByText(/no cards in your collection yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('renders search input', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/card name/i)).toBeInTheDocument();
      });
    });

    it('renders type filter', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
      });
    });

    it('renders attribute filter', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByLabelText(/attribute/i)).toBeInTheDocument();
      });
    });

    it('renders rarity filter', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByLabelText(/rarity/i)).toBeInTheDocument();
      });
    });

    it('filters cards by search', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/card name/i)).toBeInTheDocument();
      });

      await userEvent.type(screen.getByPlaceholderText(/card name/i), 'Dark');

      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledWith('/collection/cards', {
          params: expect.objectContaining({ search: 'Dark' }),
        });
      });
    });

    it('filters cards by type', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByLabelText(/type/i), 'Effect Monster');

      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledWith('/collection/cards', {
          params: expect.objectContaining({ type: 'Effect Monster' }),
        });
      });
    });

    it('filters cards by attribute', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByLabelText(/attribute/i)).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByLabelText(/attribute/i), 'DARK');

      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledWith('/collection/cards', {
          params: expect.objectContaining({ attribute: 'DARK' }),
        });
      });
    });

    it('filters cards by rarity', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByLabelText(/rarity/i)).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByLabelText(/rarity/i), 'Ultra Rare');

      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledWith('/collection/cards', {
          params: expect.objectContaining({ rarity: 'Ultra Rare' }),
        });
      });
    });
  });

  describe('Card Quantity Management', () => {
    it('increments card quantity', async () => {
      mockedApi.put.mockResolvedValue({ data: {} });
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician')).toBeInTheDocument();
      });

      const cardContainers = screen.getAllByText('+');
      await userEvent.click(cardContainers[0]);

      await waitFor(() => {
        expect(mockedApi.put).toHaveBeenCalledWith('/collection/cards/1/quantity', {
          quantity: 3,
        });
      });
    });

    it('decrements card quantity', async () => {
      mockedApi.put.mockResolvedValue({ data: {} });
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician')).toBeInTheDocument();
      });

      const cardContainers = screen.getAllByText('-');
      await userEvent.click(cardContainers[0]);

      await waitFor(() => {
        expect(mockedApi.put).toHaveBeenCalledWith('/collection/cards/1/quantity', {
          quantity: 1,
        });
      });
    });
  });

  describe('Remove Card', () => {
    it('shows confirmation when removing card', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician')).toBeInTheDocument();
      });

      const removeButtons = screen.getAllByText('Remove');
      await userEvent.click(removeButtons[0]);

      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to remove this card from your collection?'
      );
      confirmSpy.mockRestore();
    });

    it('removes card when confirmed', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      mockedApi.delete.mockResolvedValue({ data: {} });
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician')).toBeInTheDocument();
      });

      const removeButtons = screen.getAllByText('Remove');
      await userEvent.click(removeButtons[0]);

      await waitFor(() => {
        expect(mockedApi.delete).toHaveBeenCalledWith('/collection/cards/1');
        expect(mockedToast.success).toHaveBeenCalledWith('Card removed from collection');
      });

      confirmSpy.mockRestore();
    });

    it('does not remove card when cancelled', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByText('Dark Magician')).toBeInTheDocument();
      });

      const removeButtons = screen.getAllByText('Remove');
      await userEvent.click(removeButtons[0]);

      expect(mockedApi.delete).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });

  describe('Add Card Modal', () => {
    it('opens add card modal when button clicked', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add card/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add card/i }));

      expect(screen.getByText('Add Card')).toBeInTheDocument();
    });

    it('renders add card form fields', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add card/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add card/i }));

      expect(screen.getByPlaceholderText(/e\.g\., 46986414/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\., LOB-001/i)).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /rarity/i })).toBeInTheDocument();
    });

    it('closes modal when close button clicked', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add card/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add card/i }));
      expect(screen.getByText('Add Card')).toBeInTheDocument();

      // Click the close button (x)
      const closeButton = screen.getByText('\u00D7');
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Add Card')).not.toBeInTheDocument();
      });
    });

    it('validates required fields before adding card', async () => {
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add card/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add card/i }));

      // Find the Add Card submit button in the modal
      const buttons = screen.getAllByRole('button', { name: /add card/i });
      const submitButton = buttons[buttons.length - 1]; // The one in the form
      await userEvent.click(submitButton);

      expect(mockedToast.error).toHaveBeenCalledWith('Please fill in all fields');
    });

    it('adds card when form is valid', async () => {
      mockedApi.post.mockResolvedValue({ data: {} });
      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add card/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add card/i }));

      await userEvent.type(
        screen.getByPlaceholderText(/e\.g\., 46986414/i),
        '46986414'
      );
      await userEvent.type(screen.getByPlaceholderText(/e\.g\., LOB-001/i), 'LOB-001');
      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: /rarity/i }),
        'Ultra Rare'
      );

      const buttons = screen.getAllByRole('button', { name: /add card/i });
      const submitButton = buttons[buttons.length - 1];
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalledWith('/collection/cards/add', {
          card_code: '46986414',
          set_code: 'LOB-001',
          rarity: 'Ultra Rare',
          quantity: 1,
        });
        expect(mockedToast.success).toHaveBeenCalledWith('Card added to collection!');
      });
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

      renderWithRouter(<Collection />);

      // Loading indicator should be visible
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
      });

      // Resolve the promise
      resolvePromise!({
        data: { data: [], total: 0, page: 1, limit: 20, total_pages: 0 },
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

      renderWithRouter(<Collection />);

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

      renderWithRouter(<Collection />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
