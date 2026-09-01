import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import YAML from 'yaml';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const roomSchema = JSON.parse(fs.readFileSync(path.join(projectRoot, 'schemas/room-spec.schema.json'), 'utf8'));
const contextSchema = JSON.parse(fs.readFileSync(path.join(projectRoot, 'schemas/project-context.schema.json'), 'utf8'));
const ajv = new Ajv2020({allErrors: true, strict: true});
addFormats(ajv);
const validateRoom = ajv.compile(roomSchema);
const validateContext = ajv.compile(contextSchema);

export const DESTINATIONS = [
  {id:'home',label:'Home'}, {id:'tsh',label:'TSH'}, {id:'folio-work-kits',label:'Folio Work Kits (DPF)'},
  {id:'midas',label:'Midas'}, {id:'wanderpick',label:'WanderPick'}, {id:'agent-staff',label:'Agent Staff'}
];
export function readData(file){ const raw=fs.readFileSync(file,'utf8'); return file.endsWith('.yaml')||file.endsWith('.yml')?YAML.parse(raw):JSON.parse(raw); }
export function sha256(text){ return crypto.createHash('sha256').update(text).digest('hex'); }
export function validationErrors(errors=[]){ return errors.map(e=>`${e.instancePath || '/'} ${e.message}${e.params?.additionalProperty?` (${e.params.additionalProperty})`:''}`).join('\n'); }
export function assertProjectContext(value){ if(!validateContext(value)) throw new Error(`ProjectContext validation failed:\n${validationErrors(validateContext.errors)}`); privacyScan(value); return value; }
export function assertRoomSpec(value){ if(!validateRoom(value)) throw new Error(`RoomSpec validation failed:\n${validationErrors(validateRoom.errors)}`); privacyScan(value); return value; }
const forbidden=[
  {name:'personal filesystem path',re:/\/(Users|home)\/[^\s"']+/i},
  {name:'secret-like key',re:/(api[_-]?key|client[_-]?secret|private[_-]?key|password)\s*[:=]\s*[^\s,}]{8,}/i},
  {name:'wallet material',re:/(seed phrase|mnemonic|wallet private|recovery phrase)/i},
  {name:'health/client identifier',re:/(patient name|client health|date of birth|medical record)/i}
];
export function privacyScan(value){ const text=JSON.stringify(value); for(const rule of forbidden){ if(rule.re.test(text)) throw new Error(`Privacy exclusion triggered: ${rule.name}. Remove or replace the prohibited value before generation.`); } return true; }
export function seedFrom(id){ const h=crypto.createHash('sha256').update(id).digest(); return Math.max(1,h.readUInt32BE(0)&0x7fffffff); }
function placement(seed,index){ let x=(seed+index*2654435761)>>>0; x^=x<<13;x^=x>>>17;x^=x<<5; return Number((((x>>>0)%1000)/1000*2-1).toFixed(3)); }
export function generateRoomSpec(context, sourcePath='project-context.json'){
  assertProjectContext(context);
  const seed=seedFrom(`${context.id}:${context.display_name}`), colors=context.visual_identity.colors;
  const sourceRaw=JSON.stringify(context);
  const stations=[
    {id:'orchestrator',label:'Orchestrator',role_type:'orchestrator',kind:'planning-board',position:[-5,0,1.5],rotation:0,color:colors[2],obstacle_radius:1.3},
    {id:'builder',label:'Builder',role_type:'builder',kind:'workbench',position:[1.5,0,-2.5],rotation:-0.5,color:colors[3]||colors[1],obstacle_radius:1.5},
    {id:'reviewer',label:'Reviewer',role_type:'reviewer',kind:'review-desk',position:[5,0,1],rotation:0.4,color:colors[4]||colors[2],obstacle_radius:1.2}
  ];
  const agents=context.agents.map((a,i)=>({handle:a.handle,role:a.role,station:stations[i%3].id,state:'away',team_member:a.team_member,model:'Local profile',usage:'Awaiting live adapter',current_work:null,last_work:'No live run observed',scale:Number((0.92+(i%3)*0.07).toFixed(2)),variant:i%6}));
  return assertRoomSpec({
    schema_version:'1.0.0',id:context.id,display_name:context.display_name,seed,identity_summary:context.summary,visual_keywords:context.visual_identity.keywords,
    palette:{background:colors[0],wall:colors[1],wall_secondary:colors[1],floor:colors[2],trim:colors[3]||colors[2],accent:colors[4]||colors[0],accent_secondary:colors[5]||colors[3]||colors[2],cream:'#fff4dc',dark:'#263238'},
    architecture:{footprint:{width:20,depth:16},wall_height:6,wall_thickness:.45,floor_material:context.visual_identity.materials[0],wall_material:context.visual_identity.materials[1],trim_style:'layered capped trim',floor_pattern:'boards',openings:[{type:'window',wall:'back',position:-4,width:3.2,height:3,sill:1.4,treatment:context.visual_identity.openings_hint},{type:'window',wall:'right',position:2,width:3,height:3,sill:1.4,treatment:context.visual_identity.openings_hint}],composition:'sample-studio',cutaway:'corner-cutaway'},
    lighting:{recipe:context.visual_identity.lighting_hint,environment:colors[0],key:'#fff1d3',fill:'#b8d8e8',key_intensity:2.8,fill_intensity:1.1,exposure:1.05,shadow_softness:4},
    species:{name:'Contextlings',silhouette:'round-eared',material:'matte ceramic',accent_feature:'role-color sash'},agents,stations,
    downtime_zone:{name:'Window nook',kind:'rug-nook',position:[6,0,-4.5],capacity:3},
    pet:{name:'Room companion',species:'house-cat',default_state:'wander',color:colors[4]||colors[2],digest:{room_burn:'light',last_success:'RoomSpec generated',last_failure:null,human_action:'Review the generated visual identity.'}},
    jobs_wall:{label:'JOB WALL',mount:'fascia',surface:'cork',accent:colors[4]||colors[2],face:'#fff4dc',position:[-5,2.8,-7.65],job_scope:[context.id,...context.agents.map(a=>a.handle)],jobs:[]},
    props:{hero:context.visual_identity.hero_feature,clusters:[{type:'hero-display',position:[placement(seed,1)*2,0,-4],rotation:0,color:colors[4]||colors[2]},{type:'material-library',position:[5,0,3],rotation:-.4,color:colors[3]||colors[1]}],accents:['layered wall caps','recessed openings','threshold trim','task cards','material samples']},
    door:{label:'Campus',position:[-9.65,2.33,4],destinations:DESTINATIONS},
    privacy:{...context.privacy,sanitized:true},build_metadata:{generator_version:'1.0.0',source_hashes:{[path.basename(sourcePath)]:sha256(sourceRaw)},model_provider:null,model_name:null,llm_used:false}
  });
}
export {projectRoot};
