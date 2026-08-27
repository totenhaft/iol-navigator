/* ------------------------------------------------------------------
   QR 코드 생성 — 바이트 모드 · 오류정정 레벨 M · 버전 1~10

   이 앱은 외부 스크립트를 전혀 불러오지 않는 단일 HTML 파일이므로
   QR 라이브러리를 쓸 수 없어 직접 구현했습니다.

   검증: test/qr.test.mjs 가 파이썬 segno 라이브러리가 만든 모듈 행렬과
   한 칸씩 비교합니다. 한 칸이라도 다르면 테스트가 실패합니다.
   ------------------------------------------------------------------ */

/* 버전별 블록 구조 (오류정정 M)
   ec = 블록당 오류정정 코드워드 수, g1/d1 = 1군 블록수/블록당 데이터 코드워드 */
const QR_M = {
  1:{ec:10,g1:1,d1:16,g2:0,d2:0},   2:{ec:16,g1:1,d1:28,g2:0,d2:0},
  3:{ec:26,g1:1,d1:44,g2:0,d2:0},   4:{ec:18,g1:2,d1:32,g2:0,d2:0},
  5:{ec:24,g1:2,d1:43,g2:0,d2:0},   6:{ec:16,g1:4,d1:27,g2:0,d2:0},
  7:{ec:18,g1:4,d1:31,g2:0,d2:0},   8:{ec:22,g1:2,d1:38,g2:2,d2:39},
  9:{ec:22,g1:3,d1:36,g2:2,d2:37}, 10:{ec:26,g1:4,d1:43,g2:1,d2:44},
};
/* 정렬 패턴 중심 좌표 */
const QR_ALIGN = {
  1:[], 2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30],
  6:[6,34], 7:[6,22,38], 8:[6,24,42], 9:[6,26,46], 10:[6,28,50],
};
/* 데이터 뒤에 붙는 나머지 비트 */
const QR_REMAINDER = {1:0,2:7,3:7,4:7,5:7,6:7,7:0,8:0,9:0,10:0};

