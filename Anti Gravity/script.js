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

let gestureRecognizer;
let runningMode = "VIDEO";
let lastVideoTime = -1;

const getIconElement = (name) => {
  const i = document.createElement('i');
  i.style.width = '48px';
  i.style.height = '48px';
  i.style.color = '#f8fafc';
  
  switch(name) {
    case 'Closed_Fist': i.setAttribute('data-lucide', 'hand'); break;
    case 'Open_Palm': i.setAttribute('data-lucide', 'hand'); break;
    case 'Pointing_Up': i.setAttribute('data-lucide', 'navigation'); break;
    case 'Thumb_Down': i.setAttribute('data-lucide', 'thumbs-down'); break;
    case 'Thumb_Up': i.setAttribute('data-lucide', 'thumbs-up'); break;
    case 'Victory': i.setAttribute('data-lucide', 'hand-metal'); break;
    case 'ILoveYou': i.setAttribute('data-lucide', 'heart'); break;
    case 'Infinite_Void': i.setAttribute('data-lucide', 'eye'); i.style.color = '#a855f7'; break;
    case 'Divine_Dog': i.setAttribute('data-lucide', 'dog'); i.style.color = '#3b82f6'; break;
    case 'Finger_Heart': i.setAttribute('data-lucide', 'heart-handshake'); i.style.color = '#ec4899'; break;
    case 'Shaka': i.setAttribute('data-lucide', 'waves'); i.style.color = '#eab308'; break;
    case 'Spiderman': i.setAttribute('data-lucide', 'spider'); i.style.color = '#ef4444'; break;
    case 'Vulcan_Salute': i.setAttribute('data-lucide', 'zap'); i.style.color = '#06b6d4'; break;
    case 'Tiger_Seal': i.setAttribute('data-lucide', 'flame'); i.style.color = '#f97316'; break;
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
    gestureNameDisplay.innerText = gesture.name.replace('_', ' ');
    iconWrapper.classList.add('active');
    
    // Default success color
    let barColor = 'var(--success)';
    iconWrapper.className = 'gesture-icon-wrapper active';

    // Custom glowing styles
    if (gesture.name === 'Infinite_Void') {
      iconWrapper.classList.add('domain-gojo');
      barColor = '#a855f7';
    } else if (gesture.name === 'Divine_Dog') {
      iconWrapper.classList.add('domain-megumi');
      barColor = '#3b82f6';
    } else if (gesture.name === 'Finger_Heart') {
      iconWrapper.classList.add('genz-heart');
      barColor = '#ec4899';
    } else if (gesture.name === 'Shaka') {
      iconWrapper.classList.add('genz-shaka');
      barColor = '#eab308';
    } else if (gesture.name === 'Spiderman') {
      iconWrapper.classList.add('pop-spiderman');
      barColor = '#ef4444';
    } else if (gesture.name === 'Vulcan_Salute') {
      iconWrapper.classList.add('pop-vulcan');
      barColor = '#06b6d4';
    } else if (gesture.name === 'Tiger_Seal') {
      iconWrapper.classList.add('anime-tiger');
      barColor = '#f97316';
    }

    confidenceBar.style.backgroundColor = barColor;

    iconWrapper.innerHTML = '';
    iconWrapper.appendChild(getIconElement(gesture.name));
    lucide.createIcons();
    
    confidenceDetails.style.display = 'block';
    confidenceScore.innerText = gesture.score;
    confidenceBar.style.width = gesture.score + '%';
    handednessText.innerText = gesture.handedness;
  }
};

// ---------------------------------------------------------
// CUSTOM HEURISTICS ENGINE
// ---------------------------------------------------------
const dist = (p1, p2) => Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2);

