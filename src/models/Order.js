const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productId: String,
  name: String,
  price: Number,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  total: Number
});

const paymentSchema = new mongoose.Schema({
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  method: {
    type: String,
    enum: ['razorpay', 'cod'],
    default: 'razorpay'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  amount: Number,
  transactionId: String,
  refundId: String,
  refundedAt: Date
});

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userId: String,
  userName: String,
  items: [orderItemSchema],
  shippingAddress: {
    name: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    country: String
  },
  billingAddress: {
    name: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    country: String
  },
  subtotal: {
    type: Number,
    required: true
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
    required: true
  },
  status: {
    type: String,
    enum: [
      'pending',
      'accepted',
      'ready_to_ship',
      'picked_up',
      'in_transit',
      'delivered',
      'cancelled',
      'refunded'
    ],
    default: 'pending'
  },
  payment: paymentSchema,
  statusHistory: [{
    status: String,
    date: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  notes: String,
  trackingNumber: String,
  estimatedDelivery: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  cancellationReason: String
}, {
  timestamps: true
});

// Generate orderId before saving
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    this.orderId = 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
  }
  next();
});

// Update status history
orderSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      date: new Date(),
      note: `Status changed to ${this.status}`
    });
    
    if (this.status === 'delivered') {
      this.deliveredAt = new Date();
    }
    
    if (this.status === 'cancelled') {
      this.cancelledAt = new Date();
    }
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);