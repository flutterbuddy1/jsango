import { describe, it, expect } from 'vitest';
import {
  createApp,
  defineModel,
  fields,
  relations,
  DatabaseManager,
  setDatabaseManager,
  HttpRequest,
} from './index.js';
import { clearDatabaseManager } from '@jsango/orm';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('UUID primary keys', () => {
  it('are generated on create and work in the ORM, app.crud and the admin API', async () => {
    const db = new DatabaseManager({
      default: 'default',
      connections: { default: { driver: 'sqlite', filename: ':memory:' } },
    });
    setDatabaseManager(db);
    await db.query('CREATE TABLE uuid_teams (id VARCHAR(36) PRIMARY KEY, name TEXT)');
    await db.query(
      'CREATE TABLE uuid_members (id VARCHAR(36) PRIMARY KEY, name TEXT, teamId VARCHAR(36))'
    );
    const Team = defineModel(
      'UuidTeam',
      { id: fields.uuid({ primaryKey: true }), name: fields.string() },
      { table: 'uuid_teams' }
    );
    const Member = defineModel(
      'UuidMember',
      { id: fields.uuid({ primaryKey: true }), name: fields.string(), teamId: fields.uuid() },
      {
        table: 'uuid_members',
        relations: { team: relations.belongsTo('UuidTeam', { foreignKey: 'teamId' }) },
      }
    );

    try {
      const team = await Team.create({ name: 'A' });
      expect(team.get('id')).toMatch(UUID);
      expect((await Team.find(team.get('id')))?.get('name')).toBe('A');

      const app = createApp();
      app.crud('/teams', Team, { access: 'public' });
      app.admin({
        resources: [Team, Member],
        credentials: { email: 'admin@example.com', password: 'test-password-1' },
        media: {},
      });
      const call = async (method: string, url: string, body?: unknown, token?: string) => {
        const res = await app.handle(
          new HttpRequest({
            method: method as 'GET',
            url: `http://localhost${url}`,
            headers: {
              'content-type': 'application/json',
              ...(token ? { authorization: `Bearer ${token}` } : {}),
            },
            body: body === undefined ? null : JSON.stringify(body),
          })
        );
        return { status: res.status, json: JSON.parse(String(res.body)) };
      };

      const created = await call('POST', '/teams', { name: 'B' });
      expect(created.json.id).toMatch(UUID);
      const patched = await call('PATCH', `/teams/${created.json.id}`, { name: 'B2' });
      expect(patched.json.name).toBe('B2');

      const { json: login } = await call('POST', '/admin/api/v1/auth/login', {
        email: 'admin@example.com',
        password: 'test-password-1',
      });
      const token = login.data.token as string;
      const adminTeam = (
        await call('POST', '/admin/api/v1/resources/uuidteam', { name: 'C' }, token)
      ).json.data.item;
      expect(adminTeam.id).toMatch(UUID);
      const member = await call(
        'POST',
        '/admin/api/v1/resources/uuidmember',
        { name: 'm', teamId: adminTeam.id },
        token
      );
      expect(member.json.data.item.teamId).toBe(adminTeam.id);
      const listed = await call(
        'GET',
        `/admin/api/v1/resources/uuidmember?filter_teamId=${adminTeam.id}`,
        undefined,
        token
      );
      expect(listed.json.data.items).toHaveLength(1);
    } finally {
      clearDatabaseManager();
      await db.close();
    }
  });
});
