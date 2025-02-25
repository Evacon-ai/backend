const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyAuth, requireAdmin } = require('../middleware/auth');

// Protected routes - require authentication
router.use(verifyAuth);

// Routes that any authenticated user can access
router.get('/me', userController.getCurrentUser);

// Admin-only routes
router.get('/', requireAdmin, userController.getAllUsers);
router.get('/:id', requireAdmin, userController.getUserById);
router.post('/', requireAdmin, userController.createUser);
router.put('/:id', requireAdmin, userController.updateUser);
router.delete('/:id', requireAdmin, userController.deleteUser);

module.exports = router;