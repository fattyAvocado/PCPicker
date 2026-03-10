const Product = require('../../models/Product');
const Category = require('../../models/Category');

// @desc    Search products
// @route   GET /api/search
// @access  Public
exports.search = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 20, category, minPrice, maxPrice } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a search query'
      });
    }

    const query = {
      $text: { $search: q },
      isActive: true
    };

    if (category) {
      const categoryDoc = await Category.findOne({ slug: category });
      if (categoryDoc) {
        query.category = categoryDoc._id;
      }
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    const products = await Product.find(query)
      .populate('category')
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    // Get search suggestions
    const suggestions = await Product.aggregate([
      {
        $match: {
          $text: { $search: q },
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          names: { $addToSet: '$name' },
          categories: { $addToSet: '$category' }
        }
      },
      {
        $project: {
          suggestions: {
            $slice: ['$names', 5]
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: products,
      suggestions: suggestions[0]?.suggestions || []
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get search suggestions
// @route   GET /api/search/suggestions
// @access  Public
exports.getSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const products = await Product.find({
      $text: { $search: q },
      isActive: true
    })
      .select('name')
      .limit(5);

    const categories = await Category.find({
      name: { $regex: q, $options: 'i' },
      isActive: true
    })
      .select('name slug')
      .limit(3);

    res.status(200).json({
      success: true,
      data: {
        products: products.map(p => ({ type: 'product', name: p.name })),
        categories: categories.map(c => ({ type: 'category', name: c.name, slug: c.slug }))
      }
    });
  } catch (error) {
    next(error);
  }
};