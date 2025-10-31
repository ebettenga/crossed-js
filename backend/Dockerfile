FROM node:22-alpine

WORKDIR /app

ENV CI=true
ENV CROSSWORDS_DIR=/crosswords

# Add build dependencies for native modules
RUN apk add --no-cache g++ gcc libsodium gcompat

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
COPY ../crosswords ./crosswords
RUN mkdir -p ${CROSSWORDS_DIR} && cp -r ./crosswords/. ${CROSSWORDS_DIR} || true
RUN yarn build

EXPOSE 3000
CMD ["yarn", "start"]
