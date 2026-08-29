#!/bin/bash

# `-e`: means the shell will exit when any cmd fails
# `-o pipefail`: will set the return value for the program to the exit status of the last cmd
set -eo pipefail

ENV_EXAMPLE="app/src/backend/.env.example"
ENV_FILE="app/src/backend/.env"
MODE="start"

for arg in "$@"; do
	case "$arg" in
	--dev) MODE="dev" ;;
	*) warn "Unknown argument: $arg" ;;
	esac
done

cleanup() {
    set +e
    trap - INT TERM EXIT
    echo "hi"
    kill 0
}

info() { printf '\033[1;35m[info]\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$1"; }
err() { printf '\033[1;31m[error]\033[0m %s\n' "$1" >&2; }

ask_yes_no() {
	local prompt="$1" reply
	while true; do
		read -r -p "$prompt [y/N]: " reply
		case "$reply" in
		[Yy]) return 0 ;;
		[Nn] | "") return 1 ;;
		*) echo "Please answer y or n." ;;
		esac
	done
}

info "Installing dependencies..."
npm run install-deps

if ask_yes_no "Would you like to set up a local MySQL DB using Docker?"; then
	info "Checking for Docker..."
	if ! command -v docker > /dev/null 2>&1; then
		err "Docker is not installed or not on PATH."
		exit 1
	fi
	info "Checking for Docker Compose..."
	if ! docker compose version > /dev/null 2>&1; then
		err "Docker Compose is not available."
		exit 1
	fi

	if [ -f "$ENV_FILE" ]; then
		info "$ENV_FILE already exists."
	elif [ -f "$ENV_EXAMPLE" ]; then
		info "Copying $ENV_EXAMPLE to $ENV_FILE..."
		cp "$ENV_EXAMPLE" "$ENV_FILE"
	else
		warn "$ENV_EXAMPLE not found."
	fi

	info "Starting the database"
	npm run db:up

	info "Resetting the database"
	npm run db:reset

	info "Seeding the database"
	npm run db:seed
	cat << 'EOF'

Database is up.

Usage:
  Stop the database:   npm run db:down
  Delete DB entirely:  sudo docker compose down -v   (run from app/src/backend)

EOF
else
	info "Skipping local DB setup."
fi

info "Starting backend and frontend."

trap cleanup INT TERM EXIT

# Start your background processes
npm run "${MODE}:backend" &
npm run "${MODE}:frontend" &

# Wait for them to finish
wait
