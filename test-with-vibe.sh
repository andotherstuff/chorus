#!/bin/bash

# Test script using vibe-tools browser commands
APP_URL="http://10.255.12.206:8080"
NSEC="nsec13ftedfg0kmrj5ka8dfn82vpelnewmrtpr7zzr9t7kdn02gq6wrzq3va5gy"

echo "🚀 Testing +chorus App with vibe-tools"
echo "====================================="
echo ""

# Create results directory
mkdir -p test-results/vibe-screenshots

# Test 1: Homepage
echo "📱 Test 1: Homepage"
vibe-tools browser open "$APP_URL" \
  --screenshot=test-results/vibe-screenshots/01-homepage.png \
  --wait="time:3s" \
  --no-headless \
  --console \
  --html > test-results/01-homepage.log 2>&1

echo "✅ Homepage tested"

# Test 2: Login Flow
echo ""
echo "🔐 Test 2: Login with nsec"
vibe-tools browser act "Click the 'Sign in' button" \
  --url="$APP_URL" \
  --screenshot=test-results/vibe-screenshots/02-login-dialog.png \
  --wait="time:2s" \
  --no-headless > test-results/02-login.log 2>&1

# Try to interact with login form
vibe-tools browser act "Click on 'Nsec' tab if visible, then enter '$NSEC' in the password field and click Login" \
  --url="current" \
  --screenshot=test-results/vibe-screenshots/03-after-login.png \
  --wait="time:5s" \
  --no-headless > test-results/03-nsec-login.log 2>&1

echo "✅ Login attempted"

# Test 3: Extract page content after login
echo ""
echo "📋 Test 3: Check logged in state"
vibe-tools browser extract "What is displayed on the page? List any navigation links, buttons, and main content areas" \
  --url="current" \
  --screenshot=test-results/vibe-screenshots/04-logged-in.png \
  --no-headless > test-results/04-page-content.log 2>&1

echo "✅ Page content extracted"

# Test 4: Navigate to groups
echo ""
echo "📂 Test 4: Navigate to Groups"
vibe-tools browser act "Click on 'Groups' link or navigate to the groups page" \
  --url="current" \
  --screenshot=test-results/vibe-screenshots/05-groups.png \
  --wait="time:3s" \
  --no-headless > test-results/05-groups.log 2>&1

echo "✅ Groups page tested"

# Test 5: Observe interactive elements
echo ""
echo "🔍 Test 5: Analyze Groups Page"
vibe-tools browser observe "List all clickable elements, forms, and interactive components on this page" \
  --url="current" \
  --screenshot=test-results/vibe-screenshots/06-groups-elements.png \
  --no-headless > test-results/06-observe.log 2>&1

echo "✅ Page elements analyzed"

echo ""
echo "📊 Test Summary"
echo "=============="
echo "Screenshots saved to: test-results/vibe-screenshots/"
echo "Logs saved to: test-results/*.log"
echo ""
echo "Review the screenshots and logs to verify:"
echo "1. Homepage loads correctly"
echo "2. Login dialog appears"
echo "3. Authentication works with nsec"
echo "4. Groups page is accessible"
echo "5. UI elements are interactive"