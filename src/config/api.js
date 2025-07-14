// Configuration for API endpoints
const config = {
  // Use relative URLs in production, absolute URLs in development
  API_BASE_URL: process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001',
  
  // API endpoints
  endpoints: {
    ED: '/data/ED',
    LAB: '/data/LAB', 
    BB: '/data/BB',
    OR: '/data/OR',
    RAD: '/data/RAD'
  }
};

export default config;