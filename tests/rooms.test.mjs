import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertRoomSpec } from '../scripts/lib.mjs';

const root = path.resolve('.');
const ids = ['home', 'tsh', 'folio-work-kits', 'midas', 'wanderpick', 'agent-staff'];
const labels = ['Home', 'TSH', 'Folio Work Kits (DPF)', 'Midas', 'WanderPick', 'Agent Staff'];
const rooms = Object.fromEntries(ids.map(id => [id, JSON.parse(fs.readFileSync(path.join(root, 'rooms', `${id}.json`), 'utf8'))]));

for (const [id, room] of Object.entries(rooms)) {
  test(`${id} is a complete RoomSpec with shared interactive contracts`, () => {
    assertRoomSpec(room);
    assert.equal(room.id, id);
    assert.deepEqual(room.door.destinations.map(d => d.label), labels);
    assert.equal(room.jobs_wall.label, 'JOB WALL');
    assert.equal(room.door.label, 'Campus');
    assert.ok(room.pet.name && room.pet.species);
    assert.ok(room.agents.length >= 1);
    assert.ok(room.stations.some(s => s.role_type === 'orchestrator'));
    assert.ok(room.stations.some(s => s.role_type === 'builder'));
    assert.ok(room.stations.some(s => s.role_type === 'reviewer'));
    assert.ok(room.downtime_zone.kind);
    assert.ok(room.props.clusters.length >= 3);
    assert.ok(Object.keys(room.build_metadata.source_hashes).length >= 1);
  });
}

test('all six production rooms have distinct visual and behavioral identities', () => {
  const signatures = ids.map(id => {
    const r = rooms[id];
    return JSON.stringify([
      r.palette.wall_primary,
      r.palette.floor,
      r.architecture.composition,
      r.architecture.floor_pattern,
      r.lighting.recipe,
      r.architecture.openings.map(o => o.treatment),
      r.species.name,
      r.pet.species,
      r.jobs_wall.surface,
      r.props.clusters[0].type
    ]);
  });
  assert.equal(new Set(signatures).size, ids.length);
  assert.equal(new Set(ids.map(id => rooms[id].species.name)).size, ids.length);
  assert.equal(new Set(ids.map(id => rooms[id].pet.species)).size, ids.length);
  assert.equal(new Set(ids.map(id => rooms[id].jobs_wall.surface)).size, ids.length);
});

test('room-specific architecture and product truths are encoded in data', () => {
  assert.equal(rooms.home.architecture.openings.filter(o => o.type === 'window').length, 2);
  assert.equal(rooms.home.pet.species, 'house-cat');
  assert.equal(rooms.tsh.architecture.openings.filter(o => o.type === 'window').length, 3);
  assert.ok(rooms.tsh.props.clusters.some(p => p.type === 'parallel-bars'));
  assert.ok(rooms.tsh.props.clusters.some(p => p.type === 'rehab-stairs'));
  assert.equal(rooms.tsh.agents.find(a => a.handle === 'tsh').team_member, true);
  assert.equal(rooms.tsh.agents.find(a => a.handle === 'general-assistant').team_member, false);
  assert.equal(rooms.midas.architecture.openings.length, 0);
  assert.match(rooms.midas.identity_summary, /paper-only/i);
  assert.equal(rooms['folio-work-kits'].display_name, 'Folio Work Kits (DPF)');
  assert.match(rooms['folio-work-kits'].identity_summary, /public brand is Folio Work Kits/i);
  assert.match(rooms.wanderpick.identity_summary, /live Google Places API/i);
  assert.match(rooms.wanderpick.identity_summary, /no crawling and no local places index/i);
  assert.equal(rooms['agent-staff'].architecture.floor_pattern, 'carpet');
});

test('cron manifests are room-scoped and never leak across rooms', () => {
  const seen = new Map();
  for (const id of ids) {
    const room = rooms[id];
    const allowed = new Set(room.jobs_wall.job_scope);
    for (const job of room.jobs_wall.jobs) {
      assert.ok(allowed.has(job.owner), `${id}: owner ${job.owner} is outside job_scope`);
      assert.equal(seen.has(job.name), false, `${job.name} leaked into both ${seen.get(job.name)} and ${id}`);
      seen.set(job.name, id);
    }
  }
  assert.deepEqual(rooms.tsh.jobs_wall.jobs.map(j => j.name), [
    'tsh-supabase-backup',
    'tsh-google-voice-inbox-watch',
    'tsh-session-invoice-watch',
    'tsh-morning-briefing'
  ]);
});

test('production RoomSpecs and screenshots contain no sensitive payloads or personal paths', () => {
  const forbidden = [
    /\/Users\//i,
    /hamallar-mac/i,
    /\.hermes\//i,
    /api[_-]?key\s*[:=]/i,
    /seed phrase/i,
    /private key/i,
    /patient name/i,
    /wallet address/i
  ];
  for (const id of ids) {
    const serialized = JSON.stringify(rooms[id]);
    for (const pattern of forbidden) assert.doesNotMatch(serialized, pattern, `${id} matched ${pattern}`);
    const shot = path.join(root, 'docs', 'screenshots', `${id}.png`);
    assert.ok(fs.existsSync(shot), `missing tracked screenshot ${shot}`);
    assert.ok(fs.statSync(shot).size > 25_000, `${shot} looks empty`);
  }
});

test('shared runtime has one mount path and all required scene registries', () => {
  const runtimePath = path.join(root, 'src', 'runtime.js');
  const source = fs.readFileSync(runtimePath, 'utf8');
  const checked = spawnSync(process.execPath, ['--check', runtimePath], { encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal((source.match(/export async function mountCampus/g) || []).length, 1);
  for (const token of ['jobRoot', 'doorRoot', 'petApi.root', 'registry', 'Raycaster', 'controlTarget']) {
    assert.ok(source.includes(token), `runtime missing ${token}`);
  }
});
