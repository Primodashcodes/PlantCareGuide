/* =========================================================
   Plant Care Guide — Application Logic
   Team: Plant Care Guide | BSIT-2D | A.Y. 2025-2026
   SDG 15: Life on Land
   =========================================================
   HOW TO SET YOUR GEMINI API KEY:
   1. Go to https://aistudio.google.com/apikey
   2. Create a new key
   3. Paste it in the Identify tab inside the app
      OR replace the empty string below:

   const HARDCODED_KEY = 'YOUR_KEY_HERE';
   ========================================================= */

// ─────────────────────────────────────────────────────────
// OPTIONAL: Hard-code your key here so you never have to type it
// Leave empty '' to use the input box in the app instead
// ─────────────────────────────────────────────────────────
const HARDCODED_KEY = 'AIzaSyDVyuECNEEDuw6xV7HL2ALu-H_0c1Ztev8';

// ─────────────────────────────────────────────────────────
// GEMINI MODEL — gemini-2.5-flash is the current free model (2026)
// gemini-1.5 and gemini-2.0 are already SHUT DOWN (404 error)
// ─────────────────────────────────────────────────────────
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// =========================================================
// STATE
// =========================================================
let plants          = [];
let currentFilter   = 'All';
let currentCatFilter= 'All';
let cameraStream    = null;
let capturedB64     = null;
let currentPage     = 'browse';

// API key: priority → hardcoded → localStorage → input box
function getApiKey() {
  if (HARDCODED_KEY) return HARDCODED_KEY;
  return localStorage.getItem('pcg_gemini_key') || '';
}

// =========================================================
// INIT — runs on page load
// =========================================================
async function init() {
  // Load plant data — try JSON file first, fall back to embedded data
  try {
    const res = await fetch('plants.json');
    if (!res.ok) throw new Error('fetch failed');
    plants = await res.json();
  } catch {
    plants = window.PLANTS_DATA || [];
  }

  renderPlants(plants);
  document.getElementById('totalCount').textContent = plants.length;
  document.getElementById('shownCount').textContent = plants.length;

  // Restore saved API key into the input box
  const saved = getApiKey();
  if (saved) {
    const inp = document.getElementById('geminiApiKey');
    if (inp) inp.value = saved;
    // Hide the API key warning box if key exists
    hideApiKeyBox();
  }
}

// =========================================================
// PAGE NAVIGATION
// =========================================================
function showPage(page) {
  currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));

  const pages = ['browse', 'scan', 'location', 'about'];
  const idx = pages.indexOf(page);
  if (idx >= 0) {
    document.querySelectorAll('.nav-btn')[idx]?.classList.add('active');
    document.querySelectorAll('.mobile-nav-btn')[idx]?.classList.add('active');
  }

  const hero = document.getElementById('heroSection');
  if (hero) hero.style.display = page === 'browse' ? '' : 'none';

  // Stop camera when leaving scan page
  if (page !== 'scan' && cameraStream) stopCamera();
}

// =========================================================
// PLANT BROWSE
// =========================================================
function renderPlants(list) {
  const grid = document.getElementById('plantGrid');
  const noResults = document.getElementById('noResults');
  document.getElementById('shownCount').textContent = list.length;

  if (list.length === 0) {
    grid.innerHTML = '';
    noResults.classList.add('visible');
    return;
  }
  noResults.classList.remove('visible');

  grid.innerHTML = list.map(p => `
    <div class="plant-card" onclick="openModal(${p.id})">
      <div class="plant-card-header">
        <span class="plant-emoji">${p.emoji}</span>
        <span class="difficulty-badge ${p.difficulty}">${p.difficulty}</span>
      </div>
      <div class="plant-card-body">
        <div class="plant-card-name">${p.name}</div>
        <div class="plant-card-scientific">${p.scientific}</div>
        <span class="plant-card-cat">${p.category}</span>
        <div class="plant-card-desc">${p.description}</div>
        <div class="plant-card-location">📍 ${p.location}</div>
      </div>
    </div>
  `).join('');
}

