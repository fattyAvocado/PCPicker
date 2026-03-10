const Product = require('../../models/Product');
const Category = require('../../models/Category');
const ImageService = require('../../services/imageService');
const mongoose = require('mongoose');

// @desc    Get products by brand
// @route   GET /api/products/brand/:brand
// @access  Public
exports.getProductsByBrand = async (req, res, next) => {
  try {
    const { brand } = req.params;
    const { page = 1, limit = 10, sort } = req.query;
    
    const query = { 
      brand: { $regex: new RegExp('^' + brand + '$', 'i') },
      isActive: true 
    };

    // Build sort object
    let sortBy = {};
    if (sort === 'price_asc') sortBy = { price: 1 };
    else if (sort === 'price_desc') sortBy = { price: -1 };
    else if (sort === 'newest') sortBy = { createdAt: -1 };
    else sortBy = { name: 1 };

    const products = await Product.find(query)
      .populate('category', 'categoryId name slug brands')
      .sort(sortBy)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Product.countDocuments(query);

    // Get unique models for this brand
    const models = await Product.distinct('model', { 
      brand: { $regex: new RegExp('^' + brand + '$', 'i') },
      model: { $ne: '', $exists: true }
    });

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      brand: brand,
      availableModels: models.filter(m => m && m.trim() !== ''),
      data: products
    });
  } catch (error) {
    console.error('Error getting products by brand:', error);
    next(error);
  }
};

// @desc    Get products by brand and model
// @route   GET /api/products/brand/:brand/model/:model
// @access  Public
exports.getProductsByBrandAndModel = async (req, res, next) => {
  try {
    const { brand, model } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const query = { 
      brand: { $regex: new RegExp('^' + brand + '$', 'i') },
      model: { $regex: new RegExp('^' + model + '$', 'i') },
      isActive: true 
    };

    const products = await Product.find(query)
      .populate('category', 'categoryId name slug brands')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      brand: brand,
      model: model,
      data: products
    });
  } catch (error) {
    console.error('Error getting products by brand and model:', error);
    next(error);
  }
};

// @desc    Get all unique brands
// @route   GET /api/products/brands
// @access  Public
exports.getAllBrands = async (req, res, next) => {
  try {
    const brands = await Product.distinct('brand', { 
      brand: { $ne: '', $exists: true },
      isActive: true 
    });

    // Get count of products per brand
    const brandCounts = await Promise.all(
      brands.map(async (brand) => {
        const count = await Product.countDocuments({ 
          brand: brand,
          isActive: true 
        });
        return { brand, productCount: count };
      })
    );

    res.status(200).json({
      success: true,
      count: brandCounts.length,
      data: brandCounts.sort((a, b) => a.brand.localeCompare(b.brand))
    });
  } catch (error) {
    console.error('Error getting brands:', error);
    next(error);
  }
};

// @desc    Get models for a specific brand
// @route   GET /api/products/brand/:brand/models
// @access  Public
exports.getBrandModels = async (req, res, next) => {
  try {
    const { brand } = req.params;

    const models = await Product.distinct('model', { 
      brand: { $regex: new RegExp('^' + brand + '$', 'i') },
      model: { $ne: '', $exists: true },
      isActive: true 
    });

    // Get count of products per model
    const modelCounts = await Promise.all(
      models.map(async (model) => {
        const count = await Product.countDocuments({ 
          brand: { $regex: new RegExp('^' + brand + '$', 'i') },
          model: model,
          isActive: true 
        });
        return { model, productCount: count };
      })
    );

    res.status(200).json({
      success: true,
      brand: brand,
      count: modelCounts.length,
      data: modelCounts.sort((a, b) => a.model.localeCompare(b.model))
    });
  } catch (error) {
    console.error('Error getting brand models:', error);
    next(error);
  }
};

// Keep other existing functions (getProductById, deleteProduct, etc.)

// @desc    Get products by category name
// @route   GET /api/products/category/:categoryName
// @access  Public
exports.getProductsByCategoryName = async (req, res, next) => {
  try {
    const { categoryName } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Find category by name, slug, or categoryId
    const category = await Category.findOne({ 
      $or: [
        { name: { $regex: new RegExp('^' + categoryName + '$', 'i') } },
        { slug: categoryName },
        { categoryId: categoryName }
      ],
      isActive: true 
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const query = { 
      category: category._id,
      isActive: true 
    };

    const products = await Product.find(query)
      .populate('category', 'categoryId name slug')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      category: {
        id: category.categoryId,
        name: category.name,
        slug: category.slug
      },
      data: products
    });
  } catch (error) {
    console.error('Error getting products by category name:', error);
    next(error);
  }
};

