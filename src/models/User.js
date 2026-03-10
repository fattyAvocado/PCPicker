const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['primary', 'secondary', 'Work', 'Home'],
    default: 'secondary'
  },
  name: {
    type: String
  },
  phone: {
    type: String
  },
  addressLine1: {
    type: String
  },
  addressLine2: String,
  city: {
    type: String
  },
  state: {
    type: String
  },
  pincode: {
    type: String
  },
  country: {
    type: String,
    default: 'India'
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Name is required']
  },
  surname: {
    type: String,
    required: [true, 'Surname is required']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    select: false
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  addresses: {
    type: [addressSchema],
    default: []
  },
  // Cart reference at user level (not inside address)
  cart: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cart'
  },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  passwordResetToken: String,
  passwordResetExpire: Date,
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date
}, {
  timestamps: true
});

// Generate userId before saving
userSchema.pre('save', async function(next) {
  try {
    if (this.isNew && !this.userId) {
      const prefix = this.role === 'admin' ? 'ADMIN' : 'USR';
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(1000 + Math.random() * 9000);
      
      let userId = `${prefix}${timestamp}${random}`;
      
      const User = this.constructor;
      let isUnique = false;
      let attempts = 0;
      
      while (!isUnique && attempts < 5) {
        const existingUser = await User.findOne({ userId });
        if (!existingUser) {
          isUnique = true;
        } else {
          const newRandom = Math.floor(1000 + Math.random() * 9000);
          userId = `${prefix}${timestamp}${newRandom}`;
          attempts++;
        }
      }
      
      this.userId = userId;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get primary address
userSchema.methods.getPrimaryAddress = function() {
  if (!this.addresses || this.addresses.length === 0) {
    return null;
  }
  const primary = this.addresses.find(addr => addr.type === 'primary' || addr.isDefault);
  return primary || this.addresses[0];
};

module.exports = mongoose.model('User', userSchema);