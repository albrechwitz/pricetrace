import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,lstatSync,appendFileSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {containsCredential,sensitivePath} from './check-repository.mjs';

const shaPattern=/^[a-f0-9]{40}$/;
const repositoryPattern=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();

export function checkDeploymentContext({eventName,ref,repository,sha}){
  if(!['push','workflow_dispatch'].includes(eventName)||ref!=='refs/heads/main')throw new Error('Only the main branch can deploy.');
  if(!repositoryPattern.test(repository||'')||!shaPattern.test(sha||''))throw new Error('Invalid deployment metadata.');
}

export function selectPromotion(pulls,{repository,sha},parents){
  const candidates=pulls.filter(pr=>pr.merged_at&&pr.state==='closed'&&pr.merge_commit_sha===sha
    &&pr.base?.ref==='main'&&pr.head?.ref==='stage'
    &&pr.base?.repo?.full_name===repository&&pr.head?.repo?.full_name===repository);
  if(candidates.length!==1)throw new Error('The deployment commit must be a merged stage-to-main PR.');
  const promotion=candidates[0];
  if(!Number.isInteger(promotion.number)||!shaPattern.test(promotion.head?.sha||''))throw new Error('Invalid promotion metadata.');
  if(parents.length!==2||parents[1]!==promotion.head.sha)throw new Error('Promotion must preserve the verified stage commit with a merge.');
  return promotion;
}

export function requireSuccessfulChecks(runs,promotion,repository){
  const matching=runs.filter(run=>run.event==='pull_request'&&run.head_sha===promotion.head.sha
    &&run.head_branch==='stage'&&run.head_repository?.full_name===repository
    &&run.path?.split('@',1)[0]==='.github/workflows/repository-checks.yml').sort((a,b)=>b.id-a.id);
  // GitHub may empty run.pull_requests after merge. Checks belong to this exact
  // stage SHA; the merged PR and preserved merge parent were verified separately.
  const latest=matching[0];
  if(!latest||latest.status!=='completed'||latest.conclusion!=='success')throw new Error('The promotion PR must have successful current Repository checks.');
  return latest;
}

export async function verifyPromotion(context,{getJSON,readGit=git}){
  checkDeploymentContext(context);
  if(readGit('rev-parse','HEAD')!==context.sha)throw new Error('Checked-out source does not match the deployment commit.');
  const prefix=`/repos/${context.repository}`;
  const main=await getJSON(`${prefix}/git/ref/heads/main`);
  if(main.object?.sha!==context.sha)throw new Error('A newer main commit exists; deploy that commit instead.');
  const pulls=await getJSON(`${prefix}/commits/${context.sha}/pulls?per_page=100`);
  const parents=readGit('show','-s','--format=%P',context.sha).split(' ').filter(Boolean);
  const promotion=selectPromotion(pulls,context,parents);
  const result=await getJSON(`${prefix}/actions/workflows/repository-checks.yml/runs?event=pull_request&head_sha=${promotion.head.sha}&per_page=100`);
  const run=requireSuccessfulChecks(result.workflow_runs||[],promotion,context.repository);
  return {promotion:promotion.number,checksRun:run.id,sha:context.sha};
}

export function resolveSiteReference(reference,from,files){
  if(!reference||reference.startsWith('#')||/^https?:\/\//i.test(reference))return;
  if(reference.startsWith('/')||/^[a-z][a-z0-9+.-]*:/i.test(reference))throw new Error('Site assets must preserve the project-relative path.');
  const url=new URL(reference,`https://preview.invalid/pricetrace/${from}`);
  const path=decodeURIComponent(url.pathname);
  if(!path.startsWith('/pricetrace/'))throw new Error('Site reference escapes the project path.');
  const local=path.slice('/pricetrace/'.length)+(path.endsWith('/')?'index.html':'');
  if(!files.has(local))throw new Error('Site asset or module is missing: '+local);
}

export function inspectSite(root='dist'){
  const files=[];
  function visit(directory,prefix=''){
    for(const entry of readdirSync(directory,{withFileTypes:true})){
      const path=prefix+entry.name,absolute=join(directory,entry.name),stat=lstatSync(absolute);
      if(stat.isSymbolicLink()||(!stat.isDirectory()&&stat.nlink!==1))throw new Error('Linked files cannot enter the Pages artifact.');
      if(path.split('/').some(part=>part.startsWith('.'))||sensitivePath(path))throw new Error('Private or hidden path in Pages artifact.');
      if(stat.isDirectory())visit(absolute,path+'/');
      else{
        if(!['.html','.css','.js','.svg'].includes(extname(path)))throw new Error('Unexpected file type in Pages artifact: '+path);
        const content=readFileSync(absolute,'utf8');
        if(containsCredential(content))throw new Error('Credential pattern in Pages artifact: '+path);
        files.push({path,content,sha256:createHash('sha256').update(content).digest('hex')});
      }
    }
  }
  visit(root);
  const names=new Set(files.map(file=>file.path));
  if(!names.has('index.html'))throw new Error('Pages requires dist/index.html.');
  for(const {path,content} of files){
    const references=path.endsWith('.html')?[...content.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)].map(match=>match[1]):[];
    if(path.endsWith('.js')){
      references.push(...[...content.matchAll(/\b(?:import|export)\s+[^;\n]*?\bfrom\s*["']([^"']+)["']/g)].map(match=>match[1]));
      references.push(...[...content.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].map(match=>match[1]));
    }
    if(path.endsWith('.css'))references.push(...[...content.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)].map(match=>match[1]));
    for(const reference of references)resolveSiteReference(reference,path,names);
  }
  const entries=files.map(({path,sha256})=>({path,sha256})).sort((a,b)=>a.path.localeCompare(b.path));
  return {files:entries.length,digest:createHash('sha256').update(JSON.stringify(entries)).digest('hex')};
}

async function main(){
  if(process.argv.includes('--site-only')){
    if(git('status','--porcelain','--untracked-files=all','--ignored','--','dist'))throw new Error('Deployment files differ from the checked-out commit.');
    const site=inspectSite();console.log(JSON.stringify(site));
    if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`\nStatic artifact: ${site.files} files; SHA-256 manifest digest \`${site.digest}\`.\n`);
    return;
  }
  const context={eventName:process.env.GITHUB_EVENT_NAME,ref:process.env.GITHUB_REF,repository:process.env.GITHUB_REPOSITORY,sha:process.env.GITHUB_SHA};
  const token=process.env.GITHUB_TOKEN;if(!token)throw new Error('A read-only GitHub token is required for deployment metadata.');
  const getJSON=async path=>{
    const response=await fetch('https://api.github.com'+path,{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2026-03-10'},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error('GitHub deployment metadata lookup failed: HTTP '+response.status);
    return response.json();
  };
  const result=await verifyPromotion(context,{getJSON});console.log(JSON.stringify(result));
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`Verified main commit \`${result.sha}\` from promotion PR #${result.promotion}; Repository checks run ${result.checksRun}.\n`);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
