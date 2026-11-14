import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('checked-in fictional evaluation matches the current parser and catalog',()=>{
  const result=spawnSync(process.execPath,['scripts/evaluate.mjs','--check'],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(result.stdout);
  assert.equal(report.real_mail_tested,false);
  assert.equal(report.mode,'check');
});
