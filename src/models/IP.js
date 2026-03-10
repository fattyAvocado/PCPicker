const mongoose = require('mongoose');

const ipSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['whitelist', 'blacklist'],
    required: true
  },
  reason: String,
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  expiresAt: Date,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster lookups
ipSchema.index({ address: 1, type: 1 });
ipSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('IP', ipSchema);