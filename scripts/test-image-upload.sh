#!/bin/bash

# Image Upload Test Script
# Tests the complete image handling pipeline

set -e

echo "🧪 Testing Image Handling System"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_URL="http://localhost:8787"
SESSION_ID="test-session-$(date +%s)"

# Check if server is running
echo "1️⃣  Checking if server is running..."
if ! curl -s "$API_URL/health" > /dev/null; then
    echo -e "${RED}❌ Server is not running!${NC}"
    echo "   Start it with: pnpm dev"
    exit 1
fi
echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# Check if worker is needed
echo "2️⃣  Checking if Redis is running..."
if ! redis-cli ping > /dev/null 2>&1; then
    echo -e "${RED}❌ Redis is not running!${NC}"
    echo "   Start it with: brew services start redis"
    exit 1
fi
echo -e "${GREEN}✅ Redis is running${NC}"
echo ""

echo "3️⃣  Creating test image..."
# Create a simple test image (1x1 pixel PNG)
TEST_IMAGE="/tmp/test-image-$SESSION_ID.png"
# Base64 encoded 1x1 transparent PNG
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > "$TEST_IMAGE"
echo -e "${GREEN}✅ Test image created: $TEST_IMAGE${NC}"
echo ""

# Upload image
echo "4️⃣  Uploading image..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/api/upload" \
  -F "files=@$TEST_IMAGE" \
  -F "sessionId=$SESSION_ID")

echo "Response: $UPLOAD_RESPONSE"

# Extract image ID
IMAGE_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$IMAGE_ID" ]; then
    echo -e "${RED}❌ Upload failed!${NC}"
    echo "Response: $UPLOAD_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Image uploaded successfully${NC}"
echo "   Image ID: $IMAGE_ID"
echo ""

# Check status immediately
echo "5️⃣  Checking initial status..."
STATUS_RESPONSE=$(curl -s "$API_URL/api/images/$IMAGE_ID/status")
echo "Status: $STATUS_RESPONSE"
echo ""

# Wait for processing
echo "6️⃣  Waiting for background processing (10 seconds)..."
echo -e "${YELLOW}   (Worker must be running: pnpm worker:dev)${NC}"
sleep 10
echo ""

# Check final status
echo "7️⃣  Checking final status..."
FINAL_STATUS=$(curl -s "$API_URL/api/images/$IMAGE_ID/status")
echo "Status: $FINAL_STATUS"

if echo "$FINAL_STATUS" | grep -q '"status":"completed"'; then
    echo -e "${GREEN}✅ Image processing completed!${NC}"
elif echo "$FINAL_STATUS" | grep -q '"status":"processing"'; then
    echo -e "${YELLOW}⚠️  Still processing (worker may not be running)${NC}"
    echo "   Start worker with: pnpm worker:dev"
elif echo "$FINAL_STATUS" | grep -q '"status":"failed"'; then
    echo -e "${RED}❌ Processing failed!${NC}"
    echo "   Check worker logs for errors"
else
    echo -e "${YELLOW}⚠️  Unknown status${NC}"
fi
echo ""

# Test thumbnail
echo "8️⃣  Testing thumbnail endpoint..."
THUMB_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/images/$IMAGE_ID/thumbnail")
if [ "$THUMB_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Thumbnail endpoint working${NC}"
else
    echo -e "${YELLOW}⚠️  Thumbnail returned HTTP $THUMB_HTTP_CODE${NC}"
fi
echo ""

# Test details
echo "9️⃣  Testing details endpoint..."
DETAILS=$(curl -s "$API_URL/api/images/$IMAGE_ID/details")
echo "Details: $DETAILS"
echo ""

# Test conversation images
echo "🔟 Testing conversation images endpoint..."
CONV_IMAGES=$(curl -s "$API_URL/api/images/conversation/$SESSION_ID")
echo "Conversation images: $CONV_IMAGES"
echo ""

# Test search (if processing completed)
if echo "$FINAL_STATUS" | grep -q '"status":"completed"'; then
    echo "1️⃣1️⃣ Testing semantic search..."
    SEARCH_RESULTS=$(curl -s "$API_URL/api/images/search?q=test&limit=5")
    echo "Search results: $SEARCH_RESULTS"
    echo ""
fi

# Cleanup
echo "🧹 Cleaning up..."
rm -f "$TEST_IMAGE"
echo ""

echo "=================================="
echo "✅ Test completed!"
echo ""
echo "Next steps:"
echo "  1. Start worker if not running: pnpm worker:dev"
echo "  2. Upload a real image to test metadata generation"
echo "  3. Try semantic search: curl '$API_URL/api/images/search?q=your-query'"
echo ""
