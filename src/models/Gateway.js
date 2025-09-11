import mongoose from 'mongoose';

const GatewaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name for this portal.'],
    trim: true,
    unique: true,
  },
  logo: {
    type: String,
    required: false,
    default: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmP_C567B99oW1qwIYITjG9hQ6WIA2rHf2eg&s" // Add explicit default
  },
  description: {
    type: String,
    required: false,
    trim: true,
    default: "" // Add explicit default
  },
  miniId: {
    type: Number,
    required: [true, 'Please provide a mini ID for this portal.'],
    unique: true,
    default: () => Math.floor(Math.random() * 100000),
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  associatedWebsites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: false,
  }],
  // Change Map to Mixed type for better compatibility
  keys: {
    type: mongoose.Schema.Types.Mixed, // Changed from Map to Mixed
    required: false,
    default: {},
  },
}, {
  timestamps: true,
});

// Add a pre-save hook to ensure logo is properly handled
GatewaySchema.pre('save', function(next) {
  // Ensure logo is a string (not undefined or null)
  if (this.logo === undefined || this.logo === null) {
    this.logo = "";
  }
  
  // Ensure keys is an object
  if (!this.keys || typeof this.keys !== 'object') {
    this.keys = {};
  }
  
  next();
});

export default mongoose.models.Gateway || mongoose.model('Gateway', GatewaySchema);