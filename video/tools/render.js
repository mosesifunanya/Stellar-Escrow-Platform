/* Master video renderer: TTS voice-over + scenes + fades + music bed + final mux.
   Produces video/out/stellarchain_pitch.mp4 (1080p30) */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FF = process.env.HOME + '/.python/current/lib/python3.14/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';
const V = '/workspaces/Stellar-Escrow-Platform/video';
const REC = `${V}/recordings`, ASSETS = `${V}/assets`, SC = `${V}/scenes`, OUT = `${V}/out`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scvid-'));

const run = (args, quiet = true) => {
  const r = spawnSync(FF, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('FFMPEG FAIL: ' + (r.stderr || '').split('\n').slice(-6).join('\n'));
  return r;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- scenes: narration + visual ---------- */
const scenes = [
  { id: 's01', dur: 9, src: `${ASSETS}/panel_title.png`, motion: 'zoomin' },
  { id: 's02', dur: 13, src: `${ASSETS}/panel_problem.png`, motion: 'static' },
  { id: 's03', dur: 10, src: `${ASSETS}/panel_solution.png`, motion: 'static' },
  { id: 's04', dur: 12, src: `${ASSETS}/panel_architecture.png`, motion: 'slowzoom' },
  { id: 's05', dur: 12, src: `${REC}/tour.webm`, motion: 'video' },
  { id: 's06', dur: 17, src: `${REC}/create.webm`, motion: 'video' },
  { id: 's07', dur: 11, src: `${ASSETS}/panel_code.png`, motion: 'static' },
  { id: 's08', dur: 8, src: `${REC}/act.webm`, motion: 'video' },
  { id: 's09', dur: 9, src: `${REC}/refund.webm`, motion: 'video' },
  { id: 's10', dur: 7, src: `${REC}/dispute.webm`, motion: 'video' },
  { id: 's11', dur: 9, src: `${REC}/arbiter.webm`, motion: 'video' },
  { id: 's12', dur: 8, src: `${ASSETS}/panel_why.png`, motion: 'static' },
  { id: 's13', dur: 9, src: `${ASSETS}/panel_tests.png`, motion: 'static' },
  { id: 's14', dur: 10, src: `${ASSETS}/panel_end.png`, motion: 'zoomin' },
];

const narration = {
  s01: `Every deal between strangers starts with one question: who goes first?`,
  s02: `Traditional escrow answers that with a company. It holds your money, decides when you get paid, and you just trust their numbers.`,
  s03: `StellarChain moves that trust into code. A smart contract, not a company, holds the funds and enforces the deal.`,
  s04: `A React frontend. A TypeScript backend that prepares each transaction. And the Soroban contract on Stellar: the single source of truth for every escrow.`,
  s05: `And it's live on testnet right now. Every escrow you're part of: amounts, milestones, deadlines, at a glance.`,
  s06: `Creating one takes under a minute. Worker, arbiter, amount, milestones, deadline, then sign. This is a real transaction, settled on-chain in about twenty seconds.`,
  s07: `Under the hood, a Rust contract enforces everything. Releases require the payer's signature, and only the contract can move the money.`,
  s08: `Work gets paid as it ships. Release the last milestone, and the escrow completes itself.`,
  s09: `Missed deadline? The payer pulls the remaining funds back, enforced on-chain.`,
  s10: `Something goes wrong? Open a dispute, on-chain.`,
  s11: `The arbiter settles it either way. Here the worker wins, and the contract pays instantly.`,
  s12: `Why Stellar? Five second settlement, fractions of a cent, full Rust programmability.`,
  s13: `And it's engineered: fifteen tests cover every state transition, from deposit to refund.`,
  s14: `StellarChain. Escrow without the middleman. Try it live today.`,
};

/* ---------- 1. TTS ---------- */
async function tts() {
  const { execSync } = require('child_process');
  for (const s of scenes) {
    const mp3 = `${TMP}/${s.id}.mp3`;
    const text = narration[s.id].replace(/'/g, "");
    execSync(`python3 -m edge_tts --voice en-US-AndrewMultilingualNeural --text "${text}" --write-media ${mp3}`, { stdio: 'pipe', timeout: 120000 });
    s.voice = mp3;
    console.log('tts', s.id);
  }
}

/* ---------- 2. normalize voice to wav 48k stereo ---------- */
function normAudio(s) {
  const wav = `${TMP}/${s.id}_v.wav`;
  run(['-y', '-i', s.voice, '-ar', '48000', '-ac', '2', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', wav]);
  const dur = parseFloat(run(['-i', wav, '-f', 'null', '-'], false).stderr.match(/time=(\d+:\d+:[\d.]+)/)?.[1]?.split(':').reduce((a, t) => a * 60 + parseFloat(t), 0) || '0');
  s.vdur = dur;
  // auto-fit: scene must be at least voice + lead/tail, and at least the planned minimum
  s.min = s.dur;
  s.wav = wav;
  return dur;
}

/* ---------- 3. scene video (motion + baked narration) ---------- */
function scene(s) {
  const out = `${SC}/${s.id}.mp4`;
  const lead = 0.35, tail = 0.65;
  const dur = Math.max(s.min || s.dur, s.vdur + lead + tail);
  s.dur = dur;

  let vf;
  if (s.motion === 'zoomin') vf = "scale=2304:1296,zoompan=z='min(1.0+0.10*on/(30*10),1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=360:s=1920x1080:fps=30";
  else if (s.motion === 'slowzoom') vf = "scale=2112:1188,zoompan=z='min(1.0+0.05*on/(30*10),1.05)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=360:s=1920x1080:fps=30";
  else vf = 'scale=1920:1080,setsar=1';

  const input = ['-loop', '1', '-t', String(dur), '-r', '30', '-i', s.src];
  if (s.motion === 'video') input.splice(0, input.length, '-stream_loop', '-1', '-i', s.src);
  const pad = s.motion === 'video'
    ? ['--', '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b0d12,setsar=1,fps=30']
    : ['-vf', vf, '-t', String(dur)];

  // audio: 0.45s silence + voice + silence tail, padded to scene dur
  const afilter = `aevalsrc=0:d=0.45:s=48000,volume=0[s0];[${'2:a'}]anull[a1];[s0][a1]concat=n=2:v=0:a=1[lead];` +
    `[lead]apad=whole_dur=${dur}[aout]`;

  run([
    '-y', ...input, '-i', s.wav,
    '-filter_complex', `[1:a]adelay=450|450,apad,atrim=0:${dur},aformat=sample_rates=48000:channel_layouts=stereo[aout]`,
    '-map', '0:v', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-t', String(dur), out,
  ]);
  s.file = out;
}

/* ---------- 4. concat + music bed + final ---------- */
function finalize() {
  const list = `${TMP}/list.txt`;
  fs.writeFileSync(list, scenes.map((s) => `file '${s.file}'`).join('\n'));
  const concat = `${TMP}/concat.mp4`;
  run(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', concat]);

  // royalty-free ambient bed via synthesized pad chord (generated locally)
  const bed = `${TMP}/bed.wav`;
  run(['-y', '-f', 'lavfi', '-i', 'sine=frequency=110:duration=270', '-f', 'lavfi', '-i', 'sine=frequency=165:duration=270',
    '-filter_complex', '[0:a][1:a]amix=inputs=2,lowpass=f=200,volume=0.05,afade=t=in:st=0:d=4,afade=t=out:st=262:d=8', bed]);

  const total = scenes.reduce((a, s) => a + s.dur, 0);
  const final = `${OUT}/stellarchain_pitch.mp4`;
  run(['-y', '-i', concat, '-i', bed,
    '-filter_complex', `[0:a]volume=1.0[va];[1:a]atrim=0:${total.toFixed(2)},volume=0.16[m];[va][m]amix=inputs=2:duration=first:dropout_transition=3[aout]`,
    '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', final]);

  const sz = (fs.statSync(final).size / 1048576).toFixed(1);
  console.log(`\nDONE: ${final}  (${(total / 60).toFixed(1)} min, ${sz} MB)`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(SC, { recursive: true });
  console.log('== 1/4 TTS ==');
  await tts();
  console.log('== 2/4 normalize ==');
  for (const s of scenes) normAudio(s);
  console.log('== 3/4 scenes ==');
  for (const s of scenes) { scene(s); console.log('scene', s.id, s.dur.toFixed(1) + 's'); }
  console.log('== 4/4 final ==');
  finalize();
})().catch((e) => { console.error('RENDER FAILED:', String(e).slice(0, 600)); process.exit(1); });
