#!/bin/bash
# chaos-scenarios.sh
# Runs 3 chaos scenarios: API downtime, CPU exhaustion, DB freeze.
set -u
cd "$(dirname "$0")/../.."

RESULTS="results"
mkdir -p "$RESULTS"

# ─── Scenario 1: API Downtime ────────────────────────────────────────────────
echo "=== CHAOS SCENARIO 1: API DOWNTIME ==="
npx playwright test tests/auth.spec.ts --reporter=line 2>&1 | tee "$RESULTS/chaos-baseline.txt"
BASELINE_PASS=$(grep -Eo '[0-9]+ passed' "$RESULTS/chaos-baseline.txt" | head -1 | grep -Eo '[0-9]+')
BASELINE_FAIL=$(grep -Eo '[0-9]+ failed' "$RESULTS/chaos-baseline.txt" | head -1 | grep -Eo '[0-9]+' || echo 0)

START_TIME=$(date +%s)
docker stop gitea

npx playwright test tests/auth.spec.ts --reporter=line 2>&1 | tee "$RESULTS/chaos-downtime.txt"
DOWNTIME_FAIL=$(grep -Eo '[0-9]+ failed' "$RESULTS/chaos-downtime.txt" | head -1 | grep -Eo '[0-9]+' || echo 0)

docker start gitea
until curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/version | grep -q 200; do sleep 1; done
END_TIME=$(date +%s)
MTTR=$((END_TIME - START_TIME))
echo "MTTR: ${MTTR}s"
echo "MTTR_VALUE=$MTTR" > "$RESULTS/chaos-scenario1.env"
echo "BASELINE_PASS=$BASELINE_PASS" >> "$RESULTS/chaos-scenario1.env"
echo "DOWNTIME_FAIL=$DOWNTIME_FAIL" >> "$RESULTS/chaos-scenario1.env"

# ─── Scenario 2: CPU Exhaustion ──────────────────────────────────────────────
echo "=== CHAOS SCENARIO 2: CPU EXHAUSTION ==="
docker update --cpus="0.15" gitea
sleep 3
k6 run --vus 5 --duration 20s \
  --summary-export "$RESULTS/chaos-cpu-summary.json" \
  tests/performance/load-test.js 2>&1 | tee "$RESULTS/chaos-cpu-raw.txt"
docker update --cpus="0" gitea

# ─── Scenario 3: DB Freeze ──────────────────────────────────────────────────
echo "=== CHAOS SCENARIO 3: DB FREEZE ==="
START_TIME=$(date +%s)
docker pause gitea
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:8080/api/v1/version || echo "timeout")
echo "Response during freeze: $HTTP_CODE"
docker unpause gitea
until curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/version | grep -q 200; do sleep 1; done
END_TIME=$(date +%s)
RECOVERY=$((END_TIME - START_TIME))
echo "Recovery time: ${RECOVERY}s"
echo "RECOVERY_TIME=$RECOVERY" > "$RESULTS/chaos-scenario3.env"
echo "HTTP_CODE=$HTTP_CODE" >> "$RESULTS/chaos-scenario3.env"
