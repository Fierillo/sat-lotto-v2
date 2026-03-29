#!/bin/bash
# Usage: ./run.sh <test_name>
# Example: ./run.sh test-nwc-connection

TEST_NAME=$1
TEST_DIR="$(dirname "$0")"

if [ -z "$TEST_NAME" ]; then
    echo "Usage: $0 <test_name>"
    echo "Available tests in $TEST_DIR:"
    ls "$TEST_DIR"/*.ts 2>/dev/null | xargs -n1 basename | sed 's/\.ts$//'
    exit 1
fi

TEST_FILE="$TEST_DIR/${TEST_NAME}.ts"

if [ ! -f "$TEST_FILE" ]; then
    echo "Error: Test '$TEST_NAME' not found at $TEST_FILE"
    exit 1
fi

echo "Running $TEST_NAME..."
npx tsx "$TEST_FILE"
