import { Authenticator } from "@fastify/passport";
import {fastify} from "./fastify";
import { User } from "./entities/User";
import { Strategy as GitHubStrategy } from "passport-github";
import { config } from "./config/config";


// `this` inside validate is `fastify`
export const validate = (username, password, req, reply, done) => {
  if (username === 'Tyrion' && password === 'wine') {
    done();
  } else {
    done(new Error('Winter is coming'));
  }
};


const userPassport: Authenticator = new Authenticator();

// Auth Stuff
userPassport.use(
  "github",
  new GitHubStrategy(
    {
      clientID: config.github.clientId,
      clientSecret: config.github.clientSecret,
      callbackURL: `http://${config.api.host}:${config.api.port}/api/auth/github/callback`,
    },
    (accessToken, refreshToken, profile, cb) => {
      fastify.orm
        .getRepository(User)
        .findOneBy({ githubId: profile.id })
        .then((user) => {
          if (user) {
            return cb(null, user);
          }

          const newUser = new User();
          newUser.githubId = profile.id;
          newUser.username = profile.username;
          fastify.orm
            .getRepository(User)
            .save(newUser)
            .then((newUser) => {
              return cb(null, newUser);
            });
        })
        .catch((error) => {
          return cb(error, null);
        });
    }
  )
);



userPassport.registerUserSerializer(async (user: User, request) => {
  console.log("Got here");
  return {
  id: user.id,
  username: user.username,
  }
});

// ... and then a deserializer that will fetch that user from the database when a request with an id in the session arrives
userPassport.registerUserDeserializer(async (id: number, request) => {
  return await fastify.orm.getRepository(User).findBy({ id: id })
});

export { userPassport };
