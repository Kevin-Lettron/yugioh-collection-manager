import { useState, useEffect, FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Deck, DeckComment } from '../../../shared/types';
import api from '../services/api';
import toast from 'react-hot-toast';

const DeckView = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<DeckComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showComments, setShowComments] = useState(true);

  useEffect(() => {
    if (deckId) {
      fetchDeck();
      fetchComments();
    }
  }, [deckId]);

  const fetchDeck = async () => {
    try {
      const response = await api.get(`/decks/${deckId}`);
      setDeck(response.data);
    } catch (error) {
      console.error('Failed to fetch deck:', error);
      toast.error('Failed to load deck');
      navigate('/decks');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await api.get(`/comments/deck/${deckId}`);
      setComments(response.data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleReaction = async (isLike: boolean) => {
    try {
      if (deck?.user_reaction === (isLike ? 'like' : 'dislike')) {
        // Remove reaction
        await api.delete(`/reactions/decks/${deckId}`);
        setDeck((prev) =>
          prev
            ? {
                ...prev,
                user_reaction: null,
                likes_count: isLike ? (prev.likes_count || 0) - 1 : prev.likes_count,
                dislikes_count: !isLike ? (prev.dislikes_count || 0) - 1 : prev.dislikes_count,
              }
            : null
        );
      } else {
        // Add or change reaction
        if (isLike) {
          await api.post(`/reactions/decks/${deckId}/like`);
        } else {
          await api.post(`/reactions/decks/${deckId}/dislike`);
        }

        setDeck((prev) => {
          if (!prev) return null;
          const wasLike = prev.user_reaction === 'like';
          const wasDislike = prev.user_reaction === 'dislike';

          return {
            ...prev,
            user_reaction: isLike ? 'like' : 'dislike',
            likes_count: isLike
              ? (prev.likes_count || 0) + 1
              : wasLike
              ? (prev.likes_count || 0) - 1
              : prev.likes_count,
            dislikes_count: !isLike
              ? (prev.dislikes_count || 0) + 1
              : wasDislike
              ? (prev.dislikes_count || 0) - 1
              : prev.dislikes_count,
          };
        });
      }
    } catch (error) {
      console.error('Failed to update reaction:', error);
    }
  };

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();

    if (!commentText.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    try {
      await api.post(`/comments/deck/${deckId}`, { content: commentText });
      toast.success('Comment added!');
      setCommentText('');
      fetchComments();
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleAddReply = async (commentId: number) => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply');
      return;
    }

    try {
      await api.post(`/comments/${commentId}/reply`, {
        content: replyText,
        parent_comment_id: commentId,
      });
      toast.success('Reply added!');
      setReplyText('');
      setReplyingTo(null);
      fetchComments();
    } catch (error) {
      console.error('Failed to add reply:', error);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      await api.delete(`/comments/${commentId}`);
      toast.success('Comment deleted');
      fetchComments();
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const handleCopyToWishlist = async () => {
    try {
      await api.post(`/social/wishlist/${deckId}`);
      toast.success('Deck added to wishlist!');
      setDeck((prev) => (prev ? { ...prev, is_wishlisted: true } : null));
    } catch (error) {
      console.error('Failed to add to wishlist:', error);
    }
  };

  const handleRemoveFromWishlist = async () => {
    try {
      await api.delete(`/social/wishlist/${deckId}`);
      toast.success('Deck removed from wishlist');
      setDeck((prev) => (prev ? { ...prev, is_wishlisted: false } : null));
    } catch (error) {
      console.error('Failed to remove from wishlist:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Deck not found</h2>
          <Link to="/decks" className="text-blue-600 hover:text-blue-700">
            Back to Decks
          </Link>
        </div>
      </div>
    );
  }

  const mainDeckCount = deck.main_deck?.reduce((sum, card) => sum + card.quantity, 0) || 0;
  const extraDeckCount = deck.extra_deck?.reduce((sum, card) => sum + card.quantity, 0) || 0;
  const isOwner = user?.id === deck.user_id;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-blue-600">YuGiOh Manager</h1>
              <div className="hidden md:flex space-x-4">
                <Link to="/collection" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md">
                  Collection
                </Link>
                <Link to="/decks" className="text-blue-600 font-semibold px-3 py-2 rounded-md">
                  Decks
                </Link>
                <Link to="/social" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md">
                  Social
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/profile" className="text-gray-700 hover:text-blue-600 font-medium">
                {user?.username}
              </Link>
              <button onClick={logout} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Deck Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">{deck.name}</h2>
              <p className="text-gray-600">
                by{' '}
                <Link to={`/profile/${deck.user_id}`} className="text-blue-600 hover:text-blue-700">
                  {deck.user?.username}
                </Link>
              </p>
              <div className="flex items-center space-x-4 mt-4">
                <span className={deck.is_public ? 'text-green-600' : 'text-gray-600'}>
                  {deck.is_public ? 'Public' : 'Private'}
                </span>
                <span className={deck.respect_banlist ? 'text-green-600' : 'text-orange-600'}>
                  {deck.respect_banlist ? 'Banlist Compliant' : 'Banlist Ignored'}
                </span>
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              {isOwner && (
                <Link
                  to={`/decks/${deckId}/edit`}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-semibold text-center"
                >
                  Edit Deck
                </Link>
              )}
              {!isOwner && (
                <>
                  {deck.is_wishlisted ? (
                    <button
                      onClick={handleRemoveFromWishlist}
                      className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition font-semibold"
                    >
                      Remove from Wishlist
                    </button>
                  ) : (
                    <button
                      onClick={handleCopyToWishlist}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition font-semibold"
                    >
                      Add to Wishlist
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">{mainDeckCount}</p>
              <p className="text-sm text-gray-600">Main Deck</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">{extraDeckCount}</p>
              <p className="text-sm text-gray-600">Extra Deck</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{deck.likes_count || 0}</p>
              <p className="text-sm text-gray-600">Likes</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">{deck.comments_count || 0}</p>
              <p className="text-sm text-gray-600">Comments</p>
            </div>
          </div>

          {/* Reactions */}
          <div className="flex items-center space-x-4 mt-6">
            <button
              onClick={() => handleReaction(true)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                deck.user_reaction === 'like'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-green-100'
              }`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              <span>Like</span>
            </button>

            <button
              onClick={() => handleReaction(false)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                deck.user_reaction === 'dislike'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-red-100'
              }`}
            >
              <svg className="w-5 h-5 transform rotate-180" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              <span>Dislike</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Deck Lists */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Deck */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Main Deck ({mainDeckCount})</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {deck.main_deck?.map((deckCard) => (
                  <div key={deckCard.id} className="relative">
                    <img
                      src={deckCard.card?.card_images?.[0]?.image_url_small || '/placeholder-card.png'}
                      alt={deckCard.card?.name}
                      className="w-full h-auto rounded shadow"
                      title={deckCard.card?.name}
                    />
                    {deckCard.quantity > 1 && (
                      <span className="absolute top-1 right-1 bg-black bg-opacity-75 text-white text-xs font-bold px-2 py-1 rounded">
                        x{deckCard.quantity}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {(!deck.main_deck || deck.main_deck.length === 0) && (
                <p className="text-center text-gray-600 py-8">No cards in main deck</p>
              )}
            </div>

            {/* Extra Deck */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Extra Deck ({extraDeckCount})</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {deck.extra_deck?.map((deckCard) => (
                  <div key={deckCard.id} className="relative">
                    <img
                      src={deckCard.card?.card_images?.[0]?.image_url_small || '/placeholder-card.png'}
                      alt={deckCard.card?.name}
                      className="w-full h-auto rounded shadow"
                      title={deckCard.card?.name}
                    />
                    {deckCard.quantity > 1 && (
                      <span className="absolute top-1 right-1 bg-black bg-opacity-75 text-white text-xs font-bold px-2 py-1 rounded">
                        x{deckCard.quantity}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {(!deck.extra_deck || deck.extra_deck.length === 0) && (
                <p className="text-center text-gray-600 py-8">No cards in extra deck</p>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">Comments</h3>
                <button
                  onClick={() => setShowComments(!showComments)}
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  {showComments ? 'Hide' : 'Show'}
                </button>
              </div>

              {showComments && (
                <>
                  {/* Add Comment */}
                  <form onSubmit={handleAddComment} className="mb-6">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                      rows={3}
                      placeholder="Add a comment..."
                    />
                    <button
                      type="submit"
                      className="mt-2 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                    >
                      Post Comment
                    </button>
                  </form>

                  {/* Comments List */}
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {comments.map((comment) => (
                      <div key={comment.id} className="border-b border-gray-200 pb-4">
                        <div className="flex items-start space-x-2">
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-gray-800">
                              {comment.user?.username}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">{comment.content}</p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                              <span>
                                {new Date(comment.created_at).toLocaleDateString()}
                              </span>
                              <button
                                onClick={() => setReplyingTo(comment.id)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                Reply
                              </button>
                              {user?.id === comment.user_id && (
                                <button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  Delete
                                </button>
                              )}
                            </div>

                            {/* Reply Form */}
                            {replyingTo === comment.id && (
                              <div className="mt-3 ml-4">
                                <textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-sm"
                                  rows={2}
                                  placeholder="Write a reply..."
                                />
                                <div className="flex space-x-2 mt-2">
                                  <button
                                    onClick={() => handleAddReply(comment.id)}
                                    className="bg-blue-600 text-white px-4 py-1 rounded text-xs hover:bg-blue-700"
                                  >
                                    Reply
                                  </button>
                                  <button
                                    onClick={() => setReplyingTo(null)}
                                    className="bg-gray-200 text-gray-700 px-4 py-1 rounded text-xs hover:bg-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Replies */}
                            {comment.replies && comment.replies.length > 0 && (
                              <div className="ml-4 mt-3 space-y-3">
                                {comment.replies.map((reply) => (
                                  <div key={reply.id} className="bg-gray-50 rounded p-2">
                                    <p className="font-semibold text-xs text-gray-800">
                                      {reply.user?.username}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">{reply.content}</p>
                                    <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                                      <span>
                                        {new Date(reply.created_at).toLocaleDateString()}
                                      </span>
                                      {user?.id === reply.user_id && (
                                        <button
                                          onClick={() => handleDeleteComment(reply.id)}
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {comments.length === 0 && (
                      <p className="text-center text-gray-600 py-8">
                        No comments yet. Be the first to comment!
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeckView;
