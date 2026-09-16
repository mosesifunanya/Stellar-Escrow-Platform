/* Creates one Active escrow off-camera (no release), for the dispute scenes. */
const { Transaction, Keypair, Networks, rpc } = require('/workspaces/Stellar-Escrow-Platform/backend/node_modules/@stellar/stellar-sdk');
const fs = require('fs');

const API = 'http://localhost:5000';
const RPC = 'https://soroban-testnet.stellar.org';
const XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const ids = JSON.parse(fs.readFileSync('/tmp/demo-identities.json', 'utf8'));
const server = new rpc.Server(RPC);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const res = await fetch(API + '/api/escrows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payer: ids.payer.publicKey,
      worker: ids.worker.publicKey,
      arbiter: ids.arbiter.publicKey,
      token: XLM_SAC,
      amount: '500000000', // 50 XLM
      deadline: String(Math.floor(Date.now() / 1000) + 30 * 86400),
      milestones: [
        { id: 1, amount: '250000000', status: 'Pending' },
        { id: 2, amount: '250000000', status: 'Pending' },
      ],
    }),
  }).then((r) => r.json());

  const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  if (!data?.tx) throw new Error('prepare failed: ' + JSON.stringify(res).slice(0, 200));

  const tx = new Transaction(data.tx, Networks.TESTNET);
  tx.sign(Keypair.fromSecret(ids.payer.secret));

  const send = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: { transaction: tx.toXDR() } }),
  }).then((r) => r.json());

  if (!send.result || send.result.status !== 'PENDING') throw new Error('send failed: ' + JSON.stringify(send).slice(0, 300));

  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const st = await server.getTransaction(send.result.hash).catch(() => null);
    if (st && st.status !== 'NOT_FOUND') {
      console.log('escrow #12 created, status:', st.status);
      if (st.status !== 'SUCCESS') process.exit(1);
      return;
    }
  }
  throw new Error('timeout');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
