#!/usr/bin/env bash
set -e

BASE_URL="${1:-http://localhost:3000}"
echo "=================================================="
echo "Running Herd Immunity Backend API Tests against: $BASE_URL"
echo "=================================================="

# Generate unique random seed so multiple runs do not collide
RAND="$(date +%s)_$RANDOM"
TEST_ID="upi://pay?pa=fraud_${RAND}@upi"
REPORTER_A="device_A_${RAND}"
REPORTER_B="device_B_${RAND}"
REPORTER_C="device_C_${RAND}"

# 1. Health check
echo -n "[1/6] Testing GET /health ... "
HEALTH=$(curl -s -f "$BASE_URL/health")
if [ "$HEALTH" = "ok" ]; then
  echo "PASSED (response: '$HEALTH')"
else
  echo "FAILED (expected 'ok', got '$HEALTH')"
  exit 1
fi

# 2. First report -> soft warning
echo -n "[2/6] Testing POST /report (1st report -> soft) ... "
RES1=$(curl -s -X POST "$BASE_URL/report" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$TEST_ID\", \"reporterId\": \"$REPORTER_A\"}")
echo "$RES1" | grep -q '"ok":true' || { echo "FAILED (no ok:true): $RES1"; exit 1; }
echo "$RES1" | grep -q '"level":"soft"' || { echo "FAILED (level is not soft): $RES1"; exit 1; }
echo "$RES1" | grep -q '"reports":1' || { echo "FAILED (reports != 1): $RES1"; exit 1; }
echo "$RES1" | grep -q '"duplicate":false' || { echo "FAILED (duplicate != false): $RES1"; exit 1; }
echo "PASSED (level: soft, reports: 1, duplicate: false)"

# 3. Same reporter again -> duplicate: true
echo -n "[3/6] Testing POST /report duplicate (same reporter again) ... "
RES2=$(curl -s -X POST "$BASE_URL/report" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$TEST_ID\", \"reporterId\": \"$REPORTER_A\"}")
echo "$RES2" | grep -q '"ok":true' || { echo "FAILED: $RES2"; exit 1; }
echo "$RES2" | grep -q '"duplicate":true' || { echo "FAILED (expected duplicate:true): $RES2"; exit 1; }
echo "$RES2" | grep -q '"reports":1' || { echo "FAILED (reports changed on duplicate): $RES2"; exit 1; }
echo "PASSED (duplicate: true, reports: 1)"

# 4. 3 different reporterIds -> hard warning
echo -n "[4/6] Testing POST /report escalation (3 unique reporters -> hard) ... "
# Reporter B
RES3=$(curl -s -X POST "$BASE_URL/report" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$TEST_ID\", \"reporterId\": \"$REPORTER_B\"}")
echo "$RES3" | grep -q '"reports":2' || { echo "FAILED (expected reports:2): $RES3"; exit 1; }
echo "$RES3" | grep -q '"level":"soft"' || { echo "FAILED (expected level:soft): $RES3"; exit 1; }

# Reporter C (Threshold 3 reached!)
RES4=$(curl -s -X POST "$BASE_URL/report" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$TEST_ID\", \"reporterId\": \"$REPORTER_C\"}")
echo "$RES4" | grep -q '"reports":3' || { echo "FAILED (expected reports:3): $RES4"; exit 1; }
echo "$RES4" | grep -q '"level":"hard"' || { echo "FAILED (expected level:hard): $RES4"; exit 1; }
echo "PASSED (escalated to hard warning with 3 reporters)"

# 5. GET /flags
echo -n "[5/6] Testing GET /flags ... "
FLAGS=$(curl -s "$BASE_URL/flags")
echo "$FLAGS" | grep -q '"level":"hard"' || { echo "FAILED: $FLAGS"; exit 1; }
echo "$FLAGS" | grep -q '"reports":3' || { echo "FAILED: $FLAGS"; exit 1; }
echo "PASSED (found active hard flag in /flags)"

# 6. Rate limiting: 6 reports from one reporter, 6th should be HTTP 429
echo -n "[6/6] Testing Rate Limit (6 reports in 60s from same reporter) ... "
SPAMMER="spammer_${RAND}"

for i in 1 2 3 4 5; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/report" \
    -H "Content-Type: application/json" \
    -d "{\"id\": \"upi://pay?pa=spam_${RAND}_${i}@upi\", \"reporterId\": \"$SPAMMER\"}")
  if [ "$STATUS" != "200" ]; then
    echo "FAILED: request $i returned unexpected HTTP status $STATUS"
    exit 1
  fi
done

# 6th request should hit rate limit
HTTP_STATUS=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/report" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"upi://pay?pa=spam_${RAND}_6@upi\", \"reporterId\": \"$SPAMMER\"}")

BODY=$(echo "$HTTP_STATUS" | sed '$d')
CODE=$(echo "$HTTP_STATUS" | tail -n1)

if [ "$CODE" = "429" ]; then
  echo "$BODY" | grep -q '"error":"rate_limited"' || { echo "FAILED (body missing rate_limited): $BODY"; exit 1; }
  echo "PASSED (6th request received HTTP 429 rate_limited)"
else
  echo "FAILED (expected HTTP 429, got $CODE, body: $BODY)"
  exit 1
fi

echo "=================================================="
echo "ALL TESTS PASSED SUCCESSFULLY!"
echo "=================================================="
