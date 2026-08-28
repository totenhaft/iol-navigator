/** 병원 공통 설정(config.json) 검증
 *
 *  이 기능은 http 로 서비스될 때만 동작합니다(file:// 에서는 fetch 가 막힙니다).
 *  그래서 다른 테스트와 달리 임시 웹서버를 띄워 dist/ 를 그대로 서비스하고,
 *  실제 브라우저가 config.json 을 받아 적용하는지까지 확인합니다.
 *
 *  "파일을 만들었다"가 아니라 "그 값이 점수에 반영됐다"까지 봐야 합니다.
 *  설정이 조용히 무시되면 임상 판단이 원장님 의도와 다르게 굴러갑니다.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { launch, repoRoot, isRealError } from "./browser.mjs";

const wait = (p, ms) => p.waitForTimeout(ms);
const indexHtml = () => readFileSync(resolve(repoRoot, "dist", "index.html"), "utf8");

/** dist/index.html 을 서비스하고, config.json 은 테스트가 그때그때 갈아끼웁니다. */
function serve(getConfig){
  const html = indexHtml();
  const server = createServer((req, res) => {
    const path = (req.url || "/").split("?")[0];
    if (path === "/config.json"){
      const body = getConfig();
      if (body === null){ res.writeHead(404).end("no config"); return; }
      res.writeHead(200, {"content-type":"application/json; charset=utf-8"}).end(body);
      return;
    }
    if (path === "/" || path === "/index.html"){
      res.writeHead(200, {"content-type":"text/html; charset=utf-8"}).end(html);
      return;
    }
    res.writeHead(404).end("not found");
  });
  return new Promise(ok => server.listen(0, "127.0.0.1", () => ok(server)));
}

