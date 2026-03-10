const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../validators');
const {
  // User methods
  getProfile,
  updateProfile,
  changePassword,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getUserOrders,
  getUserOrder,
  
  // Admin methods for user management
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  resetUserPassword
} = require('../controllers/user.controller');

// ============= USER ROUTES (All authenticated) =============
router.use(protect);

// Profile routes
router.get('/profile', getProfile);
router.put('/profile', validate('updateProfile'), updateProfile);
router.put('/change-password', validate('changePassword'), changePassword);

// Address routes
router.get('/addresses', getAddresses);
router.post('/addresses', validate('address'), addAddress);
router.put('/addresses/:addressId', validate('address'), updateAddress);
router.delete('/addresses/:addressId', deleteAddress);
router.put('/addresses/:addressId/default', setDefaultAddress);

// Order routes
router.get('/orders', getUserOrders);
router.get('/orders/:orderId', getUserOrder);

// ============= ADMIN ROUTES for User Management =============
// All routes below require admin role

// @route   GET /api/users/admin/all
// @desc    Get all users with filters (Admin only)
router.get('/admin/all', authorize('admin'), getAllUsers);

// @route   GET /api/users/admin/:userId
// @desc    Get user by ID (Admin only)
router.get('/admin/:userId', authorize('admin'), getUserById);

// @route   PUT /api/users/admin/:userId
// @desc    Update user by ID (Admin only)
router.put('/admin/:userId', authorize('admin'), validate('updateProfile'), updateUserById);

// @route   DELETE /api/users/admin/:userId
// @desc    Delete user by ID (Admin only)
router.delete('/admin/:userId', authorize('admin'), deleteUserById);

// @route   POST /api/users/admin/:userId/reset-password
// @desc    Reset user password (Admin only)
router.post('/admin/:userId/reset-password', authorize('admin'), validate('resetPassword'), resetUserPassword);

module.exports = router;