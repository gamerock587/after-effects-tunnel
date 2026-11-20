/* File queue only. No HTTP server, model service, telemetry or preference changes. */
(function () {
 'use strict';
 const fs=require('fs'), path=require('path'), os=require('os');
 const root=path.join(process.env.LOCALAPPDATA||os.homedir(),'AfterEffectTunnel');
 const extension=decodeURI(window.__adobe_cep__.getSystemPath('extension')).replace(/^file:\/\//,'');
 const runtime=path.join(extension,'host','tunnel.jsx');
 ['inbox','outbox','processing'].forEach(n=>fs.mkdirSync(path.join(root,n),{recursive:true}));
 let paused=false,busy=false,current=null;
 const owner=String(process.pid)+'-'+Date.now();
 const log=s=>{document.getElementById('log').textContent=s+'\n'+document.getElementById('log').textContent.slice(0,3000);};
 function atomic(file,value){const tmp=file+'.'+owner+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value),'utf8');fs.renameSync(tmp,file);}
 function beat(){if(!paused)atomic(path.join(root,'heartbeat.json'),{time:Date.now(),owner,busy,current,version:'1.0.0'});}
 document.getElementById('toggle').onclick=function(){paused=!paused;this.textContent=paused?'Resume accepting jobs':'Pause accepting jobs';document.getElementById('status').textContent=paused?'Paused':'Ready — local connection active';if(paused){try{fs.unlinkSync(path.join(root,'heartbeat.json'));}catch(e){}}};
 function tick(){
  try{
   beat();if(paused||busy)return;
   const files=fs.readdirSync(path.join(root,'inbox')).filter(n=>/^[a-f0-9]{32}\.json$/.test(n)).sort();if(!files.length)return;
   const name=files[0], source=path.join(root,'inbox',name), claimed=path.join(root,'processing',name);
   if(fs.existsSync(claimed)){log('Unresolved earlier job: '+name);return;}
   fs.renameSync(source,claimed); // Claim before execution. Crashed jobs are never replayed automatically.
   let job;
   try{job=JSON.parse(fs.readFileSync(claimed,'utf8'));if(job.id+'.json'!==name||!job.request||job.request.version!==1||!Array.isArray(job.request.actions)||!job.request.actions.length||job.request.actions.length>2000)throw Error('Invalid envelope');}
   catch(e){atomic(path.join(root,'outbox',name),{ok:false,error:String(e)});fs.unlinkSync(claimed);return;}
   busy=true;current=job.id;beat();log('Running '+job.id);
   const code=fs.readFileSync(runtime,'utf8')+'\nAETunnel.run('+JSON.stringify(job.request)+');';
   window.__adobe_cep__.evalScript(code,function(result){
    try{let value;try{value=JSON.parse(result);}catch(e){value={ok:false,error:'AE returned an invalid response',raw:String(result)};}
     value.jobId=job.id;atomic(path.join(root,'outbox',name),value);fs.unlinkSync(claimed);log((value.ok?'Completed ':'Failed ')+job.id);
    }catch(e){log('Result persistence failed: '+e+'; do not retry this job blindly.');}
    finally{busy=false;current=null;beat();}
   });
  }catch(e){log(String(e));}
 }
 document.getElementById('status').textContent='Ready — local connection active';
 setInterval(tick,500);tick();
 window.addEventListener('beforeunload',()=>{try{const p=path.join(root,'heartbeat.json');if(JSON.parse(fs.readFileSync(p,'utf8')).owner===owner)fs.unlinkSync(p);}catch(e){}});
})();
