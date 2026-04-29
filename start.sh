#!/bin/sh
set -e

# Ensure the DB file is writable by the app user
chown nextjs /data/school-photos.db 2>/dev/null || true

# Run migrations against the persistent volume DB
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Start the server
exec node server.js
