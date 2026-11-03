// Screenshots for SRS Appendix B (AGENTS.md section 9).
// Usage: npm run capture            (builds dist/ if missing)
//        npm run capture -- --build (always rebuilds)
//        npm run capture -- W-07 M-03 (only those screens)
// Web screens: 1440×900 -> capturas/W-XX.png · Mobile: 390×844 @2x -> capturas/M-XX.png
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'capturas');
const PORT = 3123;
const BASE = `http://localhost:${PORT}`;
const WEB = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

interface Shot {
  id: string;
  file: string;
  mobile?: boolean;
  user?: string;
  /** Prepares the screen after login. */
  run?: (p: Helpers) => Promise<void>;
}

interface Helpers {
  page: Page;
  tid: (id: string) => ReturnType<Page['locator']>;
  nav: (path: string) => Promise<void>;
  click: (id: string) => Promise<void>;
  fill: (id: string, text: string) => Promise<void>;
  pick: (select: string, value: string) => Promise<void>;
  keys: (text: string) => Promise<void>;
  wait: (ms?: number) => Promise<void>;
}

const shots: Shot[] = [
  { id: 'P-01', file: 'P-01-web.png' },
  { id: 'P-01', file: 'P-01-movil.png', mobile: true },
  { id: 'W-01', file: 'W-01.png', user: 'admin' },
  { id: 'W-02', file: 'W-02.png', user: 'admin', run: async (h) => { await h.nav('/usuarios'); await h.click('new-user'); } },
  { id: 'W-03', file: 'W-03.png', user: 'admin', run: (h) => h.nav('/insumos') },
  { id: 'W-04', file: 'W-04.png', user: 'admin', run: async (h) => { await h.nav('/fundas'); await h.click('product-type-printed'); } },
  { id: 'W-05', file: 'W-05.png', user: 'admin', run: (h) => h.nav('/recetas/p-fi4060') },
  { id: 'W-06', file: 'W-06.png', user: 'admin', run: (h) => h.nav('/recetas/aprobacion') },
  {
    id: 'W-07',
    file: 'W-07.png',
    user: 'ventas',
    run: async (h) => {
      await h.nav('/pedidos');
      await h.pick('customer', 'c-comercial');
      await h.pick('product', 'p-fi4060');
      await h.fill('quantity', '10.000');
    },
  },
  {
    id: 'W-08',
    file: 'W-08.png',
    user: 'supervisor',
    run: async (h) => {
      await h.nav('/ordenes/nueva?pedido=ped-0006');
      for (const [stage, machine, operator] of [
        ['extrusion', 'mc-ext02', 'operario1'],
        ['printing', 'mc-imp01', 'operario3'],
        ['sealing', 'mc-sel02', 'operario2'],
        ['packing', '', 'operario2'],
      ]) {
        if (machine) await h.pick(`machine-${stage}`, machine);
        await h.click(`op-${stage}-${operator}`);
      }
    },
  },
  { id: 'W-09', file: 'W-09.png', user: 'supervisor', run: (h) => h.nav('/ordenes/op-0003') },
  { id: 'W-10', file: 'W-10.png', user: 'supervisor' },
  { id: 'W-11', file: 'W-11.png', user: 'contabilidad', run: (h) => h.nav('/precios') },
  { id: 'W-12', file: 'W-12.png', user: 'admin', run: (h) => h.nav('/precios/comparar') },
  { id: 'W-13', file: 'W-13.png', user: 'rrhh' },
  { id: 'W-14', file: 'W-14.png', user: 'admin', run: (h) => h.nav('/costos/ordenes/op-0001') },
  {
    id: 'W-15',
    file: 'W-15.png',
    user: 'contabilidad',
    run: async (h) => {
      // Flow 2: a new local PEBD price, then its impact.
      await h.nav('/precios');
      await h.pick('price-material', 'm-pebd');
      await h.pick('price-supplier', 's-polimeros');
      await h.fill('price-value', '1,58');
      await h.click('save-price');
      await h.click('see-impact');
    },
  },
  { id: 'W-16', file: 'W-16.png', user: 'ventas', run: (h) => h.nav('/precios/simulador') },
  {
    id: 'W-17',
    file: 'W-17.png',
    user: 'admin',
    run: async (h) => {
      await h.nav('/precios/aprobacion');
      await h.page.getByText('FN-2030', { exact: true }).first().click();
    },
  },
  { id: 'W-18', file: 'W-18.png', user: 'facturacion' },
  { id: 'W-19', file: 'W-19.png', user: 'admin', run: (h) => h.nav('/reportes/tiempos') },
  { id: 'W-20', file: 'W-20.png', user: 'admin', run: (h) => h.nav('/reportes/tablero') },
  { id: 'W-21', file: 'W-21.png', user: 'contabilidad', run: (h) => h.nav('/integracion') },
  { id: 'W-22', file: 'W-22.png', user: 'admin', run: (h) => h.nav('/bitacora') },
  { id: 'M-01', file: 'M-01.png', mobile: true, user: 'operario1' },
  { id: 'M-02', file: 'M-02.png', mobile: true, user: 'operario1', run: (h) => h.click('stage-op-0005-ext') },
  {
    id: 'M-03',
    file: 'M-03.png',
    mobile: true,
    user: 'operario1',
    run: async (h) => {
      await h.click('stage-op-0005-ext');
      await h.click('start-operation');
      await h.wait(4200);
    },
  },
  {
    id: 'M-04',
    file: 'M-04.png',
    mobile: true,
    user: 'operario1',
    run: async (h) => {
      await h.click('stage-op-0005-ext');
      await h.click('start-operation');
      await h.click('go-production');
      await h.keys('102');
      await h.click('field-roll');
      await h.keys('99,5');
    },
  },
  {
    id: 'M-05',
    file: 'M-05.png',
    mobile: true,
    user: 'operario1',
    run: async (h) => {
      await h.click('stage-op-0005-ext');
      await h.click('start-operation');
      await h.click('go-waste');
      await h.keys('2,5');
      await h.click('destination-pelletized');
    },
  },
  {
    id: 'M-06',
    file: 'M-06.png',
    mobile: true,
    user: 'operario2',
    run: async (h) => {
      await h.click('stage-op-0004-emp');
      await h.click('start-operation');
      await h.click('finish');
      await h.keys('24950');
      await h.click('field-bundles');
      await h.keys('25');
    },
  },
  { id: 'M-07', file: 'M-07.png', mobile: true, user: 'operario1', run: (h) => h.click('shift-summary') },
  { id: 'M-08', file: 'M-08.png', mobile: true, user: 'supervisor' },
];

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`El servidor estático no respondió en ${BASE}`);
}

