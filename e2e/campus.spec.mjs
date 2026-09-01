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

test('local adapter exposes only sanitized room-scoped live state', async ({ request }) => {
  const response = await request.get('/api/campus-state?room=home');
  expect(response.status()).toBe(200);
  const state = await response.json();
  expect(state.room_id).toBe('home');
  expect(state.connected).toBe(true);
  expect(state.agents.length).toBeGreaterThan(0);
  expect(state.agents.every(agent => ['default', 'general-assistant'].includes(agent.handle))).toBe(true);
  expect(state.token_usage.burn).toBeGreaterThanOrEqual(0);
  expect(state.agents.every(agent => agent.token_usage.burn >= 0)).toBe(true);
  const serialized = JSON.stringify(state);
  for (const forbidden of ['prompt', 'system_prompt', 'tool_calls', 'cwd', '/Users/']) {
    expect(serialized).not.toContain(forbidden);
  }
});

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
    await expect(page.locator('[data-panel-body]')).toContainText('Token burn');
    await expect(page.locator('[data-panel-body]')).toContainText('Token usage');
    await expect(page.getByTestId('toggle-agent-state')).toHaveCount(0);
    await page.evaluate(() => {
      const agent = window.__CAMPUS__.agents[0];
      agent.setState(agent.state === 'working' ? 'idle' : 'working');
    });
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({
      position: window.__CAMPUS__.agents[0].root.position.toArray(),
      walking: window.__CAMPUS__.agents[0].walking,
      pathLength: window.__CAMPUS__.agents[0].path.length
    }));
    expect(after.pathLength).toBeGreaterThan(0);
    expect(Math.hypot(after.position[0] - before[0], after.position[2] - before[2])).toBeGreaterThan(0.1);

    await page.getByTestId('room-pet').click({ force: true });
    await expect(page.locator('[data-panel-title]')).toContainText('room digest');
    await expect(page.locator('[data-panel-body]')).toContainText('Room token burn');
    await expect(page.locator('[data-panel-body]')).toContainText('Room token usage');
    await page.locator('#panel .close').click();

    await page.getByTestId('jobs-wall').click({ force: true });
    await expect(page.locator('[data-panel-title]')).toHaveText('JOB WALL');
    const shownJobs = await page.locator('.job h3').allTextContents();
    expect(shownJobs).toEqual(state.jobs.length ? state.jobs : ['No scheduled jobs']);
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

test('open agent and pet popups repaint when live token burn changes', async ({ page }) => {
  await page.goto('/?room=home');
  await ready(page, 'home');
  const firstTag = page.locator('[data-testid="agent-tag"]').first();
  await firstTag.click({ force: true });
  await page.evaluate(() => {
    const current = window.__CAMPUS__.spec;
    const live = {
      connected: true,
      generated_at: new Date().toISOString(),
      jobs: current.jobs_wall.jobs,
      agents: current.agents.map(agent => ({...agent})),
      token_usage: {input: 1200, output: 300, cache_read: 4000, cache_write: 500, burn: 6000}
    };
    live.agents[0].token_usage = {...live.token_usage};
    window.__CAMPUS__.applyLiveState(live);
  });
  await expect(page.locator('[data-panel-body]')).toContainText('6,000');

  await page.getByTestId('room-pet').click({ force: true });
  await expect(page.locator('[data-panel-body]')).toContainText('6,000');
});

test('live-state outages immediately clear operational metadata and repaint open panels', async ({ page }) => {
  await page.goto('/?room=home');
  await ready(page, 'home');
  await page.locator('[data-testid="agent-tag"]').first().click({ force: true });
  await page.evaluate(() => window.__CAMPUS__.applyLiveState(null));
  const state = await page.evaluate(() => ({
    connected: window.__CAMPUS__.spec.live.connected,
    jobs: window.__CAMPUS__.spec.jobs_wall.jobs.length,
    burn: window.__CAMPUS__.spec.live.token_usage.burn,
    agentStates: window.__CAMPUS__.agents.map(agent => agent.state),
    models: window.__CAMPUS__.agents.map(agent => agent.data.model)
  }));
  expect(state.connected).toBe(false);
  expect(state.jobs).toBe(0);
  expect(state.burn).toBe(0);
  expect(state.agentStates.every(value => value === 'away')).toBe(true);
  expect(state.models.every(value => value === 'Local profile')).toBe(true);
  await expect(page.locator('[data-panel-body]')).toContainText('Adapter unavailable');
  await expect(page.locator('[data-panel-body]')).toContainText('Token burn');
  await expect(page.locator('[data-panel-body]')).toContainText('0');
});

