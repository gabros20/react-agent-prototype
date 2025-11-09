#!/bin/bash

# Test script for API endpoints
BASE_URL="http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main"

echo "=== Testing CMS API Endpoints ==="
echo ""

# Health check
echo "1. Health Check:"
curl -s http://localhost:8787/health | python3 -m json.tool
echo ""
echo ""

# List pages
echo "2. List Pages:"
curl -s "$BASE_URL/pages" | python3 -m json.tool
echo ""
echo ""

# Get home page with contents
echo "3. Get Home Page (with sections):"
curl -s "$BASE_URL/pages/home/contents" | python3 -m json.tool
echo ""
echo ""

# List section definitions
echo "4. List Section Definitions:"
curl -s "$BASE_URL/sections" | python3 -m json.tool | head -30
echo ""
echo ""

# List collections
echo "5. List Collections:"
curl -s "$BASE_URL/collections" | python3 -m json.tool
echo ""
echo ""

# Create a new page
echo "6. Create New Page (about):"
curl -s -X POST "$BASE_URL/pages" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "About Us",
    "slug": "about",
    "indexing": true,
    "meta": {"title": "About Us", "description": "Learn about our company"}
  }' | python3 -m json.tool
echo ""
echo ""

# List pages again to see the new one
echo "7. List Pages (should show new about page):"
curl -s "$BASE_URL/pages" | python3 -m json.tool
echo ""
echo ""

echo "=== API Tests Complete ===" 
