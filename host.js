const socket = io();
let pin;
let questionCount = 0;

const $ = id => document.getElementById(id);

function show(id) {
  ['builder', 'lobby', 'game', 'finish'].forEach(x => $(x).classList.toggle('hidden', x !== id));
}

function addQuestion(data = {}) {
  if (questionCount >= 15) return;
  questionCount++;

  const box = document.createElement('article');
  box.className = 'question-box';
  box.innerHTML = `<h3>Pregunta ${questionCount}</h3>
    <input class="qtext" maxlength="140" placeholder="Escribe la pregunta">
    <label class="image-picker">Imagen opcional
      <input class="qimage" type="file" accept="image/jpeg,image/png,image/webp">
    </label>
    <small>La imagen se reducirá automáticamente.</small>
    <div class="option-grid">
      ${[0, 1, 2, 3].map(n => `<label><input type="radio" name="correct${questionCount}" value="${n}" ${n === 0 ? 'checked' : ''}> <input class="option" maxlength="80" placeholder="Respuesta ${n + 1}"></label>`).join('')}
    </div>`;

  box.querySelector('.qtext').value = data.text || data.question || '';
  box.querySelectorAll('.option').forEach((input, i) => input.value = (data.options || data.answers || [])[i] || '');

  const correct = data.correct ?? data.correctIndex ?? 0;
  const correctInput = box.querySelector(`input[type=radio][value="${correct}"]`);
  if (correctInput) correctInput.checked = true;

  if (data.image) {
    box.dataset.savedImage = data.image;
    box.querySelector('small').textContent = 'Imagen guardada. Puedes elegir otra para sustituirla.';
  }

  $('questions').appendChild(box);
}

$('add').onclick = addQuestion;
addQuestion();

$('save').onclick = async () => {
  const questions = await readQuestions();
  if (!validQuestions(questions)) return;

  const quizzes = getSaved();
  const title = $('title').value.trim() || 'Quiz sin título';
  const existing = quizzes.findIndex(q => q.title.toLowerCase() === title.toLowerCase());
  const quiz = { id: existing >= 0 ? quizzes[existing].id : Date.now(), title, questions };

  if (existing >= 0) quizzes[existing] = quiz;
  else quizzes.push(quiz);

  try {
    localStorage.setItem('saitecQuizzes', JSON.stringify(quizzes));
    $('error').textContent = 'Quiz guardado en este navegador.';
    renderSaved();
  } catch {
    $('error').textContent = 'No queda espacio para guardar tantas imágenes. Prueba con imágenes más pequeñas.';
  }
};

$('create').onclick = async () => {
  $('create').disabled = true;
  $('create').textContent = 'Preparando imágenes...';
  const questions = await readQuestions();
  $('create').disabled = false;
  $('create').textContent = 'Crear partida';
  createGame($('title').value, questions);
};

async function readQuestions() {
  const boxes = [...document.querySelectorAll('.question-box')];
  return Promise.all(boxes.map(async box => ({
    text: box.querySelector('.qtext').value.trim(),
    image: await resizeImage(box.querySelector('.qimage').files[0]) || box.dataset.savedImage || '',
    options: [...box.querySelectorAll('.option')].map(x => x.value.trim()),
    correct: Number(box.querySelector('input[type=radio]:checked')?.value || 0)
  })));
}

function normalizeQuestions(questions = []) {
  return questions.map(q => ({
    text: String(q.text || q.question || '').trim(),
    image: q.image || '',
    options: (q.options || q.answers || []).map(x => String(x || '').trim()).slice(0, 4),
    correct: Number(q.correct ?? q.correctIndex ?? 0)
  }));
}

function validQuestions(questions) {
  if (!questions.length || questions.length > 15) {
    $('error').textContent = 'Añade entre 1 y 15 preguntas.';
    return false;
  }
  if (questions.some(q => !q.text || q.options.length !== 4 || q.options.some(x => !x))) {
    $('error').textContent = 'Completa todas las preguntas y respuestas.';
    return false;
  }
  return true;
}

function createGame(title, questions) {
  questions = normalizeQuestions(questions);
  if (!validQuestions(questions)) return;

  $('error').textContent = 'Creando partida...';
  socket.timeout(20000).emit('host:create', { title, questions }, (err, res) => {
    if (err) {
      $('error').textContent = 'No se ha podido crear la partida. Si tiene imágenes, quizá pesaba demasiado o falta actualizar Render.';
      return;
    }
    if (res.error) {
      $('error').textContent = res.error;
      return;
    }
    $('error').textContent = '';
    pin = res.pin;
    $('pin').textContent = pin;
    show('lobby');
  });
}

