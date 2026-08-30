import { test, expect } from '@playwright/test';

const rooms = [
  { id: 'home', label: 'Home' },
  { id: 'tsh', label: 'TSH' },
  { id: 'folio-work-kits', label: 'Folio Work Kits (DPF)' },
  { id: 'midas', label: 'Midas' },
  { id: 'wanderpick', label: 'WanderPick' },
  { id: 'agent-staff', label: 'Agent Staff' }
];
const labels = rooms.map(r => r.label);

async function ready(page, id) {
  await page.waitForFunction(room => window.__CAMPUS__?.ready && window.__CAMPUS__.roomId === room, id);
}

for (const room of rooms) {
  test(`${room.label}: first paint, interactions, scoped jobs and scene contracts`, async ({ page, request }) => {
    test.setTimeout(90_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

    const specResponse = await request.get(`/rooms/${room.id}.json`);
    expect(specResponse.status()).toBe(200);
    const response = await page.goto(`/?room=${room.id}`, { waitUntil: 'networkidle' });
    expect(response.status()).toBe(200);
    await ready(page, room.id);

    const state = await page.evaluate(() => ({
      roomId: window.__CAMPUS__.roomId,
      agents: window.__CAMPUS__.spec.agents.length,
      jobs: window.__CAMPUS__.spec.jobs_wall.jobs.map(j => j.name),
      registry: Object.keys(window.__CAMPUS__.registry)
    }));
    expect(state.roomId).toBe(room.id);
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.locator('.fatal')).toHaveCount(0);
    await expect(page.locator('[data-testid="jobs-wall"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="room-pet"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="campus-door"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="agent-tag"]')).toHaveCount(state.agents);
    expect(state.registry).toEqual(expect.arrayContaining(['jobWall', 'door', 'pet']));

    const firstTag = page.locator('[data-testid="agent-tag"]').first();
    const handle = (await firstTag.textContent()).trim();
    const before = await page.evaluate(() => window.__CAMPUS__.agents[0].root.position.toArray());
    await firstTag.click({ force: true });
    await expect(page.locator('[data-panel-title]')).toHaveText(handle);
    await expect(page.getByTestId('toggle-agent-state')).toBeVisible();
    await page.getByTestId('toggle-agent-state').click();
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => ({
      position: window.__CAMPUS__.agents[0].root.position.toArray(),
      walking: window.__CAMPUS__.agents[0].walking,
      pathLength: window.__CAMPUS__.agents[0].path.length
    }));
    expect(after.pathLength).toBeGreaterThan(0);
    expect(Math.hypot(after.position[0] - before[0], after.position[2] - before[2])).toBeGreaterThan(0.1);

    await page.getByTestId('room-pet').click({ force: true });
    await expect(page.locator('[data-panel-title]')).toContainText('room digest');
    await page.locator('#panel .close').click();

    await page.getByTestId('jobs-wall').click({ force: true });
    await expect(page.locator('[data-panel-title]')).toHaveText('JOB WALL');
    const shownJobs = await page.locator('.job h3').allTextContents();
    expect(shownJobs).toEqual(state.jobs.length ? state.jobs : ['No project-scoped jobs']);
    await page.locator('#panel .close').click();

    await page.getByTestId('campus-door').click({ force: true });
    await expect(page.locator('#campus-modal h2')).toHaveText('Campus');
    expect(await page.locator('.destination strong').allTextContents()).toEqual(labels);
    await page.keyboard.press('Escape');
    await expect(page.locator('#campus-modal')).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test('physical meshes are clickable through the shared raycaster', async ({ page }) => {
  await page.goto('/?room=home');
  await ready(page, 'home');
  await page.evaluate(() => { document.querySelector('.css-label-layer').style.display = 'none'; });
  for (const [name, title] of [['pet', 'room digest'], ['jobWall', 'JOB WALL'], ['door', 'Campus']]) {
    if (name !== 'pet') await page.keyboard.press('Escape');
    const point = await page.evaluate(key => window.__CAMPUS__.interactions.screenPoint(key), name);
    expect(point).toBeTruthy();
    await page.mouse.click(point.x, point.y);
    if (name === 'door') await expect(page.locator('#campus-modal h2')).toHaveText(title);
    else await expect(page.locator('[data-panel-title]')).toContainText(title);
  }
  expect(await page.evaluate(() => window.__CAMPUS__.interactions.pickCount)).toBeGreaterThanOrEqual(3);
});

test('inverted pan, orbit, zoom and pitch controls update the shared camera state', async ({ page }) => {
  await page.goto('/?room=home');
  await ready(page, 'home');
  const initial = await page.evaluate(() => ({ x: window.__CAMPUS__.controlTarget.x, ...window.__CAMPUS__.controls.state }));
  await page.keyboard.down('a'); await page.waitForTimeout(220); await page.keyboard.up('a');
  const afterA = await page.evaluate(() => window.__CAMPUS__.controlTarget.x);
  expect(afterA).toBeGreaterThan(initial.x);
  await page.keyboard.down('d'); await page.waitForTimeout(320); await page.keyboard.up('d');
  const afterD = await page.evaluate(() => window.__CAMPUS__.controlTarget.x);
  expect(afterD).toBeLessThan(afterA);
  await page.keyboard.down('q'); await page.waitForTimeout(160); await page.keyboard.up('q');
  expect(await page.evaluate(() => window.__CAMPUS__.controls.state.azimuth)).toBeLessThan(initial.azimuth);
  await page.keyboard.down('r'); await page.waitForTimeout(160); await page.keyboard.up('r');
  expect(await page.evaluate(() => window.__CAMPUS__.controls.state.pitch)).toBeGreaterThan(initial.pitch);
  await page.locator('canvas').hover({ position: { x: 900, y: 600 } });
  await page.mouse.wheel(0, 500);
  expect(await page.evaluate(() => window.__CAMPUS__.controls.state.distance)).toBeGreaterThan(initial.distance);
});

test('Campus warp navigates to every non-current room without loops or black screens', async ({ page }) => {
  test.setTimeout(120_000);
  for (const destination of rooms.filter(r => r.id !== 'home')) {
    await page.goto('/?room=home');
    await ready(page, 'home');
    await page.getByTestId('campus-door').click({ force: true });
    await page.locator(`.destination[data-destination="${destination.id}"]`).click();
    await page.waitForURL(new RegExp(`room=${destination.id}$`));
    await ready(page, destination.id);
    expect(await page.evaluate(() => window.__CAMPUS__.roomId)).toBe(destination.id);
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.locator('.fatal')).toHaveCount(0);
  }
});

test('invalid room ids fail with a helpful first-paint error boundary', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('/?room=does-not-exist');
  expect(response.status()).toBe(200);
  await expect(page.locator('.fatal strong')).toHaveText('Campus could not open this room.');
  await expect(page.locator('.fatal pre')).toContainText('does-not-exist');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});