export default async function run(){
  let fail = 0;
  const ok = (name, cond, detail) => {
    if (cond) console.log("  PASS  " + name);
    else { fail++; console.log("  FAIL  " + name + (detail ? "  →  " + detail : "")); }
  };

  let config = null;
  const server = await serve(() => config);
  const base = "http://127.0.0.1:" + server.address().port + "/";
  const browser = await launch();
  const errors = [];

  /* 매번 새 컨텍스트를 씁니다 — localStorage 가 남으면 다음 검사가 오염됩니다. */
  const open = async () => {
    const ctx = await browser.newContext({ viewport:{width:1280, height:900} });
    const page = await ctx.newPage();
    page.on("console", m => { if (m.type() === "error" && isRealError(m.text())) errors.push(m.text()); });
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(base, { waitUntil:"load" });
    await wait(page, 350);
    return { ctx, page };
  };

  /* ---- 1) 파일이 없어도 앱은 그대로 돈다 ---- */
  config = null;
  let s = await open();
  ok("config.json 이 없어도 기본값으로 동작한다",
     await s.page.evaluate(() => REMOTE_CONFIG.loaded === false && TU("cutCyl") === TUNING_DEFAULT.cutCyl));
  ok("파일이 없으면 화면도 정상적으로 그려진다",
     await s.page.evaluate(() => !!document.querySelector("#runBtn") && !!document.querySelector("#formSections .field")));
  await s.ctx.close();

  /* ---- 2) 금액과 조정값이 실제로 반영된다 ---- */
  config = JSON.stringify({ version: 1, costs: { trifocal: {min: 500, max: 520} }, tuning: { cutCyl: 1.25 } });
  s = await open();
  ok("config.json 의 조정값이 엔진에 들어간다",
     await s.page.evaluate(() => TU("cutCyl") === 1.25), await s.page.evaluate(() => String(TU("cutCyl"))));
  ok("config.json 의 금액이 금액표에 들어간다",
     await s.page.evaluate(() => COST_MAN.trifocal.min === 500 && COST_MAN.trifocal.max === 520));
  ok("건드리지 않은 항목은 코드 기본값 그대로다",
     await s.page.evaluate(() => TU("cutToric") === TUNING_DEFAULT.cutToric && COST_MAN.mono.min === 25));
  ok("바뀐 임계값이 규칙 발동에 반영된다",
     await s.page.evaluate(() => {
       const d = {age:68, cylD:1.0, specIndep:"1", nearPriority:"1", interPriority:"1",
                  nightDriving:"1", dysphTolerance:"1", costSensitivity:"1"};
       // cutCyl 을 1.25 로 올렸으므로 난시 1.0D 는 이제 '난시 있음'이 아니다
       return evaluate(d, "pro").d.astigEstimated === false;
     }));
  await s.ctx.close();

  /* ---- 3) 우선순위: 코드 기본값 < config.json < 이 기기 설정 ---- */
  config = JSON.stringify({ version: 1, tuning: { cutCyl: 1.25 } });
  const ctx3 = await browser.newContext({ viewport:{width:1280, height:900} });
  const p3 = await ctx3.newPage();
  p3.on("pageerror", e => errors.push(e.message));
  await p3.goto(base, { waitUntil:"load" }); await wait(p3, 350);
  await p3.evaluate(() => { const s = loadSettings(); s.tuning = {cutCyl: 2.0}; saveSettings(s); });
  ok("이 기기 설정이 config.json 을 덮는다", await p3.evaluate(() => TU("cutCyl") === 2.0));

  /* version 이 그대로면 기기 설정은 유지된다 */
  await p3.reload({ waitUntil:"load" }); await wait(p3, 350);
  ok("version 이 그대로면 기기 설정이 유지된다", await p3.evaluate(() => TU("cutCyl") === 2.0),
     await p3.evaluate(() => String(TU("cutCyl"))));

  /* version 을 올리면 그 항목의 기기 설정은 지워지고 병원 값으로 돌아간다 */
  config = JSON.stringify({ version: 2, tuning: { cutCyl: 0.9 } });
  await p3.reload({ waitUntil:"load" }); await wait(p3, 350);
  ok("version 을 올리면 기기 설정이 지워지고 병원 값이 적용된다",
     await p3.evaluate(() => TU("cutCyl") === 0.9), await p3.evaluate(() => String(TU("cutCyl"))));
  ok("version 을 올려도 그 파일에 없는 기기 설정은 남는다",
     await p3.evaluate(async () => {
       const s = loadSettings(); s.tuning = Object.assign({}, s.tuning, {cutComa: 0.44}); saveSettings(s);
       return TU("cutComa") === 0.44;
     }));
  await p3.reload({ waitUntil:"load" }); await wait(p3, 350);
  ok("새로고침해도 관련 없는 기기 설정은 그대로다",
     await p3.evaluate(() => TU("cutComa") === 0.44 && TU("cutCyl") === 0.9),
     await p3.evaluate(() => TU("cutComa") + "/" + TU("cutCyl")));
  await ctx3.close();

  /* ---- 4) 이상한 값은 통과시키지 않는다 ---- */
  config = JSON.stringify({
    version: 3,
    costs: { trifocal: {min: -10, max: 5}, nosuchlens: {min: 1, max: 2} },
    tuning: { cutCyl: "많이", nosuchkey: 5, scoreBase: 99999 },
  });
  s = await open();
  ok("음수 금액은 무시한다", await s.page.evaluate(() => COST_MAN.trifocal.min === 350));
  ok("모르는 렌즈 항목은 무시한다", await s.page.evaluate(() => COST_MAN.nosuchlens === undefined));
  ok("숫자가 아닌 조정값은 무시한다", await s.page.evaluate(() => TU("cutCyl") === TUNING_DEFAULT.cutCyl));
  ok("모르는 조정 항목은 무시한다", await s.page.evaluate(() => TUNING.nosuchkey === undefined));
  ok("허용 범위를 벗어난 값은 무시한다",
     await s.page.evaluate(() => TU("scoreBase") === TUNING_DEFAULT.scoreBase),
     await s.page.evaluate(() => String(TU("scoreBase"))));
  ok("무시한 항목을 콘솔에 남긴다", await s.page.evaluate(() => REMOTE_CONFIG.dropped.length >= 4),
     await s.page.evaluate(() => REMOTE_CONFIG.dropped.join(",")));
  await s.ctx.close();

  /* ---- 5) 깨진 JSON 이어도 앱이 멈추지 않는다 ---- */
  config = "{ 이건 JSON 이 아님";
  s = await open();
  ok("깨진 config.json 이어도 앱은 기본값으로 뜬다",
     await s.page.evaluate(() => REMOTE_CONFIG.loaded === false && !!document.querySelector("#runBtn")));
  await s.ctx.close();

  /* ---- 6) 설정 화면이 붙여넣을 config.json 을 만들어 준다 ---- */
  config = JSON.stringify({ version: 4, tuning: { cutCyl: 1.1 } });
  s = await open();
  const made = await s.page.evaluate(async () => {
    markUnlocked(true);
    const cur = loadSettings(); cur.tuning = {cutComa: 0.42}; saveSettings(cur);
    openSettings();
    document.querySelector("#setCfgBtn").click();
    return document.querySelector("#setCfgJson").value;
  });
  let parsed = null;
  try { parsed = JSON.parse(made); } catch(e){}
  ok("만들어진 내용이 올바른 JSON 이다", parsed !== null, made.slice(0, 80));
  ok("version 이 1 올라간다", parsed && parsed.version === 5, parsed && String(parsed.version));
  ok("지금 화면의 값이 그대로 담긴다", parsed && parsed.tuning.cutComa === 0.42 && parsed.tuning.cutCyl === 1.1,
     parsed && JSON.stringify(parsed.tuning).slice(0, 80));
  ok("만든 내용에는 금액도 함께 담긴다", parsed && parsed.costs && parsed.costs.trifocal.min === 350);
  ok("설정 화면이 적용 중인 version 을 알려 준다",
     await s.page.evaluate(() => /version 4/.test(document.querySelector("#setBody").textContent)));
  await s.ctx.close();

  ok("자바스크립트 오류 없음", errors.length === 0, errors.join(" | "));

  await browser.close();
  server.close();
  return { name: "병원 공통 설정(config.json)", failures: fail };
}