function filterPlants() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const filtered = plants.filter(p => {
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.scientific.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q)) ||
      p.location.toLowerCase().includes(q);

    const matchDiff = currentFilter === 'All' || p.difficulty === currentFilter;
    const matchCat  = currentCatFilter === 'All' ||
      p.category === currentCatFilter ||
      (currentCatFilter === 'Indoor' && p.tags.includes('indoor'));

    return matchSearch && matchDiff && matchCat;
  });
  renderPlants(filtered);
}

function setFilter(val, el) {
  currentFilter = val;
  currentCatFilter = 'All';
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  filterPlants();
}

function setCatFilter(val, el) {
  currentCatFilter = val;
  currentFilter = 'All';
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  filterPlants();
}

// =========================================================
// MODAL
// =========================================================
function openModal(id) {
  const p = plants.find(x => x.id === id);
  if (!p) return;

  document.getElementById('modalEmoji').textContent = p.emoji;
  document.getElementById('modalName').textContent = p.name;
  document.getElementById('modalScientific').textContent = p.scientific;
  document.getElementById('modalDesc').textContent = p.description;

  document.getElementById('modalBadges').innerHTML = `
    <span class="plant-card-cat">${p.category}</span>
    <span class="difficulty-badge ${p.difficulty}" style="position:static;">${p.difficulty}</span>
    ${p.climate.map(c => `<span class="climate-tag">🌍 ${c}</span>`).join('')}
  `;

  const icons = { water:'💧', sunlight:'☀️', soil:'🪴', fertilizer:'🌱', temperature:'🌡️' };
  document.getElementById('modalCareGrid').innerHTML = Object.entries(p.care).map(([k, v]) => `
    <div class="care-item">
      <div class="care-item-label">${icons[k] || '•'} ${k}</div>
      <div class="care-item-value">${v}</div>
    </div>
  `).join('');

  document.getElementById('modalTags').innerHTML = p.tags.map(t => `<span class="tag">#${t}</span>`).join('');
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// =========================================================
// API KEY
// =========================================================
function saveApiKey() {
  const val = document.getElementById('geminiApiKey').value.trim();
  if (val) {
    localStorage.setItem('pcg_gemini_key', val);
    hideApiKeyBox();
  }
}

function hideApiKeyBox() {
  // Only hide the warning banner, keep the input accessible
  const box = document.getElementById('apiKeyWrap');
  if (box) box.classList.remove('warning');
}

// =========================================================
// CAMERA
// =========================================================
async function toggleCamera() {
  if (cameraStream) { stopCamera(); return; }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    cameraStream = stream;
    const video = document.getElementById('liveVideo');
    video.srcObject = stream;
    video.style.display = 'block';
    document.getElementById('capturedImg').style.display = 'none';
    document.getElementById('camPlaceholder').style.display = 'none';
    document.getElementById('cameraBtn').innerHTML = '⏹ Stop Camera';
    document.getElementById('snapBtn').style.display = 'inline-flex';
    resetScanResult();
  } catch (err) {
    showError('Camera access denied. Please allow camera permission or use Upload Image instead.\n\nError: ' + err.message);
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  const video = document.getElementById('liveVideo');
  video.srcObject = null;
  video.style.display = 'none';
  document.getElementById('cameraBtn').innerHTML = '📷 Open Camera';
  document.getElementById('snapBtn').style.display = 'none';
  if (!capturedB64) {
    document.getElementById('camPlaceholder').style.display = 'flex';
  }
}

function snapPhoto() {
  const video  = document.getElementById('liveVideo');
  const canvas = document.getElementById('snapCanvas');
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0);

  // Use JPEG quality 0.9 for better recognition
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  capturedB64 = dataUrl.split(',')[1];

  const img = document.getElementById('capturedImg');
  img.src = dataUrl;
  img.style.display = 'block';
  video.style.display = 'none';

  stopCamera();
  callGemini(capturedB64, 'image/jpeg');
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Detect mime type from file
  const mime = file.type || 'image/jpeg';

  const reader = new FileReader();
  reader.onload = ev => {
    const dataUrl = ev.target.result;
    capturedB64 = dataUrl.split(',')[1];

    const img = document.getElementById('capturedImg');
    img.src = dataUrl;
    img.style.display = 'block';
    document.getElementById('camPlaceholder').style.display = 'none';
    document.getElementById('liveVideo').style.display = 'none';

    stopCamera();
    callGemini(capturedB64, mime);
  };
  reader.readAsDataURL(file);
  e.target.value = ''; // Reset so same file can be re-uploaded
}

