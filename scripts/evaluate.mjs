import {readFile,writeFile} from 'node:fs/promises';
import {extractMessages,VERSION} from '../dist/core.js';
import {buildCatalog} from '../dist/catalog.js';
import {samples,sampleRates} from '../dist/samples.js';
const rows=extractMessages(samples),catalog=buildCatalog(rows,sampleRates);
const report={dataset:'synthetic-price-histories',fixture:'dist/samples.js',engineVersion:VERSION,real_mail_tested:false,messages:samples.length,extractedRows:rows.length,summary:catalog.summary,productGroupsIncludingUnresolvedAndCancelled:catalog.products.length,repeatProducts:catalog.products.filter(product=>product.purchaseCount>1).length,products:catalog.products.map(product=>({identity:product.identity,purchaseCount:product.purchaseCount,reviewCount:product.reviewCount,purchases:product.purchases.map(purchase=>({order:purchase.order,pricing:purchase.pricing,change:purchase.change,eligible:purchase.eligible,issues:purchase.issues,sourceMessageIds:purchase.source.messageIds}))})),limitations:['All messages and sample exchange rates are fictional development fixtures, not a real-world accuracy evaluation.','The separate 13-message HTML demo is evaluated in tests/browser.html; it is not this report dataset.','Korean/English label rules, table structures and supported Schema.org Order fields cannot cover every seller template or image attachment.','Product name and option matching cannot guarantee physical product identity; conflicting manufacturers require review.','Reference FX conversion is an estimate, not the credit-card settlement amount.']};
const contents=JSON.stringify(report,null,2)+String.fromCharCode(10);
const target=new URL('../validation.json',import.meta.url);
if(process.argv.includes('--check')){
  if(await readFile(target,'utf8')!==contents)throw new Error('validation.json is stale; regenerate it with node scripts/evaluate.mjs.');
}else await writeFile(target,contents);
console.log(JSON.stringify({dataset:report.dataset,messages:report.messages,...report.summary,productGroups:report.productGroupsIncludingUnresolvedAndCancelled,repeatProducts:report.repeatProducts,real_mail_tested:false,mode:process.argv.includes('--check')?'check':'write'}));