test('Folio break nook sign labels the couch and idle agents stay off the seat', async ({ page }) => {
  await page.goto('/?room=folio-work-kits');
  await ready(page, 'folio-work-kits');
  const layout = await page.evaluate(() => {
    const seat = window.__CAMPUS__.scene.getObjectByName('downtime-seat');
    const sign = window.__CAMPUS__.scene.getObjectByName('break-nook-sign');
    return {
      parent: sign?.parent?.name || null,
      local: sign?.position.toArray() || null,
      seat: seat?.position.toArray() || null
    };
  });
  expect(layout.parent).toBe('downtime-seat');
  expect(layout.local[0]).toBeCloseTo(0, 2);
  expect(layout.local[1]).toBeGreaterThan(1.7);
  expect(layout.local[2]).toBeGreaterThan(0.55);

  await page.evaluate(() => window.__CAMPUS__.agents.forEach(agent => agent.setState('idle')));
  await page.waitForTimeout(2600);
  const clipping = await page.evaluate(() => {
    const seat = window.__CAMPUS__.spec.downtime_zone.position;
    return window.__CAMPUS__.agents.map(agent => {
      const dx = Math.abs(agent.root.position.x - seat[0]);
      const dz = Math.abs(agent.root.position.z - seat[2]);
      return { handle: agent.data.handle, inSeat: dx < 1.7 && dz < 0.85 };
    });
  });
  expect(clipping.filter(agent => agent.inSeat)).toEqual([]);
});

test('agents and pets visibly move while keeping furniture clearance', async ({ page }) => {
  await page.goto('/?room=home');
  await ready(page, 'home');
  const before = await page.evaluate(() => window.__CAMPUS__.pet.root.position.toArray());
  await page.waitForTimeout(1600);
  const after = await page.evaluate(() => window.__CAMPUS__.pet.root.position.toArray());
  expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeGreaterThan(0.08);

  await page.evaluate(() => window.__CAMPUS__.agents.forEach(agent => agent.setState('idle')));
  await page.waitForTimeout(2600);
  const clearances = await page.evaluate(() => window.__CAMPUS__.agents.map(agent =>
    Math.min(...window.__CAMPUS__.collisionObstacles.map(obstacle =>
      Math.hypot(agent.root.position.x - obstacle.center.x, agent.root.position.z - obstacle.center.z) - obstacle.radius
    ))
  ));
  expect(clearances.every(clearance => clearance > 0.42)).toBe(true);

  await page.goto('/?room=tsh');
  await ready(page, 'tsh');
  expect(await page.evaluate(() => window.__CAMPUS__.pet.root.userData.limbCount)).toBeGreaterThanOrEqual(4);
});

