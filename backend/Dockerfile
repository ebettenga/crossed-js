# Use the official Node.js image as the base image
FROM node:21

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies
RUN yarn install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["yarn", "start"]