const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const root = path.resolve('dist');
for (const file of ['index.html','wash.html','safety.html','shapes.html','garden.html','peekaboo.html']) {
  const html = fs.readFileSync(path.join(root,file),'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const href = match[1];
    if (/^(data:|#)/.test(href)) continue;
    assert(!/^https?:|\/\//.test(href),'No third-party runtime assets or links: '+href);
    const target = href.split('#')[0];
    assert(fs.existsSync(path.resolve(root,target || '.')),'Missing asset '+href+' in '+file);
  }
  assert(!/<(?:input|textarea|form)\b/i.test(html),'No information collection forms');
  assert(html.includes('lang="zh-CN"'));
  assert(!html.includes('游戏'), 'Parent-facing page copy must use interaction wording: '+file);
}
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const categories=[...home.matchAll(/<article[^>]+data-category="([^"]+)"/g)].map(m=>m[1]);
const filters=[...home.matchAll(/data-filter="([^"]+)"/g)].map(m=>m[1]);
assert.equal(categories.length,5);assert.deepEqual(filters,['all','habit','discover','safety']);
for(const asset of ['wash-card','safety-card','shapes-card','garden-play-card','peekaboo-card']){
 assert(home.includes('assets/'+asset+'.svg'));const svg=fs.readFileSync(path.join(root,'assets',asset+'.svg'),'utf8');assert(svg.includes('viewBox="0 0 720 420"'));assert(!/<script|https?:\/\/(?!www\.w3\.org)/i.test(svg));
}
const buttons=filters.map(filter=>({dataset:{filter},classList:{toggle(name,value){this.selected=value}},setAttribute(name,value){this[name]=value},addEventListener(name,fn){this.click=fn}}));
const cards=categories.map(category=>({dataset:{category},hidden:false}));
vm.runInNewContext(fs.readFileSync(path.join(root,'home.js'),'utf8'),{document:{querySelectorAll:selector=>selector==='[data-filter]'?buttons:cards}});
for(const button of [...buttons,...buttons].reverse()){
 button.click();assert.deepEqual(cards.map(c=>c.hidden),categories.map(c=>button.dataset.filter!=='all'&&c!==button.dataset.filter));
 for(const other of buttons)assert.equal(other['aria-pressed'],String(button===other));
}
for(const file of fs.readdirSync(root).filter(f=>/\.(js|html|css)$/.test(f))){
 const content=fs.readFileSync(path.join(root,file),'utf8');
 assert(!/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(|google-analytics|googletagmanager|facebook\.com\/tr/i.test(content),'No tracking/network calls: '+file);
}
const manifest=JSON.parse(fs.readFileSync('.openai/hosting.json','utf8'));
assert.equal(manifest.project_id,'appgprj_6af33c6b179881919869236a2addb127');
assert(!fs.existsSync('dist/qa.html'),'Remove QA harness before publication');
console.log('PASS: all asset/route links, Chinese metadata, no external runtime/form collection, real catalog filters, preserved Site identity, no deployed QA fixture.');
