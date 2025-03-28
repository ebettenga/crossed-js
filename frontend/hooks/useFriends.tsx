import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, del } from './api';
import { useState } from 'react';
import { User, useUser } from './users';

export interface Friend {
  id: number;
  sender: {
    id: number;
    username: string;
    photo: string;
    status: 'online' | 'offline';
  };
  receiver: {
    id: number;
    username: string;
    photo: string;
    status: 'online' | 'offline';
  };
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  acceptedAt: string | null;
}

// Query keys
const FRIENDS_KEY = 'friends';
const PENDING_REQUESTS_KEY = 'pending-requests';

// Fetch friends list
export function useFriendsList() {
  return useQuery<Friend[]>({
    queryKey: [FRIENDS_KEY],
    queryFn: () => get('/friends'),
  });
}

// Fetch pending requests
export function usePendingRequests() {
  return useQuery<Friend[]>({
    queryKey: [PENDING_REQUESTS_KEY],
    queryFn: () => get('/friends/pending'),
  });
}

// Add friend
export function useAddFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => post('/friends', { username }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [FRIENDS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PENDING_REQUESTS_KEY] });
    },
  });
}

// Accept friend request
export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendshipId: number) =>
      post(`/friends/${friendshipId}/accept`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FRIENDS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PENDING_REQUESTS_KEY] });
    },
  });
}

// Reject friend request
export function useRejectFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendshipId: number) =>
      post(`/friends/${friendshipId}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PENDING_REQUESTS_KEY] });
    },
  });
}

// Remove friend
export function useRemoveFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendshipId: number) => del(`/friends/${friendshipId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FRIENDS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PENDING_REQUESTS_KEY] });
    },
  });
}

// Search users
export function useSearchUsers() {
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const { data: user } = useUser();
  const mutation = useMutation({
    mutationFn: async (query: string) => {
      if (!query.trim()) return [];
      const response = await get(`/users/search?query=${encodeURIComponent(query.trim())}`);
      // Filter out the current user from search results
      setSearchResults((response as User[]).filter(userListItem => userListItem.id !== user?.id));
    },
  });

  const clearSearchResults = () => {
    setSearchResults([]);
  };

  return { searchResults, clearSearchResults, ...mutation };
}
