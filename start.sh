#!/bin/sh
set -e

# Run migrations against the persistent volume DB
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Start the server
exec node server.js
