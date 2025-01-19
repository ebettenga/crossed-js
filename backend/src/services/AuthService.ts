import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { ForbiddenError, NotFoundError, UniqueConstraintError } from "../errors/api";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { config } from "../config/config";
import fastify, { FastifyInstance } from "fastify";

export class AuthService {
  private ormConnection: DataSource;

  constructor(ormConnection: DataSource) {
    this.ormConnection = ormConnection;
  }

  private generateAccessToken(user: User) {
    return jwt.sign(
      { sub: user.id, roles: user.roles },
      config.auth.secretAccessToken,
      { expiresIn: config.auth.authTokenExpiry },
    );
  }

  private generateRefreshToken(user: User) {
    return jwt.sign(
      { sub: user.id, roles: user.roles, aud: "/refresh" },
      config.auth.secretAccessToken,
      { expiresIn: config.auth.authRefreshTokenExpiry },
    );
  }

  async signup(app: FastifyInstance, body: any) {
    const { email, password, username } = body;

  // Checks if the user and emails are unique
  const uniqueValues = await this.ormConnection.getRepository(User).findOne({
    select: {
      id: true,
      email: true,
      username: true,
    },
    where: [
      { email: email },
      { username: username },
    ],
  });



  if (uniqueValues) {
    let errors = [];
    if (uniqueValues.email === email) {
      errors.push("auth/email-already-exists");

    }
    if (uniqueValues.username === username) {
      errors.push("auth/username-already-exists");

    }
    throw new UniqueConstraintError(errors.map((error) => error).join(", "));

  }



    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user in the database
    const user = await this.ormConnection.getRepository(User).save({
      email,
      password: hashedPassword,
      confirmed_mail: false,
      roles: ["user"],
      description: "",
      username,
      attributes: [],
    });

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);


    return {
      token_type: "Bearer",
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
    };
  }

  async signin(app: FastifyInstance, body: any) {
    const { email, password } = body;

    const user = await this.ormConnection.getRepository(User).findOne({
      where: { email },
      select: [
        "id",
        "email",
        "password",
        "confirmed_mail",
        "roles",
        "username",
        "attributes",
        "created_at",
        "description",
        "eloRating",
      ],
    });

    if (!user) {
      throw new NotFoundError("auth/user-not-found");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error("auth/invalid-password");
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      token_type: "Bearer",
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
    };
  }

  verify(app: FastifyInstance, body: any) {
    const { token } = body;
    try {
      const decoded = jwt.verify(token, config.auth.secretAccessToken);
      return decoded;
    } catch (err) {
      throw new ForbiddenError("auth/invalid-token");
    }
  }

  async refresh(app: FastifyInstance, body: any) {
    const { refresh_token } = body;

    try {
      const decoded = jwt.verify(
        refresh_token,
        config.auth.secretAccessToken,
      );
      const user = await this.ormConnection.getRepository(User).findOneBy({
        // @ts-ignore  this is always an int we're gonna hope. refer to generate methods
        id: decoded.sub,
      });

      if (!user) {
        throw new NotFoundError("auth/user-not-found");
      }

      const accessToken = this.generateAccessToken(user);

      return {
        token_type: "Bearer",
        access_token: accessToken,
      };
    } catch (err) {
      throw new Error("auth/invalid-refresh-token");
    }
  }

  async updatePassword(userId: number, newPassword: string): Promise<void> {
    const userRepository = this.ormConnection.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: userId },
      select: ['id', 'password']
    });

    if (!user) {
      throw new NotFoundError("auth/user-not-found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.update(userId, { password: hashedPassword });
  }
}
