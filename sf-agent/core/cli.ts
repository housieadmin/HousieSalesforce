#!/usr/bin/env node
import {runOperation} from "./runner.js";
const args=process.argv.slice(2);const cmd=args.shift();const val=(key:string)=>{const i=args.indexOf(key);return i<0?undefined:args[i+1]};
if(cmd!=="run"){console.error("Usage: sf-agent run --config <file> --operation <name>");process.exitCode=2}else{const op=val("--operation");if(!op){console.error("Missing --operation");process.exitCode=2}else try{console.log(JSON.stringify(await runOperation(val("--config")??"sf-agent.config.yml",op),null,2))}catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1}}