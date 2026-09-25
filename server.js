const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'state.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function defaultState() {
  return {
    profile: { weightKg: 80, heightCm: 168, goal: 'Build consistency and complete an easy 5K' },
    week: 1,
    sessions: [
      { id: 1, day: 'Session 1', plan: '5 min walk + 8 x (1 min easy run / 2 min walk) + 5 min walk', done: false, rpe: null },
      { id: 2, day: 'Session 2', plan: '5 min walk + 8 x (1 min easy run / 2 min walk) + 5 min walk', done: false, rpe: null },
      { id: 3, day: 'Session 3', plan: '5 min walk + 10 x (1 min easy run / 2 min walk) + 5 min walk', done: false, rpe: null }
    ],
    weightHistory: []
  };
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { const s = defaultState(); saveState(s); return s; }
}
function saveState(s) { fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 2)); }

app.get('/api/state', (req, res) => res.json(loadState()));
app.post('/api/session/:id', (req, res) => {
  const s = loadState();
  const item = s.sessions.find(x => x.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Session not found' });
  if (typeof req.body.done === 'boolean') item.done = req.body.done;
  if (req.body.rpe === null || (Number(req.body.rpe) >= 1 && Number(req.body.rpe) <= 10)) item.rpe = req.body.rpe === null ? null : Number(req.body.rpe);
  saveState(s); res.json(s);
});
app.post('/api/weight', (req, res) => {
  const kg = Number(req.body.kg);
  if (!Number.isFinite(kg) || kg < 30 || kg > 300) return res.status(400).json({ error: 'Invalid weight' });
  const s = loadState();
  s.profile.weightKg = kg;
  s.weightHistory.unshift({ date: new Date().toISOString(), kg });
  s.weightHistory = s.weightHistory.slice(0, 30);
  saveState(s); res.json(s);
});

app.get('/{*splat}', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => {
  console.log(`RunStart Coach running on http://localhost:${PORT}`);
});
