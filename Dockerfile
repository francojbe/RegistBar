# Stage 1: Build the React Application
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
# Use --legacy-peer-deps to avoid conflicts if any
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Accept Build Arguments (Environment Variables from EasyPanel)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GOOGLE_CLIENT_ID

# Set them as Environment Variables for the build process
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Build the project
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built assets from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
