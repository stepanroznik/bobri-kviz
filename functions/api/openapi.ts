import { json } from '../_lib';

const quizSchema = {
  type: 'object',
  required: ['title', 'rounds'],
  properties: {
    title: { type: 'string', example: 'Bobří kvíz' },
    subtitle: { type: 'string' },
    rounds: { type: 'array', items: { $ref: '#/components/schemas/Round' } },
    settings: { type: 'object', properties: { countdownSeconds: { type: 'integer', example: 60 } } },
  },
};

const apiKeySecurity = [{ AdminKey: [] }];

export async function onRequestGet({ request }: { request: Request }): Promise<Response> {
  const origin = new URL(request.url).origin;
  return json({
    openapi: '3.1.0',
    info: { title: 'Bobří kvíz API', version: '1.0.0', description: 'API pro čtení a správu obsahu Bobřího kvízu.' },
    servers: [{ url: origin }],
    paths: {
      '/api/quiz': { get: { summary: 'Načíst veřejný kvíz', responses: { 200: { description: 'Obsah kvízu', content: { 'application/json': { schema: { $ref: '#/components/schemas/Quiz' } } } } } } },
      '/api/media/{id}': { get: { summary: 'Načíst uložené médium', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Binární obrázek nebo audio' }, 404: { description: 'Médium nenalezeno' } } } },
      '/api/admin/quiz': {
        get: { summary: 'Načíst kvíz pro administraci', security: apiKeySecurity, responses: { 200: { description: 'Obsah kvízu', content: { 'application/json': { schema: { $ref: '#/components/schemas/Quiz' } } } }, 401: { $ref: '#/components/responses/Unauthorized' } } },
        post: { summary: 'Uložit celý kvíz', security: apiKeySecurity, requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Quiz' } } } }, responses: { 200: { description: 'Uloženo' }, 400: { description: 'Neplatná struktura' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
      },
      '/api/admin/media': {
        post: { summary: 'Nahrát médium', security: apiKeySecurity, parameters: [{ name: 'id', in: 'query', required: true, schema: { type: 'string' } }, { name: 'name', in: 'query', required: false, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } }, responses: { 200: { description: 'Nahráno' }, 401: { $ref: '#/components/responses/Unauthorized' }, 413: { description: 'Soubor je příliš velký' } } },
        delete: { summary: 'Smazat uložené médium', security: apiKeySecurity, parameters: [{ name: 'id', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Smazáno' }, 401: { $ref: '#/components/responses/Unauthorized' } } },
      },
    },
    components: {
      securitySchemes: { AdminKey: { type: 'apiKey', in: 'header', name: 'X-Admin-Key', description: 'Stejná hodnota jako proměnná ADMIN_KEY v Cloudflare.' } },
      responses: { Unauthorized: { description: 'Chybí nebo neodpovídá X-Admin-Key.' } },
      schemas: {
        Quiz: quizSchema,
        Round: { type: 'object', required: ['title', 'topics'], properties: { title: { type: 'string' }, topics: { type: 'array', items: { $ref: '#/components/schemas/Topic' } } } },
        Topic: { type: 'object', required: ['title', 'questions'], properties: { title: { type: 'string' }, subtitle: { type: 'string' }, enabled: { type: 'boolean' }, questions: { type: 'array', items: { $ref: '#/components/schemas/Question' } } } },
        Question: { type: 'object', properties: { id: { type: 'string' }, enabled: { type: 'boolean' }, type: { type: 'string', enum: ['text', 'image', 'audio'] }, prompt: { type: 'string' }, answer: { type: 'string' }, notes: { type: 'string' }, mediaHint: { type: 'string' }, audioStart: { type: 'number', minimum: 0, description: 'Začátek audio ukázky v sekundách; výchozí 0.' }, audioEnd: { type: 'number', minimum: 0, description: 'Konec audio ukázky v sekundách; musí být později než začátek. Vynechání znamená konec nahrávky.' } } },
      },
    },
  });
}
