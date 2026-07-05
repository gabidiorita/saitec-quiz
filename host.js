const socket = io(); let pin; let questionCount = 0;
const $ = id => document.getElementById(id);
function show(id) { ['builder','lobby','game','finish'].forEach(x => $(x).classList.toggle('hidden', x !== id)); }
function addQuestion() {
  if (questionCount >= 15) return;
  questionCount++; const box = document.createElement('article'); box.className = 'question-box';
  box.innerHTML = `<h3>Pregunta ${questionCount}</h3><input class="qtext" maxlength="140" placeholder="Escribe la pregunta"><div class="option-grid">${[0,1,2,3].map((n)=>`<label><input type="radio" name="correct${questionCount}" value="${n}" ${n===0?'checked':''}> <input class="option" maxlength="80" placeholder="Respuesta ${n+1}"></label>`).join('')}</div>`;
  $('questions').appendChild(box);
}
$('add').onclick = addQuestion; addQuestion();
$('create').onclick = () => {
  const questions = [...document.querySelectorAll('.question-box')].map(box => ({ text: box.querySelector('.qtext').value.trim(), options: [...box.querySelectorAll('.option')].map(x=>x.value.trim()), correct: Number(box.querySelector('input[type=radio]:checked').value) }));
  if (questions.some(q => !q.text || q.options.some(x=>!x))) return $('error').textContent = 'Completa todas las preguntas y respuestas.';
  socket.emit('host:create', { title: $('title').value, questions }, res => { if(res.error) return $('error').textContent=res.error; pin=res.pin; $('pin').textContent=pin; show('lobby'); });
};
function renderPlayers(players, target='players') { $(target).innerHTML = players.sort((a,b)=>b.score-a.score).map((p,i)=>`<div><span>${i+1}. ${p.name}${p.answered?' ✓':''}</span><strong>${p.score}</strong></div>`).join(''); $('count').textContent=players.length; }
socket.on('host:players', p => renderPlayers(p, $('game').classList.contains('hidden')?'players':'scores'));
$('start').onclick=()=>socket.emit('host:start',pin); $('next').onclick=()=>socket.emit('host:next',pin);
socket.on('game:question', q => { show('game'); $('progress').textContent=`Pregunta ${q.number} de ${q.total}`; $('question').textContent=q.text; $('hostOptions').innerHTML=q.options.map((x,i)=>`<div class="answer c${i}">${x}</div>`).join(''); });
socket.on('game:finished', ranking => { show('finish'); $('ranking').innerHTML=ranking.map((p,i)=>`<div><b>${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1+'.'} ${p.name}</b><span>${p.score} puntos</span></div>`).join(''); });
