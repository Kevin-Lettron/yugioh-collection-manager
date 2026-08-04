import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import DuelChallengeWatcher from './components/DuelChallengeWatcher';
import AdminTopbar from './components/AdminTopbar';

// Pages (will be created next)
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Collection from './pages/Collection';
import Decks from './pages/Decks';
import DeckEditor from './pages/DeckEditor';
import DeckView from './pages/DeckView';
import DeckShare from './pages/DeckShare';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import Social from './pages/Social';
import Followers from './pages/Followers';
import News from './pages/News';
import Admin from './pages/Admin';
import Duels from './pages/Duels';
import DuelRoom from './pages/DuelRoom';
import EngineDuelRoom from './pages/EngineDuelRoom';

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={user ? <Navigate to="/collection" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/collection" /> : <Register />} />
      <Route path="/deck/share/:shareToken" element={<DeckShare />} />

      {/* Protected routes */}
      <Route
        path="/collection"
        element={
          <ProtectedRoute>
            <Collection />
          </ProtectedRoute>
        }
      />
      <Route
        path="/decks"
        element={
          <ProtectedRoute>
            <Decks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/decks/new"
        element={
          <ProtectedRoute>
            <DeckEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/decks/:deckId/edit"
        element={
          <ProtectedRoute>
            <DeckEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/decks/:deckId"
        element={
          <ProtectedRoute>
            <DeckView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/:userId"
        element={
          <ProtectedRoute>
            <UserProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/user/:userId"
        element={
          <ProtectedRoute>
            <UserProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/social"
        element={
          <ProtectedRoute>
            <Social />
          </ProtectedRoute>
        }
      />
      <Route
        path="/actualites"
        element={
          <ProtectedRoute>
            <News />
          </ProtectedRoute>
        }
      />
      <Route
        path="/followers"
        element={
          <ProtectedRoute>
            <Followers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/duels"
        element={
          <ProtectedRoute>
            <Duels />
          </ProtectedRoute>
        }
      />
      {/* Un duel, c'est le moteur. ygopro-core applique les règles, les phases,
          les limites d'invocation et les effets de cartes.

          C'était l'inverse jusqu'ici — l'ancien mode manuel occupait cette
          adresse — et personne ne trouvait le moteur, ce qui donnait
          l'impression qu'il n'existait pas. */}
      <Route
        path="/duel/:id"
        element={
          <ProtectedRoute>
            <EngineDuelRoom />
          </ProtectedRoute>
        }
      />
      {/* Tapis de jeu libre : aucune règle appliquée, les joueurs s'arrangent
          entre eux. Utile pour les cartes non scriptées et les formats maison. */}
      <Route
        path="/duel/:id/libre"
        element={
          <ProtectedRoute>
            <DuelRoom />
          </ProtectedRoute>
        }
      />

      {/* Landing publique : Home v2 si non logué, sinon redirection vers la collection */}
      <Route path="/" element={user ? <Navigate to="/collection" /> : <Home />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <AdminTopbar />
            <AppRoutes />
            {/* Surveille les defis depuis n'importe quelle page : un duel recu doit
                se voir meme en pleine consultation de sa collection. */}
            <DuelChallengeWatcher />
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: 'var(--panel)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderLeft: '3px solid var(--gold)',
                  borderRadius: 0,
                  fontFamily: "'Rajdhani', system-ui, sans-serif",
                  fontWeight: 600,
                },
                success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--panel)' } },
                error: { iconTheme: { primary: 'var(--danger)', secondary: 'var(--panel)' } },
              }}
            />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
