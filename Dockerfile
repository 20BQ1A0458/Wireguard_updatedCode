# Use an official Node.js image as the base
FROM node:18-slim

# Install WireGuard, kubectl, and other necessary tools
RUN apt-get update && apt-get install -y \
    wireguard \
    wireguard-tools \
    ufw \
    iproute2 \
    iptables \
    iputils-ping \
    curl \
    && curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Expose the port for the application
EXPOSE 8000

# Command to run the application
CMD ["npm", "run", "start"]
