const Layout = require('../../models/Layout');
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const mongoose = require('mongoose');

// Helper function to convert productId to ObjectId
const convertProductIdsToObjectIds = async (productIds) => {
  if (!productIds || !Array.isArray(productIds)) return [];
  
  const objectIds = [];
  
  for (const id of productIds) {
    try {
      // If it's already a valid ObjectId, use it
      if (mongoose.Types.ObjectId.isValid(id)) {
        objectIds.push(mongoose.Types.ObjectId.createFromHexString(id));
        continue;
      }
      
      // Otherwise, find the product by its custom productId
      const product = await Product.findOne({ productId: id }).select('_id');
      if (product) {
        objectIds.push(product._id);
      } else {
        console.warn(`Product not found with ID: ${id}`);
      }
    } catch (error) {
      console.error(`Error converting product ID ${id}:`, error);
    }
  }
  
  return objectIds;
};

// Helper function to convert categoryId to ObjectId
const convertCategoryIdsToObjectIds = async (categoryIds) => {
  if (!categoryIds || !Array.isArray(categoryIds)) return [];
  
  const objectIds = [];
  
  for (const id of categoryIds) {
    try {
      // If it's already a valid ObjectId, use it
      if (mongoose.Types.ObjectId.isValid(id)) {
        objectIds.push(mongoose.Types.ObjectId.createFromHexString(id));
        continue;
      }
      
      // Otherwise, find the category by its custom categoryId
      const category = await Category.findOne({ categoryId: id }).select('_id');
      if (category) {
        objectIds.push(category._id);
      } else {
        console.warn(`Category not found with ID: ${id}`);
      }
    } catch (error) {
      console.error(`Error converting category ID ${id}:`, error);
    }
  }
  
  return objectIds;
};

// Recursive function to build category tree with all descendants
const buildCategoryTree = async (categoryId) => {
  const category = await Category.findById(categoryId)
    .select('categoryId name slug order image parent brands');
  
  if (!category) return null;

  // Find all direct children
  const children = await Category.find({ parent: categoryId, isActive: true })
    .select('categoryId name slug order image parent brands');

  // Recursively build children
  const childrenWithDescendants = await Promise.all(
    children.map(async (child) => {
      const childObj = {
        id: child.categoryId,
        name: child.name,
        slug: child.slug,
        order: child.order,
        image: child.image || '',
        brands: child.brands || []
      };

      // Get grandchildren recursively
      const grandchildren = await buildCategoryTree(child._id);
      if (grandchildren && grandchildren.children && grandchildren.children.length > 0) {
        childObj.children = grandchildren.children;
      }

      return childObj;
    })
  );

  return {
    id: category.categoryId,
    name: category.name,
    slug: category.slug,
    order: category.order,
    image: category.image || '',
    brands: category.brands || [],
    children: childrenWithDescendants.filter(c => c !== null)
  };
};

