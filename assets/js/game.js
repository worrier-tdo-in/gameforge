
(function(){
  const canvas = document.getElementById('game');
  if(!canvas) return;
  const c = canvas.getContext('2d');

  function resize(){
    const ratio = 900/520;
    const w = Math.min(canvas.parentElement.clientWidth, 900);
    const h = Math.round(w/ratio);
    canvas.width = 900; canvas.height = 520;
    canvas.style.width = w+'px'; canvas.style.height = h+'px';
  }
  window.addEventListener('resize', resize); resize();

  const W = () => canvas.width, H = () => canvas.height;
  let running=true, paused=false, score=0, high=parseInt(localStorage.getItem('gf_high')||'0',10), combo=1, t=0;
  const player={x:450,y:440,w:64,h:24,vx:0,speed:8,shield:0};
  const sparks=[], obstacles=[], powerups=[];
  const lanes=7, laneWidth=()=>W()/lanes;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function spawnObstacle(){ const lane=Math.floor(Math.random()*lanes), size=22+Math.random()*14, speed=3+Math.min(7, score/250);
    obstacles.push({x: lane*laneWidth()+laneWidth()/2-size/2, y:-40, w:size, h:size, vy:speed}); }
  function spawnPower(){ const lane=Math.floor(Math.random()*lanes), kind = Math.random()<0.6?'gem':(Math.random()<0.5?'shield':'slow');
    powerups.push({x: lane*laneWidth()+laneWidth()/2-10, y:-40, w:20, h:20, vy:2.6, kind}); }
  function spark(x,y,n=12){ for(let i=0;i<n;i++) sparks.push({x,y,vx:(Math.random()*2-1)*3,vy:(Math.random()*2-1)*3,life:40+Math.random()*20}); }

  function input(){
    window.addEventListener('keydown', e=>{
      if(['ArrowLeft','a','A'].includes(e.key)) player.vx=-player.speed;
      if(['ArrowRight','d','D'].includes(e.key)) player.vx=player.speed;
      if(e.key==='p'||e.key==='P') paused=!paused;
      if(e.key==='r'||e.key==='R') restart();
    });
    window.addEventListener('keyup', e=>{
      if(['ArrowLeft','a','A','ArrowRight','d','D'].includes(e.key)) player.vx=0;
    });
    let dragging=false,lastX=null;
    canvas.addEventListener('pointerdown', e=>{dragging=true;lastX=e.clientX;});
    window.addEventListener('pointerup', ()=>{dragging=false;lastX=null;});
    window.addEventListener('pointermove', e=>{ if(!dragging) return; const dx=e.clientX-(lastX??e.clientX); lastX=e.clientX; player.x+=dx*1.1; });
    document.getElementById('btn-pause')?.addEventListener('click', ()=>paused=!paused);
    document.getElementById('btn-restart')?.addEventListener('click', restart);
  }

  function drawBG(now){
    c.clearRect(0,0,W(),H());
    for(let i=0;i<10;i++){
      const y=(i/10)*H(), alpha=0.06+Math.sin((now*0.001+i))*0.04;
      const g=c.createLinearGradient(0,y,W(),y); g.addColorStop(0,`rgba(124,58,237,${alpha})`); g.addColorStop(1,`rgba(6,182,212,${alpha})`);
      c.fillStyle=g; c.fillRect(0,y,W(),6);
    }
    c.strokeStyle="rgba(255,255,255,.06)"; c.lineWidth=2;
    for(let i=1;i<lanes;i++){ const x=i*laneWidth(); c.beginPath(); c.moveTo(x,0); c.lineTo(x,H()); c.stroke(); }
  }
  function roundRect(ctx,x,y,w,h,r,fill){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); if(fill) ctx.fill(); else ctx.stroke(); }
  function drawPlayer(){
    c.save(); const g=c.createLinearGradient(player.x,player.y,player.x,player.y+player.h); g.addColorStop(0,"#7C3AED"); g.addColorStop(1,"#06B6D4");
    c.fillStyle=g; c.shadowBlur=16; c.shadowColor="#06B6D4"; roundRect(c, player.x-player.w/2, player.y-player.h/2, player.w, player.h, 10, true);
    if(player.shield>0){ c.strokeStyle="rgba(20,184,166,.9)"; c.lineWidth=3; c.beginPath(); c.arc(player.x,player.y,player.h,0,Math.PI*2); c.stroke(); }
    c.restore();
  }
  function drawObstacles(){ obstacles.forEach(o=>{ c.save(); c.strokeStyle="rgba(255,255,255,.15)"; c.lineWidth=2; c.strokeRect(o.x,o.y,o.w,o.h);
    const g=c.createLinearGradient(o.x,o.y,o.x+o.w,o.y+o.h); g.addColorStop(0,"rgba(124,58,237,.9)"); g.addColorStop(1,"rgba(6,182,212,.9)"); c.fillStyle=g; c.globalAlpha=.9; c.fillRect(o.x,o.y,o.w,o.h); c.restore(); }); }
  function drawPowerups(){ powerups.forEach(p=>{ c.save(); c.globalAlpha=.95; if(p.kind==='gem'){ c.fillStyle="#22d3ee"; c.beginPath(); c.moveTo(p.x+p.w/2,p.y); c.lineTo(p.x+p.w,p.y+p.h/2); c.lineTo(p.x+p.w/2,p.y+p.h); c.lineTo(p.x,p.y+p.h/2); c.closePath(); c.fill(); } else if(p.kind==='shield'){ c.strokeStyle="#14b8a6"; c.lineWidth=3; c.strokeRect(p.x,p.y,p.w,p.h); } else { c.fillStyle="#a78bfa"; c.fillRect(p.x,p.y,p.w,p.h); } c.restore(); }); }
  function drawSparks(){ sparks.forEach(s=>{ c.fillStyle="rgba(255,255,255,.9)"; c.fillRect(s.x,s.y,2,2); }); }
  function overlap(a,b){ const ax=a.x-a.w/2, ay=a.y-a.h/2; return ax < b.x+b.w && ax+a.w > b.x && ay < b.y+b.h && ay+a.h > b.y; }

  function step(dt){
    if(!running||paused) return;
    t+=dt;
    if(t%40<1) spawnObstacle();
    if(t%160<1) spawnPower();
    player.x = clamp(player.x + player.vx, player.w/2, W()-player.w/2);

    for(let i=obstacles.length-1;i>=0;i--){
      const o=obstacles[i]; o.y+=o.vy; if(o.y>H()+40) obstacles.splice(i,1);
      if(overlap(player,o)){ if(player.shield>0){ player.shield=0; obstacles.splice(i,1); spark(player.x,player.y,20); combo=1; } else { running=false; spark(player.x,player.y,40); } }
    }
    for(let i=powerups.length-1;i>=0;i--){
      const p=powerups[i]; p.y+=p.vy; if(p.y>H()+40) powerups.splice(i,1);
      if(overlap(player,p)){ if(p.kind==='gem'){ combo=Math.min(10,combo+1); score+=15*combo; } else if(p.kind==='shield'){ player.shield=1; } else { obstacles.forEach(o=>o.vy*=0.6); } powerups.splice(i,1); spark(player.x,player.y,18); }
    }
    for(let i=sparks.length-1;i>=0;i--){ const s=sparks[i]; s.x+=s.vx; s.y+=s.vy; s.life--; if(s.life<=0) sparks.splice(i,1); }
    score += 0.25 + obstacles.length*0.02;
  }

  function drawHUD(){
    c.fillStyle="rgba(255,255,255,.92)"; c.font="20px Inter, Arial";
    c.fillText(`Score: ${Math.floor(score)}  Combo x${combo}`, 16, 28);
    c.fillText(`High: ${high}`, 16, 52);
    if(!running){ c.textAlign="center"; c.font="28px Inter, Arial"; c.fillText("Game Over — Press R to retry", W()/2, H()/2); c.textAlign="start"; }
  }

  let last=performance.now();
  function loop(now){ const dt=(now-last)/16.67; last=now; drawBG(now); step(dt); drawObstacles(); drawPowerups(); drawPlayer(); drawSparks(); drawHUD(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);

  function restart(){
    high=Math.max(high, Math.floor(score)); localStorage.setItem('gf_high', String(high));
    const lb = JSON.parse(localStorage.getItem('gf_leaderboard')||'[]'); lb.push({score:Math.floor(score), at:new Date().toISOString()}); lb.sort((a,b)=>b.score-a.score);
    localStorage.setItem('gf_leaderboard', JSON.stringify(lb.slice(0,50)));
    running=true; paused=false; score=0; combo=1; t=0; player.x=450; player.vx=0; player.shield=0; obstacles.length=0; powerups.length=0; sparks.length=0;
  }

  input();
})();
