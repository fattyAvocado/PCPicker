const axios = require('axios');
const FormData = require('form-data');

class ImageService {
  constructor() {
    this.apiKey = process.env.IMAGE_HOST_API_KEY;
    this.apiUrl = process.env.IMAGE_HOST_URL || 'https://api.imgbb.com/1/upload';
  }

  async uploadImage(imageBuffer, options = {}) {
    try {
      // Convert buffer to base64 (remove any data URL prefix if present)
      const base64Image = imageBuffer.toString('base64');
      
      // Create form data - important: the field name MUST be "image" [citation:3][citation:8]
      const formData = new FormData();
      formData.append('image', base64Image);
      
      // Add filename if provided (this helps the API identify the image) [citation:8]
      if (options.filename) {
        formData.append('name', options.filename);
      }

      console.log('Uploading image to imgbb...');

      // Make the request - API key goes in the URL as query parameter [citation:3]
      const response = await axios.post(`${this.apiUrl}?key=${this.apiKey}`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      console.log('imgbb response:', response.data);

      // Check response format - imgbb returns { success: true, data: { ... } } [citation:3]
      if (response.data && response.data.success) {
        return {
          success: true,
          url: response.data.data.url,
          thumb: response.data.data.thumb?.url || response.data.data.url,
          filename: options.filename || 'image.jpg',
          delete_url: response.data.data.delete_url
        };
      } else {
        throw new Error(response.data.error?.message || 'Upload failed');
      }
    } catch (error) {
      console.error('❌ Image upload error:', error.response?.data || error.message);
      
      // Provide more specific error messages
      if (error.code === 'ECONNABORTED') {
        throw new Error('Upload timeout - please try again');
      } else if (error.response?.status === 400) {
        // Log the actual error message from the API [citation:1][citation:4]
        const apiError = error.response.data?.error?.message || 'Bad Request';
        throw new Error(`Upload failed: ${apiError}`);
      } else if (error.response?.status === 403) {
        throw new Error('API key invalid - please check your imgbb API key');
      }
      
      throw new Error('Failed to upload image: ' + (error.message || 'Unknown error'));
    }
  }

  async uploadMultipleImages(images) {
    if (!images || images.length === 0) {
      return [];
    }
    
    const uploadPromises = images.map(async (file, index) => {
      try {
        const result = await this.uploadImage(file.buffer, {
          filename: file.originalname
        });
        return {
          ...result,
          isPrimary: index === 0
        };
      } catch (error) {
        console.error(`Failed to upload image ${file.originalname}:`, error.message);
        return null;
      }
    });
    
    const results = await Promise.all(uploadPromises);
    const successful = results.filter(r => r !== null);
    
    if (successful.length === 0 && images.length > 0) {
      throw new Error('Failed to upload any images');
    }
    
    console.log(`✅ Successfully uploaded ${successful.length} out of ${images.length} images`);
    return successful;
  }
}

module.exports = new ImageService();