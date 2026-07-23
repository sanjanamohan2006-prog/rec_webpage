FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json server.js "html file.html" rec-logo.png portal-data.json ./

# Mount this directory on the server. It holds the SQLite database and is never
# replaced when a newer version of the application image is deployed.
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
EXPOSE 3000
VOLUME ["/app/data"]

CMD ["node", "server.js"]