// @desc    Get layout
// @route   GET /api/layout
// @access  Public
exports.getLayout = async (req, res, next) => {
  try {
    let layout = await Layout.findOne({ isActive: true });

    if (!layout) {
      // Create default layout with empty structure
      layout = await Layout.create({
        name: 'default',
        banner: [],
        topItems: [],
        customSections: []
      });
    }

    // Get top items details (populate full product details)
    const topProducts = await Product.find({
      _id: { $in: layout.topItems },
      isActive: true
    }).populate('category', 'categoryId name slug brands');

    // Get custom sections with populated data based on type
    const customSectionsWithDetails = await Promise.all(
      layout.customSections.map(async (section) => {
        const sectionObj = section.toObject();
        
        if (section.type === 'products' && section.items && section.items.length > 0) {
          // Populate product details for product-type sections
          const products = await Product.find({
            _id: { $in: section.items },
            isActive: true
          }).populate('category', 'categoryId name slug brands');
          
          return {
            ...sectionObj,
            items: products,
            categories: []
          };
        }
        
        if (section.type === 'categories' && section.categories && section.categories.length > 0) {
          // Populate category details for category-type sections
          const categories = await Category.find({
            _id: { $in: section.categories },
            isActive: true
          }).select('categoryId name slug image description brands');
          
          return {
            ...sectionObj,
            categories: categories.map(cat => ({
              id: cat.categoryId,
              name: cat.name,
              slug: cat.slug,
              image: cat.image,
              description: cat.description,
              brands: cat.brands || []
            })),
            items: []
          };
        }
        
        return sectionObj;
      })
    );

    // Get categories for navigation
    const categories = await Category.find({ isActive: true })
      .select('categoryId name slug parent')
      .populate('parent', 'categoryId name');

    // Build category tree
    const categoryMap = {};
    const rootCategories = [];

    categories.forEach(category => {
      categoryMap[category._id] = {
        id: category.categoryId,
        name: category.name,
        slug: category.slug,
        children: []
      };
    });

    categories.forEach(category => {
      if (category.parent) {
        const parentId = category.parent._id.toString();
        if (categoryMap[parentId]) {
          categoryMap[parentId].children.push({
            id: category.categoryId,
            name: category.name,
            slug: category.slug
          });
        }
      } else {
        rootCategories.push(categoryMap[category._id]);
      }
    });

    res.status(200).json({
      success: true,
      data: {
        banner: layout.banner,
        topItems: topProducts,
        customSections: customSectionsWithDetails,
        categories: rootCategories,
        layout: {
          name: layout.name,
          id: layout._id
        }
      }
    });
  } catch (error) {
    console.error('Error in getLayout:', error);
    next(error);
  }
};

// @desc    Update layout (admin) - stores only IDs
// @route   PUT /api/layout
// @access  Private/Admin
exports.updateLayout = async (req, res, next) => {
  try {
    const { name, banner, topItems, customSections } = req.body;

    console.log('Updating layout with topItems:', topItems);

    let layout = await Layout.findOne({ isActive: true });

    if (!layout) {
      layout = new Layout({
        name: name || 'default',
        banner: banner || [],
        topItems: [],
        customSections: []
      });
    } else {
      layout.name = name || layout.name;
      layout.banner = banner || layout.banner;
    }

    // Convert topItems from productId strings to ObjectIds
    if (topItems && Array.isArray(topItems)) {
      layout.topItems = await convertProductIdsToObjectIds(topItems);
      console.log('Converted topItems to ObjectIds:', layout.topItems);
    }

    // Process custom sections
    if (customSections && Array.isArray(customSections)) {
      const processedSections = [];
      
      for (const section of customSections) {
        const baseSection = {
          title: section.title,
          type: section.type || 'products',
          displayOrder: section.displayOrder || 0
        };

        if (section.type === 'categories') {
          // Convert category IDs to ObjectIds
          const categoryObjectIds = await convertCategoryIdsToObjectIds(section.categories || []);
          processedSections.push({
            ...baseSection,
            categories: categoryObjectIds,
            items: []
          });
        } else {
          // Convert product IDs to ObjectIds
          const productObjectIds = await convertProductIdsToObjectIds(section.items || []);
          processedSections.push({
            ...baseSection,
            items: productObjectIds,
            categories: []
          });
        }
      }
      
      layout.customSections = processedSections;
    }

    await layout.save();
    console.log('Layout saved successfully');

    res.status(200).json({
      success: true,
      message: 'Layout updated successfully',
      data: {
        banner: layout.banner,
        topItems: layout.topItems, // Return ObjectIds
        customSections: layout.customSections.map(section => ({
          title: section.title,
          type: section.type,
          displayOrder: section.displayOrder,
          items: section.type === 'products' ? section.items : [],
          categories: section.type === 'categories' ? section.categories : []
        }))
      }
    });
  } catch (error) {
    console.error('Error in updateLayout:', error);
    next(error);
  }
};

// @desc    Add banner image
// @route   POST /api/layout/banner
// @access  Private/Admin
exports.addBanner = async (req, res, next) => {
  try {
    const { imageUrl, link, title } = req.body;

    let layout = await Layout.findOne({ isActive: true });

    if (!layout) {
      layout = await Layout.create({
        banner: [],
        topItems: [],
        customSections: []
      });
    }

    const bannerItem = {
      imageUrl,
      link,
      title,
      order: layout.banner.length
    };

    layout.banner.push(bannerItem);
    await layout.save();

    res.status(201).json({
      success: true,
      data: layout.banner
    });
  } catch (error) {
    console.error('Error in addBanner:', error);
    next(error);
  }
};

