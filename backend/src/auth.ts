import { Authenticator } from "@fastify/passport";
import { Strategy as GitHubStrategy } from "passport-github";
import { config } from "./config/config";
import { User } from "./entities/User";
import { fastify } from "./fastify";

export const userPassport: Authenticator = new Authenticator();

// Auth Stuff
userPassport.use(
  "github",
  new GitHubStrategy(
    {
      clientID: config.github.clientId,
      clientSecret: config.github.clientSecret,
      callbackURL: `http://${config.api.host}:${config.api.port}/auth/github/callback`,
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const user = await fastify.orm
          .getRepository(User)
          .findOneBy({ githubId: profile.id });

        if (user) {
          return cb(null, user);
        }

        const newUser = new User();
        newUser.githubId = profile.id;
        newUser.username = profile.username;
        await fastify.orm.getRepository(User).save(newUser);
        return cb(null, newUser);
      } catch (error) {
        return cb(error, null);
      }
    }
  )
);
