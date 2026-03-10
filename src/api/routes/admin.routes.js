const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../validators');
const User = require('../../models/User');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const PaymentService = require('../../services/paymentService');
const EmailService = require('../../services/emailService');

// All admin routes require authentication and admin role
router.use(protect, authorize('admin'));

// ============= User Management =============

// @desc    Get all users
// @route   GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, isActive, search } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { surname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    // Get order stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const orderStats = await Order.aggregate([
          { $match: { user: user._id } },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalSpent: { $sum: '$total' },
              avgOrderValue: { $avg: '$total' }
            }
          }
        ]);

        return {
          ...user.toObject(),
          stats: orderStats[0] || { totalOrders: 0, totalSpent: 0, avgOrderValue: 0 }
        };
      })
    );

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: usersWithStats
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get single user details
// @route   GET /api/admin/users/:userId
router.get('/users/:userId', async (req, res, next) => {
  try {
    const user = await User.findOne({ 
      $or: [
        { _id: req.params.userId },
        { userId: req.params.userId }
      ]
    }).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user orders
    const orders = await Order.find({ user: user._id })
      .populate('items.product')
      .sort('-createdAt');

    // Calculate statistics
    const stats = {
      totalOrders: orders.length,
      totalSpent: orders.reduce((sum, order) => sum + order.total, 0),
      pendingOrders: orders.filter(o => ['pending', 'accepted', 'ready_to_ship', 'picked_up', 'in_transit'].includes(o.status)).length,
      deliveredOrders: orders.filter(o => o.status === 'delivered').length,
      cancelledOrders: orders.filter(o => o.status === 'cancelled').length
    };

    res.status(200).json({
      success: true,
      data: {
        user,
        stats,
        orders
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update user (admin)
// @route   PUT /api/admin/users/:userId
router.put('/users/:userId', async (req, res, next) => {
  try {
    const { name, surname, phone, role, isActive, addresses } = req.body;
    
    const user = await User.findOneAndUpdate(
      { $or: [{ _id: req.params.userId }, { userId: req.params.userId }] },
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
    next(error);
  }
});

// @desc    Delete user (admin)
// @route   DELETE /api/admin/users/:userId
router.delete('/users/:userId', async (req, res, next) => {
  try {
    const user = await User.findOne({ 
      $or: [
        { _id: req.params.userId },
        { userId: req.params.userId }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has orders
    const ordersCount = await Order.countDocuments({ user: user._id });
    if (ordersCount > 0) {
      // Soft delete - just deactivate instead of removing
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
    next(error);
  }
});

// @desc    Reset user password (admin)
// @route   POST /api/admin/users/:userId/reset-password
router.post('/users/:userId/reset-password', async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    
    const user = await User.findOne({ 
      $or: [
        { _id: req.params.userId },
        { userId: req.params.userId }
      ]
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
    next(error);
  }
});

// ============= Order Management =============

// @desc    Get all orders with filters
// @route   GET /api/admin/orders
router.get('/orders', async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      fromDate, 
      toDate, 
      minAmount, 
      maxAmount,
      search 
    } = req.query;
    
    const query = {};

    if (status) query.status = status;
    
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    if (minAmount || maxAmount) {
      query.total = {};
      if (minAmount) query.total.$gte = Number(minAmount);
      if (maxAmount) query.total.$lte = Number(maxAmount);
    }

    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { 'payment.razorpayPaymentId': { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    // Calculate summary statistics
    const summary = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          avgOrderValue: { $avg: '$total' },
          totalItems: { $sum: { $size: '$items' } }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      summary: summary[0] || { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, totalItems: 0 },
      data: orders
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get order details
// @route   GET /api/admin/orders/:orderId
router.get('/orders/:orderId', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate('user', 'name email phone addresses')
      .populate('items.product');

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
    next(error);
  }
});

// @desc    Update order status
// @route   PUT /api/admin/orders/:orderId/status
router.put('/orders/:orderId/status', async (req, res, next) => {
  try {
    const { status, note } = req.body;
    
    const order = await Order.findOne({ orderId: req.params.orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const oldStatus = order.status;
    order.status = status;
    order.statusHistory.push({
      status,
      note: note || `Status changed from ${oldStatus} to ${status}`,
      updatedBy: req.user.id
    });

    if (status === 'delivered') {
      order.deliveredAt = new Date();
    }

    if (status === 'cancelled') {
      order.cancelledAt = new Date();
      order.cancellationReason = note || 'Cancelled by admin';
    }

    await order.save();

    // Send email notification to user about status change
    try {
      const user = await User.findById(order.user);
      if (user) {
        // You can implement email notification here
        // await EmailService.sendOrderStatusUpdate(user, order);
      }
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Process refund for order
// @route   POST /api/admin/orders/:orderId/refund
router.post('/orders/:orderId/refund', async (req, res, next) => {
  try {
    const { reason, amount } = req.body;
    
    const order = await Order.findOne({ orderId: req.params.orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order can be refunded
    if (order.payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Order payment is not completed'
      });
    }

    if (order.payment.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Order already refunded'
      });
    }

    // Process refund through Razorpay
    const refundAmount = amount || order.total;
    const refund = await PaymentService.refundPayment(
      order.payment.razorpayPaymentId,
      refundAmount
    );

    // Update order
    order.payment.status = 'refunded';
    order.payment.refundId = refund.id;
    order.payment.refundedAt = new Date();
    order.status = 'refunded';
    order.statusHistory.push({
      status: 'refunded',
      note: `Refund processed: ₹${refundAmount}. Reason: ${reason || 'No reason provided'}`,
      updatedBy: req.user.id
    });

    await order.save();

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { units: item.quantity }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        refundId: refund.id,
        amount: refundAmount,
        order
      }
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: error.message
    });
  }
});

// ============= Dashboard & Analytics =============

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Get order statistics
    const [
      totalOrders,
      todayOrders,
      weekOrders,
      monthOrders,
      yearOrders,
      revenueStats,
      topProducts,
      categoryStats,
      userStats
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: startOfDay } }),
      Order.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Order.countDocuments({ createdAt: { $gte: startOfYear } }),
      
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            avgOrderValue: { $avg: '$total' },
            todayRevenue: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', startOfDay] },
                  '$total',
                  0
                ]
              }
            },
            monthRevenue: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', startOfMonth] },
                  '$total',
                  0
                ]
              }
            }
          }
        }
      ]),

      Order.aggregate([
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            name: { $first: '$items.name' },
            totalSold: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.total' }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]).lookup({
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'productDetails'
      }),

      Order.aggregate([
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $group: {
            _id: '$product.category',
            totalSold: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.total' }
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category'
          }
        }
      ]),

      User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: {
              $sum: { $cond: ['$isActive', 1, 0] }
            },
            newToday: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', startOfDay] },
                  1,
                  0
                ]
              }
            },
            newThisMonth: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', startOfMonth] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    // Get order status distribution
    const orderStatusCounts = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent orders
    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .sort('-createdAt')
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        orders: {
          total: totalOrders,
          today: todayOrders,
          thisWeek: weekOrders,
          thisMonth: monthOrders,
          thisYear: yearOrders,
          byStatus: orderStatusCounts
        },
        revenue: revenueStats[0] || {
          totalRevenue: 0,
          avgOrderValue: 0,
          todayRevenue: 0,
          monthRevenue: 0
        },
        topProducts: topProducts,
        categoryPerformance: categoryStats,
        users: userStats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          newToday: 0,
          newThisMonth: 0
        },
        recentOrders
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============= Product Management =============

// @desc    Bulk update products
// @route   POST /api/admin/products/bulk-update
router.post('/products/bulk-update', async (req, res, next) => {
  try {
    const { products } = req.body;

    const operations = products.map(product => ({
      updateOne: {
        filter: { _id: product.id },
        update: { $set: product.updates }
      }
    }));

    const result = await Product.bulkWrite(operations);

    res.status(200).json({
      success: true,
      message: 'Bulk update completed',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get low stock products
// @route   GET /api/admin/products/low-stock
router.get('/products/low-stock', async (req, res, next) => {
  try {
    const threshold = req.query.threshold || 10;

    const products = await Product.find({
      units: { $lte: threshold },
      isActive: true
    }).populate('category');

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    next(error);
  }
});

// ============= Settings =============

// @desc    Get system settings
// @route   GET /api/admin/settings
router.get('/settings', async (req, res, next) => {
  try {
    // Get various system stats
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      categoriesCount,
      systemInfo
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { 'payment.status': 'completed' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Category.countDocuments(),
      {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        statistics: {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue: totalRevenue[0]?.total || 0,
          categoriesCount
        },
        system: systemInfo
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;