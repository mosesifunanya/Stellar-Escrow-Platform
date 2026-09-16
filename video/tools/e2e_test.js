/* End-to-end test: create + release milestone on the REAL Stellar testnet contract
   via the local backend, signing offline with the funded payer key. */
const { Transaction, Networks, rpc } = require('/workspaces/Stellar-Escrow-Platform/backend/node_modules/@stellar/stellar-sdk');
const fs = require('fs');

const API = 'http://localhost:5000';
const RPC = 'https://soroban-testnet.stellar.org';
const XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const ids = JSON.parse(fs.readFileSync('/tmp/demo-identities.json', 'utf8'));
const server = new rpc.Server(RPC);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function prepareAndSubmit(name, endpoint, body, secret) {
  const { Keypair } = require('/workspaces/Stellar-Escrow-Platform/backend/node_modules/@stellar/stellar-sdk');
  const kp = Keypair.fromSecret(secret);

  const res = await fetch(API + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const out = await res.json();
  const dataObj = typeof out.data === 'string' ? JSON.parse(out.data) : out.data;
  if (!res.ok || out.status !== 'success' || !dataObj?.tx) {
    throw new Error(`${name} prepare failed: ${JSON.stringify(out).slice(0, 300)}`);
  }
  console.log(`[${name}] prepared XDR (${dataObj.tx.length} chars)`);

  const tx = new Transaction(dataObj.tx, Networks.TESTNET);
  tx.sign(kp);
  const signed = tx.toXDR();

  const send = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: { transaction: signed } }),
  }).then((r) => r.json());

  if (send.error || !send.result || send.result.status !== 'PENDING') {
    throw new Error(`${name} send failed: ${JSON.stringify(send).slice(0, 400)}`);
  }
  const hash = send.result.hash;
  console.log(`[${name}] submitted, hash=${hash.slice(0, 16)}...`);

  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const st = await server.getTransaction(hash).catch(() => null);
    if (st && st.status !== 'NOT_FOUND') {
      console.log(`[${name}] final status: ${st.status}`);
      if (st.status !== 'SUCCESS') throw new Error(`${name} FAILED on-chain: ${JSON.stringify(st).slice(0, 400)}`);
      return hash;
    }
  }
  throw new Error(`${name} timed out waiting for confirmation`);
}

(async () => {
  // ---- CREATE ESCROW (100 XLM, 3 milestones 40/30/30, deadline +7 days) ----
  const amount = '1000000000'; // 100 XLM in stroops
  const deadline = String(Math.floor(Date.now() / 1000) + 7 * 86400);
  await prepareAndSubmit('CREATE', '/api/escrows', {
    payer: ids.payer.publicKey,
    worker: ids.worker.publicKey,
    arbiter: ids.arbiter.publicKey,
    token: XLM_SAC,
    amount,
    deadline,
    milestones: [
      { id: 1, amount: '400000000', status: 'Pending' },
      { id: 2, amount: '300000000', status: 'Pending' },
      { id: 3, amount: '300000000', status: 'Pending' },
    ],
  }, ids.payer.secret);

  // ---- VERIFY ON-CHAIN STATE ----
  const q = await fetch(`${API}/api/escrows?publicKey=${ids.payer.publicKey}`).then((r) => r.json());
  const escrows = q.data || [];
  console.log(`\n=== ESCROWS VISIBLE FOR PAYER: ${escrows.length} ===`);
  const latest = escrows[escrows.length - 1];
  console.log(JSON.stringify(latest, null, 1).slice(0, 900));

  // ---- RELEASE MILESTONE 1 ----
  await prepareAndSubmit('RELEASE-1', `/api/escrows/${latest.escrow_id || escrows.length}/release-milestone`, {
    milestoneId: 1,
    publicKey: ids.payer.publicKey,
  }, ids.payer.secret);

  const after = await fetch(`${API}/api/escrows/${escrows.length}?publicKey=${ids.payer.publicKey}`).then((r) => r.json());
  console.log('\n=== ESCROW AFTER RELEASE ===');
  console.log(JSON.stringify(after.data, null, 1).slice(0, 900));
  console.log('\nE2E TEST PASSED ✅');
})().catch((e) => { console.error('E2E TEST FAILED ❌:', e.message); process.exit(1); });
