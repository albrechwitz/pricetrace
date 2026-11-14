export function htmlContent(html) {
  // Parse inertly; never append email DOM, links, images, or scripts to the application.
  const template = document.createElement('template');
  template.innerHTML = html; // template contents stay inert, including remote images
  const doc = template.content;
  const structured = [];
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) { try { structured.push(JSON.parse(script.textContent)); } catch { /* malformed structured data falls back to text */ } }
  doc.querySelectorAll('script,style,iframe,img,video,audio,object,embed,link').forEach(e => e.remove());
  doc.querySelectorAll('br').forEach(e => e.replaceWith('\n'));
  doc.querySelectorAll('td,th').forEach(e => e.append('\n'));
  doc.querySelectorAll('div,p,tr,li,section,article,h1,h2,h3').forEach(e => e.append('\n'));
  const tables=[...doc.querySelectorAll('table')].map(table=>[...table.querySelectorAll('tr')].filter(row=>row.closest('table')===table).map(row=>[...row.children].filter(cell=>/^(TD|TH)$/.test(cell.tagName)).map(cell=>cell.querySelector('table')?'':cell.textContent.replace(/\s+/g,' ').trim())).filter(row=>row.length&&row.some(Boolean))).filter(rows=>rows.length);
  const orderIds=[];for(const link of doc.querySelectorAll('a[href]')){try{const u=new URL(link.getAttribute('href'));for(const [key,value] of u.searchParams)if(/^(?:orderid|order_id|orderno|order_no|ordernumber)$/i.test(key)&&/^[A-Z0-9_-]{4,80}$/i.test(value))orderIds.push(value);}catch{}}
  return { text: doc.textContent.replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim(), structured,tables,orderIds:[...new Set(orderIds)] };
}
