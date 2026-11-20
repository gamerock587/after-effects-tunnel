/* After Effect Tunnel 1.0 -- ExtendScript / ES3. No network or preference changes. */
var AETunnel = (function () {
    function fail(s) { throw new Error(s); }
    function quote(s) { return '"' + String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\t/g,'\\t').replace(/[\x00-\x1f]/g,function(c){return '\\u'+('000'+c.charCodeAt(0).toString(16)).slice(-4);}) + '"'; }
    function json(v) {
        if(v === null || v === undefined) return 'null';
        if(typeof v === 'string') return quote(v);
        if(typeof v === 'number') return isFinite(v) ? String(v) : 'null';
        if(typeof v === 'boolean') return String(v);
        var a=[],i,k;
        if(v instanceof Array){for(i=0;i<v.length;i++)a.push(json(v[i]));return '['+a.join(',')+']';}
        for(k in v)if(v.hasOwnProperty(k))a.push(quote(k)+':'+json(v[k]));
        return '{'+a.join(',')+'}';
    }
    function item(ref){
        if(ref && typeof ref === 'object' && ref.ref)ref=aliases[ref.ref];
        for(var i=1;i<=app.project.numItems;i++)if(app.project.item(i).id===Number(ref))return app.project.item(i);
        fail('Item ID not found: '+ref);
    }
    function comp(ref){var c=item(ref);if(!(c instanceof CompItem))fail('Item is not a composition');return c;}
    function layer(c,ref){
        if(ref && typeof ref === 'object' && ref.ref)ref=aliases[ref.ref];
        for(var i=1;i<=c.numLayers;i++)if(c.layer(i).id===Number(ref))return c.layer(i);
        fail('Layer ID not found in composition: '+ref);
    }
    function prop(l,path){
        if(!(path instanceof Array)||!path.length)fail('property must be a nonempty array of match names or 1-based indices');
        var p=l;for(var i=0;i<path.length;i++){p=p.property(path[i]);if(!p)fail('Property path not found at '+path[i]);}return p;
    }
    function finite(n,label){if(typeof n!=='number'||!isFinite(n))fail(label+' must be a finite number');return n;}
    function positive(n,label){finite(n,label);if(n<=0)fail(label+' must be positive');return n;}
    function zeros(vertices){var a=[];for(var i=0;i<vertices.length;i++)a.push([0,0]);return a;}
    function absolute(p){if(typeof p!=='string'||!(/^[A-Za-z]:[\\\/]/.test(p)||/^\\\\/.test(p)))fail('Expected absolute Windows file path');return new File(p);}
    function newFile(p,overwrite){var f=absolute(p);if(!f.parent.exists)fail('Output directory does not exist: '+f.parent.fsName);if(f.exists&&!overwrite)fail('File exists; choose a new path or explicitly set overwrite:true');return f;}
    function val(p,t){try{return p.valueAtTime(t||0,false);}catch(e){return null;}}
    function layerInfo(l,c){var t=l.property('ADBE Transform Group');return {id:l.id,index:l.index,name:l.name,sourceId:l.source?l.source.id:null,enabled:l.enabled,locked:l.locked,startTime:l.startTime,inPoint:l.inPoint,outPoint:l.outPoint,parentId:l.parent?l.parent.id:null,threeD:l.threeDLayer,position:val(t.property('ADBE Position'),c.time),scale:val(t.property('ADBE Scale'),c.time),opacity:val(t.property('ADBE Opacity'),c.time)};}
    function itemInfo(it,deep){var o={id:it.id,name:it.name,type:it.typeName};if(it instanceof CompItem){o.width=it.width;o.height=it.height;o.duration=it.duration;o.fps=it.frameRate;o.time=it.time;if(deep){o.layers=[];for(var j=1;j<=it.numLayers;j++)o.layers.push(layerInfo(it.layer(j),it));}}else if(it instanceof FootageItem){o.width=it.width;o.height=it.height;o.duration=it.duration;o.file=it.file?it.file.fsName:null;}return o;}
    function tree(p,depth){var o={name:p.name,matchName:p.matchName,index:p.propertyIndex};if(p.propertyType===PropertyType.PROPERTY){o.value=val(p,0);o.numKeys=p.numKeys;o.canSetExpression=p.canSetExpression;if(p.numKeys){o.keys=[];for(var k=1;k<=Math.min(p.numKeys,100);k++)o.keys.push({time:p.keyTime(k),value:p.keyValue(k)});}}else if(depth>0){o.properties=[];for(var i=1;i<=p.numProperties;i++)o.properties.push(tree(p.property(i),depth-1));}return o;}
    function easeKeys(p,influence){
        var inf=influence===undefined?70:finite(influence,'influence');if(inf<0.1||inf>100)fail('Influence must be 0.1..100');
        for(var k=1;k<=p.numKeys;k++){var n=1,v=p.keyValue(k);if(!p.isSpatial && v instanceof Array && p.propertyValueType!==PropertyValueType.COLOR)n=v.length;var e=[];for(var i=0;i<n;i++)e.push(new KeyframeEase(0,inf));p.setTemporalEaseAtKey(k,e,e);p.setInterpolationTypeAtKey(k,KeyframeInterpolationType.BEZIER,KeyframeInterpolationType.BEZIER);if(p.isSpatial){var z=v.length===3?[0,0,0]:[0,0];p.setSpatialTangentsAtKey(k,z,z);}}
    }
    var aliases={};
    var readOnly={ping:1,inspect:1,properties:1,effects:1,renderTemplates:1};
    function action(a){
        var c,l,p,it,t,d,o,sh,g,contents,fx,i;
        switch(a.op){
        case 'ping':return {version:'1.0.0',afterEffects:app.version,project:app.project.file?app.project.file.fsName:null};
        case 'inspect':
            if(a.comp!==undefined)return itemInfo(comp(a.comp),true);
            o={project:app.project.file?app.project.file.fsName:null,activeItemId:app.project.activeItem?app.project.activeItem.id:null,items:[]};for(i=1;i<=app.project.numItems;i++)o.items.push(itemInfo(app.project.item(i),false));return o;
        case 'properties':c=comp(a.comp);l=layer(c,a.layer);return tree(a.property?prop(l,a.property):l,Math.min(a.depth===undefined?3:a.depth,8));
        case 'effects':o=[];for(i=0;i<app.effects.length;i++){it=app.effects[i];if(!a.search||(it.displayName+' '+it.matchName).toLowerCase().indexOf(a.search.toLowerCase())>=0)o.push({name:it.displayName,matchName:it.matchName});}return o;
        case 'createComp':
            it=app.project.items.addComp(a.name||'Tunnel composition',positive(a.width,'width'),positive(a.height,'height'),1,positive(a.duration,'duration'),positive(a.fps||25,'fps'));return itemInfo(it,true);
        case 'duplicateComp':it=comp(a.comp).duplicate();it.name=a.name||it.name;return itemInfo(it,true);
        case 'import':it=app.project.importFile(new ImportOptions(absolute(a.path)));return itemInfo(it,false);
        case 'addLayer':c=comp(a.comp);l=c.layers.add(item(a.source));if(a.name)l.name=a.name;return layerInfo(l,c);
        case 'text':
            c=comp(a.comp);l=c.layers.addText(a.text||'');l.name=a.name||'Text';p=l.property('ADBE Text Properties').property('ADBE Text Document');d=p.value;d.fontSize=a.fontSize||80;if(a.font)d.font=a.font;d.applyFill=true;d.fillColor=a.color||[1,1,1];d.justification=ParagraphJustification.CENTER_JUSTIFY;if(a.tracking!==undefined)d.tracking=a.tracking;if(a.leading!==undefined){d.autoLeading=false;d.leading=a.leading;}p.setValue(d);if(a.centerAnchor){var r=l.sourceRectAtTime(0,false);l.transform.anchorPoint.setValue([r.left+r.width/2,r.top+r.height/2]);}if(a.position)l.transform.position.setValue(a.position);return layerInfo(l,c);
        case 'solid':c=comp(a.comp);l=c.layers.addSolid(a.color||[0,0,0],a.name||'Background',c.width,c.height,1,c.duration);if(a.atBottom!==false)l.moveToEnd();return layerInfo(l,c);
        case 'shape':
            c=comp(a.comp);l=c.layers.addShape();l.name=a.name||'Shape';contents=l.property('ADBE Root Vectors Group');g=contents.addProperty('ADBE Vector Group');g=g.property('ADBE Vectors Group');
            if(a.vertices){p=g.addProperty('ADBE Vector Shape - Group').property('ADBE Vector Shape');sh=new Shape();sh.vertices=a.vertices;sh.closed=a.closed!==false;sh.inTangents=a.inTangents||zeros(a.vertices);sh.outTangents=a.outTangents||zeros(a.vertices);p.setValue(sh);}
            else {p=g.addProperty(a.kind==='ellipse'?'ADBE Vector Shape - Ellipse':'ADBE Vector Shape - Rect');p.property(a.kind==='ellipse'?'ADBE Vector Ellipse Size':'ADBE Vector Rect Size').setValue(a.size||[300,300]);if(a.kind!=='ellipse'&&a.roundness!==undefined)p.property('ADBE Vector Rect Roundness').setValue(a.roundness);}
            if(a.fill!==null){fx=g.addProperty('ADBE Vector Graphic - Fill');fx.property('ADBE Vector Fill Color').setValue(a.fill||[0.05,0.7,0.7]);}
            if(a.stroke){fx=g.addProperty('ADBE Vector Graphic - Stroke');fx.property('ADBE Vector Stroke Color').setValue(a.stroke);fx.property('ADBE Vector Stroke Width').setValue(a.strokeWidth||3);}
            if(a.position)l.transform.position.setValue(a.position);return layerInfo(l,c);
        case 'set':c=comp(a.comp);l=layer(c,a.layer);p=prop(l,a.property);if(a.time!==undefined)p.setValueAtTime(finite(a.time,'time'),a.value);else p.setValue(a.value);return {value:val(p,a.time||c.time)};
        case 'shapeOperator':c=comp(a.comp);l=layer(c,a.layer);p=prop(l,a.property||['ADBE Root Vectors Group',1,'ADBE Vectors Group']);if(typeof a.matchName!=='string'||a.matchName.indexOf('ADBE Vector ')!==0)fail('Expected native shape operator match name');if(!p.canAddProperty(a.matchName))fail('Shape operator unavailable');fx=p.addProperty(a.matchName);return tree(fx,2);
        case 'animate':
            c=comp(a.comp);l=layer(c,a.layer);p=prop(l,a.property);if(!(a.keys instanceof Array)||!a.keys.length)fail('keys required');for(i=0;i<a.keys.length;i++)finite(a.keys[i].time,'key time');if(a.replace)while(p.numKeys)p.removeKey(1);for(i=0;i<a.keys.length;i++)p.setValueAtTime(a.keys[i].time,a.keys[i].value);if(a.ease!==false)easeKeys(p,a.influence);return {numKeys:p.numKeys};
        case 'expression':c=comp(a.comp);p=prop(layer(c,a.layer),a.property);if(!p.canSetExpression)fail('Property cannot have an expression');p.expression=a.expression||'';if(p.expressionError)fail(p.expressionError);return {expression:p.expression};
        case 'layerSettings':
            c=comp(a.comp);l=layer(c,a.layer);if(a.locked===false)l.locked=false;
            if(a.name!==undefined)l.name=a.name;if(a.enabled!==undefined)l.enabled=!!a.enabled;if(a.threeD!==undefined)l.threeDLayer=!!a.threeD;if(a.motionBlur!==undefined)l.motionBlur=!!a.motionBlur;
            if(a.startTime!==undefined)l.startTime=finite(a.startTime,'startTime');if(a.inPoint!==undefined)l.inPoint=finite(a.inPoint,'inPoint');if(a.outPoint!==undefined)l.outPoint=finite(a.outPoint,'outPoint');
            if(a.parent!==undefined)l.parent=a.parent===null?null:layer(c,a.parent);if(a.atBottom)l.moveToEnd();if(a.before!==undefined)l.moveBefore(layer(c,a.before));if(a.locked!==undefined)l.locked=!!a.locked;return layerInfo(l,c);
        case 'compSettings':c=comp(a.comp);if(a.duration!==undefined)c.duration=positive(a.duration,'duration');if(a.fps!==undefined)c.frameRate=positive(a.fps,'fps');if(a.motionBlur!==undefined)c.motionBlur=!!a.motionBlur;if(a.shutterAngle!==undefined)c.shutterAngle=a.shutterAngle;if(a.time!==undefined)c.time=finite(a.time,'time');if(a.open!==false)c.openInViewer();return itemInfo(c,true);
        case 'addEffect':c=comp(a.comp);l=layer(c,a.layer);p=l.property('ADBE Effect Parade');if(!p.canAddProperty(a.matchName))fail('Effect unavailable: '+a.matchName);fx=p.addProperty(a.matchName);return tree(fx,2);
        case 'renderTemplates':c=comp(a.comp);it=app.project.renderQueue.items.add(c);o={output:it.outputModule(1).templates,settings:it.templates};it.remove();return o;
        case 'save':app.project.save(newFile(a.path,a.overwrite));return {path:app.project.file.fsName};
        case 'preview':
            c=comp(a.comp);t=finite(a.time,'time');if(t<0||t>=c.duration)fail('Preview time outside composition');it=newFile(a.path,a.overwrite);c.saveFrameToPng(t,it);return {path:it.fsName,time:t};
        case 'render':
            c=comp(a.comp);it=newFile(a.path,a.overwrite);var rq=app.project.renderQueue.items.add(c);rq.render=false;
            try{if(a.settings)rq.applyTemplate(a.settings);rq.outputModule(1).applyTemplate(a.template);rq.outputModule(1).file=it;rq.timeSpanStart=a.start===undefined?0:a.start;rq.timeSpanDuration=a.duration===undefined?c.duration:positive(a.duration,'duration');
            if(a.execute){for(i=1;i<=app.project.renderQueue.numItems;i++)if(app.project.renderQueue.item(i)!==rq&&app.project.renderQueue.item(i).status===RQItemStatus.QUEUED)fail('Other render jobs are queued. Unqueue them first.');rq.render=true;app.project.renderQueue.render();if(rq.status!==RQItemStatus.DONE||!it.exists)fail('Render not verified complete. Status '+rq.status+'. Inspect AE queue or use tunnel.py render with a saved project.');return {path:it.fsName,status:String(rq.status),exists:true};}return {queued:false,index:rq.index,path:it.fsName};}catch(e){if(rq.status!==RQItemStatus.RENDERING)rq.remove();throw e;}
        default:fail('Unknown operation: '+a.op);
        }
    }
    function run(request){
        aliases={};var results=[],error=null,actions=request.actions||[],begun=false;
        if(request.version!==1)return json({ok:false,error:'Expected version:1',results:[]});
        if(!(actions instanceof Array)||!actions.length)return json({ok:false,error:'actions must be nonempty',results:[]});
        try{for(var i=0;i<actions.length;i++){var a=actions[i];if(a.op==='render'&&begun){app.endUndoGroup();begun=false;}if(!readOnly[a.op]&&a.op!=='render'&&!begun){app.beginUndoGroup(request.label||'After Effect Tunnel');begun=true;}var r=action(a);if(a.span){if(r.id===undefined||a.comp===undefined)fail('span requires a created layer and comp');var ll=layer(comp(a.comp),r.id);if(a.span.length!==2||a.span[1]<=a.span[0])fail('span must be [inPoint,outPoint]');ll.inPoint=finite(a.span[0],'span start');ll.outPoint=finite(a.span[1],'span end');}if(a.as){if(r.id===undefined)fail('as requires an operation returning id');aliases[a.as]=r.id;}results.push({op:a.op,ok:true,result:r});}}
        catch(e){error={message:e.toString(),line:e.line||null,actionIndex:results.length};}
        finally{if(begun)app.endUndoGroup();}
        return json({ok:error===null,version:1,results:results,aliases:aliases,error:error,partial:error!==null&&results.length>0});
    }
    function show(result){var w=new Window('dialog','After Effect Tunnel - result');var e=w.add('edittext',undefined,result,{multiline:true,scrolling:true});e.preferredSize=[1000,620];w.add('button',undefined,'Close',{name:'cancel'});w.show();}
    return {run:run,show:show};
})();
