const Cart = require('../models/Cart');

/**
 * Create a cart for a user if it doesn't exist
 * @param {string} userId - User ID
 * @param {Object} user - User object (optional, for updating reference)
 * @returns {Promise<Object>} - Cart object
 */
exports.getOrCreateCart = async (userId, user = null) => {
  try {
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      console.log(`Creating new cart for user: ${userId}`);
      
      cart = await Cart.create({
        user: userId,
        items: [],
        subtotal: 0,
        shippingCost: 0,
        tax: 0,
        total: 0,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });

      // Update user with cart reference if user object is provided
      if (user) {
        user.cart = cart._id;
        await user.save();
      }

      console.log(`✅ Cart created: ${cart.cartId} for user: ${userId}`);
    }

    return cart;
  } catch (error) {
    console.error('❌ Error in getOrCreateCart:', error);
    throw error;
  }
};

/**
 * Delete expired carts (can be run as a cron job)
 */
exports.deleteExpiredCarts = async () => {
  try {
    const result = await Cart.deleteMany({
      expiresAt: { $lt: new Date() },
      items: { $size: 0 } // Only delete empty carts
    });
    
    console.log(`🧹 Cleaned up ${result.deletedCount} expired empty carts`);
    return result;
  } catch (error) {
    console.error('❌ Error deleting expired carts:', error);
    throw error;
  }
};