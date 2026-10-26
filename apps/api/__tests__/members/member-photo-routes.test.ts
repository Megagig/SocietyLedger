/**
 * Who may change a member's photo is decided by how the routes are declared, so this reads them:
 * officers' routes need the member-edit permission, a member's own routes act only on their own linked profile,
 * and the keys that locate a file in storage never appear in any response a member list sends out.
 */
import fs from 'fs';
import path from 'path';

const routes = fs.readFileSync(path.resolve(__dirname, '../../src/modules/members/members.routes.ts'), 'utf8').replace(/\r\n/g, '\n');
const controller = fs.readFileSync(path.resolve(__dirname, '../../src/modules/members/member-photo.controller.ts'), 'utf8').replace(/\r\n/g, '\n');
const membersController = fs.readFileSync(path.resolve(__dirname, '../../src/modules/members/members.controller.ts'), 'utf8').replace(/\r\n/g, '\n');

function block(method: 'put' | 'delete', url: string): string {
  const start = routes.indexOf(`router.${method}('${url}'`);
  expect(start).toBeGreaterThan(-1);
  return routes.slice(start, routes.indexOf(');', start));
}

describe('member photo routes', () => {
  it('an officer needs the member-edit permission to set or remove someone else\'s photo', () => {
    expect(block('put', '/:id/photo')).toContain('requirePermission(PERMISSIONS.MEMBER_EDIT)');
    expect(block('delete', '/:id/photo')).toContain('requirePermission(PERMISSIONS.MEMBER_EDIT)');
  });

  it('a member\'s own routes take no id, so they can only ever act on the signed-in member', () => {
    expect(block('put', '/me/photo')).not.toContain('requirePermission');
    expect(block('put', '/me/photo')).toContain('memberPhotoController.setMine');
    expect(block('delete', '/me/photo')).toContain('memberPhotoController.removeMine');
    expect(controller).toContain('where: { associationId, userId }');
  });

  it('declares the upload middleware before the handler, so a bad or huge file is answered first', () => {
    const put = block('put', '/:id/photo');
    expect(put.indexOf('photoUpload')).toBeGreaterThan(-1);
    expect(put.indexOf('photoUpload')).toBeLessThan(put.indexOf('memberPhotoController.setFor'));
  });

  it('every route runs behind sign-in and the tenant check', () => {
    const firstPhotoRoute = routes.indexOf("router.put('/me/photo'");
    expect(routes.indexOf('router.use(authMiddleware)')).toBeLessThan(firstPhotoRoute);
    expect(routes.indexOf('router.use(tenantMiddleware)')).toBeLessThan(firstPhotoRoute);
  });

  it('only ever works inside the signed-in association', () => {
    expect(controller).toMatch(/setFor[\s\S]*associationId = req\.user\?\.associationId/);
    expect(controller).toContain('setMemberPhoto(associationId, memberId');
  });
});

describe('what the member endpoints send out', () => {
  it('turns storage keys into links on the list, the detail and the profile', () => {
    expect(membersController).toContain('presentMemberPhotos(members, req.hostname)');
    expect(membersController).toContain('presentMemberPhoto(member, req.hostname)');
  });
});
