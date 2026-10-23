const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../helper.js'),'utf8');
const code=source.slice(source.indexOf('  function button('),source.indexOf('  function rows('));
function element(text,{standard=false,blocked=false,children=[]}={}) {
  return {text,standard,blocked,children,
    matches:s=>false,
    closest(s){return s.startsWith('[disabled]') ? (this.blocked ? {} : null) : (this.standard ? this : null);},
    contains:e=>children.includes(e)};
}
const button=vm.runInNewContext(code+'\nbutton;',{
  txt:e=>e.text,visible:()=>true,enabled:e=>!e.blocked,
  all:(s,r)=>r.children.filter(e=>s==='div,span' ? !e.standard : e.standard)
});
const native=element('同意',{standard:true});
assert.equal(button(element('退款初审',{children:[native]}),'同意'),native);
const custom=element('同意');
assert.equal(button(element('退款初审',{children:[custom]}),'同意'),custom);
const disabled=element('同意',{blocked:true});
assert.equal(button(element('退款初审',{children:[disabled]}),'同意'),null);
assert.equal(button(element('其他弹窗',{children:[custom]}),'同意'),null);
assert.equal(button(element('退款初审',{children:[custom,element('同意')]}),'同意'),null);
assert.equal(button(element('退款初审',{children:[element('不同意')]}),'同意'),null);
console.log('PASS: native/custom agree, disabled, wrong dialog, ambiguous labels, exact label');