// @desc    Get products by category ID
// @route   GET /api/products/category/id/:categoryId
// @access  Public
exports.getProductsByCategoryId = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Find category by ID or categoryId
    const category = await Category.findOne({ 
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(categoryId) ? categoryId : null },
        { categoryId: categoryId }
      ].filter(Boolean),
      isActive: true 
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const query = { 
      category: category._id,
      isActive: true 
    };

    const products = await Product.find(query)
      .populate('category', 'categoryId name slug')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      category: {
        id: category.categoryId,
        name: category.name,
        slug: category.slug
      },
      data: products
    });
  } catch (error) {
    console.error('Error getting products by category ID:', error);
    next(error);
  }
};



exports.getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(`Fetching product with ID: ${id}`);

    // Build query to find by either _id or productId
    const query = {
      $or: [],
      isActive: true 
    };

    // If it's a valid ObjectId, add it to the query
    if (mongoose.Types.ObjectId.isValid(id)) {
      query.$or.push({ _id: id });
    }
    
    // Always try to find by productId (custom ID)
    query.$or.push({ productId: id });

    const product = await Product.findOne(query)
      .populate('category', 'categoryId name slug brands description');

    if (!product) {
      console.log('Product not found');
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    console.log(`Found product: ${product.name} (${product.productId})`);

    // Get related products from same category
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      isActive: true
    })
    .populate('category', 'categoryId name slug')
    .limit(4);

    res.status(200).json({
      success: true,
      data: {
        ...product.toObject(),
        relatedProducts
      }
    });
  } catch (error) {
    console.error('Error getting product by ID:', error);
    next(error);
  }
};

// @desc    Get all products with filters
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      brand,
      minPrice, 
      maxPrice, 
      sort, 
      inStock,
      search
    } = req.query;
    
    const query = { isActive: true };
    
    // Handle category filter
    if (category) {
      let categoryDoc = null;
      
      if (mongoose.Types.ObjectId.isValid(category)) {
        categoryDoc = await Category.findById(category);
      }
      
      if (!categoryDoc) {
        categoryDoc = await Category.findOne({ categoryId: category });
      }
      
      if (!categoryDoc) {
        categoryDoc = await Category.findOne({ slug: category });
      }
      
      if (categoryDoc) {
        query.category = categoryDoc._id;
      }
    }
    
    // Handle brand filter
    if (brand) {
      query.brand = { $regex: new RegExp(brand, 'i') };
    }
    
    // Handle price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    
    // Handle stock filter
    if (inStock === 'true') {
      query.inStock = true;
    }

    // Handle search (text search)
    if (search) {
      query.$text = { $search: search };
    }

    // Build sort object
    let sortBy = {};
    if (sort === 'price_asc') sortBy = { price: 1 };
    else if (sort === 'price_desc') sortBy = { price: -1 };
    else if (sort === 'newest') sortBy = { createdAt: -1 };
    else if (sort === 'popular') sortBy = { soldCount: -1 };
    else if (sort === 'brand_asc') sortBy = { brand: 1 };
    else sortBy = { createdAt: -1 };

    const products = await Product.find(query)
      .populate('category', 'categoryId name slug brands')
      .sort(sortBy)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: products
    });
  } catch (error) {
    console.error('Error getting products:', error);
    next(error);
  }
};

