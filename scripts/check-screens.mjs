import { execFileSync, spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import { chromium, devices, webkit } from "playwright";

// 저장소 루트에서 실행한다.
//   npm run screens -- login                                  # 최초 1회, 크롬 창에서 구글 로그인
//   npm run screens -- --path /home --path /plan/123 --label after
//   npm run screens -- --path /home --targets android,iphone
// 결과: .screens/<label>/<path>/<target>.png
const TARGET_NAMES = ["pc-chrome", "pc-safari", "android", "iphone"];
const PC_VIEWPORT = { width: 1440, height: 900 };
const AUTH_FILE = path.join(homedir(), ".cache/uttae/check-screens/storage-state.json");
const SCREENS_ROOT = path.resolve(".screens");
const XCODE_DEVELOPER_DIR = "/Applications/Xcode.app/Contents/Developer";
// PATH에 의존하지 않도록 macOS 기본 위치의 실행 파일을 직접 부른다
const BIN = {
  git: "/usr/bin/git",
  lsof: "/usr/sbin/lsof",
  open: "/usr/bin/open",
  xcodeSelect: "/usr/bin/xcode-select",
  xcrun: "/usr/bin/xcrun",
};

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    path: { type: "string", multiple: true, default: [] },
    targets: { type: "string", default: TARGET_NAMES.join(",") },
    label: { type: "string" },
    base: { type: "string", default: "http://localhost:3000" },
    wait: { type: "string", default: "1500" },
    "iphone-wait": { type: "string", default: "4000" },
    full: { type: "boolean", default: false },
    "android-device": { type: "string", default: "Galaxy S24" },
    iphone: { type: "string", default: "iPhone 17" },
    "allow-other-server": { type: "boolean", default: false },
  },
});

const command = positionals[0] ?? "shot";
const baseUrl = parseBaseUrl(args.base);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (command === "login") {
  await login();
} else if (command === "shot") {
  await shot();
} else {
  fail(`알 수 없는 명령: ${command} (login 또는 shot)`);
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

/** 백엔드 CORS·구글 로그인이 localhost만 허용하고 이 값이 크롬 실행 인자로도 넘어가므로, 로컬 http 주소만 받는다 */
function parseBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`--base가 주소 형식이 아닙니다: ${value}`);
  }
  const localOrigin =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password;
  if (!localOrigin) fail(`--base는 http://localhost:<포트> 형식만 쓸 수 있습니다: ${value}`);
  return url;
}

/** `--path`는 앱 안 경로만 — `//다른곳`, `/\다른곳`처럼 다른 origin으로 바뀌는 값을 막는다 */
function appUrl(pagePath) {
  const url = new URL(pagePath, baseUrl);
  if (!pagePath.startsWith("/") || url.origin !== baseUrl.origin) fail(`--path는 /로 시작하는 앱 안 경로만 쓸 수 있습니다: ${pagePath}`);
  return url;
}

/** 결과 폴더는 `.screens` 바로 아래 한 단계 — `--label ../src`처럼 다른 위치에 쓰지 않게 막는다 */
function screensOutDir(label) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(label)) {
    fail(`--label은 영문·숫자·. - _ 만 쓸 수 있습니다(첫 글자는 영문·숫자): ${label}`);
  }
  const outDir = path.resolve(SCREENS_ROOT, label);
  if (path.dirname(outDir) !== SCREENS_ROOT) fail(`--label이 .screens 밖을 가리킵니다: ${label}`);
  return outDir;
}

/** 포트를 점유한 dev 서버의 작업 폴더 — 다른 worktree 코드를 찍는 실수를 막는다 */
function readServerCwd(port) {
  const pids = spawnSync(BIN.lsof, ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
    encoding: "utf8",
  }).stdout.trim();
  if (!pids) return null;
  const cwd = spawnSync(BIN.lsof, ["-a", "-p", pids.split("\n")[0], "-d", "cwd", "-Fn"], {
    encoding: "utf8",
  }).stdout;
  return cwd.split("\n").find((line) => line.startsWith("n"))?.slice(1) ?? null;
}

