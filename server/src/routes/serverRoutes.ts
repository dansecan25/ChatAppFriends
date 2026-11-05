import { Router } from 'express';
import * as channelController from '../controllers/channelController.js';
import * as serverController from '../controllers/serverController.js';
import { requireAuth } from '../middlewares/auth.js';

export const serverRoutes = Router();

serverRoutes.use(requireAuth);
serverRoutes.get('/', serverController.list);
serverRoutes.patch('/:serverId', serverController.rename);
serverRoutes.get('/:serverId/members', serverController.members);
serverRoutes.delete('/:serverId/members/:userId', serverController.removeMember);
serverRoutes.put('/:serverId/members/:userId/roles', serverController.setMemberRoles);
serverRoutes.get('/:serverId/roles', serverController.roles);
serverRoutes.post('/:serverId/roles', serverController.createRole);
serverRoutes.delete('/:serverId/roles/:roleId', serverController.deleteRole);
serverRoutes.get('/:serverId/channels', channelController.list);
serverRoutes.post('/:serverId/channels', channelController.create);
serverRoutes.get('/:serverId/key-work', channelController.keyWork);
