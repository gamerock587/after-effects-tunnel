const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict'), path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../host/tunnel.jsx'),'utf8');
const ctx=vm.createContext({});
vm.runInContext(`
var groups=0,ended=0,changed=0;
function CompItem() {this.id=10;this.name='Comp';this.typeName='Composition';this.width=1300;this.height=1000;this.duration=12;this.frameRate=25;this.time=0;this.numLayers=0;}
function FootageItem() {}
var projectComp=new CompItem();
var app={version:'25-mock',project:{file:null,numItems:1,activeItem:projectComp,item:function(i){return projectComp;}},beginUndoGroup:function(){groups++;},endUndoGroup:function(){ended++;}};
`,ctx);
vm.runInContext(source,ctx);
function run(req){return JSON.parse(vm.runInContext('AETunnel.run('+JSON.stringify(req)+')',ctx));}
assert.equal(run({version:1,actions:[{op:'ping'}]}).ok,true);
assert.equal(ctx.groups,0,'Read operations do not create Undo groups');
assert.equal(run({version:1,actions:[{op:'inspect',comp:10}]}).results[0].result.width,1300);
assert.equal(run({version:1,actions:[{op:'inspect',comp:999}]}).ok,false,'IDs cannot silently fall back to active comp');
const partial=run({version:1,actions:[{op:'ping'},{op:'unknown'},{op:'ping'}]});
assert.equal(partial.ok,false);assert.equal(partial.partial,true);assert.equal(partial.results.length,1);assert.equal(partial.error.actionIndex,1);
assert.equal(ctx.groups,ctx.ended,'Undo group closes after failure');
assert.equal(run({version:7,actions:[{op:'ping'}]}).ok,false);
// Serializer must preserve strings, nested vectors and Unicode without AE vector coercion.
ctx.app.version='25 "quoted"\nمرحبا\\end';
assert.equal(run({version:1,actions:[{op:'ping'}]}).results[0].result.afterEffects,ctx.app.version);
console.log('Runtime tests passed: identity, read-only behavior, partial failures, serialization.');
