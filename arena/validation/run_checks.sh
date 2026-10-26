#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
node --check runtime/app.js
node --check runtime/input.js
node --test validation/input_regression.cjs
INPUT_REPORT=validation/input_integration_report.json node validation/input_integration.cjs
node validation/offline_check.cjs
node validation/movement_audit.cjs
python3 validation/check_exports.py
node validation/detail_clearance.cjs
