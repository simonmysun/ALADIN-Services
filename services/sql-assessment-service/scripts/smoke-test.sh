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
#   PGLITE_DB_ID          databaseId to use  (default: smoke-db)
#
# Init-SQL-file feature (optional — tests the PGLITE_INIT_SQL_FILE / --init-sql-file feature):
#   SMOKE_TEST_INIT_SQL   Set to '1' to enable (server must be started with PGLITE_INIT_SQL_FILE
#                         pointing to a valid .sql file containing at least one table)
#   SMOKE_INIT_SQL_TABLE  A table name that exists in the configured init SQL file
#                         (default: products)  — used to verify the file was actually loaded
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

    # 8. Missing sqlContent → 400 when no init file; 200 when init file is configured
    if [[ -z "${SMOKE_TEST_INIT_SQL:-}" ]]; then
        post "analyze-database — missing sqlContent (expect 400)" "400" \
            "${BASE_URL}/api/database/analyze-database" \
            "$(jq -n --arg id "$PGLITE_DB_ID" \
                '{connectionInfo:{type:"pglite",databaseId:$id}}')"
    else
        post "analyze-database — missing sqlContent (init-file provides it, expect 200)" "200" \
            "${BASE_URL}/api/database/analyze-database" \
            "$(jq -n --arg id "$PGLITE_DB_ID" \
                '{connectionInfo:{type:"pglite",databaseId:$id}}')"
    fi

    # 9. Missing databaseId → 400
    post "analyze-database — missing databaseId (expect 400)" "400" \
        "${BASE_URL}/api/database/analyze-database" \
        '{"connectionInfo":{"type":"pglite","sqlContent":"SELECT 1"}}'

    # 10. Unregistered databaseId → 400 (only when no init-SQL file is configured,
    #     because an init file auto-initialises any unknown databaseId)
    if [[ -z "${SMOKE_TEST_INIT_SQL:-}" ]]; then
        post "execute — unregistered databaseId (expect 400)" "400" \
            "${BASE_URL}/api/query/execute" \
            '{"connectionInfo":{"type":"pglite","databaseId":"__not_registered__"},"query":"SELECT 1"}'
    else
        green "  SKIP  execute — unregistered databaseId (init-SQL-file auto-initialises any databaseId)"
    fi

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

# ---- Init-SQL-file tests (optional) ---------------------------------------

pglite_init_sql_file_tests() {
    if [[ -z "${SMOKE_TEST_INIT_SQL:-}" ]]; then
        echo ""
        echo "── PGlite init-SQL-file tests — skipped (set SMOKE_TEST_INIT_SQL=1 to enable) ─"
        return
    fi

    echo ""
    echo "── PGlite init-SQL-file feature ────────────────────────────────────────"
    echo "   (server must be started with PGLITE_INIT_SQL_FILE set to a valid file)"

    local INIT_TABLE="${SMOKE_INIT_SQL_TABLE:-products}"
    local NEW_DB="smoke-init-${RANDOM}"
    local OVERRIDE_DB="smoke-override-${RANDOM}"

    # 1. Fresh databaseId without sqlContent — init file provides the schema
    post "init-sql-file — fresh databaseId, no sqlContent (expect 200)" "200" \
        "${BASE_URL}/api/query/execute" \
        "$(jq -n --arg id "$NEW_DB" \
            '{connectionInfo:{type:"pglite",databaseId:$id},query:"SELECT 1 AS ping"}')" 

    # 2. The init-file schema is actually usable (query a known table)
    post "init-sql-file — query table from init file (expect 200)" "200" \
        "${BASE_URL}/api/query/execute" \
        "$(jq -n --arg id "$NEW_DB" --arg tbl "$INIT_TABLE" \
            '{connectionInfo:{type:"pglite",databaseId:$id},query:("SELECT * FROM "+$tbl+" LIMIT 1")}')" 

    # 3. Explicit sqlContent overrides the init file
    post "init-sql-file — explicit sqlContent takes priority (expect 200)" "200" \
        "${BASE_URL}/api/query/execute" \
        "$(jq -n --arg id "$OVERRIDE_DB" \
            '{connectionInfo:{type:"pglite",databaseId:$id,sqlContent:"CREATE TABLE override_tbl (id SERIAL PRIMARY KEY);"},query:"SELECT * FROM override_tbl"}')" 

    # 4. analyze-database without sqlContent — init file counts as the schema
    post "init-sql-file — analyze-database without sqlContent (expect 200)" "200" \
        "${BASE_URL}/api/database/analyze-database" \
        "$(jq -n --arg id "smoke-analyze-${RANDOM}" \
            '{connectionInfo:{type:"pglite",databaseId:$id}}')" 
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
pglite_init_sql_file_tests
postgres_tests

echo ""
echo "────────────────────────────────────────────────"
echo "Results: ${PASS} passed, ${FAIL} failed"
echo "────────────────────────────────────────────────"

[[ "$FAIL" -eq 0 ]]
