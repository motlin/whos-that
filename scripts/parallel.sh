#!/usr/bin/env bash

set -uo pipefail

# Runs each argument as a shell command, all at the same time. Prints each command's output whole, in argument order,
# so the logs never interleave, and fails when any command failed.

out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT

commands=("$@")
pids=()
for i in "${!commands[@]}"; do
	bash -c "${commands[$i]}" >"$out/$i" 2>&1 &
	pids[i]=$!
done

status=0
for i in "${!commands[@]}"; do
	if wait "${pids[$i]}"; then
		echo "=== ✓ ${commands[$i]}"
	else
		status=1
		echo "=== ✗ ${commands[$i]}"
	fi
	cat "$out/$i"
done
exit "$status"
