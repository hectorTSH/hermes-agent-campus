import './style.css';
import Ajv2020 from 'ajv/dist/2020.js';
import {mountBossMode, mountCampus} from './runtime.js';

const productionIds = ['home', 'tsh', 'folio-work-kits', 'midas', 'wanderpick', 'agent-staff'];
const allowed = new Set([...productionIds, 'sample-studio', 'sample-library']);

function fail(error) {
  console.error(error);
  const section = document.createElement('section');
  section.className = 'fatal';
  section.setAttribute('role', 'alert');
  const heading = document.createElement('strong');
  heading.textContent = 'Campus could not open this room.';
  const explanation = document.createElement('p');
  explanation.textContent = 'The room failed validation before rendering, so the canvas was not left black.';
  const detail = document.createElement('pre');
  detail.textContent = String(error?.message || error);
  const guidance = document.createElement('p');
  guidance.append('Check the RoomSpec against ');
  const schema = document.createElement('code');
  schema.textContent = 'schemas/room-spec.schema.json';
  guidance.append(schema, '.');
  section.append(heading, explanation, detail, guidance);
  document.querySelector('#app').replaceChildren(section);
}

async function fetchLive(id) {
  if (id.startsWith('sample-')) return null;
  try {
    const response = await fetch(`/api/campus-state?room=${encodeURIComponent(id)}`, {cache: 'no-store'});
    if (!response.ok) return null;
    const live = await response.json();
    return live.connected && live.room_id === id ? live : null;
  } catch {
    return null;
  }
}

function mergeLive(spec, live) {
  if (!live) {
    spec.live = {connected: false, generated_at: null, token_usage: null};
    return spec;
  }
  const base = new Map(spec.agents.map((agent) => [agent.handle, agent]));
  const stations = spec.stations.map((station) => station.id);
  spec.agents = live.agents.map((agent, index) => ({
    ...base.get(agent.handle),
    handle: agent.handle,
    role: agent.role || base.get(agent.handle)?.role || 'Shared project support',
    station: agent.station || base.get(agent.handle)?.station || stations[index % stations.length],
    team_member: agent.team_member ?? base.get(agent.handle)?.team_member ?? false,
    scale: agent.scale || base.get(agent.handle)?.scale || 0.98,
    variant: agent.variant ?? base.get(agent.handle)?.variant ?? index % 8,
    ...agent
  }));
  spec.jobs_wall.jobs = live.jobs;
  spec.live = {connected: true, generated_at: live.generated_at, token_usage: live.token_usage};
  return spec;
}

async function start() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'boss') {
      const schemaResponse = await fetch('/schemas/room-spec.schema.json');
      if (!schemaResponse.ok) throw new Error(`Schema request failed: ${schemaResponse.status}`);
      const schema = await schemaResponse.json();
      const validate = new Ajv2020({allErrors: true, strict: true}).compile(schema);
      const specs = await Promise.all(productionIds.map(async (id) => {
        const response = await fetch(`/rooms/${id}.json`);
        if (!response.ok) throw new Error(`RoomSpec request failed: ${response.status} ${response.statusText} (/rooms/${id}.json)`);
        const spec = await response.json();
        if (!validate(spec)) throw new Error(`RoomSpec validation failed for ${id}:\n${validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`).join('\n')}`);
        return mergeLive(spec, await fetchLive(id));
      }));
      await mountBossMode(specs);
      if (!navigator.webdriver) {
        setInterval(async () => {
          const current = window.__CAMPUS__;
          const updates = await Promise.all(current.rooms.map(async (room) => ({
            room,
            live: await fetchLive(room.spec.id)
          })));
          if (updates.some(({room, live}) => room.requiresRosterReload(live))) {
            location.reload();
            return;
          }
          for (const {room, live} of updates) room.applyLiveState(live);
        }, 5000);
      }
      return;
    }

    const id = params.get('room') || 'home';
    if (!allowed.has(id)) throw new Error(`Unknown room "${id}". Choose one of: ${[...allowed].join(', ')}`);
    const base = id.startsWith('sample-') ? '/examples/rooms' : '/rooms';
    const [specResponse, schemaResponse] = await Promise.all([
      fetch(`${base}/${id}.json`),
      fetch('/schemas/room-spec.schema.json')
    ]);
    if (!specResponse.ok) throw new Error(`RoomSpec request failed: ${specResponse.status} ${specResponse.statusText} (${base}/${id}.json)`);
    if (!schemaResponse.ok) throw new Error(`Schema request failed: ${schemaResponse.status}`);
    const [spec, schema] = await Promise.all([specResponse.json(), schemaResponse.json()]);
    const validate = new Ajv2020({allErrors: true, strict: true}).compile(schema);
    if (!validate(spec)) throw new Error(`RoomSpec validation failed:\n${validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`).join('\n')}`);
    mergeLive(spec, await fetchLive(id));
    await mountCampus(spec);
    if (!id.startsWith('sample-') && !navigator.webdriver) {
      setInterval(async () => {
        const live = await fetchLive(id);
        const current = window.__CAMPUS__;
        if (current.requiresRosterReload?.(live)) {
          location.reload();
          return;
        }
        current.applyLiveState?.(live);
      }, 3000);
    }
  } catch (error) {
    fail(error);
  }
}

start();
