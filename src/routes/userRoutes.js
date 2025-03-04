const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyAuth, requireAdmin } = require('../middleware/auth');


// auth is temporarily disabled

// Protected routes - require authentication
// router.use(verifyAuth);

// Routes that any authenticated user can access
router.get('/me', userController.getCurrentUser);

// Admin-only routes
// router.get('/', requireAdmin, userController.getAllUsers);
// router.get('/:id', requireAdmin, userController.getUserById);
// router.post('/', requireAdmin, userController.createUser);
// router.put('/:id', requireAdmin, userController.updateUser);
// router.delete('/:id', requireAdmin, userController.deleteUser);

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;