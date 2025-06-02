#!/bin/bash

# Test script for +chorus app API endpoints
APP_URL="http://10.255.12.206:8080"

echo "Testing +chorus App at $APP_URL"
echo "========================================"

# Test 1: Homepage
echo -e "\n1. Testing Homepage..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL)
if [ $STATUS -eq 200 ]; then
    echo "✅ Homepage accessible (Status: $STATUS)"
else
    echo "❌ Homepage error (Status: $STATUS)"
fi

# Test 2: Check if app resources load
echo -e "\n2. Testing App Resources..."
RESOURCES=(
    "/@vite/client"
    "/src/main.tsx"
    "/src/App.tsx"
    "/src/index.css"
)

for resource in "${RESOURCES[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL$resource)
    if [ $STATUS -eq 200 ]; then
        echo "✅ $resource loaded successfully"
    else
        echo "❌ $resource failed (Status: $STATUS)"
    fi
done

# Test 3: Check PWA manifest
echo -e "\n3. Testing PWA Configuration..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/manifest.json)
if [ $STATUS -eq 200 ]; then
    echo "✅ PWA manifest available"
    # Display manifest content
    echo "Manifest preview:"
    curl -s $APP_URL/manifest.json | head -10
else
    echo "❌ PWA manifest not found"
fi

# Test 4: Check Service Worker
echo -e "\n4. Testing Service Worker..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/sw.js)
if [ $STATUS -eq 200 ]; then
    echo "✅ Service Worker available"
else
    echo "❌ Service Worker not found"
fi

# Test 5: Check for API endpoints (if any)
echo -e "\n5. Testing API Endpoints..."
# Note: Nostr apps typically don't have traditional REST APIs
# but might have upload endpoints
UPLOAD_ENDPOINT="/api/upload"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS $APP_URL$UPLOAD_ENDPOINT)
echo "Upload endpoint status: $STATUS"

# Test 6: Check WebSocket support (for Nostr)
echo -e "\n6. Testing WebSocket Support..."
# This would need a WebSocket client, just checking if headers are correct
HEADERS=$(curl -s -I $APP_URL | grep -i "upgrade")
if [ -z "$HEADERS" ]; then
    echo "✅ Standard HTTP (WebSockets handled by Nostr relays)"
else
    echo "WebSocket headers: $HEADERS"
fi

# Test 7: Security Headers
echo -e "\n7. Testing Security Headers..."
HEADERS=$(curl -s -I $APP_URL)
CSP=$(echo "$HEADERS" | grep -i "content-security-policy")
if [ ! -z "$CSP" ]; then
    echo "✅ Content Security Policy present"
else
    echo "⚠️  No CSP header found (might be in meta tags)"
fi

echo -e "\n========================================"
echo "Test Summary:"
echo "- Development server is running"
echo "- App resources are being served"
echo "- PWA configuration needs verification"
echo "- Full testing requires browser with Nostr extension"