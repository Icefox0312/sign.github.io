import { GestureRecognizer, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js";

// Initialize lucide icons
lucide.createIcons();

const video = document.getElementById("videoFeed");
const canvas = document.getElementById("canvasOverlay");
const canvasCtx = canvas.getContext("2d");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");
const iconWrapper = document.getElementById("iconWrapper");
const gestureNameDisplay = document.getElementById("gestureName");
const confidenceDetails = document.getElementById("confidenceDetails");
const confidenceScore = document.getElementById("confidenceScore");
const confidenceBar = document.getElementById("confidenceBar");
const handednessText = document.getElementById("handednessText");

// UI Elements for Custom Sign Builder
const signNameInput = document.getElementById("signNameInput");
const captureBtn = document.getElementById("captureBtn");
const savedSignsList = document.getElementById("savedSignsList");
const savedCount = document.getElementById("savedCount");
const clearAllBtn = document.getElementById("clearAllBtn");

let gestureRecognizer;
let runningMode = "VIDEO";
let lastVideoTime = -1;
let currentLandmarks = null; // Store latest landmarks for saving

// ---------------------------------------------------------
// CUSTOM SIGN BUILDER LOGIC (LOCAL STORAGE & ML TEMPLATE MATCHING)
// ---------------------------------------------------------

// Load custom signs from local storage
let customSignTemplates = JSON.parse(localStorage.getItem('customSigns')) || [];

function saveTemplatesToStorage() {
  localStorage.setItem('customSigns', JSON.stringify(customSignTemplates));
  renderSavedSigns();
}

function renderSavedSigns() {
  savedSignsList.innerHTML = '';
  savedCount.innerText = customSignTemplates.length;
  if (customSignTemplates.length > 0) {
    clearAllBtn.style.display = 'block';
  } else {
    clearAllBtn.style.display = 'none';
  }

  customSignTemplates.forEach((template, index) => {
    const chip = document.createElement('div');
    chip.className = 'saved-sign-chip';
    chip.innerHTML = `
      ${template.name}
      <span class="delete-btn" data-index="${index}">×</span>
    `;
    savedSignsList.appendChild(chip);
  });

  // Attach delete handlers
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-index');
      customSignTemplates.splice(idx, 1);
      saveTemplatesToStorage();
    });
  });
}

// Initial render
renderSavedSigns();

clearAllBtn.addEventListener('click', () => {
  if (confirm("Delete all your custom signs?")) {
    customSignTemplates = [];
    saveTemplatesToStorage();
  }
});

// Normalizes a hand using the stable palm size (wrist to middle finger base)
function normalizeHand(hand) {
  const wrist = hand[0];
  const middleBase = hand[9];
  
  // Use palm size for scaling, as it stays constant whether fingers are open or closed
  let palmSize = Math.sqrt(
    (middleBase.x - wrist.x)**2 + 
    (middleBase.y - wrist.y)**2 + 
    (middleBase.z - wrist.z)**2
  );
  if (palmSize === 0) palmSize = 0.1;
  
  const translated = hand.map(p => ({
    x: p.x - wrist.x,
    y: p.y - wrist.y,
    z: p.z - wrist.z
  }));

  return translated.map(p => ({
    x: p.x / palmSize,
    y: p.y / palmSize,
    z: p.z / palmSize
  }));
}

// Compare two normalized hands and return average point distance (lower is better)
function compareNormalizedHands(hand1, hand2) {
  let sum = 0;
  for (let i = 0; i < 21; i++) {
    const dx = hand1[i].x - hand2[i].x;
    const dy = hand1[i].y - hand2[i].y;
    const dz = hand1[i].z - hand2[i].z;
    sum += Math.sqrt(dx*dx + dy*dy + dz*dz);
  }
  return sum / 21; // Average error per landmark
}

