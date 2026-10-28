FROM node:20-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy application code
COPY . .

# Expose port
EXPOSE 5050

# Start server
CMD ["node", "src/server.js"]
