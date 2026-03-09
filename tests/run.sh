#!/bin/bash

# Simple script to run any TypeScript test in the tests directory
# Requires: tsx

if [ ! -f "package.json" ]; then
    echo "Error: Run this from the root directory of the project."
    exit 1
fi

if [ -z "$1" ]; then
    echo "Usage: ./tests/run.sh <test-file-name>"
    echo ""
    echo "Available tests:"
    ls tests/*.ts | xargs -n 1 basename
    exit 1
fi

TEST_FILE="tests/$1"

if [ ! -f "$TEST_FILE" ]; then
    # try with .ts extension if missing
    if [ -f "$TEST_FILE.ts" ]; then
        TEST_FILE="$TEST_FILE.ts"
    else
        echo "Error: Test file '$TEST_FILE' not found."
        exit 1
    fi
fi

echo "--- Executing test: $TEST_FILE ---"
npx tsx "$TEST_FILE"
echo "--- Execution finished ---"