// =========================================================
// GEMINI AI IDENTIFICATION
// =========================================================
function resetScanResult() {
  document.getElementById('geminiLoading').classList.remove('visible');
  document.getElementById('geminiResult').classList.remove('visible');
  document.getElementById('geminiNotFound').classList.remove('visible');
  document.getElementById('dbMatchBanner').classList.remove('visible');
}

async function callGemini(base64, mimeType) {
  // ── 1. Get API key ──────────────────────────────────────
  let apiKey = HARDCODED_KEY ||
               document.getElementById('geminiApiKey').value.trim() ||
               localStorage.getItem('pcg_gemini_key') || '';

  if (!apiKey) {
    // Flash the API key box red to tell user to enter key
    const box = document.getElementById('apiKeyWrap');
    box.classList.add('warning');
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showError('⚠️ Please enter your Gemini API key first!\n\nGet a free key at: aistudio.google.com/apikey');
    return;
  }

  // ── 2. Show loading ─────────────────────────────────────
  resetScanResult();
  document.getElementById('geminiLoading').classList.add('visible');

  // ── 3. Build prompt ─────────────────────────────────────
  const prompt = `You are an expert botanist and plant identification AI.
Analyze the provided image carefully and identify the plant.

Respond ONLY with a valid JSON object. No markdown, no code fences, no extra text.

If a plant is clearly visible, use this format:
{"found":true,"name":"Common Name","scientific":"Genus species","emoji":"🌿","description":"2-3 sentence description.","water":"Watering care instructions.","sunlight":"Light requirements.","soil":"Soil type needed.","care_tip":"One practical care tip.","interesting_fact":"One interesting fact about this plant."}

If no plant is visible or you cannot identify it:
{"found":false,"reason":"Brief explanation."}`;

  // ── 4. Call Gemini API ──────────────────────────────────
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } }
          ]
        }],
        generationConfig: {
          temperature:     0.1,
          maxOutputTokens: 1024,
          responseMimeType: 'text/plain'
        }
      })
    });

    // ── 5. Handle HTTP errors ───────────────────────────
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody?.error?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    // ── 6. Parse response ───────────────────────────────
    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!rawText) throw new Error('Empty response from Gemini. Try a clearer photo.');

    // Strip markdown fences if model wrapped it anyway
    const clean = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch {
      // Try to extract JSON from within the text
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Gemini returned unreadable format. Please try again.');
      }
    }

    // ── 7. Display result ───────────────────────────────
    document.getElementById('geminiLoading').classList.remove('visible');

    if (!result.found) {
      document.getElementById('geminiNotFound').classList.add('visible');
      document.getElementById('notFoundMsg').textContent =
        result.reason || 'Could not identify the plant. Try a clearer, closer photo.';
      return;
    }

    // Show result card
    document.getElementById('geminiResult').classList.add('visible');
    document.getElementById('resultEmoji').textContent     = result.emoji || '🌿';
    document.getElementById('resultName').textContent      = result.name;
    document.getElementById('resultScientific').textContent= result.scientific;
    document.getElementById('resultBody').innerHTML = `
      <p>${result.description}</p>
      <p><strong>💧 Water:</strong> ${result.water}</p>
      <p><strong>☀️ Sunlight:</strong> ${result.sunlight}</p>
      <p><strong>🪴 Soil:</strong> ${result.soil}</p>
      <p><strong>💡 Care Tip:</strong> ${result.care_tip}</p>
      <p><strong>✨ Fun Fact:</strong> ${result.interesting_fact}</p>
    `;

    // ── 8. Check local database match ──────────────────
    const q = result.name.toLowerCase();
    const qs = (result.scientific || '').toLowerCase().split(' ')[0];
    const dbMatch = plants.find(p =>
      p.name.toLowerCase().includes(q) ||
      q.includes(p.name.toLowerCase()) ||
      (qs && p.scientific.toLowerCase().includes(qs))
    );

    if (dbMatch) {
      document.getElementById('dbMatchBanner').classList.add('visible');
      document.getElementById('dbMatchDesc').textContent =
        `"${dbMatch.name}" is in our Plant Directory! Tap below for the full care guide.`;
      document.getElementById('dbMatchBtn').onclick = () => {
        showPage('browse');
        setTimeout(() => openModal(dbMatch.id), 150);
      };
    }

  } catch (err) {
    document.getElementById('geminiLoading').classList.remove('visible');
    document.getElementById('geminiNotFound').classList.add('visible');
    document.getElementById('notFoundMsg').textContent = '❌ ' + err.message;
  }
}

