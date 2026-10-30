import { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, LayersControl, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});


// Invalidate size on mount / tab switch so tiles render fully
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);
  return null;
}

// Map click handler
function MapClickHandler({ onMapClick }) {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

const LocationUpdate = ({ currentLocation, onLocationUpdated }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [locationData, setLocationData] = useState({
        latitude: currentLocation?.coordinates?.[1] || '',
        longitude: currentLocation?.coordinates?.[0] || '',
        district: '',
        taluka: '',
    });
    const [locationLoading, setLocationLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const mapClickRef = useRef(false);

    const defaultCenter = [20.5937, 78.9629]; // India center
    const defaultZoom = 5;

    // Get current map center based on existing location or default
    const mapCenter = locationData.latitude && locationData.longitude
        ? [parseFloat(locationData.latitude), parseFloat(locationData.longitude)]
        : defaultCenter;

    // Reverse geocoding to get address from coordinates
    // India Nominatim address hierarchy:
    //   state_district → District (admin_level=5)
    //   county         → Taluka / Tehsil / Sub-district (admin_level=6)
    //   suburb/village → Small locality (NOT a taluka)
    const reverseGeocode = async (lat, lng) => {
        try {
            setLocationLoading(true);
            // zoom=12 gives sub-district level detail (needed for taluka)
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`;

            const res = await fetch(url, {
                headers: { 'Accept-Language': 'en' },
            });
            const data = await res.json();

            if (data.address) {
                // District: state_district is the correct field for Indian districts
                // 'district' key is also returned in some responses
                const district =
                    data.address.state_district ||
                    data.address.district ||
                    data.address.state ||
                    '';

                // Taluka: In India, Nominatim maps admin_level=6 (tehsil/taluka) to 'county'
                // Do NOT use suburb/town/city — those are locality names, not talukas
                const taluka =
                    data.address.county ||
                    data.address.state_district ||   // last resort if county missing
                    '';

                setLocationData((prev) => ({
                    ...prev,
                    district: district || prev.district,
                    taluka: taluka || prev.taluka,
                }));
            }
        } catch (err) {
            console.log('Geocoding error:', err);
        } finally {
            setLocationLoading(false);
        }
    };

    const handleMapClick = (lat, lng) => {
        mapClickRef.current = true;

        setLocationData((prev) => ({
            ...prev,
            latitude: lat.toFixed(6),
            longitude: lng.toFixed(6),
        }));

        reverseGeocode(lat, lng);

        setTimeout(() => {
            mapClickRef.current = false;
        }, 150);
    };

    const handleInputChange = (e) => {
        setLocationData({ ...locationData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!locationData.latitude || !locationData.longitude) {
            setError('Please select a location on the map');
            return;
        }

        setUpdating(true);

        try {
            const response = await userAPI.updateLocation({
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                district: locationData.district,
                taluka: locationData.taluka,
            });

            setSuccess('Location updated successfully! Redirecting to dashboard...');
            if (onLocationUpdated) {
                onLocationUpdated(response.data.user);
            }

            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
                const dashboardPath = user?.role === 'farmer'
                    ? '/farmer/dashboard'
                    : user?.role === 'agronomist'
                        ? '/agronomist/dashboard'
                        : '/';
                navigate(dashboardPath);
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update location');
        } finally {
            setUpdating(false);
        }
    };

    // Use browser's geolocation to get current location with retry mechanism
    const useMyLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            return;
        }

        setLocationLoading(true);
        setError('');
        setSuccess('');

        // Try to get location with different accuracy settings
        const tryGetLocation = (enableHighAccuracy = true, isRetry = false) => {
            const timeoutDuration = enableHighAccuracy ? 15000 : 10000;

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;

                    setLocationData((prev) => ({
                        ...prev,
                        latitude: lat.toFixed(6),
                        longitude: lng.toFixed(6),
                    }));

                    await reverseGeocode(lat, lng);

                    const accuracyMsg = position.coords.accuracy
                        ? ` (Accuracy: ${Math.round(position.coords.accuracy)}m)`
                        : '';
                    setSuccess(`Location detected successfully!${accuracyMsg}`);
                    setTimeout(() => setSuccess(''), 5000);
                },
                (error) => {
                    setLocationLoading(false);
                    let errorMessage = '';

                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Location access denied. Please allow location access in your browser settings and try again.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information is unavailable. Please check if location services are enabled on your device.';
                            break;
                        case error.TIMEOUT:
                            if (enableHighAccuracy && !isRetry) {
                                setError('High accuracy mode timed out. Trying with standard accuracy...');
                                setTimeout(() => {
                                    setError('');
                                    tryGetLocation(false, true);
                                }, 1000);
                                return;
                            }
                            errorMessage = 'Location request timed out. This can happen if:\n• GPS signal is weak (try moving near a window)\n• Location services are disabled on your device\n• You\'re in an area with poor GPS reception\n\nYou can manually select your location on the map below.';
                            break;
                        default:
                            errorMessage = 'Failed to get your location. Please try again or manually select your location on the map.';
                    }

                    setError(errorMessage);
                },
                {
                    enableHighAccuracy: enableHighAccuracy,
                    timeout: timeoutDuration,
                    maximumAge: 0,
                }
            );
        };

        tryGetLocation(true, false);
    };

    return (
        <div className="location-update-container">
            <style>{`
        .location-update-container {
          width: 100%;
        }

        .location-section-title {
          font-size: 1.2rem;
          font-weight: 600;
          color: #333;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .location-description {
          font-size: 0.9rem;
          color: #666;
          margin-bottom: 20px;
        }

        .map-container {
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          overflow: hidden;
          height: 400px;
          margin-bottom: 20px;
        }

        .location-info {
          background: #e8f5e9;
          border: 1px solid #4caf50;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
        }

        .location-info-text {
          font-size: 0.9rem;
          font-weight: 600;
          color: #2e7d32;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .loading-info {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
        }

        .loading-text {
          font-size: 0.9rem;
          font-weight: 600;
          color: #856404;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
        }

        .success-message {
          background: #d4edda;
          color: #155724;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #c3e6cb;
          margin-bottom: 20px;
          white-space: pre-line;
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #f5c6cb;
          margin-bottom: 20px;
          white-space: pre-line;
        }

        .use-location-btn {
          width: 100%;
          padding: 14px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }

        .use-location-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }

        .use-location-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .use-location-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .use-location-btn svg {
          width: 20px;
          height: 20px;
        }

        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }

          .map-container {
            height: 300px;
          }
        }
      `}</style>

            <h3 className="location-section-title">
                <span>📍</span>
                <span>Update Your Location</span>
            </h3>
            <p className="location-description">
                Click on the map to select your precise location. This helps us provide better services.
            </p>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            {/* Use My Location Button */}
            <div className="mb-4">
                <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={locationLoading}
                    className="use-location-btn"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {locationLoading ? 'Detecting Location...' : 'Use My Current Location'}
                </button>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="map-container">
                    <MapContainer
                        center={mapCenter}
                        zoom={locationData.latitude ? 12 : defaultZoom}
                        scrollWheelZoom={true}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <MapResizeHandler />
                        <LayersControl position="topright">
                            <LayersControl.BaseLayer checked name="Standard">
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name="Satellite">
                                <TileLayer
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    attribution="&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community"
                                />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name="Terrain">
                                <TileLayer
                                    url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                                    attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
                                />
                            </LayersControl.BaseLayer>
                        </LayersControl>

                        {locationData.latitude && locationData.longitude && (
                            <Marker
                                position={[
                                    parseFloat(locationData.latitude),
                                    parseFloat(locationData.longitude),
                                ]}
                            />
                        )}

                        <MapClickHandler onMapClick={handleMapClick} />
                    </MapContainer>
                </div>

                {locationData.latitude && (
                    <div className="location-info">
                        <p className="location-info-text">
                            <span>🌍</span>
                            <span>
                                Selected Location: {locationData.latitude}, {locationData.longitude}
                            </span>
                        </p>
                    </div>
                )}

                {locationLoading && (
                    <div className="loading-info">
                        <p className="loading-text">
                            <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Detecting address...
                        </p>
                    </div>
                )}

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">District</label>
                        <input
                            type="text"
                            name="district"
                            className="form-input"
                            value={locationData.district}
                            onChange={handleInputChange}
                            placeholder="District"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Taluka</label>
                        <input
                            type="text"
                            name="taluka"
                            className="form-input"
                            value={locationData.taluka}
                            onChange={handleInputChange}
                            placeholder="Taluka"
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <button
                        type="submit"
                        disabled={updating || !locationData.latitude}
                        className="button button-primary"
                    >
                        {updating ? 'Updating...' : 'Update Location'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default LocationUpdate;