test('inverted pan, orbit, zoom and pitch controls update the shared camera state', async ({ page }) => {
  await page.goto('/?room=home');
  await ready(page, 'home');
  const initial = await page.evaluate(() => ({ x: window.__CAMPUS__.controlTarget.x, ...window.__CAMPUS__.controls.state }));
  await page.keyboard.down('a'); await page.waitForTimeout(220); await page.keyboard.up('a');
  const afterA = await page.evaluate(() => window.__CAMPUS__.controlTarget.x);
  expect(afterA).toBeLessThan(initial.x);
  await page.keyboard.down('d'); await page.waitForTimeout(320); await page.keyboard.up('d');
  const afterD = await page.evaluate(() => window.__CAMPUS__.controlTarget.x);
  expect(afterD).toBeGreaterThan(afterA);
  await page.keyboard.down('q'); await page.waitForTimeout(160); await page.keyboard.up('q');
  expect(await page.evaluate(() => window.__CAMPUS__.controls.state.azimuth)).toBeGreaterThan(initial.azimuth);
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

test('BOSS MODE opens one overhead floor plan and room selection returns to that room', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?room=home');
  await ready(page, 'home');

  await page.getByTestId('campus-door').click({ force: true });
  const bossMode = page.getByTestId('boss-mode');
  await expect(bossMode).toHaveText(/BOSS MODE/);
  await bossMode.click();
  await page.waitForURL(/view=boss/);
  await page.waitForFunction(() => window.__CAMPUS__?.ready && window.__CAMPUS__.mode === 'boss');

  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByTestId('boss-room')).toHaveCount(rooms.length);
  expect(await page.getByTestId('boss-room').allTextContents()).toEqual(labels);
  const overview = await page.evaluate(() => ({
    mode: window.__CAMPUS__.mode,
    roomIds: window.__CAMPUS__.rooms.map(room => room.spec.id),
    agentCount: window.__CAMPUS__.rooms.reduce((total, room) => total + room.agents.length, 0)
  }));
  expect(overview.mode).toBe('boss');
  expect(overview.roomIds).toEqual(rooms.map(room => room.id));
  expect(overview.agentCount).toBeGreaterThanOrEqual(rooms.length);
  const rosterChecks = await page.evaluate(() => {
    const room = window.__CAMPUS__.rooms.find(item => item.spec.id === 'home');
    const current = room.agents.map(api => ({handle: api.data.handle}));
    return {
      unchanged: room.requiresRosterReload({connected: true, agents: current}),
      added: room.requiresRosterReload({connected: true, agents: [...current, {handle: 'shared-helper'}]}),
      removed: room.requiresRosterReload({connected: true, agents: current.slice(1)}),
      outage: room.requiresRosterReload(null)
    };
  });
  expect(rosterChecks).toEqual({unchanged: false, added: true, removed: true, outage: false});
  const panelOwnership = await page.evaluate(() => {
    const home = window.__CAMPUS__.rooms.find(item => item.spec.id === 'home');
    const tsh = window.__CAMPUS__.rooms.find(item => item.spec.id === 'tsh');
    const snapshot = room => ({
      connected: true,
      generated_at: new Date().toISOString(),
      jobs: room.spec.jobs_wall.jobs,
      agents: room.agents.map(api => ({...api.data})),
      token_usage: room.spec.live.token_usage || {input: 0, output: 0, cache_read: 0, cache_write: 0, burn: 0}
    });
    home.agents[0].root.userData.interactive();
    const homeTitle = document.querySelector('[data-panel-title]').textContent;
    tsh.applyLiveState(snapshot(tsh));
    const afterTshRefresh = document.querySelector('[data-panel-title]').textContent;
    tsh.agents[0].root.userData.interactive();
    const tshTitle = document.querySelector('[data-panel-title]').textContent;
    home.applyLiveState(snapshot(home));
    const afterHomeRefresh = document.querySelector('[data-panel-title]').textContent;
    return {homeTitle, afterTshRefresh, tshTitle, afterHomeRefresh};
  });
  expect(panelOwnership.afterTshRefresh).toBe(panelOwnership.homeTitle);
  expect(panelOwnership.afterHomeRefresh).toBe(panelOwnership.tshTitle);
  expect(panelOwnership.homeTitle).not.toBe(panelOwnership.tshTitle);
  await page.locator('#panel .close').click();
  await expect(page.locator('#panel')).toBeHidden();

  await page.locator('[data-testid="boss-room"][data-room-id="tsh"]').click();
  await page.waitForURL(/room=tsh/);
  await ready(page, 'tsh');
  expect(await page.evaluate(() => window.__CAMPUS__.roomId)).toBe('tsh');
});

test('invalid room ids render as text without executing markup', async ({ page }) => {
  const payload = '<img src=x onerror="window.__campusXss=1">';
  await page.goto(`/?room=${encodeURIComponent(payload)}`);
  await expect(page.locator('.fatal pre')).toContainText(payload);
  expect(await page.evaluate(() => window.__campusXss)).toBeUndefined();
  await expect(page.locator('.fatal img')).toHaveCount(0);
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

test('opening index.html directly explains the local-server requirement', async ({ page }) => {
  await page.goto(`file://${process.cwd()}/index.html`);
  await expect(page.locator('.file-warning h1')).toHaveText('Campus needs its local server');
  await expect(page.locator('.file-warning')).toContainText('npm run dev');
  await expect(page.locator('.file-warning')).toContainText('file://');
});
