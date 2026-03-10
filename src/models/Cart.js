const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: Number,
  total: Number
});

const cartSchema = new mongoose.Schema({
  cartId: {
    type: String,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  subtotal: {
    type: Number,
    default: 0
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  },
  coupon: {
    code: String,
    discount: {
      type: Number,
      default: 0
    }
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 7*24*60*60*1000) // 7 days
  }
}, {
  timestamps: true
});

// Generate cartId before saving
cartSchema.pre('save', async function(next) {
  try {
    // Only generate if this is a new document and cartId is not already set
    if (this.isNew && !this.cartId) {
      const prefix = 'CART';
      const timestamp = Date.now().toString().slice(-8); // Last 8 digits
      const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random
      
      let cartId = `${prefix}${timestamp}${random}`;
      
      // Ensure uniqueness
      const Cart = this.constructor;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (!isUnique && attempts < maxAttempts) {
        const existingCart = await Cart.findOne({ cartId });
        if (!existingCart) {
          isUnique = true;
        } else {
          // Generate new random part
          const newRandom = Math.floor(1000 + Math.random() * 9000);
          cartId = `${prefix}${timestamp}${newRandom}`;
          attempts++;
        }
      }
      
      this.cartId = cartId;
      console.log(`✅ Auto-generated cartId: ${this.cartId}`);
    }
    next();
  } catch (error) {
    console.error('Error generating cartId:', error);
    next(error);
  }
});

// Calculate totals before saving
cartSchema.pre('save', function(next) {
  // Recalculate subtotal and total
  this.subtotal = this.items.reduce((sum, item) => sum + (item.total || 0), 0);
  this.total = this.subtotal + this.shippingCost + this.tax - (this.coupon?.discount || 0);
  next();
});

// Method to calculate totals
cartSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + (item.total || 0), 0);
  this.total = this.subtotal + this.shippingCost + this.tax - (this.coupon?.discount || 0);
};

module.exports = mongoose.model('Cart', cartSchema);