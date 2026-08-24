/** 임상 로직 검증 — 페이지 안의 runSelfTests() 를 실행해 결과를 가져옵니다.
 *  규칙 자체의 테스트는 src/js/07-tests.js 에 있습니다. */
import { launch, pageURL, isRealError } from "./browser.mjs";

export default async function run() {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", m => { if (m.type() === "error" && isRealError(m.text())) errors.push("console: " + m.text()); });
  page.on("pageerror", e => errors.push("pageerror: " + e.message));

  await page.goto(pageURL + "?test=1", { waitUntil: "load" });
  await page.waitForTimeout(400);
  const res = await page.evaluate(() => runSelfTests());
  console.log(res.text);
  if (errors.length) console.log("\n자바스크립트 오류:\n" + errors.join("\n"));

  await browser.close();
  return { name: "임상 로직", failures: res.fail + errors.length };
}
