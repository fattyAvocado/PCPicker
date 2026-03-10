const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    index: true
  },
  heading: {
    type: String,
    required: [true, 'Heading is required']
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true,
    index: true
  },
  model: {
    type: String,
    trim: true,
    index: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required']
  },
  cost: {
    type: Number,
    required: [true, 'Cost is required']
  },
  warranty: {
    type: String,
    required: [true, 'Warranty is required']
  },
  units: {
    type: Number,
    required: [true, 'Units are required'],
    min: 0
  },
  shippingTime: {
    type: String,
    required: [true, 'Shipping time is required']
  },
  shippingCost: {
    type: Number,
    required: [true, 'Shipping cost is required'],
    default: 0
  },
  images: [{
    url: String,
    thumb: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  specifications: {
    type: Map,
    of: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  inStock: {
    type: Boolean,
    default: true
  },
  soldCount: {
    type: Number,
    default: 0
  },
  ratings: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Generate productId before saving
productSchema.pre('save', async function(next) {
  try {
    // Only generate if this is a new document and productId is not already set
    if (this.isNew && !this.productId) {
      const prefix = 'PRD';
      const timestamp = Date.now().toString().slice(-8); // Last 8 digits
      const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random
      
      let productId = `${prefix}${timestamp}${random}`;
      
      // Ensure uniqueness
      const Product = this.constructor;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (!isUnique && attempts < maxAttempts) {
        const existingProduct = await Product.findOne({ productId });
        if (!existingProduct) {
          isUnique = true;
        } else {
          const newRandom = Math.floor(1000 + Math.random() * 9000);
          productId = `${prefix}${timestamp}${newRandom}`;
          attempts++;
        }
      }
      
      this.productId = productId;
      console.log(`✅ Auto-generated productId: ${this.productId}`);
    }
    next();
  } catch (error) {
    console.error('Error generating productId:', error);
    next(error);
  }
});

// Update inStock status based on units
productSchema.pre('save', function(next) {
  this.inStock = this.units > 0;
  next();
});

// Text search index
productSchema.index({ 
  name: 'text', 
  description: 'text', 
  heading: 'text',
  brand: 'text',
  model: 'text'
});

// Compound index for brand + model searches
productSchema.index({ brand: 1, model: 1 });

module.exports = mongoose.model('Product', productSchema);