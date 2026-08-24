/** 테스트용 브라우저 실행 헬퍼.
 *  보통은 playwright 가 알아서 크로미움을 찾습니다.
 *  특정 브라우저를 쓰려면 환경변수 CHROME_PATH 를 지정하세요. */
import { chromium } from "playwright";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const pageURL = pathToFileURL(resolve(repoRoot, "index.html")).href;

export function launch() {
  const opts = { args: ["--no-sandbox"] };
  if (process.env.CHROME_PATH) opts.executablePath = process.env.CHROME_PATH;
  return chromium.launch(opts);
}

/** 폰트 CDN 차단 같은 네트워크 오류는 코드 결함이 아니므로 걸러냅니다. */
export const isRealError = (text) => !/net::|Failed to load resource/.test(text);
