import './style.css';
import Ajv2020 from 'ajv/dist/2020.js';
import {mountCampus} from './runtime.js';

const allowed=new Set(['home','tsh','folio-work-kits','midas','wanderpick','agent-staff','sample-studio','sample-library']);
function fail(error){console.error(error);document.querySelector('#app').innerHTML=`<section class="fatal" role="alert"><strong>Campus could not open this room.</strong><p>The room failed validation before rendering, so the canvas was not left black.</p><pre>${String(error.message||error)}</pre><p>Check the RoomSpec against <code>schemas/room-spec.schema.json</code>.</p></section>`}
async function start(){try{const id=new URLSearchParams(location.search).get('room')||'home';if(!allowed.has(id))throw new Error(`Unknown room "${id}". Choose one of: ${[...allowed].join(', ')}`);const base=id.startsWith('sample-')?'/examples/rooms':'/rooms';const [specResponse,schemaResponse]=await Promise.all([fetch(`${base}/${id}.json`),fetch('/schemas/room-spec.schema.json')]);if(!specResponse.ok)throw new Error(`RoomSpec request failed: ${specResponse.status} ${specResponse.statusText} (${base}/${id}.json)`);if(!schemaResponse.ok)throw new Error(`Schema request failed: ${schemaResponse.status}`);const [spec,schema]=await Promise.all([specResponse.json(),schemaResponse.json()]);const validate=new Ajv2020({allErrors:true,strict:true}).compile(schema);if(!validate(spec))throw new Error(`RoomSpec validation failed:\n${validate.errors.map(e=>`${e.instancePath||'/'} ${e.message}`).join('\n')}`);await mountCampus(spec)}catch(error){fail(error)}}
start();
