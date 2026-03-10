const Cart = require('../../models/Cart');
const Product = require('../../models/Product');
const mongoose = require('mongoose');

// Helper function to find product by either ObjectId or productId
const findProductById = async (id) => {
  // Try to find by ObjectId first if it's a valid ObjectId
  if (mongoose.Types.ObjectId.isValid(id)) {
    const product = await Product.findById(id);
    if (product) return product;
  }
  
  // If not found or not a valid ObjectId, try by productId
  return await Product.findOne({ productId: id });
};

// @desc    Get user cart (creates cart if doesn't exist)
// @route   GET /api/cart
// @access  Private
exports.getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id })
      .populate({
        path: 'items.product',
        populate: {
          path: 'category',
          select: 'categoryId name slug brands'
        }
      });

    // If cart doesn't exist, create one automatically
    if (!cart) {
      console.log(`Creating new cart for user: ${req.user.email}`);
      
      cart = await Cart.create({
        user: req.user.id,
        items: [],
        subtotal: 0,
        shippingCost: 0,
        tax: 0,
        total: 0,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });

      console.log(`✅ Cart created for user: ${req.user.email} (Cart ID: ${cart.cartId})`);
    }

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error in getCart:', error);
    next(error);
  }
};

// @desc    Add item to cart (creates cart if doesn't exist)
// @route   POST /api/cart/items
// @access  Private
exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;

    console.log(`Adding to cart - Product ID: ${productId}, Quantity: ${quantity}`);

    // Find product by either ObjectId or productId
    const product = await findProductById(productId);

    if (!product) {
      console.log('Product not found with ID:', productId);
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    console.log(`Found product: ${product.name} (${product.productId}) with ObjectId: ${product._id}`);

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available'
      });
    }

    if (product.units < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${product.units} units available.`
      });
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: req.user.id });
    
    // Auto-create cart if it doesn't exist
    if (!cart) {
      console.log(`Creating new cart for user during add to cart: ${req.user.email}`);
      
      cart = await Cart.create({
        user: req.user.id,
        items: [],
        subtotal: 0,
        shippingCost: 0,
        tax: 0,
        total: 0,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      console.log(`✅ Cart created for user: ${req.user.email} (Cart ID: ${cart.cartId})`);
    }

    // Check if item already in cart (compare by product ObjectId)
    const existingItem = cart.items.find(
      item => item.product && item.product.toString() === product._id.toString()
    );

    if (existingItem) {
      // Check if adding more would exceed stock
      if (product.units < existingItem.quantity + quantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot add ${quantity} more. Only ${product.units - existingItem.quantity} units available in stock.`
        });
      }
      
      // Update quantity
      existingItem.quantity += quantity;
      existingItem.total = existingItem.price * existingItem.quantity;
      console.log(`Updated existing item quantity to ${existingItem.quantity}`);
    } else {
      // Add new item with the product ObjectId
      cart.items.push({
        product: product._id,
        quantity,
        price: product.price,
        total: product.price * quantity
      });
      console.log(`Added new item to cart with product ObjectId: ${product._id}`);
    }

    // Recalculate cart totals using the model method
    cart.calculateTotals();

    await cart.save();
    console.log('Cart saved successfully');

    // Populate product details for response
    await cart.populate({
      path: 'items.product',
      populate: {
        path: 'category',
        select: 'categoryId name slug brands'
      }
    });

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error in addToCart:', error);
    next(error);
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/items/:itemId
// @access  Private
exports.updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const { itemId } = req.params;

    console.log(`Updating cart item ${itemId} to quantity ${quantity}`);

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    // Check stock
    const product = await Product.findById(item.product);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.units < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${product.units} units available.`
      });
    }

    item.quantity = quantity;
    item.total = item.price * quantity;
    
    // Recalculate cart totals
    cart.calculateTotals();

    await cart.save();
    await cart.populate({
      path: 'items.product',
      populate: {
        path: 'category',
        select: 'categoryId name slug brands'
      }
    });

    console.log('Cart item updated successfully');

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error in updateCartItem:', error);
    next(error);
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:itemId
// @access  Private
exports.removeCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    console.log(`Removing cart item ${itemId}`);

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items.pull(itemId);
    
    // Recalculate cart totals
    cart.calculateTotals();

    await cart.save();
    await cart.populate({
      path: 'items.product',
      populate: {
        path: 'category',
        select: 'categoryId name slug brands'
      }
    });

    console.log('Cart item removed successfully');

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error in removeCartItem:', error);
    next(error);
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
exports.clearCart = async (req, res, next) => {
  try {
    console.log(`Clearing cart for user: ${req.user.email}`);

    const cart = await Cart.findOne({ user: req.user.id });

    if (cart) {
      cart.items = [];
      cart.subtotal = 0;
      cart.total = 0;
      cart.shippingCost = 0;
      cart.tax = 0;
      cart.coupon = null;
      await cart.save();
      console.log('Cart cleared successfully');
    }

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    console.error('Error in clearCart:', error);
    next(error);
  }
};

// @desc    Get cart item count
// @route   GET /api/cart/count
// @access  Private
exports.getCartCount = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });

    const count = cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;

    res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Error in getCartCount:', error);
    next(error);
  }
};

// @desc    Apply coupon to cart
// @route   POST /api/cart/coupon
// @access  Private
exports.applyCoupon = async (req, res, next) => {
  try {
    const { code, discount } = req.body;

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.coupon = { code, discount };
    cart.calculateTotals();

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error in applyCoupon:', error);
    next(error);
  }
};

// @desc    Remove coupon from cart
// @route   DELETE /api/cart/coupon
// @access  Private
exports.removeCoupon = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.coupon = null;
    cart.calculateTotals();

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error in removeCoupon:', error);
    next(error);
  }
};