function showError(msg) {
  alert(msg);
}

// =========================================================
// GEOLOCATION
// =========================================================
function getLocation() {
  if (!navigator.geolocation) {
    document.getElementById('locationStatus').textContent = '❌ Geolocation is not supported by your browser.';
    return;
  }
  document.getElementById('locationStatus').textContent = '🔄 Detecting your location…';

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const climate = getClimateZone(lat, lon);

      document.getElementById('locationStatus').textContent = '✅ Location detected!';
      document.getElementById('locCoords').textContent  = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
      document.getElementById('locRegion').textContent  = climate.region;
      document.getElementById('locClimate').textContent = climate.zone;
      document.getElementById('locationInfo').classList.add('visible');

      const suitable = plants.filter(p => p.climate.some(c => climate.matches.includes(c)));
      const top = suitable.slice(0, 12);

      document.getElementById('suggestedSection').style.display = 'block';
      document.getElementById('suggestedList').innerHTML = top.map(p => `
        <div class="suggested-item" onclick="showPage('browse'); setTimeout(() => openModal(${p.id}), 150)">
          <div class="suggested-item-emoji">${p.emoji}</div>
          <div>
            <div class="suggested-item-name">${p.name}</div>
            <div class="suggested-item-cat">${p.category} · ${p.difficulty}</div>
          </div>
        </div>
      `).join('');
    },
    err => {
      document.getElementById('locationStatus').textContent = '❌ ' + err.message;
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

function getClimateZone(lat, lon) {
  // Philippines check
  if (lat >= 4 && lat <= 21 && lon >= 116 && lon <= 127)
    return { zone: 'Tropical 🌴', region: 'Philippines', matches: ['Tropical'] };

  const a = Math.abs(lat);
  if (a <= 10) return { zone: 'Tropical 🌴',         region: 'Equatorial',      matches: ['Tropical'] };
  if (a <= 25) return { zone: 'Subtropical 🌞',      region: 'Subtropical Belt', matches: ['Tropical','Subtropical'] };
  if (a <= 35) return { zone: 'Warm Temperate 🌤',   region: 'Warm Temperate',   matches: ['Subtropical','Mediterranean','Temperate'] };
  if (a <= 50) return { zone: 'Temperate 🌿',        region: 'Temperate Zone',   matches: ['Temperate','Mediterranean'] };
  if (a <= 60) return { zone: 'Cool Temperate ❄️',   region: 'Cool Temperate',   matches: ['Temperate','Cold'] };
  return       { zone: 'Cold / Subarctic 🧊',        region: 'Cold Region',      matches: ['Cold'] };
}

// =========================================================
// START
// =========================================================
document.addEventListener('DOMContentLoaded', init);
