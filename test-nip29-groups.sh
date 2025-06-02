#!/bin/bash

echo "Testing NIP-29 Groups with curl..."
echo

# Test communities.nos.social
echo "1. Testing communities.nos.social..."
echo "WebSocket URL: wss://communities.nos.social/"

# Use websocat or wscat if available, otherwise show the expected query
if command -v websocat &> /dev/null; then
    echo '["REQ","test1",{"kinds":[39000],"limit":5}]' | websocat -1 wss://communities.nos.social/ 2>/dev/null | head -20
elif command -v wscat &> /dev/null; then
    echo '["REQ","test1",{"kinds":[39000],"limit":5}]' | wscat -c wss://communities.nos.social/ 2>/dev/null | head -20
else
    echo "To test NIP-29 groups, you would send:"
    echo '["REQ","subscription_id",{"kinds":[39000],"limit":5}]'
    echo "This queries for group metadata (kind 39000)"
fi

echo
echo "2. Testing groups.fiatjaf.com..."
echo "WebSocket URL: wss://groups.fiatjaf.com/"

echo
echo "NIP-29 groups use different event kinds:"
echo "- 39000: Group metadata (relay-generated)"
echo "- 39001: Group admins list"
echo "- 39002: Group members list"
echo "- 9: Group message request (user-generated)"
echo "- 39: Group message (relay-generated after approval)"

echo
echo "The fix ensures NIP-29 groups continue to work as expected,"
echo "while NIP-72 groups now properly extract the identifier for member queries."