async function capture(browser: Browser, shot: Shot) {
  const context = await browser.newContext(shot.mobile ? MOBILE : WEB);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const tid = (id: string) => page.locator(`[data-testid="${id}"] >> visible=true`).first();
  const wait = (ms = 500) => page.waitForTimeout(ms);
  const h: Helpers = {
    page,
    tid,
    wait,
    // Client-side navigation keeps the in-memory session and data.
    nav: async (path) => {
      await page.evaluate((p) => {
        window.history.pushState({}, '', p);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, path);
      await wait(700);
    },
    click: async (id) => {
      await tid(id).click();
      await wait(350);
    },
    fill: async (id, text) => {
      await tid(id).fill(text);
      await wait(200);
    },
    pick: async (select, value) => {
      await tid(select).click();
      await tid(`${select}-${value}`).click();
      await wait(250);
    },
    keys: async (text) => {
      for (const ch of text) await tid(`key-${ch}`).click();
    },
  };

  await page.goto(`${BASE}/login`);
  await tid('login-submit').waitFor();
  if (shot.user) {
    await h.click(`quick-${shot.user}`);
    await wait(600);
  }
  await shot.run?.(h);
  await page.mouse.move(0, shot.mobile ? 0 : 899); // no hover tooltip in the picture
  await page.locator('[data-testid="toast"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  await wait(900); // charts measure their width and redraw
  await page.screenshot({ path: join(OUT, shot.file) });
  await context.close();
  if (errors.length) throw new Error(`${shot.file}: ${errors.join(' | ')}`);
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith('--'));
  if (args.includes('--build') || !existsSync(join(ROOT, 'dist', 'index.html'))) {
    console.log('Generando la build web (npx expo export -p web)…');
    const r = spawnSync('npx expo export -p web', { cwd: ROOT, stdio: 'inherit', shell: true });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  mkdirSync(OUT, { recursive: true });

  const server: ChildProcess = spawn(`npx serve dist --single --listen ${PORT} --no-request-logging`, { cwd: ROOT, shell: true, stdio: 'ignore' });
  const browser = await chromium.launch();
  let failed = 0;
  try {
    await waitForServer();
    for (const shot of shots.filter((s) => !only.length || only.includes(s.id))) {
      try {
        await capture(browser, shot);
        console.log(`✓ capturas/${shot.file}`);
      } catch (e) {
        failed++;
        console.error(`✗ capturas/${shot.file}: ${(e as Error).message.split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
    if (process.platform === 'win32' && server.pid) spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    else server.kill();
  }
  if (failed) {
    console.error(`${failed} captura(s) fallaron.`);
    process.exit(1);
  }
}

main();
