async function main() {
  const RPC = 'https://sepolia.base.org';
  const STAKING = '0xf1F2A60EdD2110a42F5Ec9d760348C0fB4Bc1659';
  const UPPER = '0xbd7928a836c9d7eaa5fbeeb0c1ba9f2fb4c852f3';
  const topic0 = '0xe07f61c526a4ace6d1e5cad0a84eddbf8e2733ce8383b0b2f1d76f07fb1cab49';
  const topic1 = '0x000000000000000000000000' + UPPER.slice(2);
  const CHUNK = 1990;
  const DEPLOY = 0x28bc000;

  const blkRes = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'eth_blockNumber', params: [] }) });
  const latest = parseInt((await blkRes.json()).result, 16);
  console.log('当前区块:', latest, '部署区块:', DEPLOY, '总共需查:', Math.ceil((latest - DEPLOY) / CHUNK), '段');

  let sum = 0n;
  let totalLogs = 0;
  for (let from = DEPLOY; from <= latest; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, latest);
    const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: from, method: 'eth_getLogs',
        params: [{ address: STAKING, topics: [topic0, topic1],
          fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) }] }) });
    const json = await res.json();
    if (json.error) { console.log('error at', from, json.error); continue; }
    const logs: { data: string }[] = json.result ?? [];
    totalLogs += logs.length;
    for (const l of logs) { if (l.data && l.data !== '0x') sum += BigInt(l.data); }
  }
  console.log('找到日志数:', totalLogs);
  console.log('0xbd79 累计团队奖励:', (Number(sum)/1e18).toFixed(6), 'VVV');
}
main().catch(console.error);
