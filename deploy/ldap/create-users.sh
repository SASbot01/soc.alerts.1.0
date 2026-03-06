#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# BlackWolf SOC — LDAP User Provisioning from CSV
#
# Usage:
#   ./create-users.sh users.csv [lldap-url]
#
# CSV format (with header):
#   username,email,displayName,group,password
#
# Requirements: curl, jq
# ═══════════════════════════════════════════════════════════
set -euo pipefail

CSV_FILE="${1:?Usage: $0 <users.csv> [lldap-url]}"
LLDAP_URL="${2:-http://localhost:17170}"
ADMIN_USER="${LDAP_ADMIN_USER:-admin}"
ADMIN_PASS="${LDAP_ADMIN_PASSWORD:-admin}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $*"; }
log_info() { echo -e "${YELLOW}[INFO]${NC} $*"; }

# ── Authenticate ──
log_info "Authenticating with lldap at ${LLDAP_URL}..."
TOKEN=$(curl -sf "${LLDAP_URL}/auth/simple/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}" \
    | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    log_fail "Authentication failed"
    exit 1
fi
log_ok "Authenticated"

# ── Ensure groups exist ──
ensure_group() {
    local group_name="$1"
    # Check if group exists
    local exists
    exists=$(curl -sf "${LLDAP_URL}/api/graphql" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"{ groups { id displayName } }\"}" \
        | jq -r ".data.groups[] | select(.displayName == \"${group_name}\") | .id")

    if [ -n "$exists" ]; then
        echo "$exists"
        return
    fi

    # Create group
    local result
    result=$(curl -sf "${LLDAP_URL}/api/graphql" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"mutation { createGroup(name: \\\"${group_name}\\\") { id displayName } }\",\"variables\":{}}" \
        | jq -r '.data.createGroup.id')

    if [ -n "$result" ] && [ "$result" != "null" ]; then
        log_ok "Group '${group_name}' created (id: ${result})"
        echo "$result"
    else
        log_fail "Failed to create group '${group_name}'"
        echo ""
    fi
}

# ── Process CSV ──
CREATED=0
FAILED=0
TOTAL=0

# Skip header line
tail -n +2 "$CSV_FILE" | while IFS=',' read -r username email displayName group password; do
    # Trim whitespace
    username=$(echo "$username" | xargs)
    email=$(echo "$email" | xargs)
    displayName=$(echo "$displayName" | xargs)
    group=$(echo "$group" | xargs)
    password=$(echo "$password" | xargs)

    [ -z "$username" ] && continue
    TOTAL=$((TOTAL + 1))

    log_info "Creating user: ${username} (${email})"

    # Create user via GraphQL
    CREATE_RESULT=$(curl -sf "${LLDAP_URL}/api/graphql" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{
            \"query\": \"mutation CreateUser(\$user: CreateUserInput!) { createUser(user: \$user) { id email displayName } }\",
            \"variables\": {
                \"user\": {
                    \"id\": \"${username}\",
                    \"email\": \"${email}\",
                    \"displayName\": \"${displayName}\"
                }
            }
        }" 2>&1) || true

    ERRORS=$(echo "$CREATE_RESULT" | jq -r '.errors[0].message // empty' 2>/dev/null)

    if [ -n "$ERRORS" ]; then
        log_fail "User '${username}': ${ERRORS}"
        FAILED=$((FAILED + 1))
        continue
    fi

    log_ok "User '${username}' created"
    CREATED=$((CREATED + 1))

    # Add to group
    if [ -n "$group" ]; then
        GROUP_ID=$(ensure_group "$group")
        if [ -n "$GROUP_ID" ]; then
            curl -sf "${LLDAP_URL}/api/graphql" \
                -H "Authorization: Bearer ${TOKEN}" \
                -H "Content-Type: application/json" \
                -d "{
                    \"query\": \"mutation { addUserToGroup(userId: \\\"${username}\\\", groupId: ${GROUP_ID}) { ok } }\"
                }" > /dev/null 2>&1 && \
                log_ok "  -> Added to group '${group}'" || \
                log_fail "  -> Failed to add to group '${group}'"
        fi
    fi
done

echo ""
echo "═══════════════════════════════════"
echo "  Provisioning complete"
echo "═══════════════════════════════════"
