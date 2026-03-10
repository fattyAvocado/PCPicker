const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../validators');
const {
  // User order methods
  createOrder,
  verifyPayment,
  getOrder,
  cancelOrder,
  
  // Admin order methods
  getAllOrders,
  updateOrderStatus,
  getOrdersByUserId,
  getOrdersByUserEmail,
  getOrdersByUserPhone,
  getUserOrderStats
} = require('../controllers/order.controller');

// ============= USER ROUTES (All authenticated) =============
router.use(protect);

// User order routes
router.post('/', validate('createOrder'), createOrder);
router.post('/:orderId/verify-payment', validate('verifyPayment'), verifyPayment);
router.get('/:orderId', getOrder);
router.post('/:orderId/cancel', cancelOrder);

// ============= ADMIN ROUTES for Order Management =============
// All routes below require admin role

// @route   GET /api/orders/admin/all
// @desc    Get all orders (Admin only)
router.get('/admin/all', authorize('admin'), getAllOrders);

// @route   GET /api/orders/admin/user/:userId
// @desc    Get orders by user ID (Admin only)
router.get('/admin/user/:userId', authorize('admin'), getOrdersByUserId);

// @route   GET /api/orders/admin/user/:userId/stats
// @desc    Get order statistics for a user (Admin only)
router.get('/admin/user/:userId/stats', authorize('admin'), getUserOrderStats);

// @route   GET /api/orders/admin/search/by-email
// @desc    Search orders by user email (Admin only)
router.get('/admin/search/by-email', authorize('admin'), getOrdersByUserEmail);

// @route   GET /api/orders/admin/search/by-phone
// @desc    Search orders by user phone (Admin only)
router.get('/admin/search/by-phone', authorize('admin'), getOrdersByUserPhone);

// @route   PUT /api/orders/:orderId/status
// @desc    Update order status (Admin only)
router.put('/:orderId/status', authorize('admin'), validate('updateOrderStatus'), updateOrderStatus);

module.exports = router;