captureBtn.addEventListener('click', () => {
  const name = signNameInput.value.trim();
  if (!name) {
    alert("Please enter a name for your sign!");
    return;
  }

  // Disable button and start countdown
  captureBtn.disabled = true;
  let secondsLeft = 5;
  captureBtn.innerText = `Recording in ${secondsLeft}...`;
  captureBtn.style.background = "#f59e0b"; // yellow warning color

  const countdownInterval = setInterval(() => {
    secondsLeft--;
    if (secondsLeft > 0) {
      captureBtn.innerText = `Recording in ${secondsLeft}...`;
    } else {
      clearInterval(countdownInterval);
      
      // Capture the current landmarks at this exact moment
      if (!currentLandmarks || currentLandmarks.length === 0) {
        alert("No hand detected! Sign not saved.");
        captureBtn.innerText = "Save Sign";
        captureBtn.style.background = "var(--accent)";
        captureBtn.disabled = false;
        return;
      }

      const normalizedHand = normalizeHand(currentLandmarks[0]);
      
      customSignTemplates.push({
        name: name,
        handData: normalizedHand
      });

      saveTemplatesToStorage();
      signNameInput.value = '';
      
      // Visual feedback
      captureBtn.innerText = "Saved!";
      captureBtn.style.background = "var(--success)";
      
      setTimeout(() => {
        captureBtn.innerText = "Save Sign";
        captureBtn.style.background = "var(--accent)";
        captureBtn.disabled = false;
      }, 2000);
    }
  }, 1000);
});

// Real-time custom template matcher
function findClosestCustomSign(landmarksList) {
  if (customSignTemplates.length === 0 || !landmarksList || landmarksList.length === 0) return null;

  // Since we normalize by palm size, an error of 0.4 means each joint is off by 40% of the palm size on average
  const MATCH_THRESHOLD = 0.35; 
  
  let bestMatch = null;
  let bestDist = Infinity;

  for (const hand of landmarksList) {
    const normHand = normalizeHand(hand);
    
    for (const template of customSignTemplates) {
      const dist = compareNormalizedHands(normHand, template.handData);
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = template.name;
      }
    }
  }

  if (bestDist < MATCH_THRESHOLD) {
    // Score based on distance (0 dist = 100%, MATCH_THRESHOLD dist = 60%)
    let score = Math.max(0, 100 - (bestDist / MATCH_THRESHOLD) * 40);
    return { name: bestMatch, score: score.toFixed(0), handedness: 'Custom Sign', isCustom: true };
  }

  return null;
}

// ---------------------------------------------------------

const getIconElement = (name, isCustom = false) => {
  const i = document.createElement('i');
  i.style.width = '48px';
  i.style.height = '48px';
  i.style.color = '#f8fafc';
  
  if (isCustom) {
    i.setAttribute('data-lucide', 'star'); 
    i.style.color = '#6366f1'; // Indigo for custom signs
    return i;
  }

  switch(name) {
    case 'Finger_Heart': i.setAttribute('data-lucide', 'heart-handshake'); i.style.color = '#ec4899'; break;
    case 'Shaka': i.setAttribute('data-lucide', 'waves'); i.style.color = '#eab308'; break;
    case 'The_L': i.setAttribute('data-lucide', 'frown'); i.style.color = '#ef4444'; break;
    case 'Middle_Finger': i.setAttribute('data-lucide', 'flame'); i.style.color = '#b91c1c'; break;
    case 'Crossed_Fingers': i.setAttribute('data-lucide', 'sparkles'); i.style.color = '#a855f7'; break;
    case 'Gun': i.setAttribute('data-lucide', 'target'); i.style.color = '#f97316'; break;
    case 'Two_Handed_Heart': i.setAttribute('data-lucide', 'heart'); i.style.color = '#db2777'; break;
    case 'OK_Sign': i.setAttribute('data-lucide', 'check-circle'); i.style.color = '#10b981'; break;
    case 'Closed_Fist': i.setAttribute('data-lucide', 'hand'); break;
    case 'Open_Palm': i.setAttribute('data-lucide', 'hand'); break;
    case 'Victory': i.setAttribute('data-lucide', 'hand-metal'); break;
    case 'ILoveYou': i.setAttribute('data-lucide', 'heart'); break;
    default: i.setAttribute('data-lucide', 'x-circle'); i.style.color = '#94a3b8'; break;
  }
  return i;
};

