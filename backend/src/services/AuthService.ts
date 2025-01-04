import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { NotFoundError } from "../errors/api";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { config } from "../config/config";

export class AuthService {
  private ormConnection: DataSource;

  constructor(ormConnection: DataSource) {
    this.ormConnection = ormConnection;
  }

  private generateAccessToken(user) {
    return jwt.sign(
      { sub: user.id, roles: user.roles },
      config.auth.secretAccessToken,
      { expiresIn: config.auth.authTokenExpiry },
    );
  }

  private generateRefreshToken(user) {
    return jwt.sign(
      { sub: user.id, roles: user.roles, aud: "/refresh" },
      config.auth.secretAccessToken,
      { expiresIn: config.auth.authRefreshTokenExpiry },
    );
  }

  async signup(app, body) {
    const { email, password, username } = body;

    // Check if the user already exists
    const existingUser = await this.ormConnection.getRepository(User).findOneBy(
      { email },
    );

    if (existingUser) {
      throw new Error("auth/already-signed-up");
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

    // Remove password from user object before sending
    delete user.password;

    return {
      token_type: "Bearer",
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
    };
  }

  async signin(app, body) {
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

    // Remove password from user object before sending
    delete user.password;

    return {
      token_type: "Bearer",
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
    };
  }

  verify(app, body) {
    const { token } = body;

    try {
      const decoded = jwt.verify(token, config.auth.secretAccessToken);
      return decoded;
    } catch (err) {
      throw new Error("auth/invalid-token");
    }
  }

  async refresh(app, body) {
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
}
