import { FastifyInstance } from "fastify";
import { FriendService } from "../../services/FriendService";
import { createSocketEventService } from "../../services/SocketEventService";

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  const friendService = new FriendService(fastify.orm);
  const socketEventService = createSocketEventService(fastify);

  // Get all friends
  fastify.get("/friends", async (request, reply) => {
    const friends = await friendService.getFriends(request.user.id);
    reply.send(friends);
  });

  // Get pending friend requests
  fastify.get("/friends/pending", async (request, reply) => {
    const pendingRequests = await friendService.getPendingRequests(
      request.user.id,
    );
    reply.send(pendingRequests);
  });

  // Send friend request
  fastify.post("/friends", async (request, reply) => {
    const { username } = request.body as { username: string };
    const friendship = await friendService.addFriend(request.user.id, username);
    const recipients = Array.from(
      new Set([friendship.senderId, friendship.receiverId]),
    );
    await socketEventService.emitToUsers(
      recipients,
      "friends:updated",
      {
        friendshipId: friendship.id,
        status: friendship.status,
        action: "added",
      },
    );
    reply.send(friendship);
  });

  // Accept friend request
  fastify.post("/friends/:id/accept", async (request, reply) => {
    const { id } = request.params as { id: string };
    const friendship = await friendService.acceptFriendRequest(
      request.user.id,
      parseInt(id),
    );
    const recipients = Array.from(
      new Set([friendship.senderId, friendship.receiverId]),
    );
    await socketEventService.emitToUsers(
      recipients,
      "friends:updated",
      {
        friendshipId: friendship.id,
        status: friendship.status,
        action: "accepted",
      },
    );
    reply.send(friendship);
  });

  // Reject friend request
  fastify.post("/friends/:id/reject", async (request, reply) => {
    const { id } = request.params as { id: string };
    const friendship = await friendService.rejectFriendRequest(
      request.user.id,
      parseInt(id),
    );
    const recipients = Array.from(
      new Set([friendship.senderId, friendship.receiverId]),
    );
    await socketEventService.emitToUsers(
      recipients,
      "friends:updated",
      {
        friendshipId: friendship.id,
        status: friendship.status,
        action: "rejected",
      },
    );
    reply.send(friendship);
  });

  // Remove friend
  fastify.delete("/friends/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const friendshipId = parseInt(id, 10);
    const friendship = await friendService.removeFriend(
      request.user.id,
      friendshipId,
    );
    const recipients = Array.from(
      new Set([friendship.senderId, friendship.receiverId]),
    );
    await socketEventService.emitToUsers(
      recipients,
      "friends:updated",
      {
        friendshipId,
        status: friendship.status,
        action: "removed",
      },
    );
    reply.send({ success: true });
  });

  next();
}
