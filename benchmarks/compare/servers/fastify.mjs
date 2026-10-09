import Fastify from 'fastify';

const app = Fastify({ logger: false });
app.get('/', async () => ({ hello: 'world' }));
app.get('/users/:id', async (req) => ({ id: req.params.id, name: 'Ada' }));
app.post(
  '/users',
  {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string', minLength: 2 },
          email: { type: 'string', format: 'email' },
        },
      },
    },
  },
  async (req, reply) => reply.code(201).send({ id: 1, ...req.body })
);
await app.listen({ port: Number(process.argv[2]), host: '127.0.0.1' });
console.log('ready');
process.on('SIGTERM', () => process.exit(0)); // lets --cpu-prof write its profile
