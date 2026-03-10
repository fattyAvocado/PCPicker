const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../validators');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart
} = require('../controllers/cart.controller');

// All routes require authentication
router.use(protect);

router.get('/', getCart);
router.post('/items', validate('addToCart'), addToCart);
router.put('/items/:itemId', validate('updateCartItem'), updateCartItem);
router.delete('/items/:itemId', removeCartItem);
router.delete('/', clearCart);

module.exports = router;