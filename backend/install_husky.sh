#!/bin/sh
yarn add husky --dev
yarn husky install
yarn husky add .husky/pre-commit "yarn prettier --write . && yarn test"