function assertServerServesThisRepo() {
  const port = baseUrl.port || "80";
  const serverCwd = readServerCwd(port);
  if (!serverCwd) fail(`${baseUrl.origin}에 dev 서버가 없습니다. 이 폴더에서 npm run dev를 먼저 실행하세요.`);
  const repoRoot = execFileSync(BIN.git, ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  if (path.resolve(serverCwd) !== path.resolve(repoRoot) && !args["allow-other-server"]) {
    fail(
      `${port}번 dev 서버가 다른 폴더(${serverCwd})의 코드입니다. 그 서버를 끄고 이 폴더(${repoRoot})에서 npm run dev를 실행하세요.`,
    );
  }
}

function readAuthState() {
  return existsSync(AUTH_FILE) ? AUTH_FILE : undefined;
}

/**
 * 앱 origin의 쿠키·저장소만 남긴다(구글 계정 쿠키 등은 저장하지 않는다).
 * refresh 토큰이 회전될 수 있어 실행 후 최신 쿠키를 다시 저장하되, 토큰이 빠진 상태로 덮어쓰지 않는다.
 */
async function saveAuthState(context) {
  const state = await context.storageState();
  const cookies = state.cookies.filter((cookie) => cookie.domain.replace(/^\./, "") === baseUrl.hostname);
  if (!cookies.some((cookie) => cookie.name === "refresh_token")) return false;
  const origins = state.origins.filter((origin) => origin.origin === baseUrl.origin);
  mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  writeFileSync(AUTH_FILE, JSON.stringify({ cookies, origins }, null, 2));
  chmodSync(AUTH_FILE, 0o600);
  return true;
}

async function readDebuggerPages(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  return (await response.json()).filter((target) => target.type === "page");
}

/** 크롬이 전용 프로필 폴더에 적는 디버깅 포트 — 이 프로필로 띄운 크롬의 포트만 나온다 */
async function waitForDevToolsPort(portFile) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const port = existsSync(portFile) ? Number(readFileSync(portFile, "utf8").split("\n")[0]) : 0;
    if (Number.isInteger(port) && port > 0) return port;
    await sleep(300);
  }
  fail("전용 프로필 크롬의 디버깅 포트를 찾지 못했습니다. 이 프로필로 열린 크롬 창이 남아 있으면 닫고 다시 실행하세요.");
}

async function login() {
  // 구글은 Playwright가 띄운 브라우저의 로그인을 거부한다(signin/rejected).
  // 일반 크롬을 전용 프로필로 띄워 사람이 로그인하고, /home 도착 뒤에만 CDP로 붙어 쿠키를 읽는다.
  // 고정 포트는 이미 떠 있던 다른 디버깅 크롬에 붙을 수 있어 빈 포트(0)로 띄우고, 이 프로필 폴더에 적힌 포트만 쓴다.
  const profileDir = path.join(path.dirname(AUTH_FILE), "chrome-profile");
  const portFile = path.join(profileDir, "DevToolsActivePort");
  rmSync(portFile, { force: true });
  spawn(
    BIN.open,
    [
      "-na",
      "Google Chrome",
      "--args",
      `--user-data-dir=${profileDir}`,
      "--remote-debugging-port=0",
      "--no-first-run",
      "--no-default-browser-check",
      new URL("/login", baseUrl).href,
    ],
    { detached: true, stdio: "ignore" },
  ).unref();
  const port = await waitForDevToolsPort(portFile);
  console.log("새 크롬 창에서 구글 로그인을 끝내 주세요. /home으로 이동하면 자동으로 저장하고 닫습니다.");

  const isHome = (url) => url.startsWith(baseUrl.origin) && new URL(url).pathname.startsWith("/home");
  const deadline = Date.now() + 5 * 60_000;
  let opened = false;
  while (Date.now() < deadline) {
    // HTTP 목록만 읽는다 — 로그인 중에는 CDP 세션을 붙이지 않는다
    const pages = await readDebuggerPages(port).catch(() => null);
    if (pages === null && opened) fail("로그인 전에 크롬 창이 닫혔습니다.");
    if (pages !== null) opened = true;
    if (pages?.some((target) => isHome(target.url))) break;
    await sleep(1000);
  }
  if (Date.now() >= deadline) fail("5분 안에 로그인이 끝나지 않았습니다.");

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const saved = await saveAuthState(browser.contexts()[0]);
  const cdp = await browser.newBrowserCDPSession();
  await cdp.send("Browser.close").catch(() => {});
  if (!saved) fail("refresh_token 쿠키를 찾지 못해 로그인 상태를 저장하지 못했습니다.");
  console.log(`✔ 로그인 상태 저장: ${AUTH_FILE}`);
}

function slugify(pagePath) {
  const slug = pagePath.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9-]+/g, "_");
  return slug || "root";
}

function timestampLabel() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function playwrightTarget(name) {
  if (name === "pc-chrome") return { engine: chromium, options: { viewport: PC_VIEWPORT, deviceScaleFactor: 1 } };
  if (name === "pc-safari") return { engine: webkit, options: { viewport: PC_VIEWPORT, deviceScaleFactor: 1 } };
  const device = devices[args["android-device"]];
  if (!device) fail(`Playwright 기기 목록에 없는 이름: ${args["android-device"]}`);
  return { engine: chromium, options: device };
}

async function shootWithPlaywright(name, pages, outDir) {
  const { engine, options } = playwrightTarget(name);
  const browser = await engine.launch();
  const context = await browser.newContext({ ...options, storageState: readAuthState() });
  const results = [];
  for (const pagePath of pages) {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const url = appUrl(pagePath);
    await page.goto(url.href, { waitUntil: "load" });
    // Next dev 배지가 화면 하단을 가리지 않게 숨긴다
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.evaluate(() => document.fonts.ready);
    // 스켈레톤·로딩 표시(aria-busy)가 사라질 때까지 최대 5초 기다린다
    await page
      .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 5000 })
      .catch(() => {});
    await page.waitForTimeout(Number(args.wait));
    const file = path.join(outDir, slugify(pagePath), `${name}.png`);
    mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: args.full });
    const redirectedToLogin = url.pathname !== "/login" && new URL(page.url()).pathname === "/login";
    results.push({ target: name, path: pagePath, file, redirectedToLogin, errors });
    await page.close();
  }
  await saveAuthState(context);
  await browser.close();
  return results;
}

function simctlEnv() {
  if (process.env.DEVELOPER_DIR) return process.env;
  const selected = spawnSync(BIN.xcodeSelect, ["-p"], { encoding: "utf8" }).stdout.trim();
  // xcode-select가 Command Line Tools를 가리키면 simctl이 없다
  if (selected.includes("CommandLineTools") && existsSync(XCODE_DEVELOPER_DIR)) {
    return { ...process.env, DEVELOPER_DIR: XCODE_DEVELOPER_DIR };
  }
  return process.env;
}

async function shootWithSimulator(pages, outDir) {
  const env = simctlEnv();
  const simctl = (...simArgs) => execFileSync(BIN.xcrun, ["simctl", ...simArgs], { env, encoding: "utf8" });
  // 여러 시뮬레이터(iPad 등)가 켜져 있으면 "booted"가 아무 기기나 고르므로 이름으로 UDID를 찾는다
  const available = Object.values(JSON.parse(simctl("list", "devices", "available", "-j")).devices).flat();
  const device = available.find((candidate) => candidate.name === args.iphone);
  if (!device) fail(`시뮬레이터 목록에 없는 기기: ${args.iphone}`);
  if (device.state !== "Booted") {
    simctl("boot", device.udid);
    spawn(BIN.open, ["-a", "Simulator"], { env, detached: true, stdio: "ignore" }).unref();
    simctl("bootstatus", device.udid, "-b");
  }
  const results = [];
  for (const pagePath of pages) {
    simctl("openurl", device.udid, appUrl(pagePath).href);
    await sleep(Number(args["iphone-wait"]));
    const file = path.join(outDir, slugify(pagePath), "iphone.png");
    mkdirSync(path.dirname(file), { recursive: true });
    simctl("io", device.udid, "screenshot", file);
    // 시뮬레이터 Safari는 리다이렉트를 읽을 수 없으므로 로그인 화면 여부는 스크린샷으로 확인한다
    results.push({ target: "iphone", path: pagePath, file, redirectedToLogin: null, errors: [] });
  }
  return results;
}

async function shot() {
  if (args.path.length === 0) fail("--path로 찍을 경로를 하나 이상 넘기세요. 예: --path /home");
  const targets = args.targets.split(",").map((name) => name.trim());
  const unknown = targets.filter((name) => !TARGET_NAMES.includes(name));
  if (unknown.length > 0) fail(`알 수 없는 대상: ${unknown.join(", ")} (가능: ${TARGET_NAMES.join(", ")})`);
  args.path.forEach(appUrl);
  const outDir = screensOutDir(args.label ?? timestampLabel());
  assertServerServesThisRepo();
  if (!readAuthState()) console.warn(`! 로그인 상태가 없습니다. 로그인이 필요한 화면은 npm run screens -- login 후 다시 찍으세요.`);

  const results = [];
  // refresh 토큰 회전이 겹치지 않도록 대상별로 순서대로 실행한다
  for (const target of targets) {
    results.push(...(target === "iphone" ? await shootWithSimulator(args.path, outDir) : await shootWithPlaywright(target, args.path, outDir)));
  }

  for (const result of results) {
    const notes = [];
    if (result.redirectedToLogin) notes.push("로그인 화면으로 이동됨");
    if (result.errors.length > 0) notes.push(`콘솔 에러 ${result.errors.length}개`);
    console.log(`${result.target.padEnd(9)} ${result.path.padEnd(24)} ${result.file}${notes.length ? `  (${notes.join(", ")})` : ""}`);
  }
  writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\n결과: ${path.join(outDir, "results.json")}`);
}
