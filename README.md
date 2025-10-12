
# Crossed

![Backend Build Status](https://github.com/ebettenga/crossed-js/actions/workflows/ci-backend.yml/badge.svg?branch=main&event=push)


A multiplayer crossword experience for friends and strangers alike!

<!-- TODO: fancy cool readme stuff -->



## Gettings Started

### Settings up the app

Start the application locally by running the following commands: *(assuems you're using some recent version of node)*

1. run `yarn` to load in the node_modules
2. to create a development server,
    - `docker compose up db -d && yarn dev`


### Setting up server

run a full server by running `docker compose up`

### Adding crosswords

you'll need to add crosswords with `yarn commands load-crosswords`


### Running commands


you can see commands to run by running `yarn commands`

**NOTE:** you can load crosswords into you database by running `yarn commands load-crosswords`


## Tools

### Major Packages

### NodeJS

Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine. It allows developers to run JavaScript on the server side, enabling the creation of scalable and high-performance applications. Node.js uses an event-driven, non-blocking I/O model, making it efficient and suitable for real-time applications.

- **fastify**: A web framework highly focused on providing the best developer experience with the least overhead and a powerful plugin architecture.
- **typeorm**: An ORM for TypeScript and JavaScript (ES7, ES6, ES5) that supports various databases like PostgreSQL, MySQL, and SQLite.
- **@fastify/passport**: A Fastify plugin for integrating Passport.js for authentication.
- **fastify-socket.io**: A Fastify plugin for integrating Socket.IO to enable real-time, bidirectional communication.
- **socket.io**: A library for real-time web applications, enabling real-time, bidirectional communication between web clients and servers.
- **winston**: A versatile logging library for Node.js, supporting multiple transports.

### PostgreSQL

PostgreSQL is a powerful, open-source object-relational database system. It has a strong reputation for reliability, feature robustness, and performance. In this project, PostgreSQL is used as the primary database to store and manage crossword data and user information.

### Docker

Docker is a platform designed to help developers build, share, and run applications in containers. Containers are lightweight, portable, and ensure consistency across different environments. In this project, Docker is used to containerize the application and its dependencies, making it easier to set up, deploy, and manage the application across various environments.


## Project Layout

The backend project is organized into several key folders, each serving a specific purpose. Below is a summary of each folder and its contents:

### `/src`

This is the main source directory for the backend application.
- ** `/commands` **: Contains custom command scripts for various tasks, such as loading crosswords into the database or running maintenance operations.
- **`/entities`**: Defines the database entities using TypeORM.
- **`/routes`**: Defines the routes/endpoints for the application.
- **`/services`**: Contains the business logic and service layer of the application.
- **`/utils`**: Utility functions and helpers used throughout the application.
- **`/config`**: Configuration files for different environments (e.g., development, production).

### `/migrations`

Contains the database migration files managed by TypeORM.

### `/tests`

Contains the test files for unit and integration testing of the application.

run tests with `yarn test`

### Running tests with coverage

To run tests with coverage, use the following command: `yarn test:coverage`

to see a coverage report, run `yarn serve:coverage`

### `/docs`

Documentation files related to the project, including API documentation and developer guides.


## Contributing

When creating a new model, the following files need to be made:

### Entities

Create a new file in the `/src/entities` directory to define the database entity for the model. This file should include the necessary TypeORM decorators to specify the table name, columns, and relationships with other entities.

### Routes

Add a new file in the `/src/routes` directory to define the API endpoints related to the new model. This file should include the necessary Fastify route definitions and handlers to perform CRUD operations on the model.

### Tests

Create a new file in the `/tests` directory to write unit and integration tests for the new model. This file should include test cases to verify the functionality of the model's routes, services, and any other related logic.

### Test Data

Add a new file in the `/tests/test-data` directory to provide sample data for testing the new model. use the other files as an example.


Use the fork and pull request method if you would like to conribute. message me at ebettenga@gmail.com if you have any questions. Enjoy!

<!-- TODO: add contributing guide -->
