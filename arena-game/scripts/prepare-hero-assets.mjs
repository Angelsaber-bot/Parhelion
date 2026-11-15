// Jeanne's World runtime is split only for storage. Ship one standard gzip asset to Arena.
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const source=new URL('../../assets/characters/jeanne/final_20261110/',import.meta.url);
const bytes=Buffer.concat(await Promise.all(['runtime.part1.bin','runtime.part2.bin'].map(name=>fs.readFile(new URL(name,source)))));
const glb=gunzipSync(bytes);if(glb.readUInt32LE(0)!==0x46546c67||glb.readUInt32LE(8)!==glb.length)throw Error('Invalid Jeanne World runtime');
const directory=new URL('../.scratch/hero-assets/',import.meta.url);await fs.mkdir(directory,{recursive:true});await fs.writeFile(new URL('jeanne-runtime.glb.gz',directory),bytes);