function getSaved() {
  try {
    return JSON.parse(localStorage.getItem('saitecQuizzes')) || [];
  } catch {
    return [];
  }
}

function loadQuiz(id) {
  const quiz = getSaved().find(q => String(q.id) === String(id));
  if (!quiz) return;

  $('title').value = quiz.title;
  $('questions').innerHTML = '';
  questionCount = 0;
  normalizeQuestions(quiz.questions).forEach(q => addQuestion(q));
  $('error').textContent = 'Quiz cargado. Ya puedes modificarlo o crear la partida.';
  scrollTo({ top: 0, behavior: 'smooth' });
}

function createSavedQuiz(id) {
  const quiz = getSaved().find(q => String(q.id) === String(id));
  if (!quiz) return;
  createGame(quiz.title, quiz.questions);
}

function deleteQuiz(id) {
  if (!confirm('¿Eliminar este quiz guardado?')) return;
  localStorage.setItem('saitecQuizzes', JSON.stringify(getSaved().filter(q => String(q.id) !== String(id))));
  renderSaved();
}

function renderSaved() {
  const target = $('savedQuizzes');
  const quizzes = getSaved();
  target.innerHTML = '';

  if (!quizzes.length) {
    target.textContent = 'Todavía no hay quizzes guardados.';
    return;
  }

  quizzes.forEach(quiz => {
    const row = document.createElement('div');
    const name = document.createElement('strong');
    const actions = document.createElement('span');
    const start = document.createElement('button');
    const load = document.createElement('button');
    const del = document.createElement('button');

    name.textContent = quiz.title;
    start.textContent = 'Crear partida';
    load.textContent = 'Cargar';
    del.textContent = 'Eliminar';

    start.onclick = () => createSavedQuiz(quiz.id);
    load.onclick = () => loadQuiz(quiz.id);
    del.onclick = () => deleteQuiz(quiz.id);

    actions.append(start, ' ', load, ' ', del);
    row.append(name, actions);
    target.appendChild(row);
  });
}

renderSaved();

function resizeImage(file) {
  if (!file) return Promise.resolve('');
  return new Promise(resolve => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => img.src = e.target.result;
    reader.onerror = () => resolve('');
    img.onload = () => {
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function renderPlayers(players, target = 'players') {
  $(target).innerHTML = players.sort((a, b) => b.score - a.score).map((p, i) => `<div><span>${i + 1}. ${escapeHtml(p.name)}${p.answered ? ' ✓' : ''}</span><strong>${p.score}</strong></div>`).join('');
  $('count').textContent = players.length;
}

socket.on('host:players', p => renderPlayers(p, $('game').classList.contains('hidden') ? 'players' : 'scores'));
$('start').onclick = () => socket.emit('host:start', pin);
$('next').onclick = () => socket.emit('host:next', pin);

socket.on('game:question', q => {
  show('game');
  $('progress').textContent = `Pregunta ${q.number} de ${q.total}`;
  $('question').textContent = q.text;
  $('questionImage').src = q.image || '';
  $('questionImage').style.display = q.image ? 'block' : 'none';
  $('hostOptions').innerHTML = q.options.map((x, i) => `<div class="answer c${i}">${escapeHtml(x)}</div>`).join('');
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function finalRankingHtml(ranking) {
  const top = ranking.slice(0, 3);
  const podiumOrder = [top[1], top[0], top[2]].filter(Boolean);
  const podium = podiumOrder.map(p => {
    const originalIndex = ranking.indexOf(p);
    const place = originalIndex + 1;
    return `<article class="podium-card place-${place}"><div class="medal">${['🥇', '🥈', '🥉'][originalIndex]}</div><h2>${escapeHtml(p.name)}</h2><p>${p.score} puntos</p><strong>${place}º puesto</strong></article>`;
  }).join('');
  const places = ranking.map((p, i) => {
    const medals = ['🥇', '🥈', '🥉'];
    return `<div><b>${medals[i] || `${i + 1}.`} ${escapeHtml(p.name)}</b><span>${p.score} puntos</span></div>`;
  }).join('');
  return `<div class="podium">${podium}</div><h2>Clasificación completa</h2>${places}`;
}

socket.on('game:finished', ranking => {
  show('finish');
  $('ranking').innerHTML = finalRankingHtml(ranking);
});
