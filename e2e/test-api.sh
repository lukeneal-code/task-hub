#!/bin/bash

# Get token
TOKEN=$(curl -s -X POST http://localhost:8081/realms/alpha/protocol/openid-connect/token \
  -d "grant_type=password" \
  -d "client_id=taskhub-app" \
  -d "username=admin@alpha.com" \
  -d "password=password123" | jq -r ".access_token")

echo "Token obtained: ${TOKEN:0:20}..."

# Test project access
echo ""
echo "Testing project access:"
curl -s http://localhost:3002/api/projects/aaaa0001-0001-0001-0001-000000000001 \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo ""
echo "Testing task creation:"
curl -s -X POST http://localhost:3002/api/projects/aaaa0001-0001-0001-0001-000000000001/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Task"}' | jq '.'
