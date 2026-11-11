'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $('#scene');
  const ctx = canvas.getContext('2d');
  const TAU = Math.PI * 2;
  // Older iPad Safari versions may lack native roundRect.
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r) {
      const a=Array.isArray(r)?r:[r,r,r,r];const q=a.length===1?[a[0],a[0],a[0],a[0]]:a.length===2?[a[0],a[1],a[0],a[1]]:a;
      const [tl,tr,br,bl]=q.map(v=>Math.min(Number(v)||0,w/2,h/2));
      this.moveTo(x+tl,y);this.lineTo(x+w-tr,y);this.quadraticCurveTo(x+w,y,x+w,y+tr);this.lineTo(x+w,y+h-br);this.quadraticCurveTo(x+w,y+h,x+w-br,y+h);this.lineTo(x+bl,y+h);this.quadraticCurveTo(x,y+h,x,y+h-bl);this.lineTo(x,y+tl);this.quadraticCurveTo(x,y,x+tl,y);this.closePath();return this;
    };
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 1200, height = 700, dpr = 1;
  let currentCar = 'car', currentTool = 'soap', started = false, complete = false;
  let muted = false, audio = null, master = null, lastSound = 0, stage = 0;
  let lastTime = 0, lastTouch = 0, idleTime = 0, happyUntil = 0, lastBeep = -1000;
  let patches = [], particles = [], pointers = new Map(), stepTimer = null;
  let carX = 600, carY = 400, carScale = 1, frameCount = 0;
  const colors = { ink:'#3f6164', pale:'#f8fbf1', mint:'#b9dacf' };
  try { muted = localStorage.getItem('car-bath-muted') === '1'; } catch (_) {}

  // The generous 110-unit touch radius makes both taps and broad toddler swipes useful.
  function makePatches(kind) {
    const list = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        const x = -300 + col * 95 + (row % 2 ? 12 : 0), y = -137 + row * 63;
        if (kind === 'car' && row === 0 && (col === 0 || col > 4)) continue;
        if (kind === 'car' && row === 1 && col === 6) continue;
        if (kind === 'digger' && row === 0 && col < 4) continue;
        list.push({x, y, soap:false, rinsed:false, dry:false, seed:row * 19 + col * 7 + 2});
      }
    }
    return list;
  }
  function cleanAt(list, tool, x, y, radius = 110) {
    let count = 0;
    for (const p of list) {
      if (Math.hypot(p.x-x, p.y-y) > radius) continue;
      if (tool === 'soap' && !p.soap && !p.rinsed) { p.soap = true; count++; }
      if (tool === 'water' && p.soap && !p.rinsed) { p.rinsed = true; count++; }
      if (tool === 'dry' && p.rinsed && !p.dry) { p.dry = true; count++; }
    }
    return count;
  }
  function coverage(key) { return patches.filter(p=>p[key]).length / patches.length; }
  const round = (c,x,y,w,h,r,fill,stroke,lw=2) => { c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();} };
  const ellipse = (c,x,y,rx,ry,fill,stroke,lw=2) => { c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();} };
  function path(c, coords, fill, stroke, lw=3) { c.beginPath(); for (const [op,...a] of coords)c[op](...a); if(fill){c.fillStyle=fill;c.fill();} if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.lineJoin='round';c.lineCap='round';c.stroke();} }
  function line(c,x1,y1,x2,y2,color,w=3) { c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=w;c.lineCap='round';c.stroke(); }
  function grad(c,x,y,x2,y2,stops) { const g=c.createLinearGradient(x,y,x2,y2);for(const [pos,color] of stops)g.addColorStop(pos,color);return g; }
  function blob(c,x,y,r,seed,fill) { const pts=[];for(let j=0;j<12;j++){const a=j/12*TAU;const rr=r*(.8+.18*Math.sin(j*2.2+seed));pts.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr*.72]);}c.beginPath();c.moveTo((pts[11][0]+pts[0][0])/2,(pts[11][1]+pts[0][1])/2);for(let j=0;j<12;j++){const n=pts[(j+1)%12];c.quadraticCurveTo(pts[j][0],pts[j][1],(pts[j][0]+n[0])/2,(pts[j][1]+n[1])/2);}c.closePath();c.fillStyle=fill;c.fill(); }
  function bubble(c,x,y,r,alpha=1){c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x-r*.3,y-r*.35,1,x,y,r);g.addColorStop(0,'#ffffffee');g.addColorStop(.6,'#effcfae8');g.addColorStop(1,'#b9dfe6c9');ellipse(c,x,y,r,r,g,'#ffffffdc',Math.max(1,r*.07));c.beginPath();c.arc(x,y,r*.7,3.8,4.85);c.strokeStyle='white';c.lineWidth=Math.max(2,r*.11);c.lineCap='round';c.stroke();ellipse(c,x+r*.38,y+r*.35,r*.14,r*.09,'#b5d3e2');c.restore();}
  function star(c,x,y,r,color,angle=0){c.save();c.translate(x,y);c.rotate(angle);path(c,[['moveTo',0,-r],['quadraticCurveTo',r*.18,-r*.18,r,0],['quadraticCurveTo',r*.18,r*.18,0,r],['quadraticCurveTo',-r*.18,r*.18,-r,0],['quadraticCurveTo',-r*.18,-r*.18,0,-r]],color);c.restore();}
  function heart(c,x,y,size,color){c.save();c.translate(x,y);c.scale(size/20,size/20);path(c,[['moveTo',0,7],['bezierCurveTo',-29,-10,-12,-27,0,-13],['bezierCurveTo',12,-27,29,-10,0,7]],color);c.restore();}

  function scenery(c,t){
    const floor = carY + carScale*152;
    c.fillStyle=grad(c,0,0,0,height,[[0,'#e6f2e9'],[.65,'#e2f1eb'],[1,'#d1e6dd']]);c.fillRect(0,0,width,height);
    // Soft sunlight and garden outside the wash bay.
    ellipse(c,1080,85,62,62,'#fae6ad');ellipse(c,1080,85,78,78,'#fae6ad30');
    for(let i=0;i<6;i++) ellipse(c,40+i*235, floor-80-22*(i%2), 160,95,['#c6dfce','#cfe4d6','#bfdac7'][i%3]);
    c.fillStyle='#cadfd1';c.fillRect(0,floor-18,width,height-floor+18);
    // Wash house. A soft architectural shape, not a menu card.
    round(c,108,Math.max(95,floor-445),984,Math.min(floor-60,405),42,'#fff9e8');
    const top = Math.max(97, floor-447);
    round(c,135,top+42,930,floor-top-20,[28,28,10,10],grad(c,0,top,0,floor,[[0,'#e5e9d7'],[1,'#f5f1d9']]));
    // Glazed square tiles.
    c.save();c.beginPath();c.roundRect(142,top+52,916,floor-top-33,24);c.clip();
    for(let x=142;x<1060;x+=88)line(c,x,top+52,x,floor,'#fffdf32b',2);
    for(let y=top+52;y<floor;y+=66)line(c,142,y,1058,y,'#fffdf352',2);
    c.restore();
    // Striped scalloped sun awning.
    const awningY=top-6;
    round(c,103,awningY,994,51,[21,21,8,8],'#a5cbb5');
    c.save();c.beginPath();c.roundRect(103,awningY,994,51,[21,21,8,8]);c.clip();
    for(let i=0;i<12;i++){c.fillStyle=i%2?'#fff7df':'#a6cbb5';c.fillRect(103+i*83,awningY,83,55);}c.restore();
    for(let i=0;i<12;i++)round(c,103+i*83,awningY+33,83,28,[0,0,18,18],i%2?'#f2ead4':'#95bca5');
    line(c,119,awningY+1,1083,awningY+1,'#fffcf6',4);
    // Side post highlights.
    round(c,107,top+65,27,floor-top-46,12,'#fff9e9');round(c,1066,top+65,27,floor-top-46,12,'#fff9e9');
    line(c,113,top+78,113,floor-4,'#ffffff',3);
    // A window with a friendly little cloud.
    if(floor-top>280){
      round(c,775,top+99,174,121,24,'#fdfbf0');round(c,784,top+108,156,104,18,'#b9dbe0');
      c.save();c.beginPath();c.roundRect(784,top+108,156,104,18);c.clip();
      ellipse(c,835,top+152,24,16,'#f6faf0');ellipse(c,857,top+141,23,25,'#f6faf0');ellipse(c,880,top+154,30,14,'#f6faf0');
      line(c,863,top+109,863,top+212,'#fff9e9',6);line(c,784,top+165,940,top+165,'#fff9e9',6);c.restore();
      round(c,767,top+211,190,12,6,'#d4c9a8');
    }
    // Wash-bay floor, soft puddle and drainage.
    ellipse(c,600,floor+21,520,70,'#aecfc6');ellipse(c,600,floor+8,496,61,'#d1e8de');ellipse(c,600,floor+6,402,38,'#b8deda88');
    c.save();c.globalAlpha=.46;for(let i=0;i<3;i++)ellipse(c,600,floor+6,250+i*53,20+i*6,null,'#f6fcf1',2);c.restore();
    round(c,491,floor+55,218,10,5,'#a0bfb3');for(let x=505;x<704;x+=15)line(c,x,floor+57,x+4,floor+62,'#cde1d4',3);
    // Left plant, on the ground beside the bay.
    const py=floor+6;
    line(c,61,py-36,66,py-160,'#719f8e',6);
    for(let i=0;i<5;i++){const yy=py-70-i*20;c.save();c.translate(64,yy);c.rotate(i%2?-.6:.7);ellipse(c,i%2?16:-16,0,24,11,i%2?'#94bc9a':'#7da993');c.restore();}
    path(c,[['moveTo',22,py-47],['lineTo',101,py-47],['lineTo',92,py+8],['quadraticCurveTo',62,20+py,31,py+8],['closePath']],'#dcac8b');round(c,19,py-50,84,12,5,'#ebbc97');line(c,40,py-33,44,py+1,'#f5cdb0',4);
    // Right hose spool and towel, close enough to feel like part of the scene.
    const hy=Math.max(top+125, floor-230);
    round(c,1106,hy-12,58,13,6,'#b6b99c');
    ellipse(c,1134,hy+52,42,48,'#c2b997');ellipse(c,1134,hy+52,32,39,'#9bbeb1');ellipse(c,1134,hy+52,21,28,null,'#c9e2d5',7);ellipse(c,1134,hy+52,10,15,null,'#c9e2d5',6);
    path(c,[['moveTo',1163,hy+64],['bezierCurveTo',1190,hy+110,1115,floor+18,1155,floor+20]],null,'#91b5a7',8);
    // Rubber duck, a tiny companion at the water's edge.
    const dx=1032,dy=floor+8;
    ellipse(c,dx,dy,37,21,'#c0d4bd');ellipse(c,dx,dy-14,31,23,'#f3cd78');ellipse(c,dx+15,dy-37,19,20,'#f7d783');
    path(c,[['moveTo',dx+29,dy-40],['lineTo',dx+48,dy-34],['quadraticCurveTo',dx+36,dy-27,dx+28,dy-30]],'#df9c67');ellipse(c,dx+20,dy-42,3,3,'#5d6c59');path(c,[['moveTo',dx-16,dy-15],['quadraticCurveTo',dx-2,dy-25,dx+7,dy-12]],null,'#dfb966',3);
    // Air bubbles drift very slowly; no timed task or rewards.
    for(let i=0;i<6;i++){const x=195+i*165+Math.sin(t*.0003+i)*12;const y=top+60+((i*47+Math.sin(t*.00015+i)*23)%180);bubble(c,x,y,7+i%3*4,.20);}
  }

  function wheel(c,x,y,r=66){
    ellipse(c,x,y+8,r+8,r+2,'#344f56');ellipse(c,x,y,r,r,'#4c6467');ellipse(c,x,y,r-12,r-12,'#38545c');ellipse(c,x,y,r-24,r-24,'#e6e6cf');ellipse(c,x,y,r-31,r-31,'#bcc7bd');ellipse(c,x,y,12,12,'#f7f2df');
    c.beginPath();c.arc(x,y,r-5,3.5,5.1);c.strokeStyle='#718282';c.lineWidth=5;c.lineCap='round';c.stroke();
    for(let i=0;i<5;i++){const a=i*TAU/5;ellipse(c,x+Math.cos(a)*(r-24)*.65,y+Math.sin(a)*(r-24)*.65,3,3,'#9aaea7');}
  }
  function eyes(c,x,y,space,scale,blink,happy){
    c.save();c.translate(x,y);c.scale(scale,scale);
    for(const dx of [-space/2,space/2]){
      if(blink||happy){path(c,[['moveTo',dx-14,3],['quadraticCurveTo',dx,blink?13:-14,dx+14,3]],null,'#355662',7);}
      else{ellipse(c,dx,0,23,29,'#fffdf4');ellipse(c,dx+4,4,12,18,'#355661');ellipse(c,dx+7,-3,4.3,5.5,'#fffdf7');}
    } c.restore();
  }
  function smile(c,x,y,wide=36){path(c,[['moveTo',x-wide,y],['quadraticCurveTo',x,y+32,x+wide,y]],null,'#8c5e50',6);ellipse(c,x-wide-18,y-4,15,8,'#eb8e8066');ellipse(c,x+wide+18,y-4,15,8,'#eb8e8066');}
  function drawCar(c,kind,t=0,mini=false){
    const blink=!mini&&((t%5500)>5200||(t%5500)<90), happy=!mini&&(complete||t<happyUntil);
    c.lineJoin='round';c.lineCap='round';
    if(kind==='car'){
      wheel(c,-231,105,68);wheel(c,237,105,68);
      // Rounded cabin, warm terracotta shell and two panes of sea-glass.
      path(c,[['moveTo',-283,-49],['quadraticCurveTo',-252,-197,-167,-212],['quadraticCurveTo',-75,-233,59,-205],['quadraticCurveTo',120,-188,177,-63],['closePath']],grad(c,0,-220,0,0,[[0,'#f7b7a0'],[1,'#d98574']]),'#cc8876',3);
      path(c,[['moveTo',-231,-68],['quadraticCurveTo',-212,-166,-156,-176],['quadraticCurveTo',-119,-184,-76,-180],['lineTo',-74,-65],['closePath']],grad(c,0,-180,0,-50,[[0,'#b3e0df'],[1,'#7fb7c4']]),'#fff0d7',7);
      path(c,[['moveTo',-54,-179],['quadraticCurveTo',0,-184,49,-171],['quadraticCurveTo',95,-156,130,-68],['lineTo',-54,-68],['closePath']],grad(c,0,-180,0,-50,[[0,'#cceceb'],[1,'#9bced6']]),'#fff0d7',7);
      path(c,[['moveTo',-208,-135],['lineTo',-190,-163],['lineTo',-158,-165],['lineTo',-195,-105]],'#ffffff36');path(c,[['moveTo',-34,-158],['lineTo',-5,-160],['lineTo',58,-83],['lineTo',30,-83]],'#ffffff2d');
      // Soft, substantial lower body.
      path(c,[['moveTo',-343,-53],['quadraticCurveTo',-354,-85,-278,-83],['lineTo',141,-81],['quadraticCurveTo',302,-82,344,-17],['quadraticCurveTo',368,19,348,76],['quadraticCurveTo',335,99,301,100],['lineTo',298,73],['bezierCurveTo',285,-10,177,-10,169,97],['lineTo',-164,97],['bezierCurveTo',-172,-8,-289,-10,-298,99],['quadraticCurveTo',-359,99,-363,60],['lineTo',-365,-13],['quadraticCurveTo',-363,-41,-343,-53],['closePath']],grad(c,0,-90,0,110,[[0,'#f7b49a'],[.4,'#eaa088'],[1,'#da8e79']]),'#cb8774',3);
      path(c,[['moveTo',-326,-56],['quadraticCurveTo',-185,-67,129,-59],['quadraticCurveTo',276,-61,317,-17]],null,'#ffd8ba',8);
      // Door, body trim, lamps and front bumper.
      path(c,[['moveTo',-69,-57],['lineTo',-66,63],['quadraticCurveTo',-64,77,-45,78],['lineTo',142,78]],null,'#ce8875',3);
      round(c,-41,-27,39,9,5,'#fbe0bb');line(c,-138,77,143,77,'#f5c5a4',5);
      round(c,-374,20,34,38,12,'#fff0cd');round(c,307,3,46,30,12,'#fff3d7','#e1c39c',3);ellipse(c,331,13,12,5,'#ffffffaa');
      round(c,301,66,62,17,8,'#c2d2c6');round(c,-373,66,57,16,8,'#d7ddd0');
      round(c,116,-77,43,26,12,'#df907a','#c98270',2);
      eyes(c,28,-119,82,.87,blink,happy);smile(c,245,-1,25);
      // A tiny flower decal.
      for(let i=0;i<5;i++){const a=i*TAU/5;ellipse(c,-218+Math.cos(a)*12,-19+Math.sin(a)*12,7,7,'#f9ddac');}ellipse(c,-218,-19,6,6,'#d6a66f');
    } else if(kind==='fire'){
      wheel(c,-238,107,68);wheel(c,237,107,68);
      round(c,-369,-161,455,245,[25,25,13,13],grad(c,0,-160,0,100,[[0,'#ec9483'],[1,'#d57867']]),'#c77263',3);
      round(c,-339,-119,245,148,13,'#e8d7b4','#c47d66',3);for(let y=-105;y<29;y+=20)line(c,-325,y,-107,y,'#c9b995',3);
      round(c,-335,42,250,16,7,'#fff0cb');round(c,-64,-112,104,107,16,'#bc6c5e');ellipse(c,-12,-58,35,35,'#edb69c');ellipse(c,-12,-58,23,23,null,'#b96a59',7);ellipse(c,-12,-58,11,11,null,'#b96a59',6);
      // Cab with friendly windscreen.
      path(c,[['moveTo',73,81],['lineTo',73,-164],['quadraticCurveTo',73,-197,113,-197],['lineTo',258,-197],['quadraticCurveTo',300,-196,318,-139],['lineTo',354,-33],['lineTo',354,74],['quadraticCurveTo',354,95,310,96],['lineTo',300,74],['bezierCurveTo',287,-9,182,-9,168,94],['lineTo',73,94],['closePath']],grad(c,0,-200,0,100,[[0,'#f0a18c'],[1,'#dd8372']]),'#c77263',3);
      path(c,[['moveTo',105,-161],['quadraticCurveTo',105,-171,120,-171],['lineTo',250,-171],['quadraticCurveTo',271,-170,283,-133],['lineTo',302,-73],['lineTo',105,-73],['closePath']],grad(c,0,-180,0,-50,[[0,'#d1e7df'],[1,'#93c3cd']]),'#ffedcb',7);
      path(c,[['moveTo',123,-154],['lineTo',151,-154],['lineTo',211,-85],['lineTo',184,-85]],'#ffffff22');
      eyes(c,199,-118,90,.86,blink,happy);smile(c,291,29,24);
      round(c,95,-39,40,9,4,'#ffe8bb');round(c,329,-18,34,27,8,'#fff0cd');round(c,318,66,53,17,7,'#c5d4c8');round(c,-375,63,49,16,7,'#d6dccc');
      // Cream ladder resting safely on the roof.
      round(c,-322,-208,445,12,6,'#ad9880');round(c,-322,-239,445,12,6,'#dfcdb0');for(let x=-302;x<117;x+=45)line(c,x,-231,x,-204,'#f2e6cd',9);
      round(c,135,-224,60,18,8,'#d2bba0');round(c,142,-255,45,33,[15,15,6,6],grad(c,0,-255,0,-221,[[0,'#c9e8e4'],[1,'#8bc1c8']]),'#d5d6bc',3);line(c,150,-247,150,-234,'#f3faf1',4);
      // Simple star badge.
      star(c,2,48,21,'#ffe3a3');
    } else {
      // A little dump truck, rounded and friendly.
      wheel(c,-234,106,73);wheel(c,237,106,73);
      round(c,-361,42,720,40,16,'#ae9463');
      path(c,[['moveTo',-376,-146],['lineTo',37,-146],['lineTo',10,37],['quadraticCurveTo',8,57,-21,57],['lineTo',-298,57],['quadraticCurveTo',-322,56,-332,31],['closePath']],grad(c,0,-150,0,70,[[0,'#f4ce79'],[1,'#e1ad59']]),'#c29958',3);
      round(c,-387,-161,439,24,9,'#f8da92','#d3ad68',3);path(c,[['moveTo',-352,-116],['lineTo',-319,24],['lineTo',-29,24],['lineTo',-11,-116]],null,'#cf9c4e',7);
      for(let x=-282;x<0;x+=79)line(c,x,-105,x+15,15,'#f8d88b',14);
      path(c,[['moveTo',55,83],['lineTo',65,-176],['quadraticCurveTo',66,-207,104,-207],['lineTo',251,-207],['quadraticCurveTo',279,-205,298,-170],['lineTo',346,-69],['lineTo',366,-51],['lineTo',366,72],['quadraticCurveTo',362,91,311,94],['bezierCurveTo',297,-11,178,-9,164,94],['lineTo',55,94],['closePath']],grad(c,0,-200,0,90,[[0,'#f7d58d'],[1,'#e6b863']]),'#c59e60',3);
      path(c,[['moveTo',94,-171],['quadraticCurveTo',94,-181,111,-181],['lineTo',240,-181],['quadraticCurveTo',256,-182,270,-153],['lineTo',305,-80],['lineTo',94,-80],['closePath']],grad(c,0,-180,0,-50,[[0,'#c6e3df'],[1,'#8bbcc5']]),'#fff0cd',7);
      eyes(c,192,-125,87,.9,blink,happy);smile(c,301,22,24);
      round(c,85,-47,39,9,4,'#fcf0cf');round(c,332,-30,36,25,9,'#fff3d1');round(c,322,64,57,20,7,'#bdccbf');
      round(c,117,-225,155,14,6,'#e3b769');round(c,137,-250,52,26,[12,12,4,4],'#efac68','#c49958',3);line(c,148,-243,148,-233,'#ffe1a6',4);
      for(let i=0;i<3;i++)path(c,[['moveTo',-326+i*47,60],['lineTo',-303+i*47,60],['lineTo',-314+i*47,78],['lineTo',-337+i*47,78],['closePath']],'#eedca5');
    }
  }

  function dirtAndBubbles(c,t){
    for(const p of patches){
      if(!p.rinsed){
        const r=25+(p.seed%10);
        blob(c,p.x,p.y,r,p.seed,'#a18a648e');blob(c,p.x+16,p.y-12,r*.42,p.seed+5,'#b59d7395');ellipse(c,p.x-17,p.y+19,4,3,'#92794e88');
      }
      if(p.soap&&!p.rinsed){
        for(let i=0;i<4;i++){const a=i*2.4+p.seed;const x=p.x+Math.cos(a)*(16+i*5),y=p.y+Math.sin(a)*(12+i*4);bubble(c,x,y,18+i*3,.93);}
      }
      if(p.rinsed&&!p.dry){
        const y=p.y+Math.sin(t*.001+p.seed)*3;
        path(c,[['moveTo',p.x,y-15],['bezierCurveTo',p.x+15,y+3,p.x+12,y+13,p.x,y+13],['bezierCurveTo',p.x-12,y+13,p.x-15,y+3,p.x,y-15]],'#82bfdb9c','#c1e6ef',1.5);
        line(c,p.x-3,y+1,p.x-4,y+6,'#eefbfc',2.5);
      }
    }
  }
  function drawSponge(c,x,y,size=1){c.save();c.translate(x,y);c.rotate(-.16);c.scale(size,size);round(c,-45,-28,90,60,19,'#e2ab56','#f8e5b6',2);round(c,-45,-34,90,57,19,'#f9d17a');for(const [xx,yy]of[[-22,-13],[12,-22],[25,7],[-14,12]])ellipse(c,xx,yy,4,3,'#e3b15f');bubble(c,-30,-37,15);bubble(c,-4,-45,20);bubble(c,24,-37,12);c.restore();}
  function drawNozzle(c,x,y,size=1){c.save();c.translate(x,y);c.rotate(-.5);c.scale(size,size);round(c,-11,-7,23,63,10,'#6f9d9f');round(c,-34,-38,68,44,[22,22,12,12],'#acd8d6','#709d9e',3);round(c,-37,-5,74,11,5,'#668c91');for(let i=-2;i<=2;i++)line(c,i*11,12,i*16,39,'#d2f6ff',4);c.restore();}
  function drawTowel(c,x,y,size=1){c.save();c.translate(x,y);c.rotate(.16);c.scale(size,size);round(c,-49,-36,98,76,14,'#ecaaa1','#f7d9ca',2);round(c,-49,-40,98,69,14,'#f6c3b6');line(c,-39,-24,39,-24,'#fff0da',5);line(c,-39,14,39,14,'#fff0da',5);for(let x=-38;x<44;x+=14)line(c,x,37,x,45,'#dda196',2);star(c,0,-4,13,'#fff0da');c.restore();}
  function cursor(c,p){const size=.77*carScale;if(currentTool==='soap')drawSponge(c,p.x+13,p.y-17,size);if(currentTool==='water')drawNozzle(c,p.x+22,p.y-42,size);if(currentTool==='dry')drawTowel(c,p.x+12,p.y-8,size);}
  function addParticles(x,y,tool,count=3){
    for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*(tool==='water'?150:90),vy:tool==='water'?Math.random()*130+30:-Math.random()*90-30,r:tool==='water'?3+Math.random()*4:7+Math.random()*15,age:0,life:tool==='water'?.6:1.3,tool,rotation:Math.random()*TAU});
    if(particles.length>160)particles.splice(0,particles.length-160);
  }
  function render(t){
    const dt=Math.min((t-lastTime)/1000,.04)||.016;lastTime=t;frameCount++;
    if(!document.hidden){
      ctx.setTransform(dpr*canvas.clientWidth/width,0,0,dpr*canvas.clientWidth/width,0,0);
      ctx.clearRect(0,0,width,height);scenery(ctx,t);
      const idle = reducedMotion?0:Math.sin(t*.0016)*2.2;
      const bounce = !reducedMotion&&t<happyUntil?Math.sin(t*.015)*5:idle;
      ellipse(ctx,carX,carY+carScale*146,carScale*390,carScale*30,'#6c9d982b');
      ctx.save();ctx.translate(carX,carY+bounce);ctx.scale(carScale,carScale);drawCar(ctx,currentCar,t);dirtAndBubbles(ctx,t);
      if(complete){for(let i=0;i<5;i++){const a=t*.0005+i*1.3;star(ctx,-300+i*145,-225-Math.sin(a)*15,9+Math.sin(a)*3,'#fff9d4',a*.2);}if(!reducedMotion)heart(ctx,-370,-160+Math.sin(t*.002)*8,18,'#e5aa95');}
      ctx.restore();
      for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.tool==='water')p.vy+=160*dt;if(p.age>p.life){particles.splice(i,1);continue;}ctx.save();ctx.globalAlpha=(1-p.age/p.life)*.8;if(p.tool==='soap')bubble(ctx,p.x,p.y,p.r);if(p.tool==='water')ellipse(ctx,p.x,p.y,p.r*.6,p.r,'#c9f1ff');if(p.tool==='dry')star(ctx,p.x,p.y,p.r*.7,'#fff9d5',p.rotation);ctx.restore();}
      for(const p of pointers.values())cursor(ctx,p);
      // An idle hand demonstrates the gesture once the child has paused, never rushing them.
      idleTime+=dt;
      if(started&&!complete&&pointers.size===0&&idleTime>5){const a=Math.sin(t*.0013);ctx.save();ctx.globalAlpha=.5;const x=carX+a*115*carScale,y=carY+8*carScale;ctx.setLineDash([5,10]);path(ctx,[['moveTo',carX-120*carScale,y+23],['quadraticCurveTo',carX,y-12,carX+120*carScale,y+23]],null,'#fffef2',4);ctx.setLineDash([]);if(currentTool==='soap')drawSponge(ctx,x,y,.5*carScale);else if(currentTool==='water')drawNozzle(ctx,x,y,.5*carScale);else drawTowel(ctx,x,y,.5*carScale);ctx.restore();}
    }
    requestAnimationFrame(render);
  }
  function resize(){
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);
    height=r.height/r.width*width;
    carScale=Math.min(1.08,Math.max(.42,(height-145)/445));
    carY=Math.max(138+carScale*210,height*.58);
    // Keep wheels, puddle, duck and all touch targets visible in short landscape layouts.
    carY=Math.min(carY,height-carScale*180-22);
    pointers.clear();
  }
  function speak(text){
    if(!started||muted||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
    try{window.speechSynthesis.cancel();const u=new window.SpeechSynthesisUtterance(text);u.lang='zh-CN';u.rate=.78;u.pitch=1.12;u.volume=.8;const voice=window.speechSynthesis.getVoices().find(v=>/^zh/.test(v.lang));if(voice)u.voice=voice;window.speechSynthesis.speak(u);}catch(_){}
  }
  function initAudio(){
    if(!audio){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio=new AC();master=audio.createGain();master.gain.value=muted?0:.18;master.connect(audio.destination);}catch(_){return;}}
    if(audio.state==='suspended')audio.resume().catch(()=>{});
  }
  function tone(freq,duration=.12,type='sine',volume=.3,delay=0,slide=null){
    if(!audio||muted||audio.state!=='running')return;
    const now=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,now);if(slide)o.frequency.exponentialRampToValueAtTime(slide,now+duration);g.gain.setValueAtTime(.001,now);g.gain.exponentialRampToValueAtTime(volume,now+.012);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(g);g.connect(master);o.start(now);o.stop(now+duration+.03);
  }
  function noise(duration,filterFreq,volume){
    if(!audio||muted||audio.state!=='running')return;
    const len=Math.ceil(audio.sampleRate*duration),b=audio.createBuffer(1,len,audio.sampleRate),data=b.getChannelData(0);for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.4);
    const s=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain();s.buffer=b;f.type='lowpass';f.frequency.value=filterFreq;g.gain.value=volume;s.connect(f);f.connect(g);g.connect(master);s.start();
  }
  function play(tool,now=performance.now()){
    if(now-lastSound<120)return;lastSound=now;
    if(tool==='soap')tone(450+Math.random()*260,.13,'sine',.22,0,190);
    if(tool==='water')noise(.19,2500,.11);
    if(tool==='dry')noise(.12,800,.07);
  }
  function chime(){tone(523,.24,'sine',.18);tone(659,.25,'sine',.15,.14);tone(784,.38,'sine',.13,.28);}
  function beep(){const now=performance.now();if(now-lastBeep<380)return;lastBeep=now;tone(currentCar==='digger'?220:330,.16,'triangle',.12);tone(currentCar==='digger'?294:440,.2,'triangle',.1,.18);}
  function updateSoundButton(){const b=$('#sound');b.classList.toggle('muted',muted);b.setAttribute('aria-pressed',String(muted));b.setAttribute('aria-label',muted?'打开声音':'关闭声音');}
  function setTool(tool,automatic=false){
    currentTool=tool;idleTime=0;
    document.querySelectorAll('.tool').forEach(b=>{const active=b.dataset.tool===tool;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
    const phrases={soap:['给车车搓泡泡','摸一摸 · 搓一搓'],water:['小水花，冲一冲','泡泡咕噜咕噜走啦'],dry:['小毛巾，擦一擦','轻轻擦 · 亮晶晶']};
    const actual=stage===0&&tool!=='soap'?['先和泡泡玩一玩','点点海绵 · 搓搓车车']:stage===1&&tool==='dry'?['先冲掉小泡泡','点点花洒 · 水花来啦']:phrases[tool];
    $('#hint-text').textContent=actual[0];$('#hint-sub').textContent=actual[1];speak(actual[0]);
    syncState();if(!automatic)tone(390+['soap','water','dry'].indexOf(tool)*90,.1,'sine',.12);
  }
  function syncState(){canvas.dataset.stage=String(stage);canvas.dataset.tool=currentTool;canvas.dataset.car=currentCar;canvas.dataset.complete=String(complete);canvas.dataset.muted=String(muted);canvas.dataset.soap=coverage('soap').toFixed(2);canvas.dataset.water=coverage('rinsed').toFixed(2);canvas.dataset.dry=coverage('dry').toFixed(2);canvas.dataset.audio=audio?.state||'not-created';}
  function updateSteps(){
    document.querySelectorAll('#step-pips span').forEach((p,i)=>{p.className=i<stage?'complete':i===stage?'current':'';});
    document.querySelectorAll('.tool').forEach((p,i)=>p.classList.toggle('finished',i<stage));
  }
  function advance(){
    if(complete||stepTimer)return;
    const keys=['soap','rinsed','dry'];
    if(coverage(keys[stage]) < .72)return;
    // Finish the tiny missed corners for small hands, then quietly offer the next tool.
    for(const p of patches)p[keys[stage]]=true;
    stage++;updateSteps();happyUntil=performance.now()+750;
    if(stage===3){finish();return;}
    stepTimer=setTimeout(()=>{stepTimer=null;if(!complete){setTool(stage===1?'water':'dry',true);tone(stage===1?550:660,.22,'sine',.14);}},420);
  }
  function finish(){
    complete=true;pointers.clear();happyUntil=performance.now()+1500;$('#done').hidden=false;$('.hint').style.visibility='hidden';chime();speak('车车洗干净啦，谢谢你。');
    for(let i=0;i<14;i++)addParticles(carX+(Math.random()-.5)*600*carScale,carY-130*carScale,'dry',1);
  }
  function reset(kind=currentCar){
    if(stepTimer){clearTimeout(stepTimer);stepTimer=null;}
    currentCar=kind;stage=0;complete=false;patches=makePatches(kind);particles=[];pointers.clear();idleTime=0;$('#done').hidden=true;$('.hint').style.visibility='';
    document.querySelectorAll('.vehicle').forEach(b=>{const active=b.dataset.car===kind;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
    updateSteps();setTool('soap',true);happyUntil=performance.now()+600;
  }
  function at(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*width/r.width,y:(e.clientY-r.top)*height/r.height};}
  function act(p){
    lastTouch=performance.now();idleTime=0;
    if(complete){syncState();if(Math.abs(p.x-carX)<400*carScale&&Math.abs(p.y-carY)<260*carScale){beep();happyUntil=performance.now()+750;}addParticles(p.x,p.y,'dry',2);return;}
    const x=(p.x-carX)/carScale,y=(p.y-carY)/carScale;
    const changed=cleanAt(patches,currentTool,x,y);
    addParticles(p.x,p.y,currentTool,changed?5:2);play(currentTool);
    if(changed)happyUntil=performance.now()+230;advance();syncState();
  }
  canvas.addEventListener('pointerdown',e=>{if(!started)return;e.preventDefault();initAudio();const p=at(e);pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);act(p);});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();const p=at(e),old=pointers.get(e.pointerId);const dist=Math.hypot(p.x-old.x,p.y-old.y),n=Math.max(1,Math.ceil(dist/35));for(let i=1;i<=Math.min(n,40);i++){const f=i/Math.min(n,40);act({x:old.x+(p.x-old.x)*f,y:old.y+(p.y-old.y)*f});}pointers.set(e.pointerId,p);});
  const pointerEnd=e=>{pointers.delete(e.pointerId);try{if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}catch(_) {}};
  canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);canvas.addEventListener('lostpointercapture',pointerEnd);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());window.addEventListener('blur',()=>pointers.clear());
  window.addEventListener('pagehide',()=>{if(window.speechSynthesis)window.speechSynthesis.cancel();});
  document.addEventListener('visibilitychange',()=>{pointers.clear();if(document.hidden&&window.speechSynthesis)window.speechSynthesis.cancel();if(document.hidden&&audio)audio.suspend().catch(()=>{});});
  document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>{initAudio();if(!complete)setTool(b.dataset.tool);}));
  document.querySelectorAll('.vehicle').forEach(b=>b.addEventListener('click',()=>{initAudio();reset(b.dataset.car);beep();}));
  $('#sound').addEventListener('click',()=>{muted=!muted;if(muted&&window.speechSynthesis)window.speechSynthesis.cancel();initAudio();if(master)master.gain.setTargetAtTime(muted?0:.18,audio.currentTime,.02);updateSoundButton();syncState();try{localStorage.setItem('car-bath-muted',muted?'1':'0');}catch(_){}if(!muted)tone(523,.15,'sine',.16);});
  $('#start').addEventListener('click',()=>{started=true;$('#welcome').classList.add('hidden');initAudio();beep();speak('给车车搓泡泡，小手摸一摸。');syncState();$('#sound').focus({preventScroll:true});});
  $('#again').addEventListener('click',()=>{initAudio();reset();beep();});
  // Tool buttons support keyboard activation. Space / Enter on the wash area offers a gentle dab.
  canvas.tabIndex=0;canvas.addEventListener('keydown',e=>{if(!started||![' ','Enter'].includes(e.key))return;e.preventDefault();initAudio();const key=['soap','rinsed','dry'][stage];const p=patches.find(p=>!p[key]);if(p)act({x:carX+p.x*carScale,y:carY+p.y*carScale});});
  document.querySelectorAll('.vehicle').forEach(b=>{const c=b.querySelector('canvas').getContext('2d');c.clearRect(0,0,190,110);c.save();c.translate(95,66);c.scale(.23,.23);drawCar(c,b.dataset.car,1000,true);c.restore();});
  new ResizeObserver(resize).observe(canvas);window.addEventListener('orientationchange',()=>setTimeout(resize,180));
  reset();updateSoundButton();resize();requestAnimationFrame(render);
  // A read-only state snapshot supports repeatable regression checks without changing gameplay.
  Object.defineProperty(window,'carBathState',{get:()=>({car:currentCar,tool:currentTool,stage,complete,started,muted,audioState:audio?.state||'not-created',coverage:{soap:coverage('soap'),water:coverage('rinsed'),dry:coverage('dry')},patches:patches.length,pointers:pointers.size,canvas:{width,height,carX,carY,carScale},frameCount}),configurable:false});
})();
