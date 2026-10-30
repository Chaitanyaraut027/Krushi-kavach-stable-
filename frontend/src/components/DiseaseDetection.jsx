import { useState, useRef, useEffect } from 'react';
import {
  Microscope,
  Sprout,
  Check,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  XCircle,
  Circle,
  History,
  Sparkles,
  ArrowRight,
  Upload,
  Camera,
  X,
  RotateCcw,
  Trash2,
  Image as ImageIcon,
  Info,
  Search,
  Wind,
  TrendingUp,
  Activity,
  Clipboard,
  Play,
  Pause,
  Square,
  Repeat,
  Volume2,
  VolumeX,
  Settings,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { diseaseReportAPI, geminiAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useChatbot } from '../context/ChatbotContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AIKeyModal from './AIKeyModal';

// ── Supported crops for the new YOLO model ─────────────────────────────────
const CROPS = [
  // --- YOLO Trained Icons (Standard) ---
  { id: 'Banana', icon: Sprout, image: 'https://images.unsplash.com/photo-1543218024-57a70143c369?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1528825838466-768162b291db?auto=format&fit=crop&q=80&w=300', color: 'from-yellow-400 to-amber-500', bgLight: 'from-yellow-50 to-amber-50', border: 'border-yellow-300', shadow: 'shadow-yellow-200', emoji: '🍌' },
  { id: 'Chilli', icon: Sprout, image: 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1610450949065-1f2809fb0311?auto=format&fit=crop&q=80&w=300', color: 'from-red-500 to-rose-600', bgLight: 'from-red-50 to-rose-50', border: 'border-red-300', shadow: 'shadow-red-200', emoji: '🌶️' },
  { id: 'Radish', icon: Sprout, image: 'https://images.unsplash.com/photo-1604084725044-67dd06368d50?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?auto=format&fit=crop&q=80&w=300', color: 'from-pink-400 to-fuchsia-500', bgLight: 'from-pink-50 to-fuchsia-50', border: 'border-pink-300', shadow: 'shadow-pink-200', emoji: '🌱' },
  { id: 'Groundnut', icon: Sprout, image: 'https://images.unsplash.com/photo-1558230551-878939b03650?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1596726883204-629a8a7ca29b?auto=format&fit=crop&q=80&w=300', color: 'from-amber-600 to-orange-600', bgLight: 'from-amber-50 to-orange-50', border: 'border-amber-300', shadow: 'shadow-amber-200', emoji: '🥜' },
  { id: 'Cauliflower', icon: Sprout, image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1510627489930-0c1b0ba0cc1c?auto=format&fit=crop&q=80&w=300', color: 'from-emerald-400 to-green-600', bgLight: 'from-emerald-50 to-green-50', border: 'border-emerald-300', shadow: 'shadow-emerald-200', emoji: '🥦' },

  { id: 'Tomato', icon: Sprout, image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1558818498-28c1e002b655?auto=format&fit=crop&q=80&w=300', color: 'from-red-400 to-red-600', bgLight: 'from-red-50 to-red-50', border: 'border-red-300', emoji: '🍅' },
  { id: 'Potato', icon: Sprout, image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&q=80&w=300', color: 'from-amber-500 to-yellow-700', bgLight: 'from-amber-50 to-yellow-50', border: 'border-amber-300', emoji: '🥔' },
  { id: 'Corn', icon: Sprout, image: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1529618139141-af9ecc12170b?auto=format&fit=crop&q=80&w=300', color: 'from-yellow-300 to-yellow-500', bgLight: 'from-yellow-50 to-yellow-50', border: 'border-yellow-200', emoji: '🌽' },
  { id: 'Grape', icon: Sprout, image: 'https://images.unsplash.com/photo-1537640538966-79f369b41f8f?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1533616688419-b7a585564566?auto=format&fit=crop&q=80&w=300', color: 'from-purple-400 to-purple-600', bgLight: 'from-purple-50 to-purple-50', border: 'border-purple-300', emoji: '🍇' },
  { id: 'Apple', icon: Sprout, image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6da7b?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&q=80&w=300', color: 'from-red-500 to-red-700', bgLight: 'from-red-50 to-red-50', border: 'border-red-400', emoji: '🍎' },
  { id: 'Orange', icon: Sprout, image: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1557800636-894a64c1696f?auto=format&fit=crop&q=80&w=300', color: 'from-orange-400 to-orange-600', bgLight: 'from-orange-50 to-orange-50', border: 'border-orange-300', emoji: '🍊' },
  { id: 'Pepper', icon: Sprout, image: 'https://images.unsplash.com/photo-1566367576510-184cf434199f?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1566367576510-184cf434199f?auto=format&fit=crop&q=80&w=300', color: 'from-green-400 to-green-700', bgLight: 'from-green-50 to-green-50', border: 'border-green-300', emoji: '🫑' },
  { id: 'Strawberry', icon: Sprout, image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1543528176-61b2395143a4?auto=format&fit=crop&q=80&w=300', color: 'from-rose-400 to-rose-600', bgLight: 'from-rose-50 to-rose-50', border: 'border-rose-300', emoji: '🍓' },
  { id: 'Blueberry', icon: Sprout, image: 'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1497534446932-c946bc77376c?auto=format&fit=crop&q=80&w=300', color: 'from-blue-600 to-indigo-700', bgLight: 'from-blue-50 to-indigo-50', border: 'border-blue-300', emoji: '🫐' },
  { id: 'Cherry', icon: Sprout, image: 'https://images.unsplash.com/photo-1528821415494-06798a720dc2?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1528821415494-06798a720dc2?auto=format&fit=crop&q=80&w=300', color: 'from-red-600 to-rose-700', bgLight: 'from-red-50 to-rose-50', border: 'border-red-300', emoji: '🍒' },
  { id: 'Peach', icon: Sprout, image: 'https://images.unsplash.com/photo-1595124253349-20fbd5d72023?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1595124253349-20fbd5d72023?auto=format&fit=crop&q=80&w=300', color: 'from-orange-300 to-peach-400', bgLight: 'from-orange-50 to-orange-50', border: 'border-orange-200', emoji: '🍑' },
  { id: 'Squash', icon: Sprout, image: 'https://images.unsplash.com/photo-1549419137-b45d04cc6147?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1506867072417-82a33785481e?auto=format&fit=crop&q=80&w=300', color: 'from-yellow-600 to-orange-700', bgLight: 'from-yellow-50 to-orange-50', border: 'border-yellow-300', emoji: '🎃' },
  { id: 'Raspberry', icon: Sprout, image: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1518635017498-87afc04923cd?auto=format&fit=crop&q=80&w=300', color: 'from-pink-500 to-rose-600', bgLight: 'from-pink-50 to-rose-50', border: 'border-pink-300', emoji: '🫐' },
  { id: 'Soybean', icon: Sprout, image: 'https://images.unsplash.com/photo-1594489428504-5c0c480a15fd?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1591850123512-329048de6841?auto=format&fit=crop&q=80&w=300', color: 'from-yellow-600 to-amber-700', bgLight: 'from-yellow-50 to-amber-50', border: 'border-yellow-400', emoji: '🫘' },
  { id: 'Other', icon: Search, image: 'https://images.unsplash.com/photo-1463123081488-729f65bb6136?auto=format&fit=crop&q=80&w=200', harvestImage: 'https://images.unsplash.com/photo-1500382017468-9049fee74a62?auto=format&fit=crop&q=80&w=300', color: 'from-gray-400 to-gray-600', bgLight: 'from-gray-50 to-gray-50', border: 'border-gray-300', emoji: '🔍' },
];

// ── Friendly names for YOLO class labels ──────────────────────────────────
const CLASS_LABELS = {
  // Banana
  banana_bract_mosaic_virus: 'Bract Mosaic Virus',
  banana_cordana: 'Cordana Leaf Spot',
  banana_healthy: 'Healthy',
  banana_insectpest: 'Insect Pest Damage',
  banana_moko: 'Moko Disease',
  banana_panama: 'Panama Wilt',
  banana_pestalotiopsis: 'Pestalotiopsis Leaf Spot',
  banana_sigatoka: 'Sigatoka',
  banana_yb_sigatoka: 'Yellow Sigatoka',
  // Cauliflower
  cauliflower_Blackrot: 'Black Rot',
  cauliflower_bacterial_spot_rot: 'Bacterial Spot Rot',
  cauliflower_downy_mildew: 'Downy Mildew',
  cauliflower_healthy: 'Healthy',
  // Chilli
  chilli_anthracnose: 'Anthracnose',
  chilli_healthy: 'Healthy',
  chilli_leafcurl: 'Leaf Curl',
  chilli_leafspot: 'Leaf Spot',
  chilli_whitefly: 'Whitefly Infestation',
  chilli_yellowish: 'Yellowing',
  // Groundnut
  groundnut_early_leaf_spot: 'Early Leaf Spot',
  groundnut_early_rust: 'Early Rust',
  groundnut_healthy: 'Healthy',
  groundnut_late_leaf_spot: 'Late Leaf Spot',
  groundnut_nutrition_deficiency: 'Nutrition Deficiency',
  groundnut_rust: 'Rust',
  // Radish
  radish_black_leaf_spot: 'Black Leaf Spot',
  radish_downey_mildew: 'Downy Mildew',
  radish_flea_beetle: 'Flea Beetle Damage',
  radish_healthy: 'Healthy',
  radish_mosaic: 'Mosaic Virus',
  // PlantVillage Classes (Pretrained)
  "Apple___Apple_scab": "Apple Scab",
  "Apple___Black_rot": "Black Rot",
  "Apple___Cedar_apple_rust": "Cedar Apple Rust",
  "Apple___healthy": "Healthy Apple",
  "Blueberry___healthy": "Healthy Blueberry",
  "Cherry_(including_sour)___Powdery_mildew": "Powdery Mildew",
  "Cherry_(including_sour)___healthy": "Healthy Cherry",
  "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "Cercospora Leaf Spot",
  "Corn_(maize)___Common_rust_": "Common Rust",
  "Corn_(maize)___Northern_Leaf_Blight": "Northern Leaf Blight",
  "Corn_(maize)___healthy": "Healthy Corn",
  "Grape___Black_rot": "Black Rot",
  "Grape___Esca_(Black_Measles)": "Esca (Black Measles)",
  "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": "Leaf Blight",
  "Grape___healthy": "Healthy Grape",
  "Orange___Haunglongbing_(Citrus_greening)": "Citrus Greening",
  "Peach___Bacterial_spot": "Bacterial Spot",
  "Peach___healthy": "Healthy Peach",
  "Pepper,_bell___Bacterial_spot": "Bacterial Spot",
  "Pepper,_bell___healthy": "Healthy Bell Pepper",
  "Potato___Early_blight": "Early Blight",
  "Potato___Late_blight": "Late Blight",
  "Potato___healthy": "Healthy Potato",
  "Raspberry___healthy": "Healthy Raspberry",
  "Soybean___healthy": "Healthy Soybean",
  "Squash___Powdery_mildew": "Powdery Mildew",
  "Strawberry___Leaf_scorch": "Leaf Scorch",
  "Strawberry___healthy": "Healthy Strawberry",
  "Tomato___Bacterial_spot": "Bacterial Spot",
  "Tomato___Early_blight": "Early Blight",
  "Tomato___Late_blight": "Late Blight",
  "Tomato___Leaf_Mold": "Leaf Mold",
  "Tomato___Septoria_leaf_spot": "Septoria Leaf Spot",
  "Tomato___Spider_mites Two-spotted_spider_mite": "Spider Mites",
  "Tomato___Target_Spot": "Target Spot",
  "Tomato___Tomato_Yellow_Leaf_Curl_Virus": "Yellow Leaf Curl Virus",
  "Tomato___Tomato_mosaic_virus": "Mosaic Virus",
  "Tomato___healthy": "Healthy Tomato"
};

/** Convert a raw class name to a friendly readable label */
const friendlyLabel = (rawClass) => {
  if (CLASS_LABELS[rawClass]) return CLASS_LABELS[rawClass];

  // Fallback cleanup for underscores
  return rawClass
    .replace(/^(banana|chilli|radish|groundnut|cauliflower|apple|tomato|potato|corn|grape|peach|pepper|soybean|strawberry|squash)_/i, '')
    .replace(/___/g, ' - ')
    .replace(/_/g, ' ')
    .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/** A prediction is "healthy" if the label contains 'healthy' */
const isHealthyClass = (rawClass) =>
  typeof rawClass === 'string' && rawClass.toLowerCase().includes('healthy');

const DiseaseDetection = ({ onDetectionComplete }) => {
  const { t, lang } = useLanguage();
  const { setDiseaseContext, openChatbot } = useChatbot();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [selectedCrop, setSelectedCrop] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  const [error, setError] = useState('');
  const [mlOffline, setMlOffline] = useState(false);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [showPreviousTests, setShowPreviousTests] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  // ── Gemini AI info state ────────────────────────────────────────────────────
  const [geminiInfo, setGeminiInfo] = useState(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [relevanceError, setRelevanceError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [preferredVoice, setPreferredVoice] = useState(localStorage.getItem('krishi_pref_voice') || '');
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // ── Speech Synthesis State ──────────────────────────────────────────────────
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechUtterance, setSpeechUtterance] = useState(null);

  // ── Voice Selection Helper ──────────────────────────────────────────────────
  const getSpeechVoice = (langCode) => {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    // 1. Check user preference first (stored in localStorage)
    const pref = localStorage.getItem('krishi_pref_voice');
    if (pref) {
      const found = voices.find(v => v.name === pref);
      if (found) return found;
    }

    // 2. Identify target language strings
    const isMarathi = langCode === 'mr';
    const isHindi = langCode === 'hi' || langCode === 'hinglish';
    const targetLangMatch = isMarathi ? 'mr-IN' : isHindi ? 'hi-IN' : 'en-IN';

    // 3. Priority search criteria
    // We want Google voices first as requested by user
    const priorityKeywords = isMarathi ? ['google', 'marathi'] : isHindi ? ['google', 'hindi'] : ['google', 'english', 'india'];

    // Search 1: Exact Google match
    let bestMatch = voices.find(v => priorityKeywords.every(kw => v.name.toLowerCase().includes(kw)));

    // Search 2: Any matching language code + Google
    if (!bestMatch) {
      bestMatch = voices.find(v => v.lang.replace('_', '-') === targetLangMatch && v.name.toLowerCase().includes('google'));
    }

    // Search 3: Any matching language code
    if (!bestMatch) {
      bestMatch = voices.find(v => v.lang.replace('_', '-') === targetLangMatch);
    }

    // Search 4: Any voice that contains the language name
    if (!bestMatch) {
      const langName = isMarathi ? 'marathi' : isHindi ? 'hindi' : 'english';
      bestMatch = voices.find(v => v.name.toLowerCase().includes(langName));
    }

    return bestMatch || voices[0];
  };

  const saveVoicePreference = (voiceName) => {
    setPreferredVoice(voiceName);
    localStorage.setItem('krishi_pref_voice', voiceName);
    setShowVoiceSettings(false);
  };

  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setAvailableVoices(v);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const stopSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  };

  const pauseResumeSpeech = () => {
    if (!window.speechSynthesis) return;
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleSpeak = (result, info) => {
    if (!window.speechSynthesis) return;
    stopSpeech(); // Clear any existing speech

    if (!result) return;

    let textParts = [];

    // 1. Detected Disease (Mandatory part 1)
    textParts.push(`${t('Detected Disease')}: ${result.prediction}. `);

    // 2. Yield info (Mandatory part 2)
    if (result.yieldEstimation) {
      textParts.push(`${t('Estimated Yield')}: ${result.yieldEstimation}. `);
    }

    // 3. AI Generated Content (Section by section)
    if (info) {
      if (info.summary) textParts.push(`${info.summary}. `);

      const sections = [
        { label: t('Symptoms'), items: info.symptoms },
        { label: t('Treatment'), items: info.treatment },
        { label: t('Prevention'), items: info.prevention },
        { label: t('Natural Remedies'), items: info.naturalRemedies },
      ];

      sections.forEach(s => {
        if (s.items && s.items.length > 0) {
          textParts.push(`${s.label}: ${s.items.join('. ')}. `);
        }
      });
    }

    const fullText = textParts.join(' ').replace(/[#*`_~]/g, '').replace(/\s+/g, ' ').trim();
    if (!fullText) return;

    const utterance = new SpeechSynthesisUtterance(fullText);
    const selectedVoice = getSpeechVoice(lang);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang; // Crucial for non-English compatibility
    } else {
      utterance.lang = lang === 'mr' ? 'mr-IN' : (lang === 'hi' || lang === 'hinglish') ? 'hi-IN' : 'en-IN';
    }
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterance.onerror = (e) => {
      console.error("Speech Error:", e);
      setIsSpeaking(false);
      setIsPaused(false);
    };

    setSpeechUtterance(utterance);
    window.speechSynthesis.speak(utterance);
  };

  // Ensure voices are loaded
  useEffect(() => {
    const handleVoicesChanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
  }, []);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => stopSpeech();
  }, []);

  // Load previous reports
  useEffect(() => {
    fetchReports();

    // Paste handler
    const handlePaste = (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          handleImageFile(blob);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleImageFile = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError(t('Image size should be less than 10MB'));
      return;
    }
    setSelectedImage(file);
    setError('');
    setRelevanceError('');
    setPredictionResult(null);
    setMlOffline(false);

    // Set Preview
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);

    // Auto-Identify Crop and Check Relevance
    setIsIdentifying(true);
    try {
      const res = await diseaseReportAPI.identifyCrop(file);
      if (!res.data.relevant) {
        setRelevanceError(res.data.message);
        // Don't auto-clear crop if user already selected something, but warn them
      } else {
        // Auto-select the crop if found in our list
        const detectedId = res.data.detectedCrop;
        const mappedCrop = CROPS.find(c => c.id === detectedId);
        if (mappedCrop) {
          setSelectedCrop(mappedCrop);
        }
      }
    } catch (err) {
      console.error("Identification failed:", err);
      // Fallback: stay silent or show minor warn
    } finally {
      setIsIdentifying(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name);
    const isPDF = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

    if (isImage || isPDF) {
      handleImageFile(file);
    } else {
      setError(t('Unsupported file type. Please upload an image (JPG, PNG, WebP) or a PDF.'));
    }
  };

  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      const res = await diseaseReportAPI.getReports();
      setReports(res.data || []);
    } catch {
      setReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleCropSelect = (crop) => {
    setSelectedCrop(crop);
    // Don't clear image preview/file - allow manual selection/change after upload
    setPredictionResult(null);
    setError('');
    setMlOffline(false);
    setGeminiInfo(null);
    setGeminiError('');
    setIsDragging(false);
  };

  const handleImageSelect = (e) => {
    handleImageFile(e.target.files?.[0]);
  };

  const handleDetect = async () => {
    if (!selectedCrop || !selectedImage) return;
    setIsPredicting(true);
    setError('');
    setMlOffline(false);
    setPredictionResult(null);

    try {
      const response = await diseaseReportAPI.detectDisease(selectedCrop.id, selectedImage);
      const data = response.data;
      const report = data.report;
      const rawClass = report.prediction; // e.g. 'banana_sigatoka'
      const displayName = friendlyLabel(rawClass);
      const healthy = isHealthyClass(rawClass);
      const result = {
        cropName: report.cropName,
        prediction: displayName,   // human-readable
        rawClass,                  // original YOLO class
        confidence: report.confidence,
        imageURL: report.imageURL,
        reportId: report._id,
        isHealthy: healthy,
        yieldEstimation: data.yield_estimation || 'N/A',
        details: data.details || {}
      };
      setPredictionResult(result);

      // Auto-start speech for basic detection result
      setTimeout(() => handleSpeak(result, null), 500);

      fetchReports(); // refresh history
      if (onDetectionComplete) onDetectionComplete(report);

      // Auto-fetch AI crop info if confidence is sufficient
      const isInvalid = report.confidence < 30;
      if (!isInvalid) {
        setGeminiLoading(true);
        setGeminiInfo(null);
        setGeminiError('');

        // Check for User's API Key
        const userStored = JSON.parse(localStorage.getItem('user'));
        if (!userStored?.groqApiKey) {
          setShowKeyModal(true);
          setGeminiLoading(false);
          return;
        }

        try {
          const gemRes = await geminiAPI.getCropDiseaseInfo(
            report.cropName,
            displayName,
            lang
          );
          setGeminiInfo(gemRes.data.info);

          // Restart speech with full AI info
          handleSpeak(result, gemRes.data.info);

          // ── Push disease context into global chatbot ──
          setDiseaseContext(
            `Crop: ${report.cropName}, Detected disease: ${displayName}, Confidence: ${report.confidence}%`
          );
        } catch {
          setGeminiError('Could not load AI crop info. Please try again.');
        } finally {
          setGeminiLoading(false);
        }
      }
    } catch (err) {
      const status = err.response?.status;
      const errData = err.response?.data;
      if (errData?.error === 'ML_SERVER_OFFLINE' || err.message?.includes('ECONNREFUSED')) {
        setMlOffline(true);
      } else if (status === 401) {
        setError(t('Session expired or storage blocked. Please try logging in again and ensure "Tracking Prevention" is disabled for this site.'));
      } else {
        setError(errData?.message || err.message || t('Detection failed. Please try again.'));
      }
    } finally {
      setIsPredicting(false);
    }
  };

  const handleDeleteReport = async (id) => {
    try {
      setDeletingId(id);
      await diseaseReportAPI.deleteReport(id);
      setReports(prev => prev.filter(r => r._id !== id));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  const handleReset = () => {
    setSelectedCrop(null);
    setSelectedImage(null);
    setImagePreview(null);
    setPredictionResult(null);
    setError('');
    setMlOffline(false);
    setGeminiInfo(null);
    setGeminiError('');
    setDiseaseContext('');
    setRelevanceError('');
    setIsIdentifying(false);
    setIsDragging(false);
  };

  const cropInfo = selectedCrop && CROPS.find(c => c.id === selectedCrop.id);

  const shareToWhatsApp = () => {
    if (!predictionResult) return;

    const cropName = predictionResult.cropName || selectedCrop?.id || 'Crop';
    const diseaseName = predictionResult.prediction;
    const confidence = predictionResult.confidence;
    const imageUrl = predictionResult.imageURL;
    const diagnosis = geminiInfo?.diagnosis || '';

    const text = `*Krishi Kavach - Crop Disease Report* 🌾\n\n` +
      `🌿 *Crop:* ${cropName}\n` +
      `🚨 *Detected Disease:* ${diseaseName}\n` +
      `✅ *Confidence:* ${confidence}%\n\n` +
      (diagnosis ? `📝 *AI Analysis:* ${diagnosis}\n\n` : '') +
      `🖼️ *View Image:* ${imageUrl}\n\n` +
      `_Sent via Krishi Kavach AI_ 🛡️`;

    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/${user?.mobileNumber || ''}?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  const textH = isDark ? 'text-white' : 'text-gray-900';
  const textS = isDark ? 'text-gray-400' : 'text-gray-600';
  const cardBg = isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-gray-100';

  return (
    <div className={`min-h-screen p-4 md:p-8 ${isDark ? 'kk-page-dark' : 'kk-page-light'}`} style={{ backgroundColor: 'var(--bg-page)' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin360 { to { transform:rotate(360deg); } }
        @keyframes pulse-ring { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.05); opacity:.85; } }
        .fade-up { animation: fadeSlideUp 0.4s ease both; }
        .spin { animation: spin360 0.9s linear infinite; }
        .crop-card { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); }
        .crop-card:hover { transform: translateY(-6px) scale(1.03); }
        .crop-card.selected { transform: translateY(-4px) scale(1.04); }
      `}</style>

      <div className="max-w-4xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="text-center mb-10 fade-up">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-2xl shadow-lg mb-4">
            <Microscope size={24} />
            <h1 className="text-2xl font-extrabold tracking-tight">{t('Crop Disease Detection')}</h1>
          </div>
          <p className={`${textS} text-base mt-2`}>
            {t('Select a crop and upload a photo to detect diseases using AI')}
          </p>
          <div className={`mt-3 inline-flex items-center gap-2 ${isDark ? 'bg-indigo-900/20 border-indigo-700/30 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-800'} text-xs font-semibold px-4 py-2 rounded-full`}>
            <Sparkles size={14} />
            {t('AI Analysis Engine')}: {t('Full Support for 18+ Crops & 50+ Varieties')}
          </div>
        </div>

        {/* ── STEP 1: Image Upload ────────────────────────────────────── */}
        {!predictionResult && (
          <div className={`rounded-3xl shadow-xl p-6 md:p-8 mb-6 fade-up bg-[var(--bg-card)] border border-[var(--border-card)]`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow">1</div>
              <h2 className={`text-lg font-bold text-[var(--text-primary)]`}>{t('Upload Plant Image')}</h2>
            </div>

            {!imagePreview ? (
              <div
                className="relative space-y-4 transition-all duration-300"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isDragging && (
                  <div className="absolute inset-0 z-10 bg-green-500/10 border-2 border-dashed border-green-500 rounded-2xl flex flex-col items-center justify-center backdrop-blur-[2px] fade-up animate-pulse">
                    <div className="bg-white p-4 rounded-full shadow-lg text-green-600 mb-2">
                      <ImageIcon size={48} />
                    </div>
                    <p className="text-green-700 font-bold text-lg">{t('Drop Image Here')}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-dashed transition-all duration-200 bg-green-50/50 border-green-200 hover:shadow-lg hover:scale-[1.02]`}
                  >
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg`}>
                      <Upload className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-[var(--text-primary)]">{t('Upload from Gallery')}</p>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">{t('JPG, PNG, WebP up to 10MB')}</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowCamera(true)}
                    className={`group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-dashed hover:shadow-lg transition-all duration-200 bg-[var(--bg-input)] border-[var(--border-card)] hover:scale-[1.02]`}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-[var(--text-primary)]">{t('Take a Photo')}</p>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">{t('Open your camera directly')}</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="fade-up">
                <div className="relative rounded-2xl overflow-hidden shadow-lg mb-4 max-h-80 flex items-center justify-center bg-gray-900 border-2 border-gray-100">
                  <img src={imagePreview} alt="Selected" className="max-h-80 w-full object-contain" />
                  <button
                    onClick={() => handleReset()}
                    className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow"
                  >
                    <X size={18} />
                  </button>
                  {isIdentifying && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                      <RotateCcw className="spin w-8 h-8 mb-2" />
                      <p className="font-bold text-sm">{t('Checking relevance...')}</p>
                    </div>
                  )}
                </div>

                {relevanceError && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3 fade-up">
                    <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
                    <p className="text-sm text-amber-800 font-medium">{relevanceError}</p>
                  </div>
                )}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleImageSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={handleImageSelect} />
          </div>
        )}

        {/* ── STEP 2: Crop Confirmation ───────────────────────────────── */}
        {imagePreview && !predictionResult && (
          <div className={`${cardBg} rounded-3xl shadow-xl p-6 md:p-8 mb-6 fade-up border-2 ${selectedCrop ? 'border-green-400' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow">2</div>
                <h2 className={`text-lg font-bold text-[var(--text-primary)]`}>{selectedCrop ? t('Confirm Crop Selection') : t('Select Crop Type')}</h2>
              </div>
              {selectedCrop && (
                <button onClick={() => setSelectedCrop(null)} className="text-xs font-bold text-indigo-600 hover:underline">{t('Change Crop')}</button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {CROPS.map((crop) => {
                const isSelected = selectedCrop?.id === crop.id;
                return (
                  <button
                    key={crop.id}
                    onClick={() => handleCropSelect(crop)}
                    className={`crop-card flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${isSelected
                      ? `selected bg-gradient-to-br ${crop.bgLight} ${crop.border} shadow-lg ${crop.shadow}`
                      : (isDark ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-white hover:border-gray-300')
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm overflow-hidden bg-gradient-to-br ${crop.color}`}>
                      {crop.image ? <img src={crop.image} alt={crop.id} className="w-full h-full object-cover" /> : <crop.icon size={28} className="text-white" />}
                    </div>
                    <p className={`text-xs font-bold leading-tight ${isSelected ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-gray-400' : 'text-gray-500')}`}>
                      {t(crop.id)}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Detect Button at the bottom of Step 2 */}
            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/10">
              {mlOffline && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-red-700 font-bold">{t('ML Server Offline')} - python app.py</p>
                </div>
              )}
              {error && <p className="text-red-600 text-sm font-bold mb-4">{error}</p>}

              <button
                onClick={handleDetect}
                disabled={isPredicting || !selectedCrop}
                className={`w-full py-4 rounded-2xl font-bold text-lg text-white shadow-lg transition-all flex items-center justify-center gap-3 ${isPredicting || !selectedCrop
                  ? 'bg-gray-300 cursor-not-allowed opacity-70'
                  : `bg-gradient-to-r ${cropInfo?.color || 'from-green-600 to-emerald-700'} hover:shadow-xl hover:scale-[1.01]`
                  }`}
              >
                {isPredicting ? <RotateCcw className="spin w-6 h-6" /> : <Microscope size={22} />}
                <span>{isPredicting ? t('Analyzing...') : t('Detect Disease')}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Results ────────────────────────────────────────── */}
        {predictionResult && (
          <div className={`${cardBg} rounded-3xl shadow-xl border-2 ${predictionResult.isHealthy ? 'border-green-400' : 'border-red-300'} p-6 md:p-8 mb-6 fade-up`}>
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-8 h-8 text-white rounded-full flex items-center justify-center shadow ${predictionResult.isHealthy ? 'bg-green-500' : 'bg-red-500'}`}>
                {predictionResult.isHealthy ? <Check size={18} /> : <AlertTriangle size={18} />}
              </div>
              <h2 className={`text-lg font-bold ${textH}`}>{t('Detection Result')}</h2>

              {/* Quick Speech Controls for basic result */}
              <div className="ml-auto flex items-center gap-1.5 bg-gray-50 dark:bg-white/5 p-1 rounded-xl border border-gray-100 dark:border-white/10">
                <button
                  onClick={() => handleSpeak(predictionResult, geminiInfo)}
                  className={`p-1.5 rounded-lg transition-all ${isSpeaking && !isPaused ? 'text-violet-600 bg-violet-50' : 'text-gray-400 hover:text-violet-500'}`}
                  title="Restart"
                >
                  <Repeat size={14} />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={pauseResumeSpeech}
                    className={`p-3 rounded-2xl border transition-all ${isPaused ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                    title={isPaused ? "Resume" : "Pause"}
                  >
                    {isPaused ? <Play size={20} /> : <Pause size={20} />}
                  </button>

                  {/* Voice Selection Icon */}
                  <div className="relative">
                    <button
                      onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                      className={`p-3 rounded-2xl border transition-all ${showVoiceSettings ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                      title="Select Voice"
                    >
                      <Settings size={20} />
                    </button>

                    {showVoiceSettings && (
                      <div className="absolute top-full right-0 mt-2 z-50 w-72 bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 fade-up">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-black text-secondary uppercase tracking-[0.2em]">Speech Model</p>
                          <button onClick={() => setShowVoiceSettings(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={14} /></button>
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                          <button
                            onClick={() => saveVoicePreference('')}
                            className={`w-full text-left px-4 py-3 rounded-2xl text-sm transition-all ${!preferredVoice ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'hover:bg-gray-50 text-gray-700'}`}
                          >
                            Auto (Smart Select)
                          </button>
                          {availableVoices
                            .filter(v => ['hi', 'mr', 'en'].some(l => v.lang.startsWith(l)))
                            .sort((a, b) => {
                              const aG = a.name.includes('Google') && (a.name.includes('Hindi') || a.name.includes('हिंदी'));
                              const bG = b.name.includes('Google') && (b.name.includes('Hindi') || b.name.includes('हिंदी'));
                              if (aG && !bG) return -1;
                              if (!aG && bG) return 1;
                              return 0;
                            })
                            .map(v => (
                              <button
                                key={v.name}
                                onClick={() => saveVoicePreference(v.name)}
                                className={`w-full text-left px-4 py-3 rounded-2xl text-sm transition-all ${preferredVoice === v.name ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'hover:bg-gray-50 text-gray-700'}`}
                              >
                                <div className="font-bold truncate">{v.name}</div>
                                <div className={`text-[10px] ${preferredVoice === v.name ? 'text-emerald-100' : 'text-gray-400'}`}>{v.lang}</div>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={stopSpeech}
                    className="p-3 rounded-2xl bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 transition-all font-bold"
                    title="Stop Speech"
                  >
                    <VolumeX size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className={`rounded-2xl p-6 mb-4 ${predictionResult.isHealthy
              ? (isDark ? 'bg-green-900/10 border-green-700/30' : 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200')
              : (isDark ? 'bg-red-900/10 border-red-700/30' : 'bg-gradient-to-br from-red-50 to-orange-50 border border-red-200')
              }`}>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-5xl">{selectedCrop?.emoji || '🌿'}</div>
                <div>
                  <p className={`text-sm font-semibold ${textS} uppercase tracking-wide`}>{t('Crop')}</p>
                  <p className={`text-xl font-bold ${textH}`}>{t(predictionResult.cropName)}</p>
                </div>
              </div>

              {/* Detection grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Disease/Status */}
                <div className={`p-4 rounded-xl ${(predictionResult.confidence < 50 || predictionResult.confidence === 100)
                  ? (isDark ? 'bg-white/5' : 'bg-gray-100')
                  : predictionResult.isHealthy
                    ? (isDark ? 'bg-green-600/20' : 'bg-green-100')
                    : (isDark ? 'bg-red-600/20' : 'bg-red-100')
                  }`}>
                  <div className={`text-xs font-semibold uppercase tracking-wide ${textS} mb-1`}>
                    {t('Detection')}
                  </div>
                  {(predictionResult.confidence < 30) ? (
                    <div className={`text-xl font-extrabold ${isDark ? 'text-gray-400' : 'text-gray-500'} flex items-center gap-2`}>
                      <XCircle size={20} /> {t('Not Detected')}
                    </div>
                  ) : (
                    <div className={`text-xl font-extrabold ${predictionResult.isHealthy ? (isDark ? 'text-green-400' : 'text-green-800') : (isDark ? 'text-red-400' : 'text-red-800')} flex items-center gap-2`}>
                      {predictionResult.isHealthy ? <CheckCircle2 size={24} /> : <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center"><AlertTriangle size={14} className="text-white" /></div>} {t(predictionResult.prediction)}
                    </div>
                  )}
                </div>

                {/* Confidence */}
                <div className={`p-4 rounded-xl ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${textS} mb-1`}>
                    {t('Confidence')}
                  </p>
                  <p className={`text-xl font-extrabold ${isDark ? 'text-blue-400' : 'text-blue-800'}`}>
                    {predictionResult.confidence}%
                  </p>
                  <div className={`mt-2 h-2 ${isDark ? 'bg-blue-900/40' : 'bg-blue-200'} rounded-full overflow-hidden`}>
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(predictionResult.confidence, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Yield Impact (Enhanced) */}
                <div className={`p-4 rounded-xl flex items-center gap-4 ${isDark ? 'bg-emerald-900/20 text-emerald-300' : 'bg-emerald-50 text-emerald-800'}`}>
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 shadow-sm border border-emerald-200/50">
                    <img
                      src={predictionResult.isHealthy
                        ? (selectedCrop?.harvestImage || "https://images.unsplash.com/photo-1500382017468-9049fee74a62?auto=format&fit=crop&q=80&w=300")
                        : predictionResult.confidence > 80
                          ? "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&q=80&w=200" // Wilted/Severe
                          : "https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=200" // Yellowed/Mild
                      }
                      alt="Yield Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${textS} mb-0.5`}>
                      {t('Expected Yield')}
                    </p>
                    <p className="text-xl font-extrabold flex items-center gap-2">
                      <TrendingUp size={20} className="text-emerald-500" /> {predictionResult.yieldEstimation}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={`w-2 h-2 rounded-full ${predictionResult.isHealthy ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`} />
                      <p className="text-[10px] font-medium opacity-80">{predictionResult.isHealthy ? t('Optimal Growth') : t('Yield at Risk')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advisory – only for valid disease detections */}
              {!predictionResult.isHealthy
                && predictionResult.confidence >= 50
                && predictionResult.confidence !== 100
                && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl fade-up">
                    <p className="font-bold text-amber-900 flex items-center gap-2">
                      <Lightbulb size={18} className="text-amber-600" /> {t('Advisory')}
                    </p>
                    <p className="text-sm text-amber-800 mt-1">
                      {t('Please consult an agronomist or apply appropriate treatment for')} {t(predictionResult.prediction)}.
                    </p>
                  </div>
                )}

              {/* ── Invalid-image alert (confidence < 30) ── */}
              {(predictionResult.confidence < 30) && (
                <div className="mt-4 p-4 bg-red-50 border-2 border-red-400 rounded-xl fade-up flex items-start gap-3">
                  <XCircle size={24} className="text-red-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-red-800 text-sm flex items-center gap-2">
                      <AlertTriangle size={16} /> {t('Invalid or Unprocessable Image')}
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      {t('The uploaded image could not be processed reliably by the AI. Please upload a clear, well-lit photo of the crop leaf or plant for an accurate result.')}
                    </p>
                  </div>
                </div>
              )}

              {/* ── AI disclaimer – always shown ─────────────────────────── */}
              <div className="mt-4 p-4 bg-orange-50 border border-orange-300 rounded-xl fade-up flex items-start gap-3">
                <Info size={24} className="text-orange-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-bold text-orange-900 text-sm">
                    {t('AI Result Disclaimer')}
                  </p>
                  <p className="text-sm text-orange-800 mt-1">
                    {t('This prediction is generated by an AI model and may not always be accurate. Please verify the disease name and recommended treatment with a certified agronomist or agriculture expert before taking any action.')}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleReset}
                className="flex-1 min-w-[140px] py-3 px-6 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
              >
                {t('Check Another Crop')}
              </button>
              <button
                onClick={() => setShowPreviousTests(true)}
                className="flex-1 min-w-[140px] py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                <History size={18} /> {t('View All Reports')}
              </button>
              <button
                onClick={shareToWhatsApp}
                className="flex-1 min-w-[140px] py-3 px-6 bg-[#25D366] text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                <MessageSquare size={18} /> {t('Share to WhatsApp')}
              </button>
            </div>
          </div>
        )}

        {/* ── Gemini AI Crop Info Panel ────────────────────────────────── */}
        {(geminiLoading || geminiInfo || geminiError) && (
          <div className={`${cardBg} rounded-3xl shadow-xl border-2 border-purple-400/30 p-6 md:p-8 mb-6 fade-up`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-full flex items-center justify-center shadow text-lg">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className={`text-lg font-bold ${textH}`}>{t('AI Crop Information')}</h2>
                <p className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'} font-medium`}>AI-powered crop disease insights & recommendations</p>
              </div>
            </div>

            {/* Loading state for Gemini analysis only */}
            {geminiLoading && !geminiInfo && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 fade-up">
                <RotateCcw className="spin w-14 h-14 text-purple-500" />
                <p className="text-purple-700 font-semibold text-sm">{t('Fetching AI crop information...')}</p>
                <p className="text-gray-400 text-xs">{t('This may take a few seconds')}</p>
              </div>
            )}

            {/* Error state */}
            {geminiError && !geminiLoading && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm fade-up flex items-center gap-2 mb-4">
                <AlertTriangle size={18} /> {geminiError}
              </div>
            )}

            {/* Detailed Info (Gemini) */}
            {geminiInfo && !geminiLoading && (
              <div className="space-y-5 fade-up">
                {/* Title + severity badge */}
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <h3 className="text-xl font-extrabold text-gray-900 leading-tight">{geminiInfo.title}</h3>

                      {/* Speech Controls */}
                      <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-white/5 p-1 rounded-xl border border-gray-100 dark:border-white/10 ml-4 relative">
                        <button
                          onClick={() => handleSpeak(predictionResult, geminiInfo)}
                          className={`p-1.5 rounded-lg transition-all ${isSpeaking && !isPaused ? 'text-violet-600 bg-violet-50 shadow-sm' : 'text-gray-400 hover:text-violet-500'}`}
                          title="Restart narration"
                        >
                          <Repeat size={16} />
                        </button>
                        <button
                          onClick={pauseResumeSpeech}
                          className={`p-1.5 rounded-lg transition-all ${isPaused ? 'text-amber-600 bg-amber-50 shadow-sm' : 'text-gray-400 hover:text-amber-500'}`}
                          disabled={!isSpeaking && !isPaused}
                          title={isPaused ? "Resume" : "Pause"}
                        >
                          {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                        </button>

                        <button
                          onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                          className={`p-1.5 rounded-lg transition-all ${showVoiceSettings ? 'text-emerald-600 bg-emerald-50 shadow-sm' : 'text-gray-400 hover:text-emerald-500'}`}
                          title="Select Voice"
                        >
                          <Settings size={16} />
                        </button>

                        {showVoiceSettings && (
                          <div className="absolute top-full right-0 mt-2 z-50 w-64 bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 fade-up">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Voice Model</p>
                              <button onClick={() => setShowVoiceSettings(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={12} /></button>
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                              <button
                                onClick={() => saveVoicePreference('')}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all ${!preferredVoice ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'hover:bg-gray-50 text-gray-700'}`}
                              >
                                Auto (Smart Select)
                              </button>
                              {availableVoices
                                .filter(v => ['hi', 'mr', 'en'].some(l => v.lang.startsWith(l)))
                                .sort((a, b) => {
                                  const aG = a.name.includes('Google') && (a.name.includes('Hindi') || a.name.includes('हिंदी'));
                                  const bG = b.name.includes('Google') && (b.name.includes('Hindi') || b.name.includes('हिंदी'));
                                  if (aG && !bG) return -1;
                                  if (!aG && bG) return 1;
                                  return 0;
                                })
                                .map(v => (
                                  <button
                                    key={v.name}
                                    onClick={() => saveVoicePreference(v.name)}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all ${preferredVoice === v.name ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'hover:bg-gray-50 text-gray-700'}`}
                                  >
                                    <div className="font-bold truncate">{v.name}</div>
                                    <div className={`text-[9px] ${preferredVoice === v.name ? 'text-emerald-100' : 'text-gray-400'}`}>{v.lang}</div>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={stopSpeech}
                          className={`p-1.5 rounded-lg transition-all text-gray-400 hover:text-red-500`}
                          disabled={!isSpeaking && !isPaused}
                          title="Stop narration"
                        >
                          <Square size={16} fill="currentColor" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">{geminiInfo.summary}</p>
                  </div>
                  {geminiInfo.severity && geminiInfo.severity !== 'None' && (
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full border flex-shrink-0 ${geminiInfo.severity === 'High' ? 'bg-red-100 text-red-800 border-red-300' : geminiInfo.severity === 'Medium' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-green-100 text-green-800 border-green-300'}`}>
                      {t('Severity')}: {geminiInfo.severity}
                    </span>
                  )}
                </div>

                {/* Info sections (Simplified mapped display) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'symptoms', label: t('Symptoms'), icon: Search, color: 'bg-red-50 border-red-200', dot: 'bg-red-400', items: geminiInfo.symptoms },
                    { key: 'treatment', label: t('Treatment'), icon: CheckCircle2, color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500', items: geminiInfo.treatment },
                    { key: 'prevention', label: t('Prevention'), icon: Wind, color: 'bg-green-50 border-green-200', dot: 'bg-green-500', items: geminiInfo.prevention },
                    { key: 'naturalRemedies', label: t('Natural Remedies'), icon: Sprout, color: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', items: geminiInfo.naturalRemedies },
                  ].filter(s => s.items && s.items.length > 0).map(section => (
                    <div key={section.key} className={`rounded-2xl border p-4 ${section.color}`}>
                      <p className="font-bold text-gray-800 mb-2 text-xs flex items-center gap-2">
                        <section.icon size={14} /> {section.label}
                      </p>
                      <ul className="space-y-1.5">
                        {section.items.slice(0, 3).map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[13px] text-gray-700">
                            <span className={`w-1 h-1 ${section.dot} rounded-full mt-1.5 flex-shrink-0`} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Ask AI Button */}
                <button
                  onClick={() =>
                    openChatbot(
                      `Tell me everything about ${predictionResult?.prediction || 'this disease'} in ${predictionResult?.cropName || 'this crop'} — causes, how to treat it, prevent it, and any organic remedies I can use.`
                    )
                  }
                  className="w-full mt-2 py-3.5 px-6 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-violet-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-600 shadow-lg hover:shadow-violet-300/60 transition-all active:scale-[0.98] flex items-center justify-center gap-2.5"
                >
                  <Sprout size={20} />
                  <span>Ask AI Assistant for detailed guidance</span>
                  <ArrowRight size={20} />
                </button>
              </div>
            )}

          </div>
        )}

        {/* ── Previous Reports Toggle ─────────────────────────────────── */}
        {!predictionResult && (
          <div className="text-center mb-4">
            <button
              onClick={() => setShowPreviousTests(prev => !prev)}
              className={`inline-flex items-center gap-2 ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-green-700 hover:text-green-900'} font-semibold underline underline-offset-4 transition-colors text-sm`}
            >
              <History size={16} />
              {showPreviousTests ? t('Hide Previous Reports') : t('View Previous Reports')}
              {reports.length > 0 && (
                <span className="bg-green-600 text-white text-xs rounded-full px-2 py-0.5 no-underline ml-1">
                  {reports.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* ── Previous Reports List ───────────────────────────────────── */}
        {showPreviousTests && (
          <div className={`${cardBg} rounded-3xl shadow-xl p-6 fade-up`}>
            <h3 className={`text-lg font-bold ${textH} mb-5 flex items-center gap-2`}>
              <History size={20} className="text-green-600" /> {t('Disease Detection History')}
            </h3>

            {loadingReports ? (
              <div className="flex items-center justify-center py-10">
                <RotateCcw className="spin w-8 h-8 text-green-600" />
                <span className="ml-3 text-gray-500">{t('Loading reports...')}</span>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-10">
                <div className="flex justify-center mb-3">
                  <Sprout size={48} className="text-gray-200" />
                </div>
                <p className="text-gray-500">{t('No reports yet. Detect your first crop disease above!')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => {
                  const isHealthy = report.prediction?.toLowerCase().includes('healthy');
                  const cropMeta = CROPS.find(c => c.id?.toLowerCase() === report.cropName?.toLowerCase());
                  return (
                    <div
                      key={report._id}
                      className={`flex gap-4 items-start p-4 rounded-2xl border ${isHealthy
                        ? (isDark ? 'border-green-700/30 bg-green-900/10' : 'border-green-200 bg-green-50')
                        : (isDark ? 'border-red-700/30 bg-red-900/10' : 'border-red-200 bg-red-50')
                        }`}
                    >
                      {/* Crop image */}
                      {report.imageURL && (
                        <img
                          src={report.imageURL}
                          alt={report.cropName}
                          className="w-16 h-16 rounded-xl object-cover shadow flex-shrink-0"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isHealthy ? 'bg-green-200' : 'bg-red-200'}`}>
                            {cropMeta?.icon ? <cropMeta.icon size={18} className={isHealthy ? 'text-green-700' : 'text-red-700'} /> : <Sprout size={18} className="text-gray-400" />}
                          </div>
                          <span className={`font-bold ${textH}`}>{t(report.cropName)}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isHealthy
                            ? (isDark ? 'bg-green-600/20 text-green-400' : 'bg-green-200 text-green-800')
                            : (isDark ? 'bg-red-600/20 text-red-400' : 'bg-red-200 text-red-800')
                            }`}>
                            {isHealthy ? t('Healthy') : t('Disease Detected')}
                          </span>
                        </div>
                        <p className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{report.prediction}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t('Confidence')}: <strong>{report.confidence}%</strong>
                          </span>
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {new Date(report.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteReport(report._id)}
                        disabled={deletingId === report._id}
                        className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 flex-shrink-0"
                        title={t('Delete report')}
                      >
                        {deletingId === report._id ? (
                          <RotateCcw size={16} className="spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>


      <AIKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
      />

      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        t={t}
        onCapture={(file) => {
          handleImageFile(file);
        }}
      />
    </div>
  );
};

// ── Real Camera Capability Modal ─────────────────────────────────────────────
const CameraModal = ({ isOpen, onClose, onCapture, t }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (isOpen) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1080 },
          height: { ideal: 1080 }
        }
      };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
        setIsActive(true);
      }
    } catch (err) {
      alert("Camera access denied or not available. " + err.message);
      onClose();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsActive(false);
    }
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Match canvas to video resolution
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      onClose();
    }, 'image/jpeg', 0.9);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col">
        {/* Viewfinder */}
        <div className="relative flex-1 bg-gray-900 overflow-hidden flex items-center justify-center min-h-[400px]">
          {!isActive && <RotateCcw className="spin text-emerald-500 w-12 h-12" />}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Guide lines */}
          <div className="absolute inset-0 pointer-events-none border-2 border-emerald-500/20 rounded-3xl m-10" />
          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-emerald-500/10 pointer-events-none" />
          <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-emerald-500/10 pointer-events-none" />
        </div>

        {/* Controls */}
        <div className="p-8 bg-gradient-to-t from-black to-gray-900 flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all font-bold"
          >
            <X size={24} />
          </button>

          <button
            onClick={captureFrame}
            className="w-20 h-20 rounded-full bg-white p-1.5 shadow-xl hover:scale-110 active:scale-95 transition-all"
          >
            <div className="w-full h-full rounded-full border-4 border-gray-900 flex items-center justify-center bg-emerald-600">
              <Camera size={32} className="text-white" />
            </div>
          </button>

          <div className="w-12 h-12" /> {/* Spacer */}
        </div>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 whitespace-nowrap">
          <p className="text-xs text-white font-bold uppercase tracking-widest">{t('Focus on Crop Leaf')}</p>
        </div>
      </div>
    </div>
  );
};

export default DiseaseDetection;
