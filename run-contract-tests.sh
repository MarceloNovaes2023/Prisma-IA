#!/bin/bash
cd /workspace/chats/421c3fc6b9bc8f4d4e228a70
pkill -9 -f meta-stub 2>/dev/null
sleep 1
nohup node scripts/meta-stub.cjs > /tmp/run-contract-tests-stub.log 2>&1 < /dev/null &
sleep 4
echo "=== stub listening? ==="
if netstat -tlnp 2>/dev/null | grep -q 4010; then
  echo "stub is listening on 4010"
else
  echo "stub NOT listening"
  cat /tmp/run-contract-tests-stub.log
fi
echo "=== curl check ==="
curl -s -m 5 "http://127.0.0.1:4010/v26.0/ads_archive?access_token=test-token&ad_reached_countries=BR&limit=10" | head -c 300
echo ""
echo "=== run vitest ==="
npx vitest run --reporter=verbose 2>&1 | tail -30