/* ---- GF(256) 산술 ---- */
const GF_EXP = new Uint8Array(512), GF_LOG = new Uint8Array(256);
(function(){
  let x = 1;
  for (let i = 0; i < 255; i++){ GF_EXP[i] = x; GF_LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();
const gfMul = (a,b) => (a === 0 || b === 0) ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];

function rsGenPoly(n){
  let p = [1];
  for (let i = 0; i < n; i++){
    const q = new Array(p.length + 1).fill(0);
    for (let j = 0; j < p.length; j++){
      q[j]     ^= p[j];
      q[j + 1] ^= gfMul(p[j], GF_EXP[i]);
    }
    p = q;
  }
  return p;
}
function rsEncode(data, ecLen){
  const gen = rsGenPoly(ecLen);
  const buf = new Uint8Array(data.length + ecLen);
  buf.set(data);
  for (let i = 0; i < data.length; i++){
    const c = buf[i];
    if (!c) continue;
    for (let j = 0; j < gen.length; j++) buf[i + j] ^= gfMul(gen[j], c);
  }
  return Array.from(buf.slice(data.length));
}

/* ---- BCH (형식정보 · 버전정보) ---- */
function bchDigit(v){ let d = 0; while (v !== 0){ d++; v >>>= 1; } return d; }
/* 형식정보 15비트: (EC 2비트 + 마스크 3비트) + BCH(15,5), 0x5412 로 XOR */
function bch15(data){
  let d = data << 10;
  while (bchDigit(d) - bchDigit(0x537) >= 0) d ^= (0x537 << (bchDigit(d) - bchDigit(0x537)));
  return ((data << 10) | d) ^ 0x5412;
}
/* 버전정보 18비트 (버전 7 이상) */
function bch18(data){
  let d = data << 12;
  while (bchDigit(d) - bchDigit(0x1f25) >= 0) d ^= (0x1f25 << (bchDigit(d) - bchDigit(0x1f25)));
  return (data << 12) | d;
}

/* ---- 마스크 ---- */
const QR_MASKS = [
  (r,c) => (r + c) % 2 === 0,
  (r,c) => r % 2 === 0,
  (r,c) => c % 3 === 0,
  (r,c) => (r + c) % 3 === 0,
  (r,c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r,c) => (r * c) % 2 + (r * c) % 3 === 0,
  (r,c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
  (r,c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
];

/* ---- 본체 ---- */
function qrEncode(text){
  const bytes = Array.from(new TextEncoder().encode(text));

  let ver = 0;
  for (let v = 1; v <= 10; v++){
    const s = QR_M[v];
    const dataCw = s.g1 * s.d1 + s.g2 * s.d2;
    const need = 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
    if (need <= dataCw * 8){ ver = v; break; }
  }
  if (!ver) throw new Error("QR: 내용이 너무 깁니다 (버전 10 초과)");

  const spec = QR_M[ver];
  const dataCw = spec.g1 * spec.d1 + spec.g2 * spec.d2;

  /* 비트열 구성 */
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4);                       // 바이트 모드
  push(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach(b => push(b, 8));
  for (let i = 0; i < 4 && bits.length < dataCw * 8; i++) bits.push(0);   // 종단자
  while (bits.length % 8) bits.push(0);
  const pads = [0xEC, 0x11];
  for (let i = 0; bits.length < dataCw * 8; i++) push(pads[i % 2], 8);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8){
    let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    codewords.push(b);
  }

  /* 블록 분할 → 오류정정 → 인터리브 */
  const blocks = [];
  let p = 0;
  for (let i = 0; i < spec.g1; i++){ blocks.push(codewords.slice(p, p + spec.d1)); p += spec.d1; }
  for (let i = 0; i < spec.g2; i++){ blocks.push(codewords.slice(p, p + spec.d2)); p += spec.d2; }
  const ecBlocks = blocks.map(b => rsEncode(Uint8Array.from(b), spec.ec));

  const finalCw = [];
  const maxData = Math.max(...blocks.map(b => b.length));
  for (let i = 0; i < maxData; i++) blocks.forEach(b => { if (i < b.length) finalCw.push(b[i]); });
  for (let i = 0; i < spec.ec; i++) ecBlocks.forEach(b => finalCw.push(b[i]));

  const finalBits = [];
  finalCw.forEach(b => { for (let i = 7; i >= 0; i--) finalBits.push((b >>> i) & 1); });
  for (let i = 0; i < QR_REMAINDER[ver]; i++) finalBits.push(0);

  /* 행렬 배치 */
  const size = ver * 4 + 17;
  const m = Array.from({length:size}, () => new Int8Array(size).fill(-1));
  const fn = Array.from({length:size}, () => new Uint8Array(size));   // 기능 패턴 표시
  const set = (r,c,v) => { m[r][c] = v; fn[r][c] = 1; };

  const finder = (r0,c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++){
      const r1 = r0 + r, c1 = c0 + c;
      if (r1 < 0 || c1 < 0 || r1 >= size || c1 >= size) continue;
      const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      set(r1, c1, (inRing || inCore) ? 1 : 0);
    }
  };
  finder(0,0); finder(0,size-7); finder(size-7,0);

  for (let i = 8; i < size - 8; i++){ set(6, i, i % 2 === 0 ? 1 : 0); set(i, 6, i % 2 === 0 ? 1 : 0); }

  const centers = QR_ALIGN[ver];
  centers.forEach(r0 => centers.forEach(c0 => {
    if ((r0 === 6 && c0 === 6) || (r0 === 6 && c0 === size - 7) || (r0 === size - 7 && c0 === 6)) return;
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++)
      set(r0 + r, c0 + c, (Math.max(Math.abs(r), Math.abs(c)) !== 1) ? 1 : 0);
  }));

  set(size - 8, 8, 1);                                   // 항상 검은 모듈

  for (let i = 0; i < 9; i++){                           // 형식정보 자리 예약
    if (m[8][i] === -1) set(8, i, 0);
    if (m[i][8] === -1) set(i, 8, 0);
  }
  for (let i = 0; i < 8; i++){
    if (m[8][size-1-i] === -1) set(8, size-1-i, 0);
    if (m[size-1-i][8] === -1) set(size-1-i, 8, 0);
  }
  if (ver >= 7){
    const vb = bch18(ver);
    for (let i = 0; i < 18; i++){
      const bit = (vb >>> i) & 1;
      set(Math.floor(i / 3), size - 11 + (i % 3), bit);
      set(size - 11 + (i % 3), Math.floor(i / 3), bit);
    }
  }

  /* 데이터 지그재그 배치 */
  let bi = 0, up = true;
  for (let col = size - 1; col > 0; col -= 2){
    if (col === 6) col--;                                 // 타이밍 열 건너뜀
    for (let n = 0; n < size; n++){
      const row = up ? size - 1 - n : n;
      for (const c of [col, col - 1]){
        if (fn[row][c]) continue;
        m[row][c] = bi < finalBits.length ? finalBits[bi] : 0;
        bi++;
      }
    }
    up = !up;
  }

  /* 마스크 선택 */
  let best = null, bestPenalty = Infinity;
  for (let k = 0; k < 8; k++){
    const cand = m.map(row => Int8Array.from(row));
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
      if (!fn[r][c] && QR_MASKS[k](r,c)) cand[r][c] ^= 1;
    applyFormat(cand, k, size);
    const pen = penalty(cand, size);
    if (pen < bestPenalty){ bestPenalty = pen; best = cand; }
  }
  return best.map(row => Array.from(row));
}

/* 형식정보 배치 — 비트 0(LSB)이 좌상단 세로줄 맨 위, 그리고 우상단 가로줄 맨 오른쪽.
   이 대응을 뒤집으면 QR 이 전혀 읽히지 않습니다 (크기는 같아서 눈으로는 구분되지 않음). */
function applyFormat(mat, maskIdx, size){
  const f = bch15((0b00 << 3) | maskIdx);          // 0b00 = 오류정정 레벨 M
  for (let i = 0; i < 15; i++){
    const bit = (f >>> i) & 1;
    if (i < 6)       mat[i][8] = bit;              // 세로줄 (좌상단)
    else if (i < 8)  mat[i + 1][8] = bit;
    else             mat[size - 15 + i][8] = bit;  // 세로줄 (좌하단)
    if (i < 8)       mat[8][size - 1 - i] = bit;   // 가로줄 (우상단)
    else if (i === 8) mat[8][7] = bit;
    else             mat[8][14 - i] = bit;         // 가로줄 (좌상단)
  }
  mat[size - 8][8] = 1;
}

function penalty(mat, size){
  let score = 0;
  // 규칙 1 — 같은 색 5칸 이상 연속
  for (let i = 0; i < size; i++){
    for (const line of [mat[i], mat.map(r => r[i])]){
      let run = 1;
      for (let j = 1; j < size; j++){
        if (line[j] === line[j-1]) run++;
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }
  }
  // 규칙 2 — 2×2 동색 블록
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++){
    const v = mat[r][c];
    if (v === mat[r][c+1] && v === mat[r+1][c] && v === mat[r+1][c+1]) score += 3;
  }
  // 규칙 3 — 1:1:3:1:1 패턴
  const pat1 = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
  const match = (line, i, pat) => pat.every((v,k) => line[i+k] === v);
  for (let i = 0; i < size; i++){
    const row = Array.from(mat[i]), col = mat.map(r => r[i]);
    for (const line of [row, col])
      for (let j = 0; j + 11 <= size; j++)
        if (match(line, j, pat1) || match(line, j, pat2)) score += 40;
  }
  // 규칙 4 — 검은 모듈 비율
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += mat[r][c];
  const pct = dark * 100 / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/* 행렬 → SVG 문자열 (여백 4모듈, 인쇄 시에도 대비 유지) */
function qrSvg(text, px){
  const m = qrEncode(text);
  const n = m.length, q = 4, total = n + q * 2;
  let d = "";
  for (let r = 0; r < n; r++){
    let c = 0;
    while (c < n){
      if (!m[r][c]){ c++; continue; }
      let w = 1;
      while (c + w < n && m[r][c + w]) w++;
      d += `M${c + q} ${r + q}h${w}v1h-${w}z`;
      c += w;
    }
  }
  const size = px || 168;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" role="img" shape-rendering="crispEdges">`
       + `<rect width="${total}" height="${total}" fill="#ffffff"/>`
       + `<path d="${d}" fill="#000000"/></svg>`;
}