// @desc    Update banner
// @route   PUT /api/layout/banner/:bannerId
// @access  Private/Admin
exports.updateBanner = async (req, res, next) => {
  try {
    const layout = await Layout.findOne({ isActive: true });

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    const banner = layout.banner.id(req.params.bannerId);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    Object.assign(banner, req.body);
    await layout.save();

    res.status(200).json({
      success: true,
      data: layout.banner
    });
  } catch (error) {
    console.error('Error in updateBanner:', error);
    next(error);
  }
};

// @desc    Delete banner
// @route   DELETE /api/layout/banner/:bannerId
// @access  Private/Admin
exports.deleteBanner = async (req, res, next) => {
  try {
    const layout = await Layout.findOne({ isActive: true });

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    layout.banner.pull(req.params.bannerId);
    await layout.save();

    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteBanner:', error);
    next(error);
  }
};

// @desc    Add custom section
// @route   POST /api/layout/sections
// @access  Private/Admin
exports.addCustomSection = async (req, res, next) => {
  try {
    const { title, type, items, categories, displayOrder } = req.body;

    let layout = await Layout.findOne({ isActive: true });

    if (!layout) {
      layout = await Layout.create({
        banner: [],
        topItems: [],
        customSections: []
      });
    }

    const newSection = {
      title,
      type: type || 'products',
      displayOrder: displayOrder || layout.customSections.length
    };

    if (type === 'categories') {
      // Convert category IDs to ObjectIds
      newSection.categories = await convertCategoryIdsToObjectIds(categories || []);
      newSection.items = [];
    } else {
      // Convert product IDs to ObjectIds
      newSection.items = await convertProductIdsToObjectIds(items || []);
      newSection.categories = [];
    }

    layout.customSections.push(newSection);
    await layout.save();

    res.status(201).json({
      success: true,
      data: {
        title: newSection.title,
        type: newSection.type,
        displayOrder: newSection.displayOrder,
        items: newSection.type === 'products' ? newSection.items : [],
        categories: newSection.type === 'categories' ? newSection.categories : []
      }
    });
  } catch (error) {
    console.error('Error in addCustomSection:', error);
    next(error);
  }
};

// @desc    Update custom section
// @route   PUT /api/layout/sections/:sectionId
// @access  Private/Admin
exports.updateCustomSection = async (req, res, next) => {
  try {
    const { title, type, items, categories, displayOrder } = req.body;

    const layout = await Layout.findOne({ isActive: true });

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    const section = layout.customSections.id(req.params.sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    if (title) section.title = title;
    if (type) section.type = type;
    if (displayOrder !== undefined) section.displayOrder = displayOrder;

    if (type === 'categories') {
      if (categories) {
        section.categories = await convertCategoryIdsToObjectIds(categories);
      }
      section.items = [];
    } else {
      if (items) {
        section.items = await convertProductIdsToObjectIds(items);
      }
      section.categories = [];
    }

    await layout.save();

    res.status(200).json({
      success: true,
      data: {
        title: section.title,
        type: section.type,
        displayOrder: section.displayOrder,
        items: section.type === 'products' ? section.items : [],
        categories: section.type === 'categories' ? section.categories : []
      }
    });
  } catch (error) {
    console.error('Error in updateCustomSection:', error);
    next(error);
  }
};

// @desc    Delete custom section
// @route   DELETE /api/layout/sections/:sectionId
// @access  Private/Admin
exports.deleteCustomSection = async (req, res, next) => {
  try {
    const layout = await Layout.findOne({ isActive: true });

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found'
      });
    }

    layout.customSections.pull(req.params.sectionId);
    await layout.save();

    res.status(200).json({
      success: true,
      message: 'Section deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteCustomSection:', error);
    next(error);
  }
};