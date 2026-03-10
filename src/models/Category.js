const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  categoryId: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true
  },
  slug: {
    type: String,
    unique: true
  },
  description: String,
  brands: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        // Ensure all entries are strings and not empty
        return Array.isArray(v) && v.every(brand => typeof brand === 'string' && brand.trim().length > 0);
      },
      message: 'Brands must be an array of non-empty strings'
    }
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  parentId: {
    type: String,
    default: null
  },
  image: String,
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Generate categoryId and slug before saving
categorySchema.pre('save', async function(next) {
  try {
    // Only generate if this is a new document
    if (this.isNew) {
      // Generate categoryId
      if (!this.categoryId) {
        const prefix = 'CAT';
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(1000 + Math.random() * 9000);
        
        let categoryId = `${prefix}${timestamp}${random}`;
        
        // Ensure uniqueness
        const Category = this.constructor;
        let isUnique = false;
        let attempts = 0;
        
        while (!isUnique && attempts < 5) {
          const existing = await Category.findOne({ categoryId });
          if (!existing) {
            isUnique = true;
          } else {
            const newRandom = Math.floor(1000 + Math.random() * 9000);
            categoryId = `${prefix}${timestamp}${newRandom}`;
            attempts++;
          }
        }
        
        this.categoryId = categoryId;
      }

      // Generate slug from name if not provided
      if (!this.slug && this.name) {
        let slug = this.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        // Ensure uniqueness
        const Category = this.constructor;
        let uniqueSlug = slug;
        let counter = 1;
        
        while (await Category.findOne({ slug: uniqueSlug })) {
          uniqueSlug = `${slug}-${counter}`;
          counter++;
        }
        
        this.slug = uniqueSlug;
      }
    }

    // Update parentId when parent is set
    if (this.parent) {
      const parentCategory = await this.constructor.findById(this.parent);
      if (parentCategory) {
        this.parentId = parentCategory.categoryId;
      }
    } else {
      this.parentId = null;
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Also update slug if name changes (for existing documents)
categorySchema.pre('save', async function(next) {
  try {
    // If name is modified and this is not a new document, update slug
    if (!this.isNew && this.isModified('name') && this.name) {
      let slug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Ensure uniqueness
      const Category = this.constructor;
      let uniqueSlug = slug;
      let counter = 1;
      
      while (await Category.findOne({ slug: uniqueSlug, _id: { $ne: this._id } })) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }
      
      this.slug = uniqueSlug;
    }

    // Update parentId when parent is modified
    if (this.isModified('parent')) {
      if (this.parent) {
        const parentCategory = await this.constructor.findById(this.parent);
        if (parentCategory) {
          this.parentId = parentCategory.categoryId;
        }
      } else {
        this.parentId = null;
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Static method to find category by categoryId or ObjectId
categorySchema.statics.findByIdOrCategoryId = function(id) {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return this.findById(id);
  }
  return this.findOne({ categoryId: id });
};

// Static method to find parent by categoryId string
categorySchema.statics.findParentByCategoryId = async function(parentId) {
  if (!parentId) return null;
  
  if (mongoose.Types.ObjectId.isValid(parentId)) {
    const byId = await this.findById(parentId);
    if (byId) return byId;
  }
  
  return await this.findOne({ categoryId: parentId });
};

module.exports = mongoose.model('Category', categorySchema);