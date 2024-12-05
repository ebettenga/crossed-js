# Crossed


A multiplayer crossword experience for friends and strangers alike!

<!-- TODO: fancy cool readme stuff -->


## Gettings Started

To get started, navigate to the backend and run `docker compose up`



### Settings up the app

Start the application locally by running the following commands: *(assuems you're using some recent version of node)*

1. run `yarn` to load in the node_modules
2. to create a development server, 
    - `docker compose up db -d && yarn dev`


### Running commands

you can see commands to run by running `yarn commands`

**NOTE:** you can load crosswords into you database by running `yarn commands load-crosswords`


## Tools

### Major Packages

- **fastify**: A web framework highly focused on providing the best developer experience with the least overhead and a powerful plugin architecture.
- **typeorm**: An ORM for TypeScript and JavaScript (ES7, ES6, ES5) that supports various databases like PostgreSQL, MySQL, and SQLite.
- **@fastify/passport**: A Fastify plugin for integrating Passport.js for authentication.
- **fastify-socket.io**: A Fastify plugin for integrating Socket.IO to enable real-time, bidirectional communication.
- **socket.io**: A library for real-time web applications, enabling real-time, bidirectional communication between web clients and servers.
- **winston**: A versatile logging library for Node.js, supporting multiple transports.

<!-- TODO: add tools -->

<!-- TODO: add tools -->


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

### `/scripts`

Utility scripts for various development tasks, such as database seeding or maintenance.

### `/public`

Static files served by the application, such as images, CSS, and JavaScript files.

### `/docker`

Docker-related files, including Dockerfile and Docker Compose configuration.

### `/logs`

Directory where application logs are stored.

### `/docs`

Documentation files related to the project, including API documentation and developer guides.


## Contributing


just use the fork and pull method if you would like to conribute. message me at ebettenga@gmail.com if you have any questions. Enjoy!

<!-- TODO: add contributing guide -->