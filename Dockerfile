FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build (if needed)
RUN npm run build || true

# Default command (can be overridden)
CMD ["npm", "run", "indexer:follow"]
