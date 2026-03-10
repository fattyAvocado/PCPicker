const Category = require('../../models/Category');
const mongoose = require('mongoose');

// Recursive function to build category tree with all descendants including brands
const buildCategoryTree = async (categoryId) => {
  const category = await Category.findById(categoryId)
    .select('categoryId name slug order image parent brands description');
  
  if (!category) return null;

  // Find all direct children
  const children = await Category.find({ parent: categoryId, isActive: true })
    .select('categoryId name slug order image parent brands description');

  // Recursively build children with their own brands
  const childrenWithDescendants = await Promise.all(
    children.map(async (child) => {
      // Recursively get grandchildren
      const grandchildren = await buildCategoryTree(child._id);
      
      // Build child object with its own brands
      const childObj = {
        id: child.categoryId,
        name: child.name,
        slug: child.slug,
        order: child.order,
        image: child.image || '',
        brands: child.brands || [], // Each child has its own brands
        description: child.description || ''
      };

      // Add children if they exist
      if (grandchildren && grandchildren.children && grandchildren.children.length > 0) {
        childObj.children = grandchildren.children;
      } else {
        childObj.children = [];
      }

      return childObj;
    })
  );

  // Return category with its own brands and children
  return {
    id: category.categoryId,
    name: category.name,
    slug: category.slug,
    order: category.order,
    image: category.image || '',
    brands: category.brands || [], // Parent has its own brands
    description: category.description || '',
    children: childrenWithDescendants.filter(c => c !== null)
  };
};

// @desc    Get all categories with recursive children including brands at every level
// @route   GET /api/categories
// @access  Public
exports.getCategories = async (req, res, next) => {
  try {
    console.log('Fetching all categories...');
    
    // Find all root categories (no parent)
    const rootCategories = await Category.find({ 
      parent: null, 
      isActive: true 
    }).select('categoryId name slug order image brands description').sort('order');

    console.log(`Found ${rootCategories.length} root categories`);

    // Build complete tree for each root category
    const categoryTree = await Promise.all(
      rootCategories.map(async (category) => {
        console.log(`Building tree for root category: ${category.name}`);
        const tree = await buildCategoryTree(category._id);
        return {
          id: tree.id,
          name: tree.name,
          slug: tree.slug,
          order: tree.order,
          image: tree.image || '',
          brands: tree.brands || [],
          description: tree.description || '',
          children: tree.children || []
        };
      })
    );

    // Sort by order
    categoryTree.sort((a, b) => a.order - b.order);

    console.log('Successfully built category tree with brands at all levels');
    
    res.status(200).json({
      success: true,
      count: categoryTree.length,
      data: categoryTree
    });
  } catch (error) {
    console.error('Error in getCategories:', error);
    next(error);
  }
};

// @desc    Get single category with its complete tree including brands
// @route   GET /api/categories/:id
// @access  Public
exports.getCategory = async (req, res, next) => {
  try {
    console.log(`Fetching category with id/slug: ${req.params.id}`);
    
    const category = await Category.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null },
        { slug: req.params.id },
        { categoryId: req.params.id }
      ].filter(Boolean),
      isActive: true 
    });

    if (!category) {
      console.log('Category not found');
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    console.log(`Found category: ${category.name}, building tree...`);

    // Build complete tree for this category
    const categoryTree = await buildCategoryTree(category._id);

    // Get parent info if exists
    let parent = null;
    if (category.parent) {
      const parentCat = await Category.findById(category.parent)
        .select('categoryId name slug');
      if (parentCat) {
        parent = {
          id: parentCat.categoryId,
          name: parentCat.name,
          slug: parentCat.slug
        };
      }
    }

    console.log(`Successfully built tree for ${category.name} with ${categoryTree.children?.length || 0} children`);

    res.status(200).json({
      success: true,
      data: {
        id: categoryTree.id,
        name: categoryTree.name,
        slug: categoryTree.slug,
        description: categoryTree.description,
        image: categoryTree.image,
        order: categoryTree.order,
        brands: categoryTree.brands || [],
        parent: parent,
        children: categoryTree.children || []
      }
    });
  } catch (error) {
    console.error('Error in getCategory:', error);
    next(error);
  }
};

