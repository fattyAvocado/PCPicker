const Order = require('../../models/Order');
const Cart = require('../../models/Cart');
const Product = require('../../models/Product');
const User = require('../../models/User');
const PaymentService = require('../../services/paymentService');
const EmailService = require('../../services/emailService');

// ============= USER ORDER METHODS =============

// @desc    Create order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res, next) => {
  try {
    const { shippingAddress, billingAddress, paymentMethod = 'razorpay' } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Check stock availability
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      if (product.units < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`
        });
      }
    }

    // Calculate totals
    const subtotal = cart.subtotal;
    const shippingCost = cart.shippingCost;
    const tax = cart.tax;
    const total = cart.total;

    // Create order items
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      productId: item.product.productId,
      name: item.product.name,
      price: item.price,
      quantity: item.quantity,
      total: item.total
    }));

    // Create order
    const order = await Order.create({
      user: req.user.id,
      userId: req.user.userId,
      userName: `${req.user.name} ${req.user.surname}`,
      items: orderItems,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      subtotal,
      shippingCost,
      tax,
      total
    });

    // If payment method is razorpay, create payment order
    if (paymentMethod === 'razorpay') {
      const paymentOrder = await PaymentService.createOrder(
        total,
        'INR',
        order.orderId
      );

      order.payment = {
        razorpayOrderId: paymentOrder.id,
        method: 'razorpay',
        status: 'pending',
        amount: total
      };

      await order.save();

      return res.status(201).json({
        success: true,
        data: {
          order,
          payment: {
            razorpayOrderId: paymentOrder.id,
            amount: paymentOrder.amount,
            currency: paymentOrder.currency
          }
        }
      });
    }

    // For COD or other methods
    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify payment
// @route   POST /api/orders/:orderId/verify-payment
// @access  Private
exports.verifyPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { razorpayPaymentId, razorpaySignature } = req.body;

    const order = await Order.findOne({ 
      orderId,
      user: req.user.id 
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify payment signature
    const isValid = PaymentService.verifyPayment(
      order.payment.razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      order.payment.status = 'failed';
      await order.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Update order
    order.payment.status = 'completed';
    order.payment.razorpayPaymentId = razorpayPaymentId;
    order.payment.razorpaySignature = razorpaySignature;
    order.status = 'accepted';
    await order.save();

    // Update product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { units: -item.quantity, soldCount: item.quantity }
      });
    }

    // Clear user's cart
    await Cart.findOneAndDelete({ user: req.user.id });

    // Send order confirmation email
    await EmailService.sendOrderConfirmation(req.user, order);

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:orderId
// @access  Private
exports.getOrder = async (req, res, next) => {
  try {
    const query = { orderId: req.params.orderId };
    
    // If not admin, ensure user owns the order
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    }

    const order = await Order.findOne(query)
      .populate('user', 'name email phone')
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
};

// @desc    Cancel order
// @route   POST /api/orders/:orderId/cancel
// @access  Private
exports.cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const { orderId } = req.params;

    const query = { orderId };
    
    // If not admin, ensure user owns the order
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    }

    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order can be cancelled
    const cancellableStatuses = ['pending', 'accepted', 'ready_to_ship'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    order.status = 'cancelled';
    order.cancellationReason = reason;
    order.cancelledAt = new Date();
    order.statusHistory.push({
      status: 'cancelled',
      note: reason || 'Order cancelled',
      updatedBy: req.user.id
    });

    // If payment was completed, process refund
    if (order.payment && order.payment.status === 'completed') {
      try {
        const refund = await PaymentService.refundPayment(
          order.payment.razorpayPaymentId,
          order.total
        );

        order.payment.status = 'refunded';
        order.payment.refundId = refund.id;
        order.payment.refundedAt = new Date();
      } catch (refundError) {
        console.error('Refund failed:', refundError);
        // Continue with cancellation even if refund fails
        // Admin can process refund manually
      }
    }

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { units: item.quantity }
      });
    }

    await order.save();

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// ============= ADMIN ORDER METHODS =============

// @desc    Get all orders (admin)
// @route   GET /api/orders/admin/all
// @access  Private/Admin
exports.getAllOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = {};
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate('user', 'name email')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status (admin)
// @route   PUT /api/orders/:orderId/status
// @access  Private/Admin
// @desc    Update order status (admin)
// @route   PUT /api/orders/:orderId/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note, trackingNumber } = req.body;
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const oldStatus = order.status;
    
    // Update status
    order.status = status;
    
    // Add tracking number if provided (especially for shipping statuses)
    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }
    
    // Add status history entry
    const historyNote = note || `Status changed from ${oldStatus} to ${status}`;
    const historyEntry = {
      status,
      note: trackingNumber ? `${historyNote} - Tracking: ${trackingNumber}` : historyNote,
      updatedBy: req.user.id
    };
    
    // Add tracking info to history if provided
    if (trackingNumber) {
      historyEntry.trackingNumber = trackingNumber;
    }
    
    order.statusHistory.push(historyEntry);

    // Set timestamps based on status
    if (status === 'delivered') {
      order.deliveredAt = new Date();
    }

    if (status === 'cancelled') {
      order.cancelledAt = new Date();
      order.cancellationReason = note || 'Cancelled by admin';
    }

    // If status is ready_to_ship or picked_up, ensure tracking number is present
    if ((status === 'ready_to_ship' || status === 'picked_up' || status === 'in_transit') && !order.trackingNumber) {
      // You might want to generate a tracking number here or require it in the request
      if (!trackingNumber) {
        return res.status(400).json({
          success: false,
          message: 'Tracking number is required for shipping statuses'
        });
      }
    }

    await order.save();

    // Send email notification to user about status change
    try {
      const user = await User.findById(order.user);
      if (user && user.email) {
        // You can implement email notification here
        // await EmailService.sendOrderStatusUpdate(user, order);
        console.log(`Status update email would be sent to ${user.email} for order ${order.orderId}`);
      }
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get orders by user ID (Admin only)
// @route   GET /api/orders/admin/user/:userId
// @access  Private/Admin
exports.getOrdersByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      status,
      fromDate,
      toDate,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Find user by ID or userId
    const user = await User.findOne({ 
      $or: [
        { _id: userId },
        { userId: userId }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Build query
    const query = { user: user._id };
    
    if (status) query.status = status;
    
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    if (minAmount || maxAmount) {
      query.total = {};
      if (minAmount) query.total.$gte = parseFloat(minAmount);
      if (maxAmount) query.total.$lte = parseFloat(maxAmount);
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get orders with pagination
    const orders = await Order.find(query)
      .populate('items.product', 'name productId price images')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Order.countDocuments(query);

    // Calculate summary statistics
    const summary = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$total' },
          averageAmount: { $avg: '$total' },
          totalItems: { $sum: { $size: '$items' } },
          minAmount: { $min: '$total' },
          maxAmount: { $max: '$total' },
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

    // Get status distribution
    const statusDistribution = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          amount: { $sum: '$total' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.userId,
          name: `${user.name} ${user.surname}`,
          email: user.email,
          phone: user.phone
        },
        summary: summary[0] || {
          totalAmount: 0,
          averageAmount: 0,
          totalItems: 0,
          minAmount: 0,
          maxAmount: 0,
          pendingOrders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0
        },
        statusDistribution,
        orders: {
          data: orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get orders by user email (Admin only)
// @route   GET /api/orders/admin/search/by-email
// @access  Private/Admin
exports.getOrdersByUserEmail = async (req, res, next) => {
  try {
    const { email } = req.query;
    const { 
      page = 1, 
      limit = 20, 
      status 
    } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    // Build query
    const query = { user: user._id };
    if (status) query.status = status;

    // Get orders
    const orders = await Order.find(query)
      .populate('items.product', 'name productId price images')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.userId,
          name: `${user.name} ${user.surname}`,
          email: user.email
        },
        orders: {
          data: orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get orders by user phone (Admin only)
// @route   GET /api/orders/admin/search/by-phone
// @access  Private/Admin
exports.getOrdersByUserPhone = async (req, res, next) => {
  try {
    const { phone } = req.query;
    const { 
      page = 1, 
      limit = 20, 
      status 
    } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a phone number'
      });
    }

    // Find user by phone
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this phone number'
      });
    }

    // Build query
    const query = { user: user._id };
    if (status) query.status = status;

    // Get orders
    const orders = await Order.find(query)
      .populate('items.product', 'name productId price images')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.userId,
          name: `${user.name} ${user.surname}`,
          phone: user.phone
        },
        orders: {
          data: orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order statistics for a user (Admin only)
// @route   GET /api/orders/admin/user/:userId/stats
// @access  Private/Admin
exports.getUserOrderStats = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Find user
    const user = await User.findOne({ 
      $or: [
        { _id: userId },
        { userId: userId }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get comprehensive order statistics
    const stats = await Order.aggregate([
      { $match: { user: user._id } },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalSpent: { $sum: '$total' },
                avgOrderValue: { $avg: '$total' },
                totalItems: { $sum: { $size: '$items' } },
                firstOrder: { $min: '$createdAt' },
                lastOrder: { $max: '$createdAt' }
              }
            }
          ],
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                amount: { $sum: '$total' }
              }
            }
          ],
          byMonth: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                count: { $sum: 1 },
                amount: { $sum: '$total' }
              }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
          ],
          paymentMethods: [
            {
              $group: {
                _id: '$payment.method',
                count: { $sum: 1 },
                amount: { $sum: '$total' }
              }
            }
          ],
          topProducts: [
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.product',
                name: { $first: '$items.name' },
                quantity: { $sum: '$items.quantity' },
                revenue: { $sum: '$items.total' }
              }
            },
            { $sort: { quantity: -1 } },
            { $limit: 5 }
          ]
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.userId,
          name: `${user.name} ${user.surname}`,
          email: user.email
        },
        statistics: {
          overview: stats[0]?.overview[0] || {
            totalOrders: 0,
            totalSpent: 0,
            avgOrderValue: 0,
            totalItems: 0
          },
          byStatus: stats[0]?.byStatus || [],
          byMonth: stats[0]?.byMonth || [],
          paymentMethods: stats[0]?.paymentMethods || [],
          topProducts: stats[0]?.topProducts || []
        }
      }
    });
  } catch (error) {
    next(error);
  }
};