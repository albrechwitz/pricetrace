import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const branchPattern=/^(feat|fix|refactor|docs|test|chore)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const subjectPattern=/^(feat|fix|refactor|docs|test|chore|ci|build|perf|revert)(\([a-zA-Z0-9][a-zA-Z0-9._/-]*\))?!?: \S.*$/;
const shaPattern=/^[a-f0-9]{40}$/;

export function checkRoute({baseRef,headRef,baseRepository,headRepository}){
  if(!baseRepository||baseRepository!==headRepository)throw new Error('The PR must stay in the same repository.');
  if(baseRef==='main'){
    if(headRef!=='stage')throw new Error('Only stage may open a promotion PR to main.');
  }else if(baseRef==='stage'){
    if(!branchPattern.test(headRef||''))throw new Error('A stage PR must use a standard task branch.');
  }else throw new Error('The PR target must be stage or main.');
}

export function checkCommitSubject(subject){
  if(!subjectPattern.test(subject))throw new Error('A non-merge commit does not follow Conventional Commits.');
}

export function sensitivePath(path){
  const value=path.replaceAll('\\','/');
  const name=value.split('/').at(-1);
  return /(^|\/)(?:\.openai|backups?|data)(?:\/|$)/i.test(value)
    || (/^\.env(?:\..*)?$/.test(name)&&name!=='.env.example')
    || /^(?:credentials|token).*\.json$/i.test(name)
    || /^(?:mailtrace|pricetrace)-backup.*\.json$/i.test(name)
    || /\.(?:eml|mbox|sqlite|sqlite3|db|p12|pfx)$/i.test(name);
}

export function containsCredential(text){
  return /github_pat_[A-Za-z0-9_]{20,}/.test(text)
    || /gh[pousr]_[A-Za-z0-9]{20,}/.test(text)
    || /GOCSPX-[A-Za-z0-9_-]{15,}/.test(text)
    || /AIza[0-9A-Za-z_-]{30,}/.test(text)
    || /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(text);
}

export function isDocumentationOnly(changedPaths){
  return changedPaths.length>0&&changedPaths.every(path=>/\.md$/i.test(path)||/^(?:LICENSE|NOTICE)(?:\.txt)?$/.test(path));
}

function command(binary,args,options={}){
  return execFileSync(binary,args,{encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe'],...options});
}
const git=(...args)=>command('git',args);
const lines=value=>value.split(/\r?\n/).filter(Boolean);
const paths=value=>value.split('\0').filter(Boolean);

function inspectFile(path,content){
  // Report only the path; never print a matched credential or source line.
  if(sensitivePath(path))throw new Error(`Private data path is not allowed: ${path}`);
  if(containsCredential(content))throw new Error(`Credential pattern detected in: ${path}`);
}

export function scanCommitHistory(base,head,readGit=git){
  const commits=lines(readGit('rev-list',`${base}..${head}`));
  for(const sha of commits){
    // -m compares a merge result with each parent, including merge-resolution edits.
    const changed=new Set(paths(readGit('diff-tree','-m','--root','--no-commit-id','--no-renames','--name-only','-z','-r','--diff-filter=ACMT',sha)));
    for(const path of changed)inspectFile(path,readGit('show',`${sha}:${path}`));
  }
  return commits.length;
}

function discoverTests(directory){
  if(!existsSync(directory))return [];
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const path=join(directory,entry.name);
    return entry.isDirectory()?discoverTests(path):entry.name.endsWith('.test.mjs')?[path]:[];
  });
}

export function runRepositoryChecks(event){
  const pr=event.pull_request;
  if(!pr)throw new Error('A pull_request event is required; do not bypass the route check.');
  checkRoute({baseRef:pr.base?.ref,headRef:pr.head?.ref,baseRepository:pr.base?.repo?.full_name,headRepository:pr.head?.repo?.full_name});
  const base=pr.base?.sha,head=pr.head?.sha;
  if(!shaPattern.test(base||'')||!shaPattern.test(head||''))throw new Error('The PR commit identifiers are invalid.');
  git('cat-file','-e',`${base}^{commit}`);
  git('cat-file','-e',`${head}^{commit}`);
  const range=`${base}..${head}`;
  const commits=lines(git('rev-list','--no-merges',range));
  if(!commits.length)throw new Error('The PR has no source commits to verify.');
  for(const sha of commits){
    checkCommitSubject(git('show','-s','--format=%s',sha).trim());
  }
  // Inspect every introduced blob, including secrets later removed and merge-only edits.
  scanCommitHistory(base,head);
  try{git('diff','--check',`${base}...${head}`);}catch{throw new Error('Whitespace check failed; inspect the diff locally.');}
  const docsOnly=isDocumentationOnly(paths(git('diff','--name-only','-z',`${base}...${head}`)));
  const tracked=paths(git('ls-files','-z'));
  for(const path of tracked)inspectFile(path,readFileSync(path,'utf8'));
  for(const path of tracked.filter(path=>/\.(?:mjs|js|cjs)$/.test(path)&&(!docsOnly||path.startsWith('scripts/check-repository')))){
    try{command(process.execPath,['--check',path]);}catch{throw new Error(`JavaScript syntax check failed: ${path}`);}
  }
  const tests=docsOnly?['scripts/check-repository.test.mjs']:[...discoverTests('scripts'),...discoverTests('tests')];
  if(tests.length)command(process.execPath,['--test',...tests],{stdio:'inherit'});
  console.log(`PASS · ${pr.head.ref} -> ${pr.base.ref} · ${commits.length} source commits · ${tests.length} test files`);
  console.log(`Verified PR head: ${head}; proposed merge: ${git('rev-parse','HEAD').trim()}`);
  if(docsOnly)console.log('Documentation-only PR: application checks are not required.');
  console.log('Pattern scanning and a passing workflow do not imply server-enforced branch protection.');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(!process.env.GITHUB_EVENT_PATH)throw new Error('GITHUB_EVENT_PATH must point to the PR event payload.');
    runRepositoryChecks(JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')));
  }catch(error){
    // Child-process stderr may contain source lines; keep it out of public logs.
    console.error(error?.status!=null?'Repository command failed; inspect it locally.':error.message);
    process.exitCode=1;
  }
}
