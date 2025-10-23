FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (use npm install for flexibility)
RUN npm install

# Copy source
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Default command (can be overridden)
CMD ["npm", "run", "indexer:follow"]