const updateUI = (gesture) => {
  if (gesture.name === 'None') {
    gestureNameDisplay.innerText = "Waiting...";
    iconWrapper.classList.remove('active');
    iconWrapper.className = 'gesture-icon-wrapper';
    iconWrapper.innerHTML = '';
    iconWrapper.appendChild(getIconElement('None'));
    lucide.createIcons();
    confidenceDetails.style.display = 'none';
  } else {
    gestureNameDisplay.innerText = gesture.name.replace(/_/g, ' ');
    iconWrapper.classList.add('active');
    
    let barColor = 'var(--success)';
    iconWrapper.className = 'gesture-icon-wrapper active';

    if (gesture.isCustom) {
      iconWrapper.classList.add('glow-custom');
      barColor = '#6366f1';
    } else {
      const styleMap = {
        'Finger_Heart': { cls: 'glow-pink', color: '#ec4899' },
        'Shaka': { cls: 'glow-yellow', color: '#eab308' },
        'The_L': { cls: 'glow-red', color: '#ef4444' },
        'Middle_Finger': { cls: 'glow-darkred', color: '#b91c1c' },
        'Crossed_Fingers': { cls: 'glow-purple', color: '#a855f7' },
        'Gun': { cls: 'glow-orange', color: '#f97316' },
        'Two_Handed_Heart': { cls: 'glow-deeppink', color: '#db2777' },
        'OK_Sign': { cls: 'glow-emerald', color: '#10b981' }
      };
      if (styleMap[gesture.name]) {
        iconWrapper.classList.add(styleMap[gesture.name].cls);
        barColor = styleMap[gesture.name].color;
      }
    }

    confidenceBar.style.backgroundColor = barColor;

    iconWrapper.innerHTML = '';
    iconWrapper.appendChild(getIconElement(gesture.name, gesture.isCustom));
    lucide.createIcons();
    
    confidenceDetails.style.display = 'block';
    confidenceScore.innerText = gesture.score;
    confidenceBar.style.width = gesture.score + '%';
    handednessText.innerText = gesture.handedness;
  }
};

// ---------------------------------------------------------
// HARDCODED HEURISTICS FALLBACK
// ---------------------------------------------------------
const dist = (p1, p2) => Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2);

function checkHardcodedSigns(landmarksList) {
  if (!landmarksList || landmarksList.length === 0) return null;

  for (const hand of landmarksList) {
    // ROTATION INVARIANT FINGER EXTENSION
    // A finger is extended if its tip is further from the wrist than its PIP joint
    const isIndexExtended = dist(hand[8], hand[0]) > dist(hand[6], hand[0]);
    const isMiddleExtended = dist(hand[12], hand[0]) > dist(hand[10], hand[0]);
    const isRingExtended = dist(hand[16], hand[0]) > dist(hand[14], hand[0]);
    const isPinkyExtended = dist(hand[20], hand[0]) > dist(hand[18], hand[0]);

    const isIndexClosed = !isIndexExtended;
    const isMiddleClosed = !isMiddleExtended;
    const isRingClosed = !isRingExtended;
    const isPinkyClosed = !isPinkyExtended;

    const thumbIndexDist = dist(hand[4], hand[8]);

    // 1. Finger Heart (Thumb/Index touching, others closed)
    if (thumbIndexDist < 0.08 && isMiddleClosed && isRingClosed && isPinkyClosed) {
      // Ensure it's not a generic closed fist
      if (dist(hand[8], hand[0]) > 0.1) return { name: 'Finger_Heart', score: 100, handedness: 'Gen Z Built-in' };
    }
    
    // 2. OK Sign
    if (thumbIndexDist < 0.06 && isMiddleExtended && isRingExtended && isPinkyExtended) {
      return { name: 'OK_Sign', score: 100, handedness: 'Gen Z Built-in' };
    }
    
    // 3. Shaka (Thumb/Pinky spread, middle/ring/index closed)
    if (isIndexClosed && isMiddleClosed && isRingClosed && isPinkyExtended && dist(hand[4], hand[20]) > 0.15) {
      return { name: 'Shaka', score: 100, handedness: 'Gen Z Built-in' };
    }
    
    // 4. Middle Finger
    if (isIndexClosed && isMiddleExtended && isRingClosed && isPinkyClosed) {
      return { name: 'Middle_Finger', score: 100, handedness: 'Gen Z Built-in' };
    }
    
    // 5. Crossed Fingers (Index/Middle extended and touching tightly)
    if (isIndexExtended && isMiddleExtended && isRingClosed && isPinkyClosed && dist(hand[8], hand[12]) < 0.03) {
      return { name: 'Crossed_Fingers', score: 100, handedness: 'Gen Z Built-in' };
    }
    
    // 6. The L (Index pointing UP, Thumb SIDEWAYS)
    // We use explicit Y/X orientation here because L and Gun are physically the same hand shape!
    if (isIndexExtended && isMiddleClosed && isRingClosed && isPinkyClosed) {
      const isIndexUp = hand[8].y < hand[6].y && Math.abs(hand[8].x - hand[6].x) < 0.08;
      const isThumbSide = Math.abs(hand[4].x - hand[2].x) > Math.abs(hand[4].y - hand[2].y) && Math.abs(hand[4].x - hand[2].x) > 0.05;
      if (isIndexUp && isThumbSide) return { name: 'The_L', score: 100, handedness: 'Gen Z Built-in' };
    }
    
    // 7. Gun (Index pointing SIDEWAYS, Thumb UP)
    if (isIndexExtended && isMiddleClosed && isRingClosed && isPinkyClosed) {
      const isIndexSide = Math.abs(hand[8].x - hand[6].x) > Math.abs(hand[8].y - hand[6].y) && Math.abs(hand[8].x - hand[6].x) > 0.05;
      const isThumbUp = hand[4].y < hand[2].y && Math.abs(hand[4].x - hand[2].x) < 0.08;
      if (isIndexSide && isThumbUp) return { name: 'Gun', score: 100, handedness: 'Gen Z Built-in' };
    }
  }

  if (landmarksList.length === 2) {
    const hand1 = landmarksList[0];
    const hand2 = landmarksList[1];
    
    // In a 2-handed heart, thumbs and index fingers touch, but wrists are kept apart to form the shape
    const thumbsClose = dist(hand1[4], hand2[4]) < 0.15;
    const indexClose = dist(hand1[8], hand2[8]) < 0.15;
    const wristsApart = dist(hand1[0], hand2[0]) > 0.1;

    if (thumbsClose && indexClose && wristsApart) {
      return { name: 'Two_Handed_Heart', score: 100, handedness: 'Gen Z Built-in' };
    }
  }
  return null;
}

