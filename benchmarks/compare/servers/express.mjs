import express from 'express';

const app = express();
app.use(express.json());
app.get('/', (_req, res) => res.json({ hello: 'world' }));
app.get('/users/:id', (req, res) => res.json({ id: req.params.id, name: 'Ada' }));
// Express has no built-in validation: the usual hand-written check.
app.post('/users', (req, res) => {
  const { name, email } = req.body ?? {};
  if (typeof name !== 'string' || name.length < 2 || !String(email).includes('@'))
    return res.status(400).json({ error: 'invalid' });
  res.status(201).json({ id: 1, name, email });
});
app.listen(Number(process.argv[2]), '127.0.0.1', () => console.log('ready'));
process.on('SIGTERM', () => process.exit(0)); // lets --cpu-prof write its profile
