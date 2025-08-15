# Backend Dockerfile for Google Cloud Run
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install build dependencies for SQLite3 and runtime dependencies
RUN apk add --no-cache python3 make g++ libc6-compat sqlite sqlite-dev

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Rebuild SQLite3 for the correct architecture
RUN npm rebuild sqlite3

# Create uploads directory
RUN mkdir -p uploads

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Expose port
EXPOSE 8080

# Set environment variables for Cloud Run
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["npm", "start"]
