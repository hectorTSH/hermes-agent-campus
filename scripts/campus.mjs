#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {assertProjectContext,assertRoomSpec,generateRoomSpec,projectRoot,readData} from './lib.mjs';

const [command,...args]=process.argv.slice(2);
function option(name){ const i=args.indexOf(name); return i>=0?args[i+1]:null; }
function files(dir){ return fs.readdirSync(dir).filter(f=>/\.(json|ya?ml)$/.test(f)).map(f=>path.join(dir,f)); }
try{
  if(command==='generate'){
    const input=option('--context'), output=option('--out');
    if(!input||!output) throw new Error('Usage: npm run generate -- --context examples/contexts/sample-studio.json --out rooms/sample-studio.json');
    const context=assertProjectContext(readData(input)); const spec=generateRoomSpec(context,input);
    fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,JSON.stringify(spec,null,2)+'\n');
    console.log(`Generated schema-valid RoomSpec: ${output} (seed ${spec.seed}, LLM used: ${spec.build_metadata.llm_used})`);
  } else if(command==='validate'){
    const input=option('--room'); if(!input) throw new Error('Usage: node scripts/campus.mjs validate --room rooms/home.json'); assertRoomSpec(readData(input)); console.log(`Valid RoomSpec: ${input}`);
  } else if(command==='validate-context'){
    const input=option('--context'); if(!input) throw new Error('Usage: node scripts/campus.mjs validate-context --context examples/contexts/sample-studio.json'); assertProjectContext(readData(input)); console.log(`Valid ProjectContext: ${input}`);
  } else if(command==='validate-all'){
    const roomDirs=[path.join(projectRoot,'rooms'),path.join(projectRoot,'examples/rooms')].filter(fs.existsSync);
    const contextDirs=[path.join(projectRoot,'examples/contexts')].filter(fs.existsSync);
    let count=0; for(const dir of contextDirs) for(const file of files(dir)){ assertProjectContext(readData(file)); count++; }
    for(const dir of roomDirs) for(const file of files(dir)){ assertRoomSpec(readData(file)); count++; }
    console.log(`Validated ${count} ProjectContext/RoomSpec files.`);
  } else throw new Error('Commands: generate, validate, validate-context, validate-all');
}catch(error){ console.error(error.message); process.exitCode=1; }
