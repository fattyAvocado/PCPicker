const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true
  },
  link: String,
  title: String,
  order: {
    type: Number,
    default: 0
  }
});

const customSectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['products', 'categories', 'custom'],
    default: 'products'
  },
  items: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }], // For product type sections
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }], // For category type sections - store only category IDs
  displayOrder: {
    type: Number,
    default: 0
  }
});

const layoutSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    default: 'default'
  },
  banner: [bannerSchema],
  topItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }], // Store only product IDs
  customSections: [customSectionSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Layout', layoutSchema);