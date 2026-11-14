import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,linkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkDeploymentContext,selectPromotion,requireSuccessfulChecks,verifyPromotion,resolveSiteReference,inspectSite,readGitHubJSON} from './check-pages.mjs';

const repository='example/pricetrace',sha='a'.repeat(40),head='b'.repeat(40),previous='c'.repeat(40);
const context={eventName:'push',ref:'refs/heads/main',repository,sha};
const promotion={number:10,merged_at:'2026-11-14T00:00:00Z',state:'closed',merge_commit_sha:sha,base:{ref:'main',repo:{full_name:repository}},head:{ref:'stage',sha:head,repo:{full_name:repository}}};
const successful={id:100,event:'pull_request',head_sha:head,head_branch:'stage',head_repository:{full_name:repository},path:'.github/workflows/repository-checks.yml',pull_requests:[{number:10}],status:'completed',conclusion:'success'};

test('deployment accepts only main push or main manual invocation and valid metadata',()=>{
  checkDeploymentContext(context);checkDeploymentContext({...context,eventName:'workflow_dispatch'});
  for(const change of [{ref:'refs/heads/stage'},{eventName:'pull_request'},{repository:'example/repo/../../other'},{sha:'HEAD'}])assert.throws(()=>checkDeploymentContext({...context,...change}));
});

test('deployment requires one same-repository stage promotion with preserved merge parent',()=>{
  assert.equal(selectPromotion([promotion],context,[previous,head]).number,10);
  for(const changes of [{merged_at:null},{merge_commit_sha:previous},{head:{...promotion.head,ref:'feat/change'}},{head:{...promotion.head,repo:{full_name:'foreign/repo'}}},{base:{...promotion.base,ref:'stage'}}])assert.throws(()=>selectPromotion([{...promotion,...changes}],context,[previous,head]));
  assert.throws(()=>selectPromotion([],context,[previous,head]));
  assert.throws(()=>selectPromotion([promotion,promotion],context,[previous,head]));
  assert.throws(()=>selectPromotion([promotion],context,[previous]));
  assert.throws(()=>selectPromotion([promotion],context,[previous,previous]));
});

test('latest exact-promotion checks must succeed, even when an earlier run passed',()=>{
  assert.equal(requireSuccessfulChecks([successful],promotion,repository).id,100);
  assert.equal(requireSuccessfulChecks([{...successful,pull_requests:[]}],promotion,repository).id,100);
  assert.equal(requireSuccessfulChecks([{...successful,path:successful.path+'@main'}],promotion,repository).id,100);
  for(const changes of [{conclusion:'failure'},{conclusion:'cancelled'},{status:'in_progress'},{head_sha:previous},{head_branch:'feat/other'},{path:'.github/workflows/other.yml'},{path:'.github/workflows/other.yml@main'},{head_repository:{full_name:'foreign/repo'}}])assert.throws(()=>requireSuccessfulChecks([{...successful,...changes}],promotion,repository));
  assert.throws(()=>requireSuccessfulChecks([successful,{...successful,id:101,conclusion:'failure'}],promotion,repository));
});

test('promotion verification binds API metadata to the checked-out SHA and performs only reads',async()=>{
  const paths=[];
  const getJSON=async path=>{paths.push(path);return path.includes('/git/ref/')?{object:{sha}}:path.includes('/commits/')?[promotion]:{workflow_runs:[successful]};};
  const readGit=(...args)=>args[0]==='rev-parse'?sha:previous+' '+head;
  assert.deepEqual(await verifyPromotion(context,{getJSON,readGit}),{promotion:10,checksRun:100,sha});
  assert.equal(paths.length,3);assert.ok(paths[1].includes('/commits/'+sha+'/pulls'));assert.ok(paths[2].includes('head_sha='+head));
  await assert.rejects(()=>verifyPromotion({...context,ref:'refs/heads/stage'},{getJSON,readGit}));
  await assert.rejects(()=>verifyPromotion(context,{getJSON,readGit:()=>previous}));
  assert.equal(paths.length,3);
  await assert.rejects(()=>verifyPromotion(context,{getJSON:async()=>({object:{sha:previous}}),readGit}),/newer main/);
});

test('GitHub transport preserves the supported merge-SHA response contract',async()=>{
  const requests=[];
  const request=async(url,options)=>{
    requests.push(url);
    assert.equal(options.headers['X-GitHub-Api-Version'],'2022-11-28');
    const body=url.includes('/git/ref/')?{object:{sha}}:url.includes('/commits/')?[promotion]:{workflow_runs:[successful]};
    return {ok:true,json:async()=>body};
  };
  const result=await verifyPromotion(context,{getJSON:path=>readGitHubJSON(path,'synthetic-token',request),readGit:(...args)=>args[0]==='rev-parse'?sha:previous+' '+head});
  assert.equal(result.sha,sha);assert.equal(requests.length,3);
  const responseWithoutMergeSha={...promotion};delete responseWithoutMergeSha.merge_commit_sha;
  assert.throws(()=>selectPromotion([responseWithoutMergeSha],context,[previous,head]),/merged stage-to-main PR/);
});

test('project assets remain beneath /pricetrace/ and missing or root-absolute links fail',()=>{
  const files=new Set(['index.html','app.js','nested/view.js']);
  for(const reference of ['./app.js','./','#main','https://example.com/guide'])resolveSiteReference(reference,'index.html',files);
  resolveSiteReference('../app.js','nested/view.js',files);
  for(const reference of ['/app.js','../app.js','./missing.js','data:text/html,test'])assert.throws(()=>resolveSiteReference(reference,'index.html',files));
});

function fixture(t){
  const root=mkdtempSync(join(tmpdir(),'pricetrace-pages-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  writeFileSync(join(root,'index.html'),'<link href="./styles.css"><script type="module" src="./app.js"></script>');
  writeFileSync(join(root,'styles.css'),'body{color:#222}');writeFileSync(join(root,'app.js'),"import {value} from './value.js';\n");writeFileSync(join(root,'value.js'),'export const value=1;');
  return root;
}

test('artifact inspection checks actual files, module closure and deterministic digest',t=>{
  const root=fixture(t),first=inspectSite(root);assert.equal(first.files,4);assert.equal(inspectSite(root).digest,first.digest);
  writeFileSync(join(root,'app.js'),"import {value} from '/value.js';\n");assert.throws(()=>inspectSite(root),/project-relative/);
  writeFileSync(join(root,'app.js'),"import {value} from './absent.js';\n");assert.throws(()=>inspectSite(root),/missing/);
});

test('artifact inspection rejects private files, credentials and hard links without printing values',t=>{
  const root=fixture(t);writeFileSync(join(root,'.env'),'local-only');assert.throws(()=>inspectSite(root),/Private or hidden/);rmSync(join(root,'.env'));
  const marker='github_'+'pat_'+'x'.repeat(30);writeFileSync(join(root,'value.js'),marker);
  assert.throws(()=>inspectSite(root),error=>error.message.includes('Credential pattern')&&!error.message.includes(marker));
  writeFileSync(join(root,'value.js'),'export const value=1;');linkSync(join(root,'value.js'),join(root,'linked.js'));assert.throws(()=>inspectSite(root),/Linked files/);
});