// @desc    Create product
// @route   POST /api/products
// @access  Private/Admin
exports.createProduct = async (req, res, next) => {
  try {
    const { 
      name, heading, description, category, brand, model,
      price, cost, warranty, units, shippingTime, shippingCost, 
      specifications 
    } = req.body;

    console.log('Creating product with category:', category);

    // Validate brand
    if (!brand) {
      return res.status(400).json({
        success: false,
        message: 'Brand is required'
      });
    }

    // Find category by ID or categoryId
    let categoryDoc = null;
    
    if (category) {
      // Try to find by ObjectId first
      if (mongoose.Types.ObjectId.isValid(category)) {
        categoryDoc = await Category.findById(category);
      }
      
      // If not found, try by categoryId
      if (!categoryDoc) {
        categoryDoc = await Category.findOne({ categoryId: category });
      }
      
      // If still not found, try by slug
      if (!categoryDoc) {
        categoryDoc = await Category.findOne({ slug: category });
      }
    }

    if (!categoryDoc) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID. Category not found.'
      });
    }

    console.log('Found category:', categoryDoc.name, 'with ObjectId:', categoryDoc._id);

    // Upload images if any
    let images = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file, index) => {
        try {
          const result = await ImageService.uploadImage(file.buffer, {
            filename: file.originalname
          });
          return {
            url: result.url,
            thumb: result.thumb,
            isPrimary: index === 0
          };
        } catch (uploadError) {
          console.error(`Failed to upload image ${file.originalname}:`, uploadError);
          return null;
        }
      });
      
      const results = await Promise.all(uploadPromises);
      images = results.filter(img => img !== null);
      
      if (images.length === 0 && req.files.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Failed to upload images. Please try again.'
        });
      }
    }

    // Create product
    const productData = {
      name,
      heading,
      description,
      category: categoryDoc._id,
      brand: brand.trim(),
      model: model ? model.trim() : '',
      price: parseFloat(price),
      cost: parseFloat(cost),
      warranty,
      units: parseInt(units),
      shippingTime,
      shippingCost: parseFloat(shippingCost),
      specifications: specifications ? JSON.parse(specifications) : {},
      images
    };

    console.log('Creating product with data:', productData);

    const product = await Product.create(productData);

    console.log('✅ Product created with ID:', product.productId);

    // Populate category for response
    await product.populate('category', 'categoryId name slug brands');

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Build query to find by either _id or productId
    const query = {
      $or: []
    };

    if (mongoose.Types.ObjectId.isValid(id)) {
      query.$or.push({ _id: id });
    }
    query.$or.push({ productId: id });

    let product = await Product.findOne(query);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Handle category update if provided
    if (req.body.category) {
      let categoryDoc = null;
      
      if (mongoose.Types.ObjectId.isValid(req.body.category)) {
        categoryDoc = await Category.findById(req.body.category);
      }
      
      if (!categoryDoc) {
        categoryDoc = await Category.findOne({ categoryId: req.body.category });
      }
      
      if (!categoryDoc) {
        categoryDoc = await Category.findOne({ slug: req.body.category });
      }

      if (!categoryDoc) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category ID. Category not found.'
        });
      }

      req.body.category = categoryDoc._id;
    }

    // Handle brand trim if provided
    if (req.body.brand) {
      req.body.brand = req.body.brand.trim();
    }

    // Handle model trim if provided
    if (req.body.model) {
      req.body.model = req.body.model.trim();
    }

    // Handle image uploads if new images are added
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file, index) => {
        const result = await ImageService.uploadImage(file.buffer, {
          filename: file.originalname
        });
        return {
          url: result.url,
          thumb: result.thumb,
          isPrimary: index === 0 && product.images.length === 0
        };
      });
      
      const newImages = await Promise.all(uploadPromises);
      req.body.images = [...product.images, ...newImages];
    }

    // Parse specifications if provided
    if (req.body.specifications && typeof req.body.specifications === 'string') {
      req.body.specifications = JSON.parse(req.body.specifications);
    }

    product = await Product.findByIdAndUpdate(
      product._id,
      req.body,
      { new: true, runValidators: true }
    ).populate('category', 'categoryId name slug brands');

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Build query to find by either _id or productId
    const query = {
      $or: []
    };

    if (mongoose.Types.ObjectId.isValid(id)) {
      query.$or.push({ _id: id });
    }
    query.$or.push({ productId: id });

    const product = await Product.findOne(query);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Soft delete - just mark as inactive
    product.isActive = false;
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    next(error);
  }
};

// @desc    Upload product image
// @route   POST /api/products/:id/images
// @access  Private/Admin
exports.uploadProductImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Build query to find by either _id or productId
    const query = {
      $or: []
    };

    if (mongoose.Types.ObjectId.isValid(id)) {
      query.$or.push({ _id: id });
    }
    query.$or.push({ productId: id });

    const product = await Product.findOne(query);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image'
      });
    }

    const result = await ImageService.uploadImage(req.file.buffer, {
      filename: req.file.originalname
    });

    const newImage = {
      url: result.url,
      thumb: result.thumb,
      isPrimary: product.images.length === 0
    };

    product.images.push(newImage);
    await product.save();

    res.status(200).json({
      success: true,
      data: newImage
    });
  } catch (error) {
    console.error('Error uploading product image:', error);
    next(error);
  }
};

// @desc    Delete product image
// @route   DELETE /api/products/:id/images/:imageId
// @access  Private/Admin
exports.deleteProductImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Build query to find by either _id or productId
    const query = {
      $or: []
    };

    if (mongoose.Types.ObjectId.isValid(id)) {
      query.$or.push({ _id: id });
    }
    query.$or.push({ productId: id });

    const product = await Product.findOne(query);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.images = product.images.filter(
      img => img._id.toString() !== req.params.imageId
    );

    // If primary image was deleted, set first image as primary
    if (product.images.length > 0 && !product.images.some(img => img.isPrimary)) {
      product.images[0].isPrimary = true;
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product image:', error);
    next(error);
  }
};

// Keep other functions (getProductsByBrand, getBrandModels, etc.) as they were...