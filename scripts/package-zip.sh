#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

npm run build

VERSION=$(node -p "require('./public/manifest.json').version")
OUTPUT="bombom-arcade-v${VERSION}.zip"
rm -f "$OUTPUT"

cd dist
zip -r "../$OUTPUT" . \
  -x "*.map" \
  -x ".DS_Store" \
  -x "*/.DS_Store" \
  -x "Thumbs.db" \
  -x "*/Thumbs.db"

cd "$PROJECT_DIR"
echo "Packaged: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