// @desc    Get complete category hierarchy with brands
// @route   GET /api/categories/:id/hierarchy
// @access  Public
exports.getCategoryHierarchy = async (req, res, next) => {
  try {
    console.log(`Fetching hierarchy for category: ${req.params.id}`);
    
    const category = await Category.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null },
        { slug: req.params.id },
        { categoryId: req.params.id }
      ].filter(Boolean),
      isActive: true 
    });

    if (!category) {
      console.log('Category not found');
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get all ancestors
    const getAncestors = async (cat) => {
      const ancestors = [];
      let current = cat;
      
      while (current.parent) {
        const parent = await Category.findById(current.parent)
          .select('categoryId name slug brands');
        if (parent) {
          ancestors.unshift({
            id: parent.categoryId,
            name: parent.name,
            slug: parent.slug,
            brands: parent.brands || []
          });
          current = parent;
        } else {
          break;
        }
      }
      return ancestors;
    };

    // Get complete descendant tree with brands
    const descendants = await buildCategoryTree(category._id);
    const ancestors = await getAncestors(category);

    console.log(`Successfully built hierarchy for ${category.name}`);

    res.status(200).json({
      success: true,
      data: {
        id: category.categoryId,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image || '',
        brands: category.brands || [],
        ancestors: ancestors,
        children: descendants.children || []
      }
    });
  } catch (error) {
    console.error('Error in getCategoryHierarchy:', error);
    next(error);
  }
};

// @desc    Create category with brands
// @route   POST /api/categories
// @access  Private/Admin
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, brands, parent, image, order } = req.body;

    console.log(`Creating category: ${name}`);

    // Check if category with same name exists
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp('^' + name + '$', 'i') }
    });
    
    if (existingCategory) {
      console.log('Category name already exists');
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    // Process brands - handle both string and array inputs
    let processedBrands = [];
    if (brands) {
      if (Array.isArray(brands)) {
        processedBrands = brands.filter(b => b && typeof b === 'string').map(b => b.trim());
      } else if (typeof brands === 'string') {
        // Handle comma-separated string
        processedBrands = brands.split(',').map(b => b.trim()).filter(b => b);
      }
    }

    console.log(`Processed brands:`, processedBrands);

    // Handle parent - if "0" or null or undefined, create root category
    let parentId = null;
    let parentCategory = null;
    
    if (parent && parent !== '0' && parent !== 0) {
      parentCategory = await Category.findOne({
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(parent) ? parent : null },
          { categoryId: parent }
        ].filter(Boolean)
      });

      if (!parentCategory) {
        console.log('Parent category not found');
        return res.status(400).json({
          success: false,
          message: 'Parent category not found'
        });
      }
      parentId = parentCategory._id;
      console.log(`Parent category found: ${parentCategory.name}`);
    }

    // Create category
    const category = await Category.create({
      name,
      description,
      brands: processedBrands,
      parent: parentId,
      image: image || '',
      order: order || 0
    });

    console.log(`Category created with ID: ${category.categoryId}`);

    // After creating, get updated list of all categories
    const rootCategories = await Category.find({ 
      parent: null, 
      isActive: true 
    }).select('categoryId name slug order image brands description').sort('order');

    // Build complete tree for each root category
    const categoryTree = await Promise.all(
      rootCategories.map(async (rootCat) => {
        const tree = await buildCategoryTree(rootCat._id);
        return {
          id: tree.id,
          name: tree.name,
          slug: tree.slug,
          order: tree.order,
          image: tree.image || '',
          brands: tree.brands || [],
          description: tree.description || '',
          children: tree.children || []
        };
      })
    );

    // Sort by order
    categoryTree.sort((a, b) => a.order - b.order);

    console.log('Returning updated category tree with brands');

    res.status(201).json({
      success: true,
      count: categoryTree.length,
      data: categoryTree
    });
  } catch (error) {
    console.error('Error in createCategory:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Category with this ${field} already exists`
      });
    }
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
exports.updateCategory = async (req, res, next) => {
  try {
    console.log(`Updating category: ${req.params.id}`);
    
    const category = await Category.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null },
        { categoryId: req.params.id },
        { slug: req.params.id }
      ].filter(Boolean)
    });

    if (!category) {
      console.log('Category not found');
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    console.log(`Found category: ${category.name}`);

    // Check if updating name and if new name already exists
    if (req.body.name && req.body.name.toLowerCase() !== category.name.toLowerCase()) {
      const existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp('^' + req.body.name + '$', 'i') },
        _id: { $ne: category._id }
      });
      
      if (existingCategory) {
        console.log('Category name already exists');
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }
    }

    // Process brands if provided
    if (req.body.brands !== undefined) {
      if (Array.isArray(req.body.brands)) {
        category.brands = req.body.brands.filter(b => b && typeof b === 'string').map(b => b.trim());
      } else if (typeof req.body.brands === 'string') {
        // Handle comma-separated string
        category.brands = req.body.brands.split(',').map(b => b.trim()).filter(b => b);
      } else {
        category.brands = [];
      }
      console.log(`Updated brands:`, category.brands);
    }

    // Handle parent update - if "0" or null, remove parent
    if (req.body.parent !== undefined) {
      if (req.body.parent && req.body.parent !== '0' && req.body.parent !== 0) {
        const parentCategory = await Category.findOne({
          $or: [
            { _id: mongoose.Types.ObjectId.isValid(req.body.parent) ? req.body.parent : null },
            { categoryId: req.body.parent }
          ].filter(Boolean)
        });

        if (!parentCategory) {
          console.log('Parent category not found');
          return res.status(400).json({
            success: false,
            message: 'Parent category not found'
          });
        }
        
        // Prevent setting self as parent
        if (parentCategory._id.toString() === category._id.toString()) {
          return res.status(400).json({
            success: false,
            message: 'Category cannot be its own parent'
          });
        }
        
        // Prevent circular reference
        let checkParent = parentCategory;
        const maxDepth = 10;
        let depth = 0;
        
        while (checkParent.parent && depth < maxDepth) {
          if (checkParent.parent.toString() === category._id.toString()) {
            return res.status(400).json({
              success: false,
              message: 'Circular reference detected in category hierarchy'
            });
          }
          const nextParent = await Category.findById(checkParent.parent);
          if (!nextParent) break;
          checkParent = nextParent;
          depth++;
        }
        
        category.parent = parentCategory._id;
        console.log(`Parent updated to: ${parentCategory.name}`);
      } else {
        category.parent = null;
        console.log('Parent removed (category is now root)');
      }
    }

    // Update other fields
    if (req.body.name) category.name = req.body.name;
    if (req.body.description !== undefined) category.description = req.body.description;
    if (req.body.image !== undefined) category.image = req.body.image || '';
    if (req.body.order !== undefined) category.order = req.body.order;
    if (req.body.isActive !== undefined) category.isActive = req.body.isActive;

    await category.save();
    console.log('Category updated successfully');

    // After updating, get updated list of all categories
    const rootCategories = await Category.find({ 
      parent: null, 
      isActive: true 
    }).select('categoryId name slug order image brands description').sort('order');

    // Build complete tree for each root category
    const categoryTree = await Promise.all(
      rootCategories.map(async (rootCat) => {
        const tree = await buildCategoryTree(rootCat._id);
        return {
          id: tree.id,
          name: tree.name,
          slug: tree.slug,
          order: tree.order,
          image: tree.image || '',
          brands: tree.brands || [],
          description: tree.description || '',
          children: tree.children || []
        };
      })
    );

    // Sort by order
    categoryTree.sort((a, b) => a.order - b.order);

    res.status(200).json({
      success: true,
      count: categoryTree.length,
      data: categoryTree
    });
  } catch (error) {
    console.error('Error in updateCategory:', error);
    next(error);
  }
};

