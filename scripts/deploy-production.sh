#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.env}"
SERVICE="${SERVICE:-app}"
CONTAINER="${CONTAINER:-bupot_app}"
IMAGE_NAME="${BUPOT_IMAGE:-bupot-app}"
RELEASE_TAG="${1:-${BUPOT_IMAGE_TAG:-${GITHUB_SHA:-$(git rev-parse HEAD)}}}"

if [[ ! "$RELEASE_TAG" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]]; then
  echo "Invalid release image tag: $RELEASE_TAG" >&2
  exit 1
fi

compose() {
  BUPOT_IMAGE="$IMAGE_NAME" BUPOT_IMAGE_TAG="$1" \
    docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "${@:2}"
}

wait_for_health() {
  local expected_status="$1"
  local attempt health

  for attempt in {1..30}; do
    health="$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || true)"
    if [[ "$health" == "$expected_status" ]]; then
      return 0
    fi
    if [[ "$health" == "unhealthy" ]]; then
      docker logs --tail 100 "$CONTAINER" >&2 || true
      return 1
    fi
    sleep 2
  done

  docker logs --tail 100 "$CONTAINER" >&2 || true
  return 1
}

previous_image="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)"
if [[ "$previous_image" == *:* ]]; then
  previous_tag="${previous_image##*:}"
else
  previous_tag="latest"
fi
release_started=0

rollback() {
  if (( release_started == 0 )); then
    echo "Release was not started; leaving the current application untouched." >&2
    return 0
  fi

  if [[ -z "$previous_image" || "$previous_image" == "$IMAGE_NAME:$RELEASE_TAG" ]]; then
    echo "No distinct previous image available for rollback." >&2
    return 0
  fi

  echo "Rolling back to $previous_image..." >&2
  compose "$RELEASE_TAG" down --remove-orphans || true
  compose "$previous_tag" up -d --no-build --remove-orphans || true
}

trap 'rollback' ERR

echo "Validating Compose configuration..."
compose "$RELEASE_TAG" config --quiet

echo "Building $IMAGE_NAME:$RELEASE_TAG..."
compose "$RELEASE_TAG" build "$SERVICE"

echo "Applying Prisma migrations..."
compose "$RELEASE_TAG" run --rm --no-deps "$SERVICE" npx prisma migrate deploy

echo "Starting release..."
compose "$RELEASE_TAG" up -d --no-build --remove-orphans
release_started=1

echo "Waiting for container health..."
wait_for_health healthy

echo "Running smoke tests..."
curl --fail --silent --show-error --max-time 10 \
  http://127.0.0.1:3000/api/health/live >/dev/null
curl --fail --silent --show-error --max-time 10 \
  http://127.0.0.1:3000/api/health/ready >/dev/null

trap - ERR
echo "Deployment successful: $IMAGE_NAME:$RELEASE_TAG"