// ---------------------------------------------------------

async function init() {
  try {
    loadingText.innerText = "Loading AI models...";
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        delegate: "GPU"
      },
      runningMode: runningMode,
      numHands: 2
    });

    loadingText.innerText = "Accessing camera...";
    enableCam();
  } catch (error) {
    console.error("Initialization error:", error);
    loadingText.innerText = "Failed to load: " + error.message;
  }
}

function enableCam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn("getUserMedia() is not supported by your browser");
    loadingText.innerText = "Camera not supported by browser";
    return;
  }

  const constraints = { video: true };
  navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", predictWebcam);
      loadingOverlay.style.display = 'none';
    })
    .catch((err) => {
      console.error("Camera access error:", err);
      loadingText.innerText = "Camera access denied or failed.";
    });
}

async function predictWebcam() {
  if (canvas.width !== video.videoWidth) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const nowInMs = Date.now();
    
    const results = gestureRecognizer.recognizeForVideo(video, nowInMs);

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    const drawingUtils = new DrawingUtils(canvasCtx);
    
    // Store latest landmarks for the capture button
    currentLandmarks = results.landmarks;

    if (results.landmarks) {
      for (const landmarks of results.landmarks) {
        drawingUtils.drawConnectors(
          landmarks,
          GestureRecognizer.HAND_CONNECTIONS,
          { color: "#3b82f6", lineWidth: 5 }
        );
        drawingUtils.drawLandmarks(landmarks, {
          color: "#10b981",
          lineWidth: 2,
          radius: 4
        });
      }
    }
    canvasCtx.restore();

    // 1. Check USER RECORDED CUSTOM SIGNS First
    const customMatch = findClosestCustomSign(results.landmarks);

    if (customMatch) {
      updateUI(customMatch);
    }
    // 2. Fallback to HARDCODED HEURISTICS
    else {
      const builtInSign = checkHardcodedSigns(results.landmarks);
      if (builtInSign) {
        updateUI(builtInSign);
      } 
      // 3. Fallback to STANDARD ML MODEL Gestures
      else if (results.gestures.length > 0 && results.gestures[0].length > 0) {
        let bestGesture = results.gestures[0][0];
        let bestHandedness = results.handednesses[0][0].displayName;

        if (results.gestures.length > 1 && results.gestures[1].length > 0) {
          if (results.gestures[1][0].score > bestGesture.score) {
            bestGesture = results.gestures[1][0];
            bestHandedness = results.handednesses[1][0].displayName;
          }
        }

        if (bestGesture.categoryName !== 'None') {
          const categoryScore = parseFloat(bestGesture.score * 100).toFixed(0);
          updateUI({
            name: bestGesture.categoryName,
            score: categoryScore,
            handedness: bestHandedness
          });
        } else {
          updateUI({ name: 'None', score: 0, handedness: '' });
        }
      } else {
        updateUI({ name: 'None', score: 0, handedness: '' });
      }
    }
  }

  window.requestAnimationFrame(predictWebcam);
}

init();
