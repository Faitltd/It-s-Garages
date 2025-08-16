# Frontend Dockerfile for Google Cloud Run
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Accept build arguments
ARG VITE_API_BASE_URL=https://garage-door-backend-341270520862.us-central1.run.app/api
ARG PUBLIC_API_BASE_URL=https://garage-door-backend-341270520862.us-central1.run.app/api

# Set environment variables for build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV PUBLIC_API_BASE_URL=$PUBLIC_API_BASE_URL

# Build the application
RUN npm run build

# Production stage - Use nginx to serve static files
FROM nginx:alpine

# Copy built application from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy start script and make executable
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose port 8080 (Cloud Run requirement)
EXPOSE 8080

# Start via start.sh to generate env.js at runtime
CMD ["/start.sh"]
