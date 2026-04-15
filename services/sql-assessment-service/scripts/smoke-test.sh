#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# smoke-test.sh — End-to-end smoke tests for sql-assessment-service
#
# Usage:
#   ./scripts/smoke-test.sh [BASE_URL]
#
# Environment variables:
#   BASE_URL          Service base URL  (default: http://localhost:3000)
#
# PGlite path (no external DB needed):
#   PGLITE_DB_ID      databaseId to use  (default: smoke-db)
#
# PostgreSQL path (optional — skipped if PG_HOST is not set):
#   PG_HOST           Postgres host
#   PG_PORT           Postgres port       (default: 5432)
#   PG_USER           Postgres username
#   PG_PASSWORD       Postgres password
#   PG_DATABASE       Postgres database name
#   PG_SCHEMA         Postgres schema     (default: public)
#
# Exit code: 0 = all tests passed, 1 = one or more failures
# ---------------------------------------------------------------------------
set -euo pipefail

BASE_URL="${1:-${BASE_URL:-http://localhost:3000}}"
PGLITE_DB_ID="${PGLITE_DB_ID:-smoke-db}"

PASS=0
FAIL=0

# ---- helpers ---------------------------------------------------------------

green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }

assert() {
    local label="$1"
    local expected_status="$2"
    local actual_status="$3"
    local body="$4"

    if [[ "$actual_status" == "$expected_status" ]]; then
        green "  PASS  [$actual_status] $label"
        (( PASS++ )) || true
    else
        red   "  FAIL  [$actual_status != $expected_status] $label"
        red   "         body: $body"
        (( FAIL++ )) || true
    fi
}

# Sends a POST request, prints body+status, calls assert.
# Usage: post LABEL EXPECTED_STATUS URL JSON_BODY
post() {
    local label="$1" expected="$2" url="$3" body="$4"
    local response
    response=$(curl -s -w '\n%{http_code}' -X POST "$url" \
        -H 'Content-Type: application/json' \
        -d "$body")
    local http_body http_status
    http_body=$(echo "$response" | head -n -1)
    http_status=$(echo "$response" | tail -n 1)
    assert "$label" "$expected" "$http_status" "$http_body"
}

# Like post, but also asserts that the response body contains NEEDLE.
# Usage: post_body_contains LABEL EXPECTED_STATUS URL JSON_BODY NEEDLE
post_body_contains() {
    local label="$1" expected="$2" url="$3" body="$4" needle="$5"
    local response
    response=$(curl -s -w '\n%{http_code}' -X POST "$url" \
        -H 'Content-Type: application/json' \
        -d "$body")
    local http_body http_status
    http_body=$(echo "$response" | head -n -1)
    http_status=$(echo "$response" | tail -n 1)
    assert "$label (HTTP $expected)" "$expected" "$http_status" "$http_body"
    if [[ "$http_status" == "$expected" ]]; then
        if echo "$http_body" | grep -q "$needle"; then
            green "  PASS  body contains \"$needle\""
            (( PASS++ )) || true
        else
            red   "  FAIL  body does not contain \"$needle\""
            red   "         body: $http_body"
            (( FAIL++ )) || true
        fi
    fi
}

# ---- PGlite tests ----------------------------------------------------------

