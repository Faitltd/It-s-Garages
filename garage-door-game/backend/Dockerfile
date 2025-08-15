# Backend Dockerfile for Google Cloud Run
# Using debian-slim instead of alpine for better SQLite3 compatibility
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install build dependencies for SQLite3 and runtime dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Rebuild SQLite3 for the correct architecture
RUN npm rebuild sqlite3

# Test SQLite3 installation
RUN node -e "console.log('Testing SQLite3...'); const sqlite3 = require('sqlite3'); console.log('SQLite3 version:', sqlite3.VERSION); console.log('SQLite3 test passed!');"

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