function checkCustomSigns(landmarksList) {
  if (!landmarksList || landmarksList.length === 0) return null;

  // Single hand signs
  for (const hand of landmarksList) {
    const isIndexExtended = hand[8].y < hand[6].y;
    const isMiddleExtended = hand[12].y < hand[10].y;
    const isRingExtended = hand[16].y < hand[14].y;
    const isPinkyExtended = hand[20].y < hand[18].y;

    const isIndexClosed = !isIndexExtended;
    const isMiddleClosed = !isMiddleExtended;
    const isRingClosed = !isRingExtended;
    const isPinkyClosed = !isPinkyExtended;
    
    // 1. Infinite Void (Gojo Satoru)
    const tipsCrossed = (hand[8].x - hand[12].x) * (hand[5].x - hand[9].x) < -0.001;
    if (isIndexExtended && isMiddleExtended && isRingClosed && isPinkyClosed && tipsCrossed) {
      return { name: 'Infinite_Void', score: 100, handedness: 'Domain Expansion' };
    }

    // 2. Finger Heart (Gen Z)
    const thumbIndexClose = dist(hand[4], hand[8]) < 0.08;
    if (thumbIndexClose && isMiddleClosed && isRingClosed && isPinkyClosed) {
      return { name: 'Finger_Heart', score: 100, handedness: 'Gen Z Energy' };
    }

    // 3. Shaka / Hang Loose
    const wideSpread = dist(hand[4], hand[20]) > 0.15;
    if (isIndexClosed && isMiddleClosed && isRingClosed && isPinkyExtended && wideSpread) {
      return { name: 'Shaka', score: 100, handedness: 'Gen Z Energy' };
    }

    // 4. Spiderman Web Shooter
    if (isIndexExtended && isMiddleClosed && isRingClosed && isPinkyExtended) {
      return { name: 'Spiderman', score: 100, handedness: 'Pop Culture' };
    }

    // 5. Vulcan Salute (Star Trek)
    const indexMiddleClose = dist(hand[8], hand[12]) < 0.06;
    const ringPinkyClose = dist(hand[16], hand[20]) < 0.06;
    const middleRingGap = dist(hand[12], hand[16]) > 0.07;
    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended && indexMiddleClose && ringPinkyClose && middleRingGap) {
      return { name: 'Vulcan_Salute', score: 100, handedness: 'Pop Culture' };
    }
  }

  // Dual hand signs
  if (landmarksList.length === 2) {
    const hand1 = landmarksList[0];
    const hand2 = landmarksList[1];

    // Check Megumi
    const thumbsTouching = dist(hand1[4], hand2[4]) < 0.1;
    const indexTouching = dist(hand1[8], hand2[8]) < 0.1;
    const h1IndexExtended = hand1[8].y < hand1[6].y;
    const h2IndexExtended = hand2[8].y < hand2[6].y;
    const othersCurled = (hand1[12].y > hand1[10].y || hand2[12].y > hand2[10].y);

    if (thumbsTouching && indexTouching && h1IndexExtended && h2IndexExtended && othersCurled) {
      return { name: 'Divine_Dog', score: 100, handedness: 'Ten Shadows' };
    }

    // Tiger Seal (Naruto)
    const h1MiddleExtended = hand1[12].y < hand1[10].y;
    const h2MiddleExtended = hand2[12].y < hand2[10].y;
    const wristsClose = dist(hand1[0], hand2[0]) < 0.2;
    // index and middle extended together
    if (h1IndexExtended && h2IndexExtended && h1MiddleExtended && h2MiddleExtended && wristsClose && othersCurled) {
      return { name: 'Tiger_Seal', score: 100, handedness: 'Ninjutsu' };
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

    // 1. Check custom Heuristics FIRST
    const customSign = checkCustomSigns(results.landmarks);

    if (customSign) {
      updateUI(customSign);
    } 
    // 2. Fallback to standard ML Model Gestures
    else if (results.gestures.length > 0 && results.gestures[0].length > 0) {
      let bestGesture = results.gestures[0][0];
      let bestHandedness = results.handednesses[0][0].displayName;

      if (results.gestures.length > 1 && results.gestures[1].length > 0) {
        if (results.gestures[1][0].score > bestGesture.score) {
          bestGesture = results.gestures[1][0];
          bestHandedness = results.handednesses[1][0].displayName;
        }
      }

      // Sometimes Victory can be misidentified as Vulcan, 
      // but heuristics run first so we're good.
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

  window.requestAnimationFrame(predictWebcam);
}

init();
