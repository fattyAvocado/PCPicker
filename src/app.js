const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const swaggerUI = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./api/routes/auth.routes');
const userRoutes = require('./api/routes/user.routes');
const productRoutes = require('./api/routes/product.routes');
const orderRoutes = require('./api/routes/order.routes');
const cartRoutes = require('./api/routes/cart.routes');
const categoryRoutes = require('./api/routes/category.routes');
const layoutRoutes = require('./api/routes/layout.routes');
const ipRoutes = require('./api/routes/ip.routes');
const searchRoutes = require('./api/routes/search.routes');


// Import middleware
const { ipFilter } = require('./api/middleware/ipFilter');
const { errorHandler } = require('./api/middleware/errorHandler');

const app = express();

// ============= CORS CONFIGURATION =============
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'Set-Cookie'],
  maxAge: 86400
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization
app.use(mongoSanitize());
app.use(xss());
//======================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'",
          "https://*.google.com",
          "https://*.gstatic.com",
          "'unsafe-inline'"
        ],

        frameSrc: [
          "'self'",
          "https://*.google.com"
        ],

        imgSrc: [
          "'self'",
          "data:",
          "https://images.unsplash.com",
          "https://iili.io",
          "https://i.ibb.co",
          "https://*.gstatic.com"
        ],

        connectSrc: [
          "'self'",
          "https://*.google.com"
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'"
        ]
      }
    }
  })
);

// ============= STATIC FILE SERVING =============
// Serve static files from the frontend dist directory
const frontendDistPath = path.join(__dirname, '../client'); // Adjust path as needed
console.log('Serving static files from:', frontendDistPath);

// Check if the dist folder exists
const fs = require('fs');
if (fs.existsSync(frontendDistPath)) {
  console.log('✅ Frontend dist folder found');
  
  // Serve static files
  app.use(express.static(frontendDistPath));
  
  // For SPA (Single Page Application) - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/api-docs')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  console.log('⚠️ Frontend dist folder not found at:', frontendDistPath);
  console.log('Static file serving disabled');
}

// IP Filter
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/auth/signup' || req.path === '/auth/verify' || req.path === '/search') {
    return next();
  }
  ipFilter(req, res, next);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/layout', layoutRoutes);
app.use('/api/ip', ipRoutes);
app.use('/api/search', searchRoutes);

// Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocument));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    message: 'Debug info',
    origin: req.headers.origin,
    method: req.method,
    headers: req.headers,
    env: process.env.NODE_ENV,
    staticPath: frontendDistPath,
    staticExists: require('fs').existsSync(frontendDistPath)
  });
});

// Error handler
app.use(errorHandler);

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found'
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 Swagger docs available at http://localhost:${PORT}/api-docs`);
    console.log(`🖥️  Frontend available at http://localhost:${PORT}`);
    console.log(`🔧 CORS enabled for origins:`, allowedOrigins);
  });
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.error(err);
  process.exit(1);
});

module.exports = app;