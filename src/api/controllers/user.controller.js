const User = require('../../models/User');
const Cart = require('../../models/Cart');
const Order = require('../../models/Order');
const mongoose = require('mongoose');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res, next) => {
  try {
    // Find user
    const user = await User.findById(req.user.id).select('-password');
    
    // Find cart separately
    const cart = await Cart.findOne({ user: req.user.id });

    res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        cart: cart || null
      }
    });
  } catch (error) {
    console.error('Error in getProfile:', error);
    next(error);
  }
};

// @desc    Get user profile with cart (creates cart if not exists)
// @route   GET /api/users/profile-with-cart
// @access  Private
exports.getProfileWithCart = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    // Find or create cart
    let cart = await Cart.findOne({ user: user._id });
    
    if (!cart) {
      cart = await Cart.create({
        user: user._id,
        items: [],
        subtotal: 0,
        shippingCost: 0,
        tax: 0,
        total: 0
      });
      
      // Update user with cart reference
      user.cart = cart._id;
      await user.save();
    }

    res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        cart
      }
    });
  } catch (error) {
    console.error('Error in getProfileWithCart:', error);
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, surname, phone } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, surname, phone },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error in updateProfile:', error);
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error in changePassword:', error);
    next(error);
  }
};

// @desc    Get user addresses
// @route   GET /api/users/addresses
// @access  Private
exports.getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      data: user.addresses
    });
  } catch (error) {
    console.error('Error in getAddresses:', error);
    next(error);
  }
};

// @desc    Add new address
// @route   POST /api/users/addresses
// @access  Private
exports.addAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Prepare new address
    const newAddress = {
      type: req.body.type || (user.addresses.length === 0 ? 'primary' : 'secondary'),
      name: req.body.name || `${user.name} ${user.surname}`,
      phone: req.body.phone || user.phone,
      addressLine1: req.body.addressLine1,
      addressLine2: req.body.addressLine2 || '',
      city: req.body.city,
      state: req.body.state,
      pincode: req.body.pincode,
      country: req.body.country || 'India',
      isDefault: req.body.isDefault || user.addresses.length === 0
    };

    // Validate required fields
    if (!newAddress.addressLine1 || !newAddress.city || !newAddress.state || !newAddress.pincode) {
      return res.status(400).json({
        success: false,
        message: 'Address line 1, city, state, and pincode are required'
      });
    }

    // If this address is set as default, update other addresses
    if (newAddress.isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json({
      success: true,
      data: user.addresses
    });
  } catch (error) {
    console.error('Error in addAddress:', error);
    next(error);
  }
};

// @desc    Update address
// @route   PUT /api/users/addresses/:addressId
// @access  Private
exports.updateAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.id);
    
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // If setting as default, update other addresses
    if (req.body.isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        address[key] = req.body[key];
      }
    });

    await user.save();

    res.status(200).json({
      success: true,
      data: user.addresses
    });
  } catch (error) {
    console.error('Error in updateAddress:', error);
    next(error);
  }
};

// @desc    Delete address
// @route   DELETE /api/users/addresses/:addressId
// @access  Private
exports.deleteAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.id);
    
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Check if this was the default address
    const wasDefault = address.isDefault;

    user.addresses.pull(addressId);

    // If we deleted the default address and there are other addresses, set a new default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: user.addresses
    });
  } catch (error) {
    console.error('Error in deleteAddress:', error);
    next(error);
  }
};

// @desc    Set default address
// @route   PUT /api/users/addresses/:addressId/default
// @access  Private
exports.setDefaultAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.id);
    
    // First, set all addresses to non-default
    user.addresses.forEach(addr => {
      addr.isDefault = false;
    });

    // Then set the selected address as default
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    address.isDefault = true;
    await user.save();

    res.status(200).json({
      success: true,
      data: user.addresses
    });
  } catch (error) {
    console.error('Error in setDefaultAddress:', error);
    next(error);
  }
};

// @desc    Get user orders
// @route   GET /api/users/orders
// @access  Private
exports.getUserOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate({
        path: 'items.product',
        populate: {
          path: 'category',
          select: 'categoryId name slug'
        }
      })
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error in getUserOrders:', error);
    next(error);
  }
};

// @desc    Get user order by ID
// @route   GET /api/users/orders/:orderId
// @access  Private
exports.getUserOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      orderId: req.params.orderId,
      user: req.user.id
    }).populate({
      path: 'items.product',
      populate: {
        path: 'category',
        select: 'categoryId name slug'
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error in getUserOrder:', error);
    next(error);
  }
};

// ============= ADMIN METHODS (keep as is) =============

// @desc    Get all users (Admin only)
// @route   GET /api/users/admin/all
// @access  Private/Admin
exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, isActive, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = {};
    
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { surname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(query)
      .select('-password')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const orderStats = await Order.aggregate([
          { $match: { user: user._id } },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalSpent: { $sum: '$total' },
              avgOrderValue: { $avg: '$total' },
              pendingOrders: {
                $sum: {
                  $cond: [
                    { $in: ['$status', ['pending', 'accepted', 'ready_to_ship', 'picked_up', 'in_transit']] },
                    1,
                    0
                  ]
                }
              },
              deliveredOrders: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
                }
              },
              cancelledOrders: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
                }
              }
            }
          }
        ]);

        const recentOrders = await Order.find({ user: user._id })
          .sort('-createdAt')
          .limit(5)
          .select('orderId total status createdAt');

        return {
          ...user.toObject(),
          stats: orderStats[0] || { 
            totalOrders: 0, 
            totalSpent: 0, 
            avgOrderValue: 0,
            pendingOrders: 0,
            deliveredOrders: 0,
            cancelledOrders: 0
          },
          recentOrders
        };
      })
    );

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: usersWithStats
    });
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    next(error);
  }
};

// @desc    Get user by ID (Admin only)
// @route   GET /api/users/admin/:userId
// @access  Private/Admin
exports.getUserById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findOne({ 
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : null },
        { userId: userId }
      ].filter(Boolean)
    }).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error in getUserById:', error);
    next(error);
  }
};

// @desc    Update user by ID (Admin only)
// @route   PUT /api/users/admin/:userId
// @access  Private/Admin
exports.updateUserById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { name, surname, phone, role, isActive, addresses } = req.body;
    
    const user = await User.findOneAndUpdate(
      { 
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : null },
          { userId: userId }
        ].filter(Boolean)
      },
      { name, surname, phone, role, isActive, addresses },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error in updateUserById:', error);
    next(error);
  }
};

// @desc    Delete user by ID (Admin only)
// @route   DELETE /api/users/admin/:userId
// @access  Private/Admin
exports.deleteUserById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findOne({ 
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : null },
        { userId: userId }
      ].filter(Boolean)
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const ordersCount = await Order.countDocuments({ user: user._id });
    if (ordersCount > 0) {
      user.isActive = false;
      await user.save();
      
      return res.status(200).json({
        success: true,
        message: 'User deactivated successfully (has existing orders)'
      });
    }

    await user.remove();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteUserById:', error);
    next(error);
  }
};

// @desc    Reset user password (Admin only)
// @route   POST /api/users/admin/:userId/reset-password
// @access  Private/Admin
exports.resetUserPassword = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    
    const user = await User.findOne({ 
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : null },
        { userId: userId }
      ].filter(Boolean)
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Error in resetUserPassword:', error);
    next(error);
  }
};