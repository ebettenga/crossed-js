FROM node:22-alpine

WORKDIR /app

ENV CI=true

# Add build dependencies for native modules
RUN apk add --no-cache g++ gcc libsodium gcompat

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

EXPOSE 3000
CMD ["yarn", "start"]
