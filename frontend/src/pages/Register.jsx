import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Map click handler
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}


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

// Fly map to a position programmatically (used after GPS fix)
function FlyToLocation({ position }) {
  const map = useMap();
  if (position) {
    map.flyTo(position, 14, { animate: true, duration: 1.2 });
  }
  return null;
}

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    mobileNumber: "",
    password: "",
    role: "farmer",
    language: "en",
    district: "",
    taluka: "",
    qualification: "",
    experience: "",
    longitude: "",
    latitude: "",
  });

  const [mobileError, setMobileError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [idProof, setIdProof] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();
  const mapClickRef = useRef(false);
  const { t } = useLanguage();
  const { isDark } = useTheme();

  const defaultCenter = [20.5937, 78.9629];
  const defaultZoom = 5;

  // Shared class for all form inputs / selects
  const inputClass = `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors
    ${isDark
      ? 'bg-white/5 border-white/20 text-white placeholder-white/30'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
    }`;

  const labelClass = `block text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`;

  // ----------------------- VALIDATE MOBILE -----------------------
  const validateMobile = (value) => {
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) return t('Mobile number is required');
    if (cleaned.length !== 10) return t('Mobile number must be exactly 10 digits');
    if (!/^[6-9]\d{9}$/.test(cleaned))
      return t('Must start with 6, 7, 8, or 9 and be 10 digits');
    return "";
  };

  const handleMobileChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, "");
    setFormData({ ...formData, mobileNumber: digitsOnly });

    const msg = validateMobile(digitsOnly);
    setMobileError(msg);
  };

  // ----------------------- REVERSE GEOCODING -----------------------
  // For India, Nominatim address hierarchy:
  //   admin_level 4  = State         → address.state
  //   admin_level 5  = District      → address.state_district  (most reliable)
  //   admin_level 6  = Taluka/Tehsil → address.county
  //   admin_level 7  = Town/City
  //   address.city / address.town / address.village = local name
  const reverseGeocode = async (lat, lng) => {
    try {
      setLocationLoading(true);

      // Use zoom=14 for street-level accuracy, and request all address fields
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&namedetails=1&accept-language=en`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en" },
      });
      const data = await res.json();

      if (data.address) {
        const a = data.address;

        // ── District ──────────────────────────────────────────────────
        // In Indian Nominatim data:
        //   state_district → actual revenue district (most accurate)
        //   county         → sometimes used for district in some states
        const district =
          a.state_district ||   // e.g. "Pune", "Nashik", "Nagpur"
          a.county ||           // fallback for some states
          a.district ||         // direct field when present
          "";

        // ── Taluka ────────────────────────────────────────────────────
        // Taluka/Tehsil is typically admin_level 6 → mapped to:
        //   county (when state_district is present as district)
        //   city_district / municipality / suburb / town
        let taluka =
          (a.state_district ? a.county : "") || // if district came from state_district, county = taluka
          a.city_district ||
          a.municipality ||
          a.suburb ||
          a.town ||
          a.city ||
          a.village ||
          a.hamlet ||
          "";

        // Avoid taluka == district (deduplicate)
        if (taluka && taluka.toLowerCase() === district.toLowerCase()) {
          taluka =
            a.suburb ||
            a.town ||
            a.city ||
            a.village ||
            a.hamlet ||
            "";
        }

        // Clean up: remove redundant state name from district/taluka
        const state = a.state || "";
        if (district.toLowerCase() === state.toLowerCase()) {
          // district resolved to state — try harder
          const betterDistrict = a.county || a.city_district || "";
          if (betterDistrict) {
            setFormData((prev) => ({
              ...prev,
              district: betterDistrict,
              taluka: taluka || prev.taluka,
            }));
            return;
          }
        }

        setFormData((prev) => ({
          ...prev,
          district: district || prev.district,
          taluka: taluka || prev.taluka,
        }));
      }
    } catch (err) {
      console.error("Geocoding error:", err);
    } finally {
      setLocationLoading(false);
    }
  };


  const handleMapClick = (lat, lng) => {
    mapClickRef.current = true;

    setFormData((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));

    reverseGeocode(lat, lng);

    setTimeout(() => {
      mapClickRef.current = false;
    }, 150);
  };

  // Handle GPS — Use My Current Location
  const [flyTo, setFlyTo] = useState(null);

  const handleUseMyLocation = () => {
    setGpsError("");
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setFlyTo([lat, lng]);
        handleMapClick(lat, lng);   // reuse existing handler: sets coords + reverse geocodes
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          setGpsError("Location permission denied. Please allow location access in your browser and try again.");
        } else if (err.code === 2) {
          setGpsError("Unable to determine your location. Please click on the map manually.");
        } else {
          setGpsError("Location request timed out. Please click on the map manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle other input fields
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setIdProof(e.target.files[0]);
  };

  // ----------------------- SUBMIT FORM -----------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const mobileMsg = validateMobile(formData.mobileNumber);
    if (mobileMsg) {
      setMobileError(mobileMsg);
      return;
    }

    // Validation for agronomist
    if (formData.role === "agronomist") {
      if (!formData.qualification || !formData.experience) {
        setError("Qualification and experience are required for agronomists.");
        return;
      }
      if (!formData.longitude || !formData.latitude) {
        setError("Please select your location on the map.");
        return;
      }
      if (!idProof) {
        setError(t('ID proof is required for agronomist registration.'));
        return;
      }
    }

    setLoading(true);

    const result = await register(formData, idProof);

    if (result.success) {
      navigate("/login");
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div className={`min-h-screen py-8 px-4 sm:px-6 lg:px-8 ${isDark
      ? 'bg-gradient-to-br from-[#0a0f1e] via-[#1e1b4b] to-[#0f2417]'
      : 'bg-gradient-to-br from-green-50 via-emerald-50 to-white'
      }`}>
      <div className="max-w-4xl mx-auto">
        {/* Card */}
        <div className={`rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-[#0f172a] border border-white/10' : 'bg-white'
          }`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-6 text-center">
            <div className="text-5xl mb-3">📝</div>
            <h2 className="text-3xl font-bold text-white">{t('Create Your Account')}</h2>
            <p className="mt-2 text-green-100 text-sm">Create your account and get started</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-8">
            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-800 px-4 py-3 rounded-lg flex items-start">
                <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Full Name + Mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className={labelClass}>
                  {t('Full Name')} *
                </label>
                <input
                  className={inputClass}
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className={labelClass}>
                  {t('Mobile Number')} *
                </label>
                <input
                  className={inputClass}
                  name="mobileNumber"
                  required
                  maxLength={10}
                  value={formData.mobileNumber}
                  onChange={handleMobileChange}
                  placeholder="10-digit mobile number"
                />
                {mobileError && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {mobileError}
                  </p>
                )}
              </div>
            </div>

            {/* Password + Role */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className={labelClass}>
                  {t('Password')} *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`${inputClass} pr-12`}
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  {t('Role')} *
                </label>
                <select
                  className={inputClass}
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="farmer">{t('Farmer')}</option>
                  <option value="agronomist">{t('Agronomist')}</option>
                </select>
              </div>
            </div>

            {/* Agronomist Extra Fields */}
            {formData.role === "agronomist" && (
              <>
                {/* Map for Location Selection */}
                <div className="mb-6">
                  <h3 className={`text-lg font-bold mb-2 flex items-center gap-2 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    <span>📍</span>
                    <span>Select Your Farm Location (Required) *</span>
                  </h3>

                  {/* ── Use My Location button ─────────────────────────────── */}
                  <div className="flex items-center gap-3 mb-3">
                    <button
                      type="button"
                      onClick={handleUseMyLocation}
                      disabled={gpsLoading}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                        shadow-sm transition-all duration-200 border
                        ${gpsLoading
                          ? 'opacity-60 cursor-not-allowed'
                          : 'hover:scale-[1.03] active:scale-[0.97]'
                        }
                        ${isDark
                          ? 'bg-indigo-600/80 border-indigo-500 text-white hover:bg-indigo-500'
                          : 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                        }`}
                    >
                      {gpsLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Detecting Location…
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" />
                            <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none" />
                          </svg>
                          Use My Current Location
                        </>
                      )}
                    </button>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      or click anywhere on the map
                    </span>
                  </div>

                  {/* GPS error */}
                  {gpsError && (
                    <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">
                      <span className="mt-0.5 flex-shrink-0">⚠️</span>
                      <span>{gpsError}</span>
                    </div>
                  )}

                  {/* Map */}
                  <div className="border-2 border-gray-200 rounded-xl overflow-hidden" style={{ height: "340px" }}>
                    <MapContainer
                      center={flyTo || defaultCenter}
                      zoom={flyTo ? 14 : defaultZoom}
                      scrollWheelZoom={true}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <MapResizeHandler />
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                      {formData.latitude && formData.longitude && (
                        <Marker
                          position={[
                            parseFloat(formData.latitude),
                            parseFloat(formData.longitude),
                          ]}
                        />
                      )}

                      {/* Fly to GPS position when detected */}
                      {flyTo && <FlyToLocation position={flyTo} />}

                      <MapClickHandler onMapClick={handleMapClick} />
                    </MapContainer>
                  </div>


                  {/* Location confirmation card */}
                  {formData.latitude && (
                    <div className={`mt-4 rounded-xl border px-4 py-3 ${isDark ? 'bg-emerald-900/20 border-emerald-700/40' : 'bg-emerald-50 border-emerald-200'}`}>
                      <p className={`text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        <span>✅</span> Location Detected
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {/* District */}
                        {formData.district && (
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${isDark ? 'bg-white/10 text-white' : 'bg-white border border-emerald-200 text-gray-800'}`}>
                            <span>🏛️</span>
                            <span className={`text-xs font-bold uppercase tracking-wide mr-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>District:</span>
                            {formData.district}
                          </div>
                        )}
                        {/* Taluka */}
                        {formData.taluka && (
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${isDark ? 'bg-white/10 text-white' : 'bg-white border border-emerald-200 text-gray-800'}`}>
                            <span>🏘️</span>
                            <span className={`text-xs font-bold uppercase tracking-wide mr-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Taluka:</span>
                            {formData.taluka}
                          </div>
                        )}
                        {/* Coordinates */}
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-50 border border-gray-200 text-gray-500'}`}>
                          <span>📌</span>
                          {formData.latitude}, {formData.longitude}
                        </div>
                      </div>
                      {/* If district/taluka missing, prompt user */}
                      {!formData.district && !locationLoading && (
                        <p className={`text-xs mt-2 ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                          ⚠️ Could not auto-detect district. Please fill it in manually below.
                        </p>
                      )}
                    </div>
                  )}


                  {locationLoading && (
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                      <p className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('Detecting district & taluka…')}
                      </p>
                    </div>
                  )}
                </div>

                {/* District + Taluka */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className={labelClass}>
                      {t('District')}
                    </label>
                    <input
                      className={inputClass}
                      name="district"
                      value={formData.district}
                      onChange={handleChange}
                      placeholder="District"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      {t('Taluka')}
                    </label>
                    <input
                      className={inputClass}
                      name="taluka"
                      value={formData.taluka}
                      onChange={handleChange}
                      placeholder="Taluka"
                    />
                  </div>
                </div>

                {/* Qualification + Experience */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className={labelClass}>
                      {t('Qualification')} *
                    </label>
                    <input
                      className={inputClass}
                      name="qualification"
                      required
                      value={formData.qualification}
                      onChange={handleChange}
                      placeholder="Your qualification"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      {t('Experience (Years)')} *
                    </label>
                    <input
                      type="number"
                      className={inputClass}
                      name="experience"
                      required
                      value={formData.experience}
                      onChange={handleChange}
                      placeholder="Years of experience"
                    />
                  </div>
                </div>

                {/* ID Proof Upload */}
                <div className="mb-6">
                  <label className={labelClass}>
                    {t('ID Proof Document')} *
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      required
                      onChange={handleFileChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{t('ID proof is required for agronomist registration.')}</p>
                </div>
              </>
            )}

            {/* Submit Button */}
            <div className="mt-8">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-lg shadow-lg text-base font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('Registering...')}
                  </>
                ) : (
                  t('Register')
                )}
              </button>
            </div>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('Already have an account?')}{' '}
                <Link to="/login" className="font-semibold text-green-500 hover:text-green-400 transition-colors">
                  {t('Sign In')}
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
