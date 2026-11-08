import {resolve} from 'node:path';
import {makeReport} from './report.mjs';
const args=process.argv.slice(2);
if(args.length!==3){console.error('Usage: npm run perf:compare -- <A/result.json> <B/result.json> <report.html>');process.exit(2);}
await makeReport([resolve(args[0]),resolve(args[1])],resolve(args[2]));
console.log('Report:',resolve(args[2]));
