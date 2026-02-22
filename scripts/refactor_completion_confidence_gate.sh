#!/usr/bin/env bash
set -euo pipefail

# Refactor Completion Confidence Gate
# Required threshold: 84.7%
#
# Scoring weights:
# - Testing evidence: 40%
# - Code review evidence: 30%
# - Logical inspection evidence: 30%

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVID_DIR="${ROOT}/evidence"
OUT="${EVID_DIR}/confidence_report.json"

mkdir -p "${EVID_DIR}"

require_file() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    echo "ERROR: Missing required evidence file: $f" >&2
    exit 2
  fi
}

require_file "${EVID_DIR}/testing.json"
require_file "${EVID_DIR}/code_review.json"
require_file "${EVID_DIR}/logical_inspection.json"

score_from_json() {
  local key="$1"
  local file="$2"
  python3 - <<PY
import json,sys
p=json.load(open("${file}"))
v=p.get("${key}", None)
if v is None:
  print("MISSING")
  sys.exit(3)
if not isinstance(v,(int,float)):
  print("INVALID")
  sys.exit(4)
print(float(v))
PY
}

TESTING="$(score_from_json score "${EVID_DIR}/testing.json")"
CODE_REVIEW="$(score_from_json score "${EVID_DIR}/code_review.json")"
LOGICAL="$(score_from_json score "${EVID_DIR}/logical_inspection.json")"

if [[ "$TESTING" == "MISSING" || "$CODE_REVIEW" == "MISSING" || "$LOGICAL" == "MISSING" ]]; then
  echo "ERROR: One of the evidence files is missing score fields." >&2
  exit 3
fi

CONFIDENCE="$(python3 - <<PY
t=${TESTING}
c=${CODE_REVIEW}
l=${LOGICAL}
conf=0.40*t + 0.30*c + 0.30*l
print(f"{conf:.2f}")
PY
)"

THRESH="84.70"

python3 - <<PY
import json
out={
  "testing_score": float("${TESTING}"),
  "code_review_score": float("${CODE_REVIEW}"),
  "logical_inspection_score": float("${LOGICAL}"),
  "confidence": float("${CONFIDENCE}"),
  "threshold": float("${THRESH}")
}
open("${OUT}","w").write(json.dumps(out, indent=2))
print(json.dumps(out, indent=2))
PY

PASS="$(python3 - <<PY
conf=float("${CONFIDENCE}")
thr=float("${THRESH}")
print("true" if conf>=thr else "false")
PY
)"

if [[ "${PASS}" != "true" ]]; then
  echo "FAIL: Refactor Completion Confidence Gate failed (${CONFIDENCE}% < ${THRESH}%)" >&2
  echo "See: ${OUT}" >&2
  exit 1
fi

echo "PASS: Refactor Completion Confidence Gate (${CONFIDENCE}% >= ${THRESH}%)"
echo "Report: ${OUT}"
