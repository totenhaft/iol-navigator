#!/usr/bin/env node
/**
 * IOL 내비게이터 빌드 스크립트
 *
 * src/ 의 조각들을 하나로 합쳐 index.html 을 만듭니다.
 *   src/head.html   → <title> 과 모든 CSS
 *   src/body.html   → 화면 구조(HTML)
 *   src/js/*.js     → 파일명 숫자 순서대로 이어붙임 (순서가 중요합니다)
 *
 * 실행:  npm run build     (또는  node build.mjs)
 * 결과:  index.html        브라우저에서 바로 열 수 있는 단일 파일
 *        dist/index.html   GitHub Pages 배포용 (동일 내용)
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(root, ...p), "utf8");

const head = read("src", "head.html");
const body = read("src", "body.html");

// 01-, 02- … 접두사 숫자 순서대로 합칩니다. 새 파일을 추가하면 자동으로 포함됩니다.
const jsDir = join(root, "src", "js");
const jsFiles = readdirSync(jsDir).filter(f => f.endsWith(".js")).sort();
if (jsFiles.length === 0) throw new Error("src/js 안에 자바스크립트 파일이 없습니다.");
const js = jsFiles.map(f => readFileSync(join(jsDir, f), "utf8")).join("\n");

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="연세솔안과 IOL 내비게이터 — 근거 기반 백내장 인공수정체 선택 보조. 환자·상담직원·의사 세 화면, 금기/주의/선호 3계층 의사결정 로직, 문헌 근거 연결.">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="연세솔안과 IOL 내비게이터">
<meta property="og:description" content="연세솔안과의 근거 기반 백내장 인공수정체 선택 보조 도구. 임상 의사결정 보조이며 의료기기가 아닙니다.">
<meta property="og:type" content="website">
${head.trim()}
<style id="pageRule">@page{ size:A4; margin:14mm }</style>
</head>
<body>
${body.trim()}
<script>
${js}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
</script>
</body>
</html>
`;

writeFileSync(join(root, "index.html"), html);
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "index.html"), html);
writeFileSync(join(root, "dist", ".nojekyll"), "");

const kb = (html.length / 1024).toFixed(0);
console.log(`빌드 완료  index.html  ${kb} KB  (자바스크립트 ${jsFiles.length}개 파일: ${jsFiles.join(", ")})`);