// Keep other functions (deleteCategory, getCategoryBrands, etc.) with similar brand handling...

// @desc    Delete category (soft delete)
// @route   DELETE /api/categories/:id
// @access  Private/Admin
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null },
        { categoryId: req.params.id },
        { slug: req.params.id }
      ].filter(Boolean)
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has products
    const Product = require('../../models/Product');
    const productsCount = await Product.countDocuments({ category: category._id });

    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with associated products'
      });
    }

    // Check if category has subcategories
    const subcategories = await Category.countDocuments({ parent: category._id });
    if (subcategories > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with subcategories'
      });
    }

    // Soft delete
    category.isActive = false;
    await category.save();

    // After deleting, get updated list of all categories
    const rootCategories = await Category.find({ 
      parent: null, 
      isActive: true 
    }).select('categoryId name slug order image brands').sort('order');

    // Build complete tree for each root category
    const categoryTree = await Promise.all(
      rootCategories.map(async (rootCat) => {
        const tree = await buildCategoryTree(rootCat._id);
        return {
          id: tree.id,
          name: tree.name,
          slug: tree.slug,
          order: tree.order,
          image: tree.image || '',
          brands: tree.brands || [],
          children: tree.children || []
        };
      })
    );

    // Sort by order
    categoryTree.sort((a, b) => a.order - b.order);

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
      count: categoryTree.length,
      data: categoryTree
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all brands for a category
// @route   GET /api/categories/:id/brands
// @access  Public
exports.getCategoryBrands = async (req, res, next) => {
  try {
    const category = await Category.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null },
        { slug: req.params.id },
        { categoryId: req.params.id }
      ].filter(Boolean),
      isActive: true 
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: category.categoryId,
        name: category.name,
        brands: category.brands || []
      }
    });
  } catch (error) {
    next(error);
  }
};

