# Base image
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm@10.20.0

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install app dependencies
RUN pnpm install --frozen-lockfile

# Bundle app source
COPY . .

# Creates a "dist" folder with the production build
RUN pnpm build

# Expose port
EXPOSE 3000

# Start the server using the production build
CMD ["pnpm", "start:prod"]
