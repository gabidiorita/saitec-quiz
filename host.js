const socket = io(); let pin; let questionCount = 0;
const $ = id => document.getElementById(id);
function show(id) { ['builder','lobby','game','finish'].forEach(x => $(x).classList.toggle('hidden', x !== id)); }
function addQuestion() {
  if (questionCount >= 15) return;
  questionCount++; const box = document.createElement('article'); box.className = 'question-box';
  box.innerHTML = `<h3>Pregunta ${questionCount}</h3><input class="qtext" maxlength="140" placeholder="Escribe la pregunta"><label class="image-picker">🖼️ Imagen opcional<input class="qimage" type="file" accept="image/jpeg,image/png,image/webp"></label><small>La imagen se reducirá automáticamente.</small><div class="option-grid">${[0,1,2,3].map((n)=>`<label><input type="radio" name="correct${questionCount}" value="${n}" ${n===0?'checked':''}> <input class="option" maxlength="80" placeholder="Respuesta ${n+1}"></label>`).join('')}</div>`;
  $('questions').appendChild(box);
}
$('add').onclick = addQuestion; addQuestion();
$('create').onclick = async () => {
  $('create').disabled = true; $('create').textContent = 'Preparando imágenes…';
  const questions = await Promise.all([...document.querySelectorAll('.question-box')].map(async box => ({ text: box.querySelector('.qtext').value.trim(), image: await resizeImage(box.querySelector('.qimage').files[0]), options: [...box.querySelectorAll('.option')].map(x=>x.value.trim()), correct: Number(box.querySelector('input[type=radio]:checked').value) })));
  $('create').disabled = false; $('create').textContent = 'Crear partida';
  if (questions.some(q => !q.text || q.options.some(x=>!x))) return $('error').textContent = 'Completa todas las preguntas y respuestas.';
  socket.emit('host:create', { title: $('title').value, questions }, res => { if(res.error) return $('error').textContent=res.error; pin=res.pin; $('pin').textContent=pin; show('lobby'); });
};
function resizeImage(file) {
  if (!file) return Promise.resolve('');
  return new Promise((resolve, reject) => { const img=new Image(), reader=new FileReader(); reader.onload=e=>img.src=e.target.result; reader.onerror=reject; img.onload=()=>{ const scale=Math.min(1,900/Math.max(img.width,img.height)), canvas=document.createElement('canvas'); canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale); canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height); resolve(canvas.toDataURL('image/jpeg',.75)); }; img.onerror=reject; reader.readAsDataURL(file); });
}
function renderPlayers(players, target='players') { $(target).innerHTML = players.sort((a,b)=>b.score-a.score).map((p,i)=>`<div><span>${i+1}. ${p.name}${p.answered?' ✓':''}</span><strong>${p.score}</strong></div>`).join(''); $('count').textContent=players.length; }
socket.on('host:players', p => renderPlayers(p, $('game').classList.contains('hidden')?'players':'scores'));
$('start').onclick=()=>socket.emit('host:start',pin); $('next').onclick=()=>socket.emit('host:next',pin);
socket.on('game:question', q => { show('game'); $('progress').textContent=`Pregunta ${q.number} de ${q.total}`; $('question').textContent=q.text; $('questionImage').src=q.image||''; $('questionImage').style.display=q.image?'block':'none'; $('hostOptions').innerHTML=q.options.map((x,i)=>`<div class="answer c${i}">${x}</div>`).join(''); });
socket.on('game:finished', ranking => { show('finish'); $('ranking').innerHTML=ranking.map((p,i)=>`<div><b>${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1+'.'} ${p.name}</b><span>${p.score} puntos</span></div>`).join(''); });
