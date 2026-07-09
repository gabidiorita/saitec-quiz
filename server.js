const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
// Permitimos quizzes con imágenes guardadas. Socket.IO por defecto corta mensajes grandes.
const io = new Server(server, { maxHttpBufferSize: 25 * 1024 * 1024 });
const games = new Map();

// Admite tanto la carpeta `public` como archivos subidos directamente a GitHub.
app.use(express.static('public'));
app.use(express.static('.', { index: 'index.html' }));

function code() {
  let value;
  do value = String(Math.floor(100000 + Math.random() * 900000));
  while (games.has(value));
  return value;
}

function publicPlayers(game) {
  return [...game.players.values()].map(({ name, score, answered }) => ({ name, score, answered }));
}

io.on('connection', socket => {
  socket.on('host:create', ({ title, questions }, reply) => {
    if (!Array.isArray(questions) || !questions.length || questions.length > 15) return reply({ error: 'Añade entre 1 y 15 preguntas.' });
    const pin = code();
    games.set(pin, { pin, title: title || 'Quiz Saitec', questions, host: socket.id, players: new Map(), index: -1, state: 'lobby' });
    socket.join(pin);
    reply({ pin });
  });

  socket.on('player:join', ({ pin, name }, reply) => {
    const game = games.get(String(pin));
    name = String(name || '').trim().slice(0, 20);
    if (!game) return reply({ error: 'No existe una partida con ese código.' });
    if (game.state !== 'lobby') return reply({ error: 'La partida ya ha empezado.' });
    if (game.players.size >= 10) return reply({ error: 'La partida ya tiene 10 jugadores.' });
    if (!name) return reply({ error: 'Escribe tu nombre.' });
    if ([...game.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase())) return reply({ error: 'Ese nombre ya está en uso.' });
    game.players.set(socket.id, { name, score: 0, answered: false });
    socket.join(game.pin);
    io.to(game.host).emit('host:players', publicPlayers(game));
    reply({ ok: true, title: game.title });
  });

  socket.on('host:start', pin => nextQuestion(String(pin), socket));
  socket.on('host:next', pin => nextQuestion(String(pin), socket));

  socket.on('player:answer', ({ pin, answer }, reply) => {
    const game = games.get(String(pin));
    const player = game?.players.get(socket.id);
    if (!game || !player || game.state !== 'question' || player.answered) return;
    player.answered = true;
    const correct = Number(answer) === Number(game.questions[game.index].correct);
    if (correct) player.score += 1000;
    reply?.({ correct });
    io.to(game.host).emit('host:players', publicPlayers(game));
  });

  socket.on('disconnect', () => {
    for (const [pin, game] of games) {
      if (game.host === socket.id) { io.to(pin).emit('game:closed'); games.delete(pin); break; }
      if (game.players.delete(socket.id)) io.to(game.host).emit('host:players', publicPlayers(game));
    }
  });
});

function nextQuestion(pin, socket) {
  const game = games.get(pin);
  if (!game || game.host !== socket.id) return;
  game.index++;
  if (game.index >= game.questions.length) {
    game.state = 'finished';
    const ranking = publicPlayers(game).sort((a, b) => b.score - a.score);
    io.to(pin).emit('game:finished', ranking);
    return;
  }
  game.state = 'question';
  for (const p of game.players.values()) p.answered = false;
  const q = game.questions[game.index];
  io.to(pin).emit('game:question', { number: game.index + 1, total: game.questions.length, text: q.text, image: q.image || '', options: q.options });
  io.to(game.host).emit('host:players', publicPlayers(game));
}

server.listen(process.env.PORT || 3000, () => console.log('Saitec Quiz listo en http://localhost:3000'));
