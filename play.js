const socket=io(); let pin; const $=id=>document.getElementById(id);
function show(id){['join','waiting','game','finish'].forEach(x=>$(x).classList.toggle('hidden',x!==id));}
$('enter').onclick=()=>{pin=$('pin').value.trim();socket.emit('player:join',{pin,name:$('name').value},res=>{if(res.error)return $('error').textContent=res.error;show('waiting');});};
socket.on('game:question',q=>{show('game');$('progress').textContent=`Pregunta ${q.number} de ${q.total}`;$('question').textContent=q.text;$('questionImage').src=q.image||'';$('questionImage').style.display=q.image?'block':'none';$('feedback').textContent='';$('answers').innerHTML=q.options.map((x,i)=>`<button class="answer c${i}" data-i="${i}">${x}</button>`).join('');document.querySelectorAll('.answer').forEach(b=>b.onclick=()=>{document.querySelectorAll('.answer').forEach(x=>x.disabled=true);socket.emit('player:answer',{pin,answer:b.dataset.i},res=>$('feedback').textContent=res.correct?'✅ ¡Correcto! +1000 puntos':'❌ Esta vez no.');});});
socket.on('game:finished',ranking=>{show('finish');$('ranking').innerHTML=ranking.map((p,i)=>`<div><b>${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1+'.'} ${p.name}</b><span>${p.score} puntos</span></div>`).join('');});
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));}
function finalRankingHtml(ranking){
  const top=ranking.slice(0,3);
  const podiumOrder=[top[1],top[0],top[2]].filter(Boolean);
  const podium=podiumOrder.map(p=>{
    const originalIndex=ranking.indexOf(p);
    const place=originalIndex+1;
    return `<article class="podium-card place-${place}"><div class="medal">${['🥇','🥈','🥉'][originalIndex]}</div><h2>${escapeHtml(p.name)}</h2><p>${p.score} puntos</p><strong>${place}º puesto</strong></article>`;
  }).join('');
  const places=ranking.map((p,i)=>{
    const medals=['🥇','🥈','🥉'];
    return `<div><b>${medals[i]||`${i+1}.`} ${escapeHtml(p.name)}</b><span>${p.score} puntos</span></div>`;
  }).join('');
  return `<div class="podium">${podium}</div><h2>Clasificación completa</h2>${places}`;
}
socket.on('game:finished',ranking=>{show('finish');$('ranking').innerHTML=finalRankingHtml(ranking);});
socket.on('game:closed',()=>{alert('La persona anfitriona ha cerrado la partida.');location.href='/';});
