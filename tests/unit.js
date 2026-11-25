const { JSDOM, ResourceLoader } = require('jsdom'); const fs=require('fs'), path=require('path'), crypto=require('crypto');
const SITE=path.resolve(__dirname,'..');
class L extends ResourceLoader{fetch(u){if(u.startsWith('http://localhost/')){const p=path.join(SITE,u.slice(17).split('?')[0]);return Promise.resolve(fs.existsSync(p)?fs.readFileSync(p):Buffer.from(''))}return Promise.resolve(Buffer.from(''))}}
(async()=>{
 const dom=await JSDOM.fromFile(path.join(SITE,'login.html'),{url:'http://localhost/login.html',runScripts:'dangerously',resources:new L()});
 await new Promise(r=>setTimeout(r,300)); const w=dom.window;
 // verify password hash == real SHA-256 of the same input
 const u=w.Store.users().find(x=>x.email==='admin@elibrary.com');
 const real=crypto.createHash('sha256').update('elib|admin@elibrary.com|Admin@123').digest('hex');
 let bad=0; const chk=(c,m)=>{console.log(c?'  ✓':'  ✗ FAIL:',m); if(!c)bad++;};
 chk(u.hash===real,'password hash equals real SHA-256');
 // duplicate registration
 chk(!w.Store.register({first:'a',last:'b',email:'reader@example.com',password:'12345678',confirm:'12345678'}).ok,'duplicate email rejected');
 // collection purchase flow
 const d2=await JSDOM.fromFile(path.join(SITE,'book-collection.html'),{url:'http://localhost/book-collection.html',runScripts:'dangerously',resources:new L(),beforeParse(w){w.bootstrap={Modal:class{constructor(){} show(){} hide(){} static getInstance(){return {hide(){}}}}}}});
 await new Promise(r=>setTimeout(r,300)); const w2=d2.window;
 w2.showCollection('classic'); w2.showBuyModal('classic','Pride and Prejudice'); w2.document.getElementById('quantity').value=2; w2.confirmPurchase();
 chk(w2.Store.cartCount()===2,'collection page Buy adds to cart');
 // index live search still works
 const d3=await JSDOM.fromFile(path.join(SITE,'index.html'),{url:'http://localhost/index.html',runScripts:'dangerously',resources:new L()});
 await new Promise(r=>setTimeout(r,300)); const w3=d3.window;
 const inp=w3.document.getElementById('bookSearch'); inp.value='dune'; inp.dispatchEvent(new w3.Event('input'));
 chk(w3.document.querySelectorAll('.book-card.hidden').length===5,'home page live search filters cards');
 console.log(bad?'\nunit checks FAILED':'\nunit checks passed'); process.exit(bad?1:0)})();
