import fs from 'fs';
import path from 'path';

// The support controller derives staff-vs-member scoping from `req.permissions`, which only the
// `attachPermissions()` middleware sets. Without it every admin was treated as a plain member and saw an
// empty ticket list, so the router must always install it.
describe('support routes', () => {
  it('installs attachPermissions() for every route', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../src/modules/support/support.routes.ts'), 'utf8');
    expect(source).toMatch(/router\.use\(attachPermissions\(\)\)/);
  });
});
