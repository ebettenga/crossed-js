import { DataSource, ILike } from "typeorm";
import { Friend, FriendshipStatus } from "../entities/Friend";
import { User } from "../entities/User";
import { NotFoundError } from "../errors/api";

export class FriendService {
  private ormConnection: DataSource;

  constructor(ormConnection: DataSource) {
    this.ormConnection = ormConnection;
  }

  async addFriend(senderId: number, receiverUsername: string): Promise<Friend> {
    // Find receiver by username
    const receiver = await this.ormConnection
      .getRepository(User)
      .findOne({ where: { username: ILike(receiverUsername) } });

    if (!receiver) {
      throw new NotFoundError("User not found");
    }

    // Prevent self-friending
    if (receiver.id === senderId) {
      throw new Error("You cannot send a friend request to yourself");
    }

    // Check if friendship already exists
    const existingFriendship = await this.ormConnection
      .getRepository(Friend)
      .findOne({
        where: [
          { senderId, receiverId: receiver.id },
        ],
      });

    if (existingFriendship) {
      throw new Error("Friendship already exists");
    }

    // Create new friendship
    const friendship = new Friend();
    friendship.senderId = senderId;
    friendship.receiverId = receiver.id;
    friendship.status = FriendshipStatus.PENDING;

    return this.ormConnection.getRepository(Friend).save(friendship);
  }

  async getFriends(userId: number): Promise<Friend[]> {
    return this.ormConnection
      .getRepository(Friend)
      .createQueryBuilder("friend")
      .leftJoinAndSelect("friend.sender", "sender")
      .leftJoinAndSelect("friend.receiver", "receiver")
      .where([
        { senderId: userId, status: FriendshipStatus.ACCEPTED },
        { receiverId: userId, status: FriendshipStatus.ACCEPTED },
      ])
      .getMany();
  }

  async getPendingRequests(userId: number): Promise<Friend[]> {
    return this.ormConnection
      .getRepository(Friend)
      .createQueryBuilder("friend")
      .where([
        { receiverId: userId, status: FriendshipStatus.PENDING },
        { senderId: userId, status: FriendshipStatus.PENDING },
      ])
      .leftJoinAndSelect("friend.sender", "sender")
      .leftJoinAndSelect("friend.receiver", "receiver")
      .getMany();
  }

  async acceptFriendRequest(
    userId: number,
    friendshipId: number,
  ): Promise<Friend> {
    const friendship = await this.ormConnection
      .getRepository(Friend)
      .findOne({ where: { id: friendshipId } });

    if (!friendship) {
      throw new NotFoundError("Friend request not found");
    }

    if (friendship.receiverId !== userId) {
      throw new Error("Not authorized to accept this request");
    }

    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new Error("Friend request is not pending");
    }

    friendship.status = FriendshipStatus.ACCEPTED;
    friendship.acceptedAt = new Date();

    return this.ormConnection.getRepository(Friend).save(friendship);
  }

  async rejectFriendRequest(
    userId: number,
    friendshipId: number,
  ): Promise<Friend> {
    const friendship = await this.ormConnection
      .getRepository(Friend)
      .findOne({ where: { id: friendshipId } });

    if (!friendship) {
      throw new NotFoundError("Friend request not found");
    }

    if (friendship.receiverId !== userId) {
      throw new Error("Not authorized to reject this request");
    }

    friendship.status = FriendshipStatus.REJECTED;

    return this.ormConnection.getRepository(Friend).save(friendship);
  }

  async removeFriend(userId: number, friendshipId: number): Promise<void> {
    const friendship = await this.ormConnection
      .getRepository(Friend)
      .findOne({ where: { id: friendshipId } });

    if (!friendship) {
      throw new NotFoundError("Friendship not found");
    }

    if (friendship.senderId !== userId && friendship.receiverId !== userId) {
      throw new Error("Not authorized to remove this friendship");
    }

    await this.ormConnection.getRepository(Friend).remove(friendship);
  }
}
