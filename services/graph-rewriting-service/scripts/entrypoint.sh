#!/bin/bash
set -e

# Build NEO4J_AUTH from individual credential env vars so callers only need to
# supply NEO4J_USERNAME and NEO4J_PASSWORD.
export NEO4J_AUTH="${NEO4J_USERNAME}/${NEO4J_PASSWORD}"

echo "Starting Neo4j..."
neo4j start

# Poll the Bolt port until Neo4j is ready to accept connections.
# /dev/tcp is a bash built-in — requires bash, not dash.
echo "Waiting for Neo4j Bolt port (7687)..."
until (echo > /dev/tcp/localhost/7687) 2>/dev/null; do
    sleep 1
done
echo "Neo4j is ready."

# Pipe Neo4j logs to stdout so they appear in 'docker logs'.
tail -f /var/lib/neo4j/logs/neo4j.log &

# Start supervisord as PID 1. It manages the Fastify app process.
# Neo4j runs as its own self-managed Java process in the background.
exec supervisord -n -c /etc/supervisor/conf.d/supervisord.conf
