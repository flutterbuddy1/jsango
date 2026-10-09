import { createApp, validate, schema, string, email } from 'jsango';

const app = createApp();
app.get('/', () => ({ hello: 'world' }));
app.get('/users/:id', ({ params }) => ({ id: params.id, name: 'Ada' }));
app.post(
  '/users',
  validate({ body: schema({ name: string().min(2), email: email() }) }),
  ({ body }) => ({ id: 1, ...body })
);
await app.listen(Number(process.argv[2]), '127.0.0.1');
console.log('ready');
process.on('SIGTERM', () => process.exit(0)); // lets --cpu-prof write its profile