pglite_tests() {
    echo ""
    echo "── PGlite path (${BASE_URL}) ──────────────────────────────────────────"

    local DDL
    DDL='CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, price NUMERIC(10,2));
CREATE TABLE orders (id SERIAL PRIMARY KEY, product_id INTEGER REFERENCES products(id), quantity INTEGER NOT NULL);
INSERT INTO products (name, price) VALUES ('\''Widget'\'', 9.99), ('\''Gadget'\'', 19.99);
INSERT INTO orders (product_id, quantity) VALUES (1, 5), (2, 3);'

    # 1. Register DB
    post "analyze-database — valid DDL" "200" \
        "${BASE_URL}/api/database/analyze-database" \
        "$(jq -n --arg id "$PGLITE_DB_ID" --arg sql "$DDL" \
            '{connectionInfo:{type:"pglite",databaseId:$id,sqlContent:$sql}}')"

    # 2. Simple SELECT
    post "execute — SELECT *" "200" \
        "${BASE_URL}/api/query/execute" \
        "$(jq -n --arg id "$PGLITE_DB_ID" \
            '{connectionInfo:{type:"pglite",databaseId:$id},query:"SELECT * FROM products ORDER BY id"}')"

    # 3. JOIN
    post "execute — JOIN" "200" \
        "${BASE_URL}/api/query/execute" \
        "$(jq -n --arg id "$PGLITE_DB_ID" \
            '{connectionInfo:{type:"pglite",databaseId:$id},query:"SELECT p.name, o.quantity FROM products p JOIN orders o ON p.id = o.product_id ORDER BY p.id"}')"

    # 4. WHERE + filter
    post "execute — WHERE no results" "200" \
        "${BASE_URL}/api/query/execute" \
        "$(jq -n --arg id "$PGLITE_DB_ID" \
            '{connectionInfo:{type:"pglite",databaseId:$id},query:"SELECT * FROM products WHERE name = '\''NoSuchProduct'\''"}')"

    # 5. INSERT rejected
    post "execute — INSERT (expect 400 NON_SELECT)" "400" \
        "${BASE_URL}/api/query/execute" \
        "$(jq -n --arg id "$PGLITE_DB_ID" \
            '{connectionInfo:{type:"pglite",databaseId:$id},query:"INSERT INTO products (name, price) VALUES ('"'"'X'"'"', 1.0)"}')"

    # 6. DELETE rejected
    post "execute — DELETE (expect 400 NON_SELECT)" "400" \
        "${BASE_URL}/api/query/execute" \
        "$(jq -n --arg id "$PGLITE_DB_ID" \
            '{connectionInfo:{type:"pglite",databaseId:$id},query:"DELETE FROM products"}')"

    # 7. Non-existent table → 500
    post "execute — unknown table (expect 500)" "500" \
        "${BASE_URL}/api/query/execute" \
        "$(jq -n --arg id "$PGLITE_DB_ID" \
            '{connectionInfo:{type:"pglite",databaseId:$id},query:"SELECT * FROM no_such_table"}')"

    # 8. Missing sqlContent → 400
    post "analyze-database — missing sqlContent (expect 400)" "400" \
        "${BASE_URL}/api/database/analyze-database" \
        "$(jq -n --arg id "$PGLITE_DB_ID" \
            '{connectionInfo:{type:"pglite",databaseId:$id}}')"

    # 9. Missing databaseId → 400
    post "analyze-database — missing databaseId (expect 400)" "400" \
        "${BASE_URL}/api/database/analyze-database" \
        '{"connectionInfo":{"type":"pglite","sqlContent":"SELECT 1"}}'

    # 10. Unregistered databaseId → 400
    post "execute — unregistered databaseId (expect 400)" "400" \
        "${BASE_URL}/api/query/execute" \
        '{"connectionInfo":{"type":"pglite","databaseId":"__not_registered__"},"query":"SELECT 1"}'

    # 11. Re-register with different schema (replace)
    post "analyze-database — replace existing instance" "200" \
        "${BASE_URL}/api/database/analyze-database" \
        "$(jq -n --arg id "$PGLITE_DB_ID" \
            '{connectionInfo:{type:"pglite",databaseId:$id,sqlContent:"CREATE TABLE categories (id SERIAL PRIMARY KEY, label TEXT NOT NULL);"}}')"

    post "execute — query new schema after replace" "200" \
        "${BASE_URL}/api/query/execute" \
        "$(jq -n --arg id "$PGLITE_DB_ID" \
            '{connectionInfo:{type:"pglite",databaseId:$id},query:"SELECT * FROM categories"}')"
}

# ---- PostgreSQL tests (optional) -------------------------------------------

postgres_tests() {
    if [[ -z "${PG_HOST:-}" ]]; then
        echo ""
        echo "── PostgreSQL path — skipped (PG_HOST not set) ────────────────────────"
        return
    fi

    echo ""
    echo "── PostgreSQL path (${PG_HOST}:${PG_PORT:-5432}) ─────────────────────────"

    local CONN
    CONN=$(jq -n \
        --arg host "${PG_HOST}" \
        --argjson port "${PG_PORT:-5432}" \
        --arg user "${PG_USER:-postgres}" \
        --arg pass "${PG_PASSWORD:-}" \
        --arg db   "${PG_DATABASE:-postgres}" \
        --arg schema "${PG_SCHEMA:-public}" \
        '{type:"postgres",host:$host,port:$port,username:$user,password:$pass,database:$db,schema:$schema}')

    post "analyze-database — valid PG connection" "200" \
        "${BASE_URL}/api/database/analyze-database" \
        "$(jq -n --argjson conn "$CONN" '{connectionInfo:$conn}')"

    post "execute — SELECT 1" "200" \
        "${BASE_URL}/api/query/execute" \
        "$(jq -n --argjson conn "$CONN" '{connectionInfo:$conn,query:"SELECT 1 AS value"}')"

    # Prove we are actually talking to PostgreSQL (pg-specific system function)
    post_body_contains "execute — version() contains 'PostgreSQL'" "200" \
        "${BASE_URL}/api/query/execute" \
        "$(jq -n --argjson conn "$CONN" '{connectionInfo:$conn,query:"SELECT version() AS ver"}')" \
        "PostgreSQL"

    # Prove backup.sql was loaded — pg_catalog.pg_tables lists aladin-owned tables
    post_body_contains "execute — pg_tables shows backup.sql tables (angest)" "200" \
        "${BASE_URL}/api/query/execute" \
        "$(jq -n --argjson conn "$CONN" \
            '{connectionInfo:$conn,query:"SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='"'"'public'"'"' ORDER BY tablename"}')" \
        "angest"
}

# ---- main ------------------------------------------------------------------

echo "sql-assessment-service smoke tests"
echo "  BASE_URL: ${BASE_URL}"

# Wait for service to be reachable (up to 10 s)
echo -n "  Waiting for service..."
for i in $(seq 1 10); do
    if curl -sf "${BASE_URL}/api/health" >/dev/null 2>&1 || \
       curl -sf -o /dev/null -w '%{http_code}' "${BASE_URL}/" 2>/dev/null | grep -qE '^[0-9]'; then
        break
    fi
    # Try any endpoint — a 404 still means the server is up
    code=$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/api/query/execute" 2>/dev/null || true)
    if [[ "$code" =~ ^[0-9]+$ && "$code" != "000" ]]; then
        break
    fi
    echo -n "."
    sleep 1
done
echo " OK"

pglite_tests
postgres_tests

echo ""
echo "────────────────────────────────────────────────"
echo "Results: ${PASS} passed, ${FAIL} failed"
echo "────────────────────────────────────────────────"

[[ "$FAIL" -eq 0 ]]
