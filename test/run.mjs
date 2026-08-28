/** 전체 테스트 실행:  npm test  */
import qr from "./qr.test.mjs";
import engine from "./engine.test.mjs";
import layout from "./layout.test.mjs";
import flow from "./flow.test.mjs";
import config from "./config.test.mjs";

const line = "─".repeat(58);
let total = 0;
for (const suite of [qr, engine, layout, flow, config]) {
  const r = await suite();
  total += r.failures;
  console.log(`${line}\n${r.name}: ${r.failures === 0 ? "통과" : `실패 ${r.failures}건`}\n${line}\n`);
}
console.log(total === 0 ? "모든 테스트 통과" : `*** 총 ${total}건 실패 ***`);
process.exit(total === 0 ? 0 : 1);
