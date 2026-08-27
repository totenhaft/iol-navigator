/** QR 코드 검증 — 만든 심볼을 '독립적으로 다시 읽어' 원문이 나오는지 봅니다.
 *
 *  왜 이렇게까지 하는가: QR 은 눈으로 보면 다 그럴듯해 보입니다. 형식정보의
 *  비트 순서를 뒤집어도 크기와 무늬는 그대로이고, 스캔해 봐야 비로소 안 읽힙니다.
 *  그래서 아래 디코더는 인코더의 코드를 쓰지 않고 규격에서 다시 구현했으며,
 *  리드-솔로몬은 '나눗셈'(인코더)이 아니라 '대입'(신드롬)으로 검사합니다.
 *
 *  검사 항목
 *    1) 형식정보 두 벌이 서로 일치하고 BCH 검사를 통과하는가
 *    2) 각 블록의 리드-솔로몬 신드롬이 0 인가 (= 오류정정 부호가 유효한가)
 *    3) 마스크를 벗기고 지그재그로 읽으면 원문이 그대로 나오는가
 *    4) 고정 입력에 대한 결과가 예전과 같은가 (골든 행렬)
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const qrSrc = readFileSync(resolve(root, "src/js/06-qr.js"), "utf8");
const qrEncode = new Function(qrSrc + "\n; return qrEncode;")();

/* ---- 규격 표 (인코더와 별개로 여기 다시 적습니다) ---- */
const SPEC_M = {
  1:{ec:10,b:[[1,16]]},          2:{ec:16,b:[[1,28]]},
  3:{ec:26,b:[[1,44]]},          4:{ec:18,b:[[2,32]]},
  5:{ec:24,b:[[2,43]]},          6:{ec:16,b:[[4,27]]},
  7:{ec:18,b:[[4,31]]},          8:{ec:22,b:[[2,38],[2,39]]},
  9:{ec:22,b:[[3,36],[2,37]]},  10:{ec:26,b:[[4,43],[1,44]]},
};
const ALIGN = {1:[],2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50]};

const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
{ let x = 1; for (let i=0;i<255;i++){ EXP[i]=x; LOG[x]=i; x<<=1; if (x&0x100) x^=0x11d; }
  for (let i=255;i<512;i++) EXP[i]=EXP[i-255]; }
const mul = (a,b) => (a===0||b===0) ? 0 : EXP[LOG[a]+LOG[b]];

const MASKS = [
  (r,c)=>(r+c)%2===0, (r,c)=>r%2===0, (r,c)=>c%3===0, (r,c)=>(r+c)%3===0,
  (r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0,
  (r,c)=>(r*c)%2+(r*c)%3===0, (r,c)=>((r*c)%2+(r*c)%3)%2===0, (r,c)=>((r+c)%2+(r*c)%3)%2===0,
];

/* 기능 패턴 위치 지도 — 데이터가 놓이지 않는 칸 */
function functionMap(ver){
  const size = ver*4+17;
  const f = Array.from({length:size}, () => new Uint8Array(size));
  const box = (r0,c0,h,w) => { for(let r=r0;r<r0+h;r++) for(let c=c0;c<c0+w;c++)
    if (r>=0&&c>=0&&r<size&&c<size) f[r][c]=1; };
  box(0,0,9,9); box(0,size-8,9,8); box(size-8,0,8,9);          // 파인더 + 구분자 + 형식정보
  for (let i=0;i<size;i++){ f[6][i]=1; f[i][6]=1; }             // 타이밍
  const ctr = ALIGN[ver];
  ctr.forEach(r0 => ctr.forEach(c0 => {
    if ((r0===6&&c0===6)||(r0===6&&c0===size-7)||(r0===size-7&&c0===6)) return;
    box(r0-2,c0-2,5,5);
  }));
  if (ver>=7){ box(0,size-11,6,3); box(size-11,0,3,6); }        // 버전정보
  return f;
}

/* 형식정보 15비트를 읽고 BCH 로 검산 */
function readFormat(m, size){
  const bitsAt = pos => pos.reduce((v,[r,c],i) => v | (m[r][c] << i), 0);
  const a = [], b = [];
  for (let i=0;i<15;i++){
    a.push(i<6 ? [i,8] : i<8 ? [i+1,8] : [size-15+i,8]);
    b.push(i<8 ? [8,size-1-i] : i===8 ? [8,7] : [8,14-i]);
  }
  const fa = bitsAt(a), fb = bitsAt(b);
  if (fa !== fb) throw new Error("형식정보 두 벌이 다릅니다");
  const raw = fa ^ 0x5412;
  // BCH(15,5) 나머지가 0 이어야 유효
  let v = raw, deg = x => { let d=0; while(x){d++;x>>>=1;} return d; };
  while (deg(v) >= deg(0x537)) v ^= 0x537 << (deg(v) - deg(0x537));
  if (v !== 0) throw new Error("형식정보 BCH 검사 실패");
  const ec = (raw >>> 13) & 3, mask = (raw >>> 10) & 7;
  if (ec !== 0b00) throw new Error("오류정정 레벨이 M 이 아닙니다");
  return mask;
}

function syndromesZero(block, ec){
  for (let j=0;j<ec;j++){
    let s = 0;
    for (let i=0;i<block.length;i++) s ^= mul(block[i], EXP[(j*(block.length-1-i)) % 255]);
    if (s !== 0) return false;
  }
  return true;
}

function qrDecode(mat){
  const size = mat.length;
  if ((size - 17) % 4) throw new Error("크기가 QR 규격에 없습니다: " + size);
  const ver = (size - 17) / 4;
  if (!SPEC_M[ver]) throw new Error("지원 범위 밖 버전: " + ver);
  const fn = functionMap(ver);
  const mask = readFormat(mat, size);

  const un = mat.map(r => r.slice());
  for (let r=0;r<size;r++) for (let c=0;c<size;c++)
    if (!fn[r][c] && MASKS[mask](r,c)) un[r][c] ^= 1;

  const bits = [];
  let up = true;
  for (let col = size-1; col > 0; col -= 2){
    if (col === 6) col--;
    for (let n=0;n<size;n++){
      const row = up ? size-1-n : n;
      for (const c of [col, col-1]) if (!fn[row][c]) bits.push(un[row][c]);
    }
    up = !up;
  }
  const cw = [];
  for (let i=0; i+8<=bits.length; i+=8){ let b=0; for(let j=0;j<8;j++) b=(b<<1)|bits[i+j]; cw.push(b); }

  /* 인터리브 해제 */
  const spec = SPEC_M[ver];
  const sizes = [];
  spec.b.forEach(([count,dlen]) => { for(let i=0;i<count;i++) sizes.push(dlen); });
  const nBlocks = sizes.length, maxLen = Math.max(...sizes);
  const data = sizes.map(() => []);
  let p = 0;
  for (let i=0;i<maxLen;i++) for (let b=0;b<nBlocks;b++) if (i < sizes[b]) data[b].push(cw[p++]);
  const ecs = sizes.map(() => []);
  for (let i=0;i<spec.ec;i++) for (let b=0;b<nBlocks;b++) ecs[b].push(cw[p++]);

  for (let b=0;b<nBlocks;b++)
    if (!syndromesZero(data[b].concat(ecs[b]), spec.ec))
      throw new Error(`블록 ${b} 의 리드-솔로몬 신드롬이 0 이 아닙니다`);

  const flat = [];
  data.forEach(b => flat.push(...b));
  const fb = [];
  flat.forEach(b => { for(let i=7;i>=0;i--) fb.push((b>>>i)&1); });
  let q = 0;
  const take = n => { let v=0; for(let i=0;i<n;i++) v=(v<<1)|fb[q++]; return v; };
  if (take(4) !== 0b0100) throw new Error("바이트 모드가 아닙니다");
  const len = take(ver < 10 ? 8 : 16);
  const bytes = [];
  for (let i=0;i<len;i++) bytes.push(take(8));
  return { text:new TextDecoder().decode(Uint8Array.from(bytes)), ver, mask };
}

/* 고정 입력에 대한 골든 행렬 (해시).
   이 두 행렬은 파이썬 qrcode 라이브러리(kazuhikoarase 구현 계열)가 같은 입력에서
   내놓는 행렬과 한 칸도 다르지 않음을 확인해 두었습니다. 값이 바뀌면 출력이
   조용히 달라졌다는 뜻이므로, 의도한 변경인지 반드시 확인하세요. */
const GOLDEN = {
  "IOL": "02ddf051",
  "https://totenhaft.github.io/iol-navigator/#h=2C88-PAHG-304P-0HJ0-181C-002N-4": "c7949459",
};
const hash = s => { let h = 0x811c9dc5; for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,0x01000193)>>>0; } return h.toString(16).padStart(8,"0"); };
const flat = m => m.map(r => r.join("")).join("\n");

export default async function run(){
  let fail = 0, pass = 0;
  const ok = (name, cond, detail) => {
    if (cond){ pass++; console.log("  PASS  " + name); }
    else { fail++; console.log("  FAIL  " + name + (detail ? "  →  " + detail : "")); }
  };

  const samples = [
    "IOL",
    "0123456789",
    "한글도 담깁니다 — 인계 코드",
    "https://totenhaft.github.io/iol-navigator/#h=2C88-0",
    "https://totenhaft.github.io/iol-navigator/#h=2C88-PAHG-304P-0HJ0-181C-002N-4",
    "https://totenhaft.github.io/iol-navigator/#h=2C88-TZYG-4WHS-06B6-B0Z0-035G-000G-06GT-08",
    "X".repeat(120),
    "가".repeat(60),          // UTF-8 3바이트 × 60 = 180바이트 (버전 9~10)
  ];
  for (const s of samples){
    let r = null, err = "";
    try { r = qrDecode(qrEncode(s)); } catch(e){ err = e.message; }
    ok(`다시 읽기: ${s.length}자 → ${r ? "v" + r.ver + " mask" + r.mask : "실패"}`,
       !!r && r.text === s, err || (r ? "읽은 값: " + r.text.slice(0,30) : ""));
  }

  for (const [text, want] of Object.entries(GOLDEN)){
    const got = hash(flat(qrEncode(text)));
    ok(`골든 행렬 유지: "${text.slice(0,28)}…"`, got === want, `${got} ≠ ${want}`);
  }

  let tooLong = false;
  try { qrEncode("A".repeat(400)); } catch(e){ tooLong = /너무 깁니다/.test(e.message); }
  ok("용량 초과는 조용히 잘리지 않고 오류로 알림", tooLong);

  return { name:"QR 코드", failures: fail };
}
