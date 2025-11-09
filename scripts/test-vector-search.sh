#!/bin/bash

# Test script for vector search
BASE_URL="http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main"

echo "=== Testing Vector Search Functionality ==="
echo ""

# Test 1: Search for pages (fuzzy: "homepage")
echo "1. Search for 'homepage' (should find home page):"
curl -s -X POST "$BASE_URL/search/resources" \
  -H "Content-Type: application/json" \
  -d '{"query": "homepage", "type": "page", "limit": 3}' | python3 -m json.tool
echo ""
echo ""

# Test 2: Search for sections (fuzzy: "hero")
echo "2. Search for 'hero' (should find hero section):"
curl -s -X POST "$BASE_URL/search/resources" \
  -H "Content-Type: application/json" \
  -d '{"query": "hero banner", "type": "section_def", "limit": 3}' | python3 -m json.tool
echo ""
echo ""

# Test 3: Search for collections (fuzzy: "blog")
echo "3. Search for 'blog posts' (should find blog collection):"
curl -s -X POST "$BASE_URL/search/resources" \
  -H "Content-Type: application/json" \
  -d '{"query": "blog posts", "limit": 5}' | python3 -m json.tool
echo ""
echo ""

# Test 4: Typo tolerance (fuzzy: "hom pag")
echo "4. Typo tolerance - search for 'hom pag' (should still find home page):"
curl -s -X POST "$BASE_URL/search/resources" \
  -H "Content-Type: application/json" \
  -d '{"query": "hom pag", "type": "page"}' | python3 -m json.tool
echo ""
echo ""

# Test 5: Search without type filter
echo "5. Search 'about' (should find about page):"
curl -s -X POST "$BASE_URL/search/resources" \
  -H "Content-Type: application/json" \
  -d '{"query": "about us", "limit": 3}' | python3 -m json.tool
echo ""
echo ""

echo "=== Vector Search Tests Complete ==="
