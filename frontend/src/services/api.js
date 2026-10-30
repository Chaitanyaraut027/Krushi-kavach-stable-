import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401 (Unauthorized) errors, not 403 (Forbidden)
    // 403 errors should be handled by the component, not cause logout
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        // No refresh token available, must logout
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/api/v1/auth/refresh-token`, {
          refreshToken,
        });
        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Only logout if refresh truly fails
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data, file) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      formData.append(key, data[key]);
    });
    if (file) {
      formData.append('idProof', file);
    }
    return api.post('/auth/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  login: (data) => api.post('/auth/login', data),
  logout: (data) => api.post('/auth/logout', data),
  refreshToken: (data) => api.post('/auth/refresh-token', data),
};

// User APIs
export const userAPI = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data) => api.put('/users/update', data),
  updateLocation: (data) => api.put('/users/update-location', data),
  updateFarmInfo: (data) => api.put('/users/update-farm-info', data),
  changePassword: (data) => api.put('/users/change-password', data),
  uploadPhoto: (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    return api.post('/users/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deletePhoto: () => api.delete('/users/delete-photo'),
};

// Crop APIs
export const cropAPI = {
  getCrops: () => api.get('/crops'),
  addCrop: (data) => api.post('/crops', data),
  deleteCrop: (id) => api.delete(`/crops/${id}`),
  getCropsByFarmer: (farmerId) => api.get(`/crops/farmer/${farmerId}`),
};

// Disease Report APIs
export const diseaseReportAPI = {
  getReports: () => api.get('/disease-reports'),
  createReport: (data, files) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      formData.append(key, data[key]);
    });
    files.forEach((file) => {
      formData.append('images', file);
    });
    return api.post('/disease-reports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  detectDisease: (cropName, file) => {
    const formData = new FormData();
    formData.append('cropName', cropName);
    formData.append('file', file);
    return api.post('/disease-reports/detect', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  identifyCrop: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/disease-reports/identify-crop', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  markTreated: (id) => api.put(`/disease-reports/${id}/mark-treated`),
  deleteReport: (id) => api.delete(`/disease-reports/${id}`),
};

// Agronomist APIs
export const agronomistAPI = {
  getProfile: () => api.get('/agronomists/me'),
  updateProfile: (data) => api.put('/agronomists/me', data),
  verifyAgronomist: (id, status = 'verified') => api.put(`/agronomists/${id}/verify`, { status }),
  findLocalExperts: () => api.get('/agronomists/local'),
  findLocalFarmers: () => api.get('/agronomists/farmers'),
};

// Admin APIs — Manage Farmers & Agronomist Approvals
export const adminAPI = {
  listFarmers: () => api.get('/admin/farmers'),
  deleteFarmer: (id) => api.delete(`/admin/farmers/${id}`),
  listAgronomists: () => api.get('/admin/agronomists'),
  deleteAgronomist: (id) => api.delete(`/admin/agronomists/${id}`),
  verifyAgronomist: (id, status) => api.put(`/agronomists/${id}/verify`, { status }),
  getOutbreakAlerts: () => api.get('/admin/outbreak-alerts'),
};

// Weather APIs
export const weatherAPI = {
  getWeather: () => api.get('/weather'),
};

// Market Price APIs
export const marketAPI = {
  // Search prices from DB with filters
  searchPrices: (params) => api.get('/market/search', { params }),
  // Latest price per district for a commodity
  getLatestPrices: (commodity, state) => api.get('/market/latest', { params: { commodity, state } }),
  // Get price history for charting
  getPriceHistory: (commodity, params) => api.get(`/market/history/${encodeURIComponent(commodity)}`, { params }),
  // 7-day price prediction
  getPricePrediction: (commodity, district) => api.get(`/market/predict/${encodeURIComponent(commodity)}`, { params: { district } }),
  // Get latest prices for farmer's own crops
  getMyCropPrices: () => api.get('/market/my-crops'),
  // Get distinct states/commodities/districts for dropdowns
  getFilters: () => api.get('/market/filters'),
  // Get DB stats
  getStats: () => api.get('/market/stats'),
  // Manually trigger scrape cycle
  triggerScrape: () => api.post('/market/scrape'),
  // Legacy alias
  triggerFetch: () => api.post('/market/scrape'),
};


// ML Server APIs
export const mlServerAPI = {
  getStatus: () => api.get('/ml-server/status'),
};

// Groq AI — Crop Disease Info & Chatbot APIs
export const geminiAPI = {
  getCropDiseaseInfo: (cropName, diseaseName, language = 'en') =>
    api.post('/disease-info/crop-info', { cropName, diseaseName, language }),
  chat: (messages, context = '', language = 'en') =>
    api.post('/disease-info/chat', { messages, context, language }),
  getCropManagementInfo: (cropName, area, areaUnit = 'acres', language = 'en') =>
    api.post('/disease-info/crop-management', { cropName, area, areaUnit, language }),
  getWeatherCropImpact: (cropName, currentWeather, dailyForecast, language = 'en') =>
    api.post('/disease-info/weather-crop-impact', { cropName, currentWeather, dailyForecast, language }),
  getMarketPrices: (commodity, district, state) =>
    api.post('/disease-info/market-prices', { commodity, district, state }),
  getSeedAdvice: (farmInfo, language = 'en') =>
    api.post('/disease-info/seed-advice', { farmInfo, language }),
};

// Media APIs
export const mediaAPI = {
  uploadMedia: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  searchImages: async (query) => {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
        { headers: { Authorization: 'Client-ID kXvLl0bDDCxjVJf1VoC8kFBZ0rSNfA9Z3bXNGnV8Mrc' } }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.results || data.results.length === 0) throw new Error();
      // Pick a semi-random image from the top results to avoid redundancy
      const randomIndex = Math.floor(Math.random() * Math.min(data.results.length, 5));
      return data.results[randomIndex]?.urls?.regular || data.results[0]?.urls?.regular;
    } catch {
      return `https://images.unsplash.com/photo-1500382017468-9049fee74a62?q=80&w=800&auto=format&fit=crop`;
    }
  }
};

export default api;

