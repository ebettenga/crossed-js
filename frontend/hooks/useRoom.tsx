import { useSocket } from './socket';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { showToast } from '~/components/shared/Toast';
import { useUser } from './users';
import { Room } from './useJoinRoom';

export const useRoomEvents = () => {
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: user } = useUser();

  useEffect(() => {
    if (!socket || !user) return;

    console.log('Setting up room events for user:', user.id);

    // Join user-specific room for user-specific events (like game cancellations)
    socket.emit('join_room_bus', { roomId: `user_${user.id}` });
    console.log(`Joined user-specific room: user_${user.id}`);

    // Get current room from query client to join game room if needed
    const currentRoom = queryClient.getQueryData<Room>(['currentRoom']);
    if (currentRoom?.id) {
      socket.emit('join_room_bus', { roomId: currentRoom.id });
      console.log(`Joined game room: ${currentRoom.id}`);
    }

    const handleRoomCancelled = (data: { message: string, roomId: number, reason: string }) => {
      console.log("Room cancelled event received:", data);

      // Invalidate pending rooms query
      queryClient.invalidateQueries({ queryKey: ['rooms', 'pending'] });

      // Show toast message
      showToast(
        'error',
        data.message || 'Game was cancelled',
      );

      // Navigate back to home if in a game
      router.replace('/(root)/(tabs)');
    };

    // Listen for room_cancelled events
    socket.on('room_cancelled', handleRoomCancelled);
    console.log('Listening for room_cancelled events');

    return () => {
      console.log('Cleaning up room events');
      if (currentRoom?.id) {
        socket.emit('leave_room_bus', { roomId: currentRoom.id });
      }
      socket.off('room_cancelled', handleRoomCancelled);
    };
  }, [socket, user]);
};
