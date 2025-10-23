# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema BEFORE npm install (needed for postinstall hook)
COPY prisma ./prisma

# Install dependencies (use install instead of ci to handle lock file discrepancies)
RUN npm install

# Copy rest of source code
COPY . .

# Build Next.js app (Prisma Client already generated via postinstall hook)
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/start.sh ./start.sh

# Make start script executable
RUN chmod +x ./start.sh

# Set production environment
ENV NODE_ENV=production

# Expose port (Railway sets this dynamically)
EXPOSE 3000

# Start the app
CMD ["./start.sh"]
