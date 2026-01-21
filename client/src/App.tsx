import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Pages (will be created next)
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
        path="/followers"
        element={
          <ProtectedRoute>
            <Followers />
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/collection" />} />
      <Route path="*" element={<Navigate to="/collection" />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
          <Toaster position="top-right" />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
