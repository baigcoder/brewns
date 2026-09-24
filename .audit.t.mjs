import puppeteer from 'puppeteer-core';
const S=process.argv[2]; const mobile=process.argv[3]==='m';
const b=await puppeteer.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const p=await b.newPage();
await p.setViewport(mobile?{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1}:{width:1440,height:900});
const errs=[], fails=[]; let bytes={};
p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.type()+': '+m.text().slice(0,200))});
p.on('requestfailed',r=>fails.push(r.url()+' '+r.failure()?.errorText));
p.on('response',async r=>{ if(r.status()>=400) fails.push(r.status()+' '+r.url()); const t=r.request().resourceType(); const l=+(r.headers()['content-length']||0); bytes[t]=(bytes[t]||0)+l;});
const t0=Date.now();
await p.goto('http://localhost:3000/',{waitUntil:'load',timeout:120000});
console.log('load ms',Date.now()-t0);
await wait(5000);
// scroll through whole page slowly
const H=await p.evaluate(()=>document.documentElement.scrollHeight);
for(let y=0;y<H;y+=600){await p.evaluate(y=>window.scrollTo(0,y),y); await wait(250);}
await wait(1500);
const res=await p.evaluate(()=>{
  const out={};
  const vw=document.documentElement.clientWidth;
  out.scrollW=document.documentElement.scrollWidth; out.vw=vw;
  out.overflow=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return r.width>0&&(r.right>vw+1)&&cs.position!=='fixed'&&!e.closest('[hidden],[aria-hidden="true"]')}).slice(0,15).map(e=>`${e.tagName}.${[...e.classList].join('.')}#${e.id} r=${Math.round(e.getBoundingClientRect().right)}`);
  out.imgNoAlt=[...document.images].filter(i=>!i.hasAttribute('alt')).map(i=>i.src.slice(-60));
  out.imgBroken=[...document.images].filter(i=>i.complete&&i.naturalWidth===0&&i.src).map(i=>i.src.slice(0,90));
  out.noName=[...document.querySelectorAll('button,a[href],[role=button]')].filter(e=>!(e.innerText.trim()||e.getAttribute('aria-label')||e.getAttribute('title')||e.querySelector('img[alt]:not([alt=""])'))).map(e=>e.outerHTML.slice(0,120));
  const ids={}; document.querySelectorAll('[id]').forEach(e=>ids[e.id]=(ids[e.id]||0)+1); out.dupIds=Object.entries(ids).filter(([k,v])=>v>1);
  out.headings=[...document.querySelectorAll('h1,h2,h3')].map(h=>h.tagName+': '+h.innerText.replace(/\s+/g,' ').slice(0,50));
  out.inputsNoLabel=[...document.querySelectorAll('input,select,textarea')].filter(i=>i.type!=='hidden'&&!(i.labels?.length||i.getAttribute('aria-label')||i.getAttribute('aria-labelledby'))).map(i=>i.outerHTML.slice(0,100));
  out.smallTargets=[...document.querySelectorAll('button,a[href]')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0&&r.height>0&&(r.height<24||r.width<24)&&!e.closest('[hidden]')}).slice(0,20).map(e=>`${e.tagName} ${e.className} "${e.innerText.trim().slice(0,20)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
  out.lang=document.documentElement.lang; out.title=document.title; out.desc=document.querySelector('meta[name=description]')?.content;
  out.canvases=document.querySelectorAll('canvas').length;
  return out;
});
res.errs=[...new Set(errs)]; res.fails=[...new Set(fails)]; res.bytes=bytes;
console.log(JSON.stringify(res,null,1));
const perf=await p.metrics(); console.log('JSHeap MB',(perf.JSHeapUsedSize/1e6).toFixed(1),'Nodes',perf.Nodes);
await b.close();
