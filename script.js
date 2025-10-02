// Nose Writing Game - Using face-api.js for reliable single-person tracking
let video;
let noseX = 0;
let noseY = 0;
// Smoothing variables
let smoothedNoseX = 0;
let smoothedNoseY = 0;
let noseHistory = [];
let maxHistoryLength = 10;
// Trail functionality
let noseTrail = [];
let isVideoReady = false;
let isModelReady = false;
let faceDetected = false;

// Face-api.js variables
let faceApiModelsLoaded = false;
let detectionInterval = null;
let currentDetections = [];

// Single person tracking with face descriptors
let trackedPersonDescriptor = null; // 128-dimension face descriptor (unique "fingerprint")
let personLocked = false;
let framesWithoutPerson = 0;
let maxFramesWithoutPerson = 60; // ~2 seconds at 30fps - balanced between temporary exit and true exit
let maxFramesOutsideCanvas = 20; // ~0.67 seconds - unlock faster if person leaves canvas boundaries
let descriptorMatchThreshold = 0.70; // Very lenient threshold for 2+ meter distance tracking
let strictDescriptorThreshold = 0.58; // Slightly lenient for relocking at distance
// Spatial tracking for canvas boundaries
let lastKnownNosePosition = null; // Track last position to detect out-of-bounds
let framesOutsideCanvas = 0; // Count frames where detected faces are outside canvas
// Mobile responsiveness variables
let isMobile = false;
let scaleFactor = 1;
let screenWidth = 0;
// Brand-based game state
let brandWords = {
    'Skintific': ['GLOWING', 'TERAWAT'],
    'Scarlett': ['KINCLONG', 'WANGI'],
    'Vaseline': ['LEMBAB', 'HALUS'],
    'FAV Beauty': ['CERAH', 'NATURAL'],
    'Xi Yaopin Zhi': ['HERBAL', 'SEHAT']
};

// Flatten all words for gameplay with brand reference
let words = [];
let wordToBrand = {}; // Map each word to its brand
for (let brand in brandWords) {
    brandWords[brand].forEach(word => {
        const spacedWord = word.trim().split('').join(' '); // Add spaces between letters
        words.push(spacedWord);
        wordToBrand[spacedWord] = brand; // Track which brand this word belongs to
    });
}
let currentWord = '';
let currentBrand = ''; // Track which brand the current word belongs to
let wordProgress = {};
let currentLetterIndex = 0; // Track which letter we're currently working on
let isRunning = false;
// Letter completion delay system
let letterCompletionTimers = {}; // Track completion timers for each letter
let completionDelayMs = 400; // 0.4 second delay before marking letter as complete (faster response)
// Checkpoint-based letter completion system
let letterCheckpoints = {}; // Track which checkpoints have been hit for each letter
let checkpointDefinitions = {
    // Simplified to 2 checkpoints per letter: START and END points based on natural drawing patterns
    // Format: { x: horizontal position (0=left, 1=right), y: vertical position (0=top, 1=bottom) }
    'A': [
        { x: 0.5, y: 0.0, label: 'start' },      // Start: top point
        { x: 0.5, y: 0.6, label: 'end' }         // End: crossbar (ensures shape is drawn)
    ],
    'B': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left (beginning of vertical line)
        { x: 0.8, y: 0.75, label: 'end' }        // End: bottom bump (ensures vertical line + bump drawn)
    ],
    'C': [
        { x: 0.8, y: 0.2, label: 'start' },      // Start: top-right opening
        { x: 0.8, y: 0.8, label: 'end' }         // End: bottom-right opening (ensures C shape)
    ],
    'D': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left
        { x: 0.7, y: 0.75, label: 'end' }        // End: bottom curve
    ],
    'E': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left
        { x: 0.8, y: 1.0, label: 'end' }         // End: bottom-right
    ],
    'F': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left
        { x: 0.7, y: 0.5, label: 'end' }         // End: middle-right bar
    ],
    'G': [
        { x: 0.8, y: 0.2, label: 'start' },      // Start: top-right
        { x: 0.8, y: 0.7, label: 'end' }         // End: bottom-right with bar
    ],
    'H': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left
        { x: 1.0, y: 1.0, label: 'end' }         // End: bottom-right
    ],
    'I': [
        { x: 0.5, y: 0.0, label: 'start' },      // Start: top
        { x: 0.5, y: 1.0, label: 'end' }         // End: bottom
    ],
    'J': [
        { x: 0.8, y: 0.0, label: 'start' },      // Start: top
        { x: 0.2, y: 0.9, label: 'end' }         // End: bottom curve left
    ],
    'K': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left
        { x: 1.0, y: 1.0, label: 'end' }         // End: bottom-right diagonal
    ],
    'L': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top of vertical line
        { x: 1.0, y: 1.0, label: 'end' }         // End: bottom-right corner
    ],
    'M': [
        { x: 0.0, y: 1.0, label: 'start' },      // Start: bottom-left
        { x: 1.0, y: 1.0, label: 'end' }         // End: bottom-right
    ],
    'N': [
        { x: 0.0, y: 1.0, label: 'start' },      // Start: bottom-left
        { x: 1.0, y: 0.0, label: 'end' }         // End: top-right
    ],
    'O': [
        { x: 0.5, y: 0.0, label: 'start' },      // Start: top
        { x: 1.0, y: 0.5, label: 'end' }         // End: right side (ensures oval drawn)
    ],
    'P': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left
        { x: 0.7, y: 0.5, label: 'end' }         // End: middle-right bump
    ],
    'Q': [
        { x: 0.5, y: 0.0, label: 'start' },      // Start: top
        { x: 1.0, y: 1.0, label: 'end' }         // End: tail (bottom-right)
    ],
    'R': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left
        { x: 0.9, y: 1.0, label: 'end' }         // End: bottom-right leg
    ],
    'S': [
        { x: 0.8, y: 0.2, label: 'start' },      // Start: top-right
        { x: 0.8, y: 0.8, label: 'end' }         // End: bottom-right
    ],
    'T': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left of horizontal bar
        { x: 0.5, y: 1.0, label: 'end' }         // End: bottom of vertical stem
    ],
    'U': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left
        { x: 1.0, y: 0.0, label: 'end' }         // End: top-right
    ],
    'V': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left
        { x: 1.0, y: 0.0, label: 'end' }         // End: top-right
    ],
    'W': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left
        { x: 1.0, y: 0.0, label: 'end' }         // End: top-right
    ],
    'X': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left
        { x: 1.0, y: 1.0, label: 'end' }         // End: bottom-right
    ],
    'Y': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left
        { x: 0.5, y: 1.0, label: 'end' }         // End: bottom center stem
    ],
    'Z': [
        { x: 0.0, y: 0.0, label: 'start' },      // Start: top-left
        { x: 1.0, y: 1.0, label: 'end' }         // End: bottom-right
    ]
};
// Performance optimization variables
let lastFrameTime = 0;
// UI elements
let currentWordElement;
let noseIndicator;
let loadingScreenElement;

// Mobile detection function
function detectMobile() {
    screenWidth = window.innerWidth;
    isMobile = screenWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Calculate scale factor based on screen size - more aggressive scaling
    if (screenWidth <= 320) {
        scaleFactor = 0.2; // Very small phones
    } else if (screenWidth <= 375) {
        scaleFactor = 0.3; // iPhone SE, iPhone 8
    } else if (screenWidth <= 390) {
        scaleFactor = 0.4; // iPhone 12, 13, 14
    } else if (screenWidth <= 428) {
        scaleFactor = 0.5; // iPhone Pro Max
    } else if (screenWidth <= 768) {
        scaleFactor = 0.6; // Tablets
    } else if (screenWidth <= 1024) {
        scaleFactor = 0.8; // Large tablets
    } else {
        scaleFactor = 1.0; // Desktop
    }
    
    // Mobile detection and scaling
}

// Front Screen Management
let frontScreenElement;
let gameScreenElement;
let closingScreenElement;
let openingScreen;
let closingScreen;
let gameTimer;
let timeRemaining = 30;

window.addEventListener('load', () => {
  const music = document.getElementById('bgMusic');

  music.volume = 0.3;

  // Try to play music
  const playMusic = () => {
    music.play().catch(error => {
        // Autoplay blocked by browser - will play on user interaction
    });
  };

  playMusic();

  // Fallback: Play on first user interaction (bypasses autoplay restrictions)
  document.addEventListener('click', () => {
    if (music.paused) {
      music.play();
    }
  }, { once: true });
});

function initializeFrontScreen() {
    frontScreenElement = document.getElementById('frontScreen');
    gameScreenElement = document.getElementById('gameScreen');
    closingScreenElement = document.getElementById('closingScreen');
    loadingScreenElement = document.getElementById('loadingScreen');
    openingScreen = document.getElementById('openingScreen');
    closingScreen = document.getElementById('closingScreen');
    
    if (openingScreen) {
        openingScreen.addEventListener('click', startGame);
    }
    
    if (closingScreen) {
        closingScreen.addEventListener('click', function() {
            // Reload the page for a fresh start
            window.location.reload();
        });
    }
    
    // Preload face-api.js models in background while user sees opening screen
    preloadFaceModels();
    
    // Front screen initialized
}

// Preload face detection models on opening screen (smart loading!)
async function preloadFaceModels() {
    if (faceApiModelsLoaded) return; // Already loaded
    
    const preloadIndicator = document.getElementById('preloadIndicator');
    
    try {
        console.log('🚀 Preloading face-api.js models in background...');
        
        // Show loading indicator
        if (preloadIndicator) {
            preloadIndicator.style.display = 'flex';
        }
        
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        
        // Load all 3 models in parallel while user is on opening screen
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        
        faceApiModelsLoaded = true;
        console.log('✅ Face detection models preloaded successfully! Game will start instantly.');
        
        // Hide loading indicator with fade out
        if (preloadIndicator) {
            preloadIndicator.classList.add('hidden');
            setTimeout(() => {
                preloadIndicator.style.display = 'none';
            }, 300); // Match CSS transition duration
        }
        
    } catch (error) {
        console.warn('⚠️ Preload failed, will load on game start:', error);
        // Hide indicator even if failed
        if (preloadIndicator) {
            preloadIndicator.classList.add('hidden');
            setTimeout(() => {
                preloadIndicator.style.display = 'none';
            }, 300);
        }
        // Not critical - will load when game starts if preload fails
    }
}

async function startGame() {
    
    // Hide front screen
    if (frontScreenElement) {
        frontScreenElement.style.display = 'none';
    }
    
    // Show game screen with loading state
    if (gameScreenElement) {
        gameScreenElement.style.display = 'block';
    }
    
    // Show loading screen immediately
    if (loadingScreenElement) {
        loadingScreenElement.style.display = 'flex';
    }
    
    // Restore canvas visibility
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.style.display = 'block';
    }
    
    // Restart p5.js draw loop
    if (typeof loop === 'function') {
        loop();
    }
    
    
    // Request camera access immediately
    try {
        await requestCameraAccess();
        
        // Hide loading message
        hideLoadingMessage();
        
        // Initialize the game after camera access is granted
        initializeGame();
        
        // Start the 20-second timer
        startGameTimer();
        
        // Force display the word when game starts
        setTimeout(() => {
            forceDisplayWord();
        }, 500);
    } catch (error) {
        console.error('Camera access denied:', error);
        hideLoadingMessage();
        
        // Show user-friendly error message
        showErrorMessage('Camera access is required to play this game. Please click "Allow" when prompted and try again.');
        
        // Go back to front screen if camera access is denied
        setTimeout(() => {
            if (frontScreenElement) {
                frontScreenElement.style.display = 'block';
            }
            if (gameScreenElement) {
                gameScreenElement.style.display = 'none';
            }
        }, 3000);
    }
}

async function requestCameraAccess() {
    return new Promise((resolve, reject) => {
        navigator.mediaDevices.getUserMedia({ 
            video: {
                width: { ideal: 1080 },  // try to get tall shape
                height: { ideal: 1920 }, // 9:16 portrait
                facingMode: "user"       // webcam or selfie (adjust as needed)
            }
        })
        .then(stream => {
            // Store the stream for later use
            window.cameraStream = stream;
            resolve(stream);
        })
        .catch(error => {
            reject(error);
        });
    });
}

function hideLoadingMessage() {
    const loadingScreenElement = document.getElementById('loadingScreen');
    if (loadingScreenElement) {
        loadingScreenElement.style.display = 'none';
    }
}

function startGameTimer() {
    timeRemaining = 30;
    
    gameTimer = setInterval(() => {
        timeRemaining--;
        
        // Periodic cleanup every 5 seconds to prevent memory buildup
        if (timeRemaining % 5 === 0 && timeRemaining > 0) {
            performPeriodicCleanup();
        }
        
        if (timeRemaining <= 0) {
            clearInterval(gameTimer);
            isRunning = false; // Stop the game
            showClosingScreen();
        }
    }, 1000);
}

function performPeriodicCleanup() {
    // Clean up old trail points (keep only last 100)
    if (noseTrail.length > 100) {
        noseTrail = noseTrail.slice(-100);
    }
    
    // Clean up old nose history (keep only last 5)
    if (noseHistory.length > 5) {
        noseHistory = noseHistory.slice(-5);
    }
    
    // Force garbage collection if available
    if (window.gc) {
        window.gc();
    }
}

function showClosingScreen() {
    // Check if word is actually completed BEFORE cleaning up resources
    const wordIsCompleted = isWordActuallyCompleted();
    
    // Clean up resources before showing closing screen
    cleanupGameResources();
    
    // Stop p5.js draw loop
    if (typeof noLoop === 'function') {
        noLoop();
    }
    
    // Hide game screen
    if (gameScreenElement) {
        gameScreenElement.style.display = 'none';
    }
    
    // Show closing screen
    if (closingScreenElement) {
        closingScreenElement.style.display = 'block';
    }
    
    // Draw brand-specific closing screen
    drawBrandClosingScreen();
    
    // Play win music only if word is actually completed
    if (wordIsCompleted && winSound) {
        try {
            // Reset the audio to the beginning in case it was played before
            winSound.currentTime = 0;
            
            // Check if audio is ready to play
            if (winSound.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                // Try to play the audio
                const playPromise = winSound.play();
                
                if (playPromise !== undefined) {
                    playPromise.catch((error) => {
                        // Try to play again after a short delay
                        setTimeout(() => {
                            winSound.play().catch(e => {
                                // Silent fail
                            });
                        }, 100);
                    });
                }
            } else {
                // Wait for the audio to be ready
                winSound.addEventListener('canplay', () => {
                    winSound.play().catch(e => {
                        // Silent fail
                    });
                }, { once: true });
            }
        } catch (error) {
            // Silent fail
        }
    }
}

function isWordActuallyCompleted() {
    // Check if all letters are actually completed (sequential system)
    if (!currentWord || currentWord.length === 0) {
        return false;
    }
    
    // Get letters only (excluding spaces)
    const lettersOnly = currentWord.split('').filter(char => char !== ' ');
    
    // Check if we've completed all letters (currentLetterIndex should be >= lettersOnly.length)
    if (currentLetterIndex >= lettersOnly.length) {
        return true;
    }
    
    return false;
}

function cleanupGameResources() {
    // Stop camera stream
    if (window.cameraStream) {
        window.cameraStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
        });
        window.cameraStream = null;
    }
    
    // Clear video reference and stop video
    if (video) {
        try {
            video.stop();
            video.remove();
        } catch (e) {
            // Video cleanup completed
        }
        video = null;
    }
    
    // Clear face detection interval
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    
    // Reset face tracking
    unlockPerson();
    
    // Hide and clean up canvas
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.style.display = 'none';
        // Clear the canvas content
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    // Clear all arrays and objects
    poses = [];
    noseTrail = [];
    noseHistory = [];
    wordProgress = {};
    letterCheckpoints = {}; // Reset checkpoints
    letterCompletionTimers = {}; // Reset timers
    
    // Reset pose tracking
    lastTrackedNoseX = null;
    lastTrackedNoseY = null;
    lastTrackedFaceCenterX = null;
    lastTrackedFaceCenterY = null;
    personLocked = false;
    framesWithoutPerson = 0;
    consecutiveFramesWithPerson = 0;
    lockStrength = 0;
    
    // Reset all state variables
    isVideoReady = false;
    isModelReady = false;
    faceDetected = false;
    isRunning = false;
    
    // Clear any pending timeouts/intervals
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
    
    // Force garbage collection hint
    if (window.gc) {
        window.gc();
    }
}

function resetGame() {
    // Reset all game variables
    noseX = width / 2;
    noseY = height / 2;
    smoothedNoseX = width / 2;
    smoothedNoseY = height / 2;
    noseTrail = [];
    noseHistory = [];
    poses = [];
    wordProgress = {};
    letterCheckpoints = {}; // Reset checkpoints
    letterCompletionTimers = {}; // Reset timers
    faceDetected = false;
    isRunning = false;
    wordCompletedSoundPlayed = false; // Reset sound flag
    
    // Reset pose tracking
    lastTrackedNoseX = null;
    lastTrackedNoseY = null;
    lastTrackedFaceCenterX = null;
    lastTrackedFaceCenterY = null;
    personLocked = false;
    framesWithoutPerson = 0;
    consecutiveFramesWithPerson = 0;
    lockStrength = 0;
    
    // Reset performance counters
    lastFrameTime = 0;
    lastImageDrawTime = 0;
}

// Function to calculate proper canvas dimensions (mobile responsive)
function calculateCanvasDimensions() {
    const targetWidth = 1080;
    const targetHeight = 1920;
    const aspectRatio = targetWidth / targetHeight; // 9:16 ratio (0.5625)
    
    const maxWidth = windowWidth;
    const maxHeight = windowHeight;
    const windowAspectRatio = maxWidth / maxHeight;
    
    let canvasWidth, canvasHeight;
    
    if (windowAspectRatio > aspectRatio) {
        // Window is wider than our target ratio - fit to height
        canvasHeight = maxHeight;
        canvasWidth = Math.round(canvasHeight * aspectRatio);
    } else {
        // Window is taller than our target ratio - fit to width  
        canvasWidth = maxWidth;
        canvasHeight = Math.round(canvasWidth / aspectRatio);
    }
    
    // Ensure minimum playable size
    if (canvasWidth < 300) {
        canvasWidth = 300;
        canvasHeight = Math.round(canvasWidth / aspectRatio);
    }
    
    // Cap at target size for desktop
    if (canvasWidth > targetWidth) {
        canvasWidth = targetWidth;
        canvasHeight = targetHeight;
    }
    
    return { width: canvasWidth, height: canvasHeight };
}

function initializeGame() {
    // Detect mobile first
    detectMobile();
    
    // Get the existing canvas element from HTML
    const canvasElement = document.getElementById('canvas');
    
    // Calculate proper canvas size with 9:16 aspect ratio (1080x1920 target)
    const dimensions = calculateCanvasDimensions();
    
    // Create p5.js canvas with proper 9:16 aspect ratio
    const canvas = createCanvas(dimensions.width, dimensions.height);
    
    // Replace the existing canvas element with p5's canvas
    if (canvasElement && canvasElement.parentNode) {
        canvasElement.parentNode.replaceChild(canvas.elt, canvasElement);
        // Copy the id to the new canvas
        canvas.elt.id = 'canvas';
    }
    
    noseX = width / 2;
    noseY = height / 2;
    smoothedNoseX = width / 2;
    smoothedNoseY = height / 2;
    
    // Reset game state
    wordProgress = {};
    letterCheckpoints = {}; // Reset checkpoints
    letterCompletionTimers = {}; // Reset completion timers
    faceDetected = false;
    isRunning = true;
    
    // Get UI elements
    currentWordElement = document.getElementById('currentWord');
    noseIndicator = document.getElementById('noseIndicator');
    
    // Debug: Check if elements are found
    // UI Elements found
    
    // Initialize game
    randomizeWord();
    
    // Start the initialization process
    initializeApp();
}

// Old setup function removed - now using p5.js's setup() for asset loading

async function initializeApp() {
    try {
        // Camera access already granted in startGame(), just initialize camera
        updateLoadingText('Initializing camera...');
        await initializeCamera();
        
        // Load model (this will complete in modelReady callback)
        updateLoadingText('Loading AI model...');
        
    } catch (error) {
        console.error('Initialization error:', error);
        updateLoadingText('Initialization failed. Please try again.');
        alert('Failed to initialize: ' + error.message);
    }
}

function updateLoadingText(text) {
    const loadingTextElement = document.querySelector('.loading-text');
    if (loadingTextElement) {
        loadingTextElement.textContent = text;
    }
}

async function initializeCamera() {
    return new Promise((resolve, reject) => {
        try {
            // Use the already granted camera stream
            if (window.cameraStream) {
                // Create p5.js video using createCapture but with constraints to avoid requesting camera again
                video = createCapture(VIDEO, () => {
                    videoReady();
                    resolve();
                });
                // Don't force video size - let it maintain natural aspect ratio
                video.hide();
                
                // Immediately set the video source to the already granted stream
                // This should prevent createCapture from requesting camera access
                video.srcObject = window.cameraStream;
            } else {
                reject(new Error('No camera stream available'));
            }
        } catch (error) {
            reject(new Error('Failed to initialize camera'));
        }
    });
}

async function videoReady() {
    isVideoReady = true;
    
    // Check if models were already preloaded on opening screen
    if (!faceApiModelsLoaded) {
        // Models not preloaded, load them now
        updateLoadingText('Loading face detection AI...');
        
        try {
            console.log('Loading face-api.js models...');
            
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
            
            // Load all models in parallel
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            
            faceApiModelsLoaded = true;
            console.log('Face-api.js models loaded successfully!');
            
        } catch (error) {
            console.error('Error loading face-api.js models:', error);
            updateLoadingText('Failed to load. Please refresh the page.');
            setTimeout(() => {
                alert('Failed to load face detection models. Please refresh the page.');
            }, 100);
            return;
        }
    } else {
        console.log('✅ Using preloaded models - instant start!');
    }
    
    // Start detection loop (whether models were preloaded or just loaded)
    updateLoadingText('Starting game...');
    startFaceDetection();
    
    // Small delay to ensure first detection runs
    setTimeout(() => {
        // Hide loading screen
        if (loadingScreenElement) {
            loadingScreenElement.style.display = 'none';
        }
        modelReady();
    }, 300); // Reduced from 500ms since models are already loaded
}

// Start continuous face detection (optimized for speed)
function startFaceDetection() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
    }
    
    // Run detection every 120ms (~8 FPS) - balanced for 320px input processing
    // Slightly slower than before but handles larger input size for distance detection
    detectionInterval = setInterval(async () => {
        if (!isVideoReady || !faceApiModelsLoaded || !video || !video.elt) {
            return;
        }
        
        try {
            // Detect faces with settings optimized for long-distance detection (2+ meters)
            const detections = await faceapi
                .detectAllFaces(video.elt, new faceapi.TinyFaceDetectorOptions({
                    inputSize: 320,        // Maximum size for best small face detection at 2+ meters
                    scoreThreshold: 0.2     // Very low threshold for detecting very distant faces
                }))
                .withFaceLandmarks(true)
                .withFaceDescriptors();
            
            currentDetections = detections;
            processFaceDetections(detections);
            
        } catch (error) {
            console.error('Face detection error:', error);
        }
    }, 120);
}

/**
 * FACE TRACKING WITH FACE-API.JS
 * Uses 128-dimension face descriptors (unique "fingerprint") for reliable person identification
 * Much more accurate than geometry-based matching!
 */

function processFaceDetections(detections) {
    // No faces detected
    if (!detections || detections.length === 0) {
        faceDetected = false;
        framesWithoutPerson++;
        framesOutsideCanvas++; // Also count as outside canvas
        
        // Quick unlock if person was last seen near boundaries and now gone
        if (lastKnownNosePosition && framesOutsideCanvas > maxFramesOutsideCanvas && personLocked) {
            console.log('⚡ Fast unlock: Person moved outside canvas boundaries');
            unlockPerson();
            return;
        }
        
        // Standard unlock if person has been gone too long
        if (framesWithoutPerson > maxFramesWithoutPerson && personLocked) {
            unlockPerson();
        }
        return;
    }
    
    // Check if any detected face is within canvas boundaries
    const videoWidth = video ? video.width : 640;
    const videoHeight = video ? video.height : 480;
    let anyFaceInBounds = false;
    
    for (const detection of detections) {
        const box = detection.detection.box;
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        
        // Check if face center is within video boundaries (with small margin)
        const margin = 50; // Allow 50px outside before considering "out of bounds"
        if (centerX > -margin && centerX < videoWidth + margin &&
            centerY > -margin && centerY < videoHeight + margin) {
            anyFaceInBounds = true;
            break;
        }
    }
    
    // If all detected faces are outside canvas, increment counter
    if (!anyFaceInBounds) {
        framesOutsideCanvas++;
        if (framesOutsideCanvas > maxFramesOutsideCanvas && personLocked) {
            console.log('⚡ Fast unlock: All detected faces outside canvas boundaries');
            unlockPerson();
            return;
        }
    } else {
        framesOutsideCanvas = 0; // Reset if face found within bounds
    }
    
    // ============================================================
    // STEP 1: NOT LOCKED - Lock to first detected person
    // ============================================================
    if (!personLocked || !trackedPersonDescriptor) {
        const firstPerson = detections[0];
        
        // Store their face descriptor (128-dim vector - unique fingerprint!)
        trackedPersonDescriptor = firstPerson.descriptor;
        personLocked = true;
        framesWithoutPerson = 0;
        framesOutsideCanvas = 0;
        
        // Get nose position from landmarks
        updateNosePosition(firstPerson);
        lastKnownNosePosition = { x: noseX, y: noseY };
        
        console.log('🔒 Locked onto person! This person will be tracked exclusively.');
        return;
    }
    
    // ============================================================
    // STEP 2: LOCKED - Find the SAME person in current detections
    // ============================================================
    
    // Compare all detected faces with tracked person's descriptor
    let bestMatch = null;
    let bestDistance = Infinity;
    
    for (const detection of detections) {
        // Calculate Euclidean distance between descriptors
        const distance = faceapi.euclideanDistance(trackedPersonDescriptor, detection.descriptor);
        
        if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = detection;
        }
    }
    
    // ============================================================
    // STEP 3: Accept or Reject based on descriptor match
    // ============================================================
    
    // Use STRICTER threshold if person was missing (prevents locking onto someone else when you return)
    // Use NORMAL threshold if person is being tracked continuously (handles fast movement better)
    const wasRecentlyMissing = framesWithoutPerson > 5; // Missing for more than 0.5 seconds
    const currentThreshold = wasRecentlyMissing ? strictDescriptorThreshold : descriptorMatchThreshold;
    
    if (bestMatch && bestDistance < currentThreshold) {
        // SAME PERSON! Update tracking
        faceDetected = true;
        framesWithoutPerson = 0;
        framesOutsideCanvas = 0; // Reset since person is found
        
        // Calculate face size to determine distance (smaller face = farther away)
        const faceBox = bestMatch.detection.box;
        const faceSize = faceBox.width * faceBox.height;
        
        // Adaptive descriptor smoothing for different distances (optimized for 2+ meters)
        // Smaller face = higher smoothing to adapt to variations at distance
        let descriptorSmoothing;
        if (faceSize < 8000) {
            // Very far away (2+ meters) - very small face
            descriptorSmoothing = 0.12;
        } else if (faceSize < 15000) {
            // Far away (1-2 meters) - small face
            descriptorSmoothing = 0.08;
        } else if (faceSize < 30000) {
            // Normal distance (0.5-1 meter) - medium face
            descriptorSmoothing = 0.05;
        } else {
            // Close up (< 0.5 meter) - large face
            descriptorSmoothing = 0.03;
        }
        
        for (let i = 0; i < trackedPersonDescriptor.length; i++) {
            trackedPersonDescriptor[i] = 
                trackedPersonDescriptor[i] * (1 - descriptorSmoothing) + 
                bestMatch.descriptor[i] * descriptorSmoothing;
        }
        
        // Update nose position
        updateNosePosition(bestMatch);
        lastKnownNosePosition = { x: noseX, y: noseY };
        
    } else {
        // DIFFERENT PERSON or no good match
        faceDetected = false;
        framesWithoutPerson++;
        
        // Unlock if wrong person for too long
        if (framesWithoutPerson > maxFramesWithoutPerson) {
            unlockPerson();
        }
    }
}

// Extract nose position from face landmarks
function updateNosePosition(detection) {
    if (!detection || !detection.landmarks) return;
    
    // Get nose tip landmark (landmark 30 is nose tip in 68-point model)
    const noseTip = detection.landmarks.getNose()[3]; // Center of nose
    
    // Update nose position in video coordinates
    noseX = noseTip.x;
    noseY = noseTip.y;
}

// Unlock person and reset tracking
function unlockPerson() {
    personLocked = false;
    trackedPersonDescriptor = null;
    framesWithoutPerson = 0;
    framesOutsideCanvas = 0;
    lastKnownNosePosition = null;
    faceDetected = false;
}

function modelReady() {
    isModelReady = true;
    isRunning = true;
}

let timerFgColor = null;

// Brand product images
let brandImages = {};
let brandQcodes = {};

// Audio variables
let correctWordSound;
let winSound;
let wordCompletedSoundPlayed = false; // Flag to prevent multiple sound plays

const images = {};
const fonts = {};
let assetsLoaded = false; // Flag to track if assets are loaded

// Image names to load from HTML (preloaded in index.html)
const imageNames = [
    'gameBgImage', 'instructionImage', 'questionImage', 'timerBgImage', 'timerFgImage',
    'skintific_1', 'skintific_2', 'skintific_3',
    'scarlett_1', 'scarlett_2', 'scarlett_3',
    'vaseline_1', 'vaseline_2', 'vaseline_3',
    'favbeauty_1', 'favbeauty_2', 'favbeauty_3',
    'xiyaopin_1', 'xiyaopin_2', 'xiyaopin_3',
    'qrcode_1', 'qrcode_2', 'qrcode_3', 'qrcode_4', 'qrcode_5',
    'qrcode_6', 'qrcode_7', 'qrcode_8', 'qrcode_9', 'qrcode_10',
    'qrcode_11', 'qrcode_12', 'qrcode_13', 'qrcode_14', 'qrcode_15',
    'closingBg'
];

// Load images from HTML DOM (already preloaded via <img> tags - no CORS issues!)
function loadImagesFromHTML() {
    const loadPromises = [];
    
    imageNames.forEach(name => {
        const imgElement = document.getElementById('img_' + name);
        if (imgElement) {
            // Create a promise that resolves when the image is fully loaded
            const loadPromise = new Promise((resolve, reject) => {
                if (imgElement.complete && imgElement.naturalWidth > 0) {
                    // Image already loaded
                    images[name] = imgElement;
                    resolve();
                } else {
                    // Wait for image to load
                    imgElement.onload = () => {
                        images[name] = imgElement;
                        resolve();
                    };
                    imgElement.onerror = () => {
                        console.error(`Failed to load image: ${name}`);
                        reject(new Error(`Failed to load ${name}`));
                    };
                }
            });
            loadPromises.push(loadPromise);
        } else {
            console.error(`Image element not found: img_${name}`);
        }
    });
    
    return Promise.all(loadPromises);
}

function preload() {
    // Fonts are loaded via CSS @font-face (in style.css)
    // Just store the font family names to use in p5.js
    fonts['tikTokDisplayBold'] = 'TikTok-Display-Bold';
    fonts['tikTokSansTextBold'] = 'TikTok-Sans-Text-Bold';
    fonts['tikTokSansDisplayBold'] = 'TikTok-Sans-Display-Bold';
    
    // Load audio files using HTML5 Audio API with better error handling
    try {
        correctWordSound = new Audio('assets/Game2_CorrectWord.mp3');
        correctWordSound.preload = 'auto';
        
        // Add error event listener
        correctWordSound.addEventListener('error', function(e) {
            correctWordSound = null;
        });
        
        // Add load event listener
        correctWordSound.addEventListener('canplaythrough', function() {
            // Sound loaded successfully
        });
        
        correctWordSound.load(); // Force load the audio
    } catch (error) {
        correctWordSound = null;
    }
    
    // Load win sound using HTML5 Audio API (more reliable than p5.js loadSound)
    try {
        winSound = new Audio('assets/Win.mp3');
        winSound.preload = 'auto';
        winSound.load(); // Force load the audio
    } catch (error) {
        winSound = null;
    }
}

// Setup function called after preload completes
function setup() {
    // Detect mobile and calculate dimensions first
    detectMobile();
    
    // Create an initial canvas with proper sizing (will be replaced by initializeGame)
    // We need this so drawingContext exists for HTML image drawing
    const initialDimensions = calculateCanvasDimensions();
    createCanvas(initialDimensions.width, initialDimensions.height);
    
    // Load images from HTML and wait for them to be ready
    loadImagesFromHTML().then(() => {
        
        // Setup brand images from HTML-loaded images
        setupBrandImages();
        
        // Wait for CSS fonts to load before marking as ready
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                assetsLoaded = true;
            });
        } else {
            // Fallback if fonts API not available
            assetsLoaded = true;
        }
    }).catch(err => {
        console.error('Error loading images:', err);
        // Still mark as loaded to prevent blocking
        assetsLoaded = true;
    });
}

// Setup brand images and QR codes from loaded images
function setupBrandImages() {
    // Map loaded images to brand arrays
    brandImages['Skintific'] = [
        images['skintific_1'],
        images['skintific_2'],
        images['skintific_3']
    ];
    brandImages['Scarlett'] = [
        images['scarlett_1'],
        images['scarlett_2'],
        images['scarlett_3']
    ];
    brandImages['Vaseline'] = [
        images['vaseline_1'],
        images['vaseline_2'],
        images['vaseline_3']
    ];
    brandImages['FAV Beauty'] = [
        images['favbeauty_1'],
        images['favbeauty_2'],
        images['favbeauty_3']
    ];
    brandImages['Xi Yaopin Zhi'] = [
        images['xiyaopin_1'],
        images['xiyaopin_2'],
        images['xiyaopin_3']
    ];
    
    brandQcodes['Skintific'] = [
        images['qrcode_1'],
        images['qrcode_2'],
        images['qrcode_3']
    ];
    brandQcodes['Scarlett'] = [
        images['qrcode_4'],
        images['qrcode_5'],
        images['qrcode_6']
    ];
    brandQcodes['Vaseline'] = [
        images['qrcode_7'],
        images['qrcode_8'],
        images['qrcode_9']
    ];
    brandQcodes['FAV Beauty'] = [
        images['qrcode_10'],
        images['qrcode_11'],
        images['qrcode_12']
    ];
    brandQcodes['Xi Yaopin Zhi'] = [
        images['qrcode_13'],
        images['qrcode_14'],
        images['qrcode_15']
    ];
}

// Helper function to draw images (handles both p5.Image and HTML Image)
function drawImageSafe(img, x, y, w, h) {
    if (!img) return;
    
    // Check if it's a p5.Image (has .get method)
    if (img.get && typeof img.get === 'function') {
        // It's a p5.Image, use normal p5.js image()
        image(img, x, y, w, h);
    } else if (img instanceof HTMLImageElement) {
        // It's an HTML Image, draw it on canvas directly
        drawingContext.drawImage(img, x, y, w, h);
    } else {
        // Try to draw it anyway
        image(img, x, y, w, h);
    }
}

// Function to extract color from Timer_FG image
function extractTimerFgColor() {
    // Skip pixel reading for HTML images (causes CORS taint with file://)
    // Use default timer color instead
    if (!timerFgColor) {
        // Default color - a nice blue/cyan for the timer (skipping pixel extraction to avoid CORS)
        timerFgColor = { r: 0, g: 200, b: 255, a: 255 };
    }
}

// Global variables to store video transformation info for nose coordinate mapping
let videoTransform = {
    drawX: 0,
    drawY: 0,
    drawWidth: 0,
    drawHeight: 0,
    videoWidth: 0,
    videoHeight: 0
};

function drawVideoWithAspectRatio() {
    if (!video) return;
    
    // Try to get video dimensions from the video element
    let videoWidth, videoHeight;
    
    // Check if video has loaded and has dimensions
    if (video.elt && video.elt.videoWidth && video.elt.videoHeight) {
        videoWidth = video.elt.videoWidth;
        videoHeight = video.elt.videoHeight;
    } else if (video.width && video.height) {
        videoWidth = video.width;
        videoHeight = video.height;
    } else {
        // Video dimensions not available yet, use object-fit: cover behavior
        // This will crop the video to fill the canvas while maintaining aspect ratio
        const videoAspectRatio = 16/9; // Assume common camera ratio as fallback
        const canvasAspectRatio = width / height;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        // ALWAYS fill entire canvas, crop if needed
        if (videoAspectRatio > canvasAspectRatio) {
            // Video is wider - fit to HEIGHT and crop left/right sides
            drawHeight = height;
            drawWidth = height * videoAspectRatio;
            drawX = (width - drawWidth) / 2; // Center horizontally (will be negative, cropping sides)
            drawY = 0;
        } else {
            // Video is taller - fit to WIDTH and crop top/bottom
            drawWidth = width;
            drawHeight = width / videoAspectRatio;
            drawX = 0;
            drawY = (height - drawHeight) / 2; // Center vertically (will be negative, cropping top/bottom)
        }
        
        // Store transform info for nose coordinate mapping
        videoTransform = {
            drawX: drawX,
            drawY: drawY,
            drawWidth: drawWidth,
            drawHeight: drawHeight,
            videoWidth: drawWidth, // Use draw dimensions as fallback
            videoHeight: drawHeight
        };
        
        image(video, drawX, drawY, drawWidth, drawHeight);
        return;
    }
    
    // Calculate video aspect ratio
    const videoAspectRatio = videoWidth / videoHeight;
    const canvasAspectRatio = width / height;
    
    let drawWidth, drawHeight, drawX, drawY;
    
    // Use object-fit: cover behavior - ALWAYS fill entire canvas, crop if needed
    if (videoAspectRatio > canvasAspectRatio) {
        // Video is wider than canvas - fit to HEIGHT and crop left/right sides
        drawHeight = height;
        drawWidth = height * videoAspectRatio;
        drawX = (width - drawWidth) / 2; // Center horizontally (will be negative, cropping sides)
        drawY = 0;
    } else {
        // Video is taller than canvas - fit to WIDTH and crop top/bottom
        drawWidth = width;
        drawHeight = width / videoAspectRatio;
        drawX = 0;
        drawY = (height - drawHeight) / 2; // Center vertically (will be negative, cropping top/bottom)
    }
    
    // Store transform info for nose coordinate mapping
    videoTransform = {
        drawX: drawX,
        drawY: drawY,
        drawWidth: drawWidth,
        drawHeight: drawHeight,
        videoWidth: videoWidth,
        videoHeight: videoHeight
    };
    
    // Draw video with proper aspect ratio and centering - ALWAYS fills entire canvas
    image(video, drawX, drawY, drawWidth, drawHeight);
}

function draw() {
    // Don't draw until all assets are loaded
    if (!assetsLoaded) {
        return;
    }
    
    // Only draw if game screen is visible
    if (gameScreenElement && gameScreenElement.style.display !== 'none') {
        // Performance optimization: Limit frame rate to 30fps
        const currentTime = Date.now();
        if (currentTime - lastFrameTime < 33) { // ~30fps
            return;
        }
        lastFrameTime = currentTime;

        // Now apply flip transformation ONLY for video and nose detection
        push();
        translate(width, 0);
        scale(-1, 1);
        
        // Draw video feed at full opacity over background with proper aspect ratio
        if (video) {
            noTint(); // Full opacity for clear video
            drawVideoWithAspectRatio();
        }

        // Draw trail FIRST (so it appears behind the nose dot)
        drawNoseTrail();

        // Draw nose if face is detected
        drawNose();

        pop();
        
        // Draw UI elements AFTER video (so they appear on top)
        // Draw Game_BG as background first
        const gameBgImage = images['gameBgImage'];
        if (gameBgImage) {
            noTint(); // Ensure no tint is applied
            drawImageSafe(gameBgImage, 0, 0, width, height);
        }

        // Draw instruction banner on top of video
        const instructionImage = images['instructionImage'];
        if (instructionImage) {
            noTint(); // Ensure no tint is applied
            const instructionWidth = width * 0.77; // 40% of canvas width
            const instructionHeight = instructionWidth * (instructionImage.height / instructionImage.width);
            const instructionX = (width - instructionWidth) / 2;
            const instructionY = height * 0.18; // 8% from top
            
            drawImageSafe(instructionImage, instructionX, instructionY, instructionWidth, instructionHeight);
        }

        // Draw question banner on top of video
        const questionImage = images['questionImage'];
        if (questionImage) {
            noTint(); // Ensure no tint is applied
            const questionWidth = width * 0.43;
            const questionHeight = questionWidth * (questionImage.height / questionImage.width);
            const questionX = (width - questionWidth) / 2;
            const questionY = height * 0.32;

            drawImageSafe(questionImage, questionX, questionY, questionWidth, questionHeight);
            
            // Draw current word inside the question banner
            const tikTokSansDisplayBold = fonts['tikTokSansDisplayBold'];
            if (currentWord && tikTokSansDisplayBold) {
                push();
                textFont(tikTokSansDisplayBold);
                textAlign(CENTER, CENTER);
                
                // Get only letters (no spaces) for display
                const lettersOnly = currentWord.split('').filter(char => char !== ' ');
                const wordToDisplay = lettersOnly.join('');
                
                // Calculate font size based on banner size
                const maxFontSize = questionHeight * 0.35;
                textSize(maxFontSize);
                
                // Position text in the center of the blue area of the banner
                const textX = questionX + questionWidth / 2;
                const textY = questionY + questionHeight / 2;
                
                // White text with slight shadow for readability
                fill(255, 255, 255); // White text
                stroke(0, 0, 0, 100); // Subtle black outline
                strokeWeight(2);
                text(wordToDisplay, textX, textY);
                
                pop();
            }
        }

        // Draw timer background on top of video
        const timerBgImage = images['timerBgImage'];
        if (timerBgImage) {
            noTint(); // Ensure no tint is applied
            const timerSize = width * 0.21; // 12% of canvas width
            const timerX = (width - timerSize) / 2;
            const timerY = height - timerSize - height * 0.043; // 4% from bottom
            
            drawImageSafe(timerBgImage, timerX, timerY, timerSize, timerSize);
        }

        // Draw timer foreground on top of video
        const timerFgImage = images['timerFgImage'];
        if (timerFgImage) {
            noTint(); // Ensure no tint is applied
            const timerSize = width * 0.19; // 12% of canvas width
            const timerX = (width - timerSize) / 2;
            const timerY = height - timerSize - height * 0.05; // 5% from bottom
            
            // Extract color from Timer_FG if not already done
            if (!timerFgColor) {
                extractTimerFgColor();
            }
            
            drawImageSafe(timerFgImage, timerX, timerY, timerSize, timerSize);
        }
        
        // Draw timer text with slice-based countdown effect
        drawSliceCountdown();
        
        // Draw word display on canvas
        drawWordOnCanvas();

        // Check text filling
        if (isRunning && faceDetected) {
            checkTextFilling();
        }
        
        // Show loading message if model not ready
        if (!isModelReady) {
            push();
            fill(255, 255, 255, 200);
            textAlign(CENTER, CENTER);
            textSize(24);
            text('Loading NoseNet...', width / 2, height / 2);
            pop();
        }
    }
}

function drawSliceCountdown() {
    push();
    
    const timerSize = width * 0.19; // 12% of canvas width
    const timerTextX = width / 2;
    const timerTextY = height - timerSize/2 - height * 0.05;
    const fontSize = timerSize * 0.5; // 30% of timer size
    const circleRadius = timerSize * 0.5; // Circle radius
    
    textAlign(CENTER, CENTER);
    textSize(fontSize);
    const tikTokDisplayBold = fonts['tikTokDisplayBold'];
    if (tikTokDisplayBold) {
        textFont(tikTokDisplayBold);
    } else {
        textStyle(BOLD);
    }
    
    const countdownText = timeRemaining.toString().padStart(2, '0');
    
    // Calculate slice progress (0 to 1) - how much pizza is "eaten"
    const sliceProgress = (30 - timeRemaining) / 30;
    
    // Draw the pizza slice countdown circle
    push();
    translate(timerTextX, timerTextY);
    
    // Draw the full circle background (remaining pizza)
    fill(255, 255, 255, 100); // Semi-transparent white
    stroke(255, 255, 255, 200);
    strokeWeight(3);
    ellipse(0, 0, circleRadius * 2, circleRadius * 2);
    
    // Draw the "eaten" slice (missing part) - starting from top (12 o'clock)
    if (sliceProgress > 0) {
        // Use actual Timer_FG color with opacity
        if (timerFgColor) {
            fill(timerFgColor.r, timerFgColor.g, timerFgColor.b, 180); // Timer_FG color with opacity
            stroke(timerFgColor.r, timerFgColor.g, timerFgColor.b, 220); // Timer_FG color border
        } else {
            // Fallback color if Timer_FG color not extracted yet
            fill(255, 165, 0, 180); // Orange with opacity
            stroke(255, 140, 0, 220); // Darker orange border
        }
        strokeWeight(2);
        
        // Calculate the angle for the eaten slice - starting from top (-PI/2 = 12 o'clock)
        const eatenAngle = sliceProgress * TWO_PI; // Convert progress to radians
        const startAngle = -PI/2; // Start from top (12 o'clock position)
        const endAngle = startAngle + eatenAngle;
        
        // Draw the eaten slice as an arc starting from top
        arc(0, 0, circleRadius * 2, circleRadius * 2, startAngle, endAngle, PIE);
        
        // Add a "bite mark" effect - jagged edge
        if (sliceProgress > 0.1) {
            if (timerFgColor) {
                stroke(timerFgColor.r, timerFgColor.g, timerFgColor.b, 255);
            } else {
                stroke(255, 140, 0, 255);
            }
            strokeWeight(4);
            
            // Draw jagged bite marks at the current edge
            for (let i = 0; i < 3; i++) {
                const angle = endAngle + (i - 1) * 0.1;
                const x = cos(angle) * circleRadius;
                const y = sin(angle) * circleRadius;
                point(x, y);
            }
        }
    }
    
    // Draw the countdown text in the center
    fill(255, 255, 255);
    stroke(0, 0, 0, 150); // Black outline for better visibility
    strokeWeight(3);
    text(countdownText, 0, 0);
    noStroke(); // Reset stroke
    
    // Add pulsing effect when time is low
    if (timeRemaining <= 5) {
        const pulseAlpha = 255 + Math.sin(Date.now() * 0.01) * 50;
        fill(255, 100, 100, pulseAlpha);
        text(countdownText, 0, 0);
        
        // Add pulsing circle border with Timer_FG color
        if (timerFgColor) {
            stroke(timerFgColor.r, timerFgColor.g, timerFgColor.b, pulseAlpha);
        } else {
            stroke(255, 165, 0, pulseAlpha);
        }
        strokeWeight(5);
        noFill();
        ellipse(0, 0, circleRadius * 2 + 10, circleRadius * 2 + 10);
    }
    
    pop();

    pop();
}

function drawWordOnCanvas() {
    if (!currentWord || currentWord.length === 0) return;
    
    // Get the current letter to display (excluding spaces)
    const lettersOnly = currentWord.split('').filter(char => char !== ' ');
    if (currentLetterIndex >= lettersOnly.length) return; // All letters completed
    
    const currentLetter = lettersOnly[currentLetterIndex];
    
    push();
    
    // Position the letter below center for better visibility
    const wordX = width / 2;
    const wordY = height * 0.6; 
    const fontSize = Math.min(width * 0.3, height * 0.3); // Larger font size for single letter
    
    // Draw the current letter
    textAlign(CENTER, CENTER);
    textSize(fontSize);
    const tikTokSansDisplayBold = fonts['tikTokSansDisplayBold'];
    if (tikTokSansDisplayBold) {
        textFont(tikTokSansDisplayBold);
    } else {
        textStyle(BOLD);
    }
    
    // Check if current letter is completed
    const actualIndex = getActualLetterIndex(currentLetterIndex);
    
    if (wordProgress[actualIndex]) {
        // Letter is completed - show in bold blue
        fill(254, 48, 86);
        stroke(255, 255, 255); // White outline
        strokeWeight(3);
        text(currentLetter, wordX, wordY);
        noStroke();
    } else {
        // Letter is not completed - show as outline only
        noFill(); // No fill color at all
        stroke(255, 255, 255); // White stroke/outline
        strokeWeight(3);
        text(currentLetter, wordX, wordY);
        noStroke();
    }
    
    // Draw checkpoints for the current letter (if not completed)
    if (!wordProgress[actualIndex]) {
        drawCheckpoints(currentLetter, actualIndex, wordX, wordY, fontSize);
    }
    
    pop();
}

// Draw checkpoint indicators for the current letter
function drawCheckpoints(letter, letterIndex, letterCenterX, letterCenterY, fontSize) {
    const checkpoints = checkpointDefinitions[letter.toUpperCase()];
    if (!checkpoints) return;
    
    // Use same conservative bounds as collision detection to keep checkpoints inside letter
    const letterWidth = fontSize * 0.5;   // Actual letter width is smaller (50% of font size)
    const letterHeight = fontSize * 0.6;  // Actual letter height is smaller (60% of font size)
    const letterLeft = letterCenterX - letterWidth / 2;
    const letterTop = letterCenterY - letterHeight / 2 + fontSize * 0.05; // Slight downward adjustment
    
    // Match the collision detection radius for visual consistency
    const checkpointRadius = Math.max(50, fontSize * 0.25);
    
    checkpoints.forEach((checkpoint, idx) => {
        const checkpointX = letterLeft + (checkpoint.x * letterWidth);
        const checkpointY = letterTop + (checkpoint.y * letterHeight);

        // Draw checkpoint indicator
        push();
        noFill();
        noStroke();
        
        ellipse(checkpointX, checkpointY, checkpointRadius);
        
        pop();
    });
}

// Helper function to convert visual letter index to actual character index
function getActualLetterIndex(visualIndex) {
    let actualIndex = -1;
    let visualCount = 0;
    for (let i = 0; i < currentWord.length; i++) {
        if (currentWord[i] !== ' ') {
            if (visualCount === visualIndex) {
                actualIndex = i;
                break;
            }
            visualCount++;
        }
    }
    return actualIndex;
}

// Enhanced smoothing function to eliminate shivering
function smoothNosePosition(targetX, targetY) {
    // Add current position to history
    noseHistory.push({ x: targetX, y: targetY, time: Date.now() });
    
    // Keep only recent history
    if (noseHistory.length > maxHistoryLength) {
        noseHistory.shift();
    }
    
    // Calculate weighted average of recent positions
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    const currentTime = Date.now();
    
    for (let i = 0; i < noseHistory.length; i++) {
        const age = currentTime - noseHistory[i].time;
        const weight = Math.exp(-age / 100); // Exponential decay over 100ms
        
        weightedX += noseHistory[i].x * weight;
        weightedY += noseHistory[i].y * weight;
        totalWeight += weight;
    }
    
    if (totalWeight > 0) {
        const avgX = weightedX / totalWeight;
        const avgY = weightedY / totalWeight;
        
        // Calculate distance from current smoothed position
        const deltaX = avgX - smoothedNoseX;
        const deltaY = avgY - smoothedNoseY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Adaptive smoothing based on movement distance
        let smoothingFactor;
        if (distance < 1) {
            // Very small movements: maximum smoothing to eliminate jitter
            smoothingFactor = 0.02;
        } else if (distance < 3) {
            // Small movements: heavy smoothing
            smoothingFactor = 0.05;
        } else if (distance < 8) {
            // Medium movements: moderate smoothing
            smoothingFactor = 0.15;
        } else if (distance < 25) {
            // Large movements: light smoothing
            smoothingFactor = 0.4;
        } else {
            // Very large movements: minimal smoothing for responsiveness
            smoothingFactor = 0.8;
        }
        
        // Apply smoothing
        smoothedNoseX += deltaX * smoothingFactor;
        smoothedNoseY += deltaY * smoothingFactor;
        
        // Additional stabilization: round to nearest pixel to prevent sub-pixel jitter
        smoothedNoseX = Math.round(smoothedNoseX * 2) / 2; // Round to nearest 0.5 pixel
        smoothedNoseY = Math.round(smoothedNoseY * 2) / 2;
    }
    
    return { x: smoothedNoseX, y: smoothedNoseY };
}

function transformNoseCoordinates(videoX, videoY) {
    // Transform nose coordinates from video space to canvas space
    if (!videoTransform.videoWidth || !videoTransform.videoHeight) {
        // Fallback: use coordinates as-is if transform info not available
        return { x: videoX, y: videoY };
    }
    
    // Calculate the scale factors
    const scaleX = videoTransform.drawWidth / videoTransform.videoWidth;
    const scaleY = videoTransform.drawHeight / videoTransform.videoHeight;
    
    // Transform coordinates
    const canvasX = (videoX * scaleX) + videoTransform.drawX;
    const canvasY = (videoY * scaleY) + videoTransform.drawY;
    
    return { x: canvasX, y: canvasY };
}

function drawNose() {
    // Check if face is detected and person is locked
    if (!faceDetected || !personLocked || !noseX || !noseY) {
        return;
    }
    
    // Transform coordinates from video space to canvas space
    const transformed = transformNoseCoordinates(noseX, noseY);
    let targetX = transformed.x;
    let targetY = transformed.y;
    
    // Use enhanced smoothing function
    const smoothedPos = smoothNosePosition(targetX, targetY);
    const smoothedX = smoothedPos.x;
    const smoothedY = smoothedPos.y;
    
    // Add to trail BEFORE drawing the nose dot
    addToTrail(smoothedX, smoothedY);
    
    // Draw current nose position - responsive size
    push();
    
    // Use integer positions to prevent sub-pixel rendering issues
    const drawX = Math.round(smoothedX);
    const drawY = Math.round(smoothedY);
    
    // Responsive nose dot size with better scaling - smaller and more subtle
    const baseNoseSize = 30;
    const noseDotSize = Math.max(15, baseNoseSize * scaleFactor);
    
    // Main nose dot - smaller and more subtle to avoid interfering with letters
    fill(255, 50, 50, 180); // Semi-transparent red
    noStroke();
    ellipse(drawX, drawY, noseDotSize);
    
    // Add a subtle white center for better visibility
    fill(255, 255, 255, 120);
    ellipse(drawX, drawY, noseDotSize * 0.6);
    
    pop();
    
    updateNoseIndicator();
}

function addToTrail(x, y) {
    // Don't add trail points if current letter is already completed
    if (currentLetterIndex < currentWord.split('').filter(char => char !== ' ').length) {
        const lettersOnly = currentWord.split('').filter(char => char !== ' ');
        const actualIndex = getActualLetterIndex(currentLetterIndex);
        if (wordProgress[actualIndex]) {
            return; // Current letter is completed, don't add trail points
        }
    }
    
    // Responsive movement threshold
    const threshold = Math.max(2, 3 * scaleFactor);
    
    // Only add if movement is significant enough to avoid too many duplicate points
    if (noseTrail.length === 0 || 
        Math.abs(noseTrail[noseTrail.length - 1].x - x) > threshold ||
        Math.abs(noseTrail[noseTrail.length - 1].y - y) > threshold) {
        
        noseTrail.push({ 
            x: Math.round(x), // Round trail points to prevent sub-pixel issues
            y: Math.round(y), 
            time: Date.now()
        });
    }
}

function drawNoseTrail() {
    if (noseTrail.length < 2) return;
    
    // Pre-calculate responsive values once
    const baseTrailWidth = 35;
    const baseGlowWidth = 35;
    const baseCircleSize = 35;
    const trailWidth = Math.max(10, baseTrailWidth * scaleFactor);
    const glowWidth = Math.max(15, baseGlowWidth * scaleFactor);
    const circleSize = Math.max(5, baseCircleSize * scaleFactor);
    
    // Draw trail with consistent, thick lines
    noFill();
    
    // Set stroke properties once
    strokeCap(ROUND);
    strokeJoin(ROUND);
    
    // Draw main trail lines
    stroke(255, 239, 0);
    strokeWeight(trailWidth);
    
    // Draw all trail lines in one batch for better performance
    beginShape();
    noFill();
    for (let i = 0; i < noseTrail.length; i++) {
        const point = noseTrail[i];
        vertex(point.x, point.y);
    }
    endShape();
    
    // Draw glow effect (simplified)
    stroke(255, 239, 0, 80);
    strokeWeight(glowWidth);
    beginShape();
    noFill();
    for (let i = 0; i < noseTrail.length; i++) {
        const point = noseTrail[i];
        vertex(point.x, point.y);
    }
    endShape();
    
    // Draw trail circles (reduced frequency for performance)
    fill(255, 239, 0);
    noStroke();
    for (let i = 0; i < noseTrail.length; i += 3) { // Draw every 3rd point
        const point = noseTrail[i];
        ellipse(point.x, point.y, circleSize);
    }
}

function updateNoseIndicator() {
    if (faceDetected) {
        // Convert canvas coordinates to screen coordinates (accounting for mirroring)
        const screenX = width - noseX; // Flip X coordinate
        const screenY = noseY;
        
        noseIndicator.style.left = screenX + 'px';
        noseIndicator.style.top = screenY + 'px';
        noseIndicator.classList.add('active');
    } else {
        noseIndicator.classList.remove('active');
    }
}

function checkTextFilling() {
    if (!faceDetected || !isRunning || !currentWord) return;
    
    // Get the current letter to check collision with
    const lettersOnly = currentWord.split('').filter(char => char !== ' ');
    if (currentLetterIndex >= lettersOnly.length) return; // All letters completed
    
    // Get current letter character
    const currentLetter = lettersOnly[currentLetterIndex].toUpperCase();
    
    // Canvas-based collision detection for current letter only
    const wordX = width / 2;
    const wordY = height * 0.6; // Match the new letter position
    const fontSize = Math.min(width * 0.3, height * 0.3); // MUST match the drawing font size!
    
    // Convert nose position to screen coordinates (accounting for mirroring)
    const screenX = width - noseX; // Flip X coordinate
    const screenY = noseY;
        
        // Get the actual character index for the current letter
        const actualIndex = getActualLetterIndex(currentLetterIndex);
        
    if (actualIndex >= 0 && actualIndex < currentWord.length && !wordProgress[actualIndex]) {
        // Check checkpoint-based collision for this letter
        checkCheckpointCollision(currentLetter, actualIndex, screenX, screenY, wordX, wordY, fontSize);
        
        // ALWAYS check completion status (even if not hitting new checkpoints)
        // This allows the timer to progress when you've already hit enough checkpoints
        checkLetterCompletionByCheckpoints(actualIndex, currentLetter);
    }
}

function checkCheckpointCollision(letter, letterIndex, screenX, screenY, letterCenterX, letterCenterY, fontSize) {
    // Get checkpoints for this letter
    const checkpoints = checkpointDefinitions[letter];
    if (!checkpoints) return; // No checkpoints defined for this letter
    
    // Initialize checkpoint tracking for this letter if not exists
    if (!letterCheckpoints[letterIndex]) {
        letterCheckpoints[letterIndex] = {};
    }
    
    // Define letter bounding box - more conservative to keep checkpoints inside visible letter
    // Reduced size and adjusted positioning to match actual drawn letter dimensions
    const letterWidth = fontSize * 0.5;   // Actual letter width is smaller (50% of font size)
    const letterHeight = fontSize * 0.6;  // Actual letter height is smaller (60% of font size)
    const letterLeft = letterCenterX - letterWidth / 2;
    const letterTop = letterCenterY - letterHeight / 2 + fontSize * 0.05; // Slight downward adjustment
    
    // Check each checkpoint
    checkpoints.forEach((checkpoint, idx) => {
        // Skip if already hit
        if (letterCheckpoints[letterIndex][checkpoint.label]) return;
        
        // Calculate checkpoint position in screen coordinates
        const checkpointX = letterLeft + (checkpoint.x * letterWidth);
        const checkpointY = letterTop + (checkpoint.y * letterHeight);
        
        // Check if nose is within checkpoint radius (responsive size)
        // Increased from 15% to 25% for easier hitting
        const checkpointRadius = Math.max(50, fontSize * 0.25); // 25% of font size for easier touch
        const distance = Math.sqrt(
            Math.pow(screenX - checkpointX, 2) + 
            Math.pow(screenY - checkpointY, 2)
        );
        
        if (distance < checkpointRadius) {
            // Mark checkpoint as hit
            letterCheckpoints[letterIndex][checkpoint.label] = true;
        }
    });
}


function checkLetterCompletionByCheckpoints(letterIndex, letter) {
    // Check if letter is already completed
    if (wordProgress[letterIndex]) return;
    
    const checkpoints = checkpointDefinitions[letter];
    if (!checkpoints) return;
    
    const hitCheckpoints = letterCheckpoints[letterIndex] || {};
    
    // Count how many checkpoints have been hit
    let hitCount = 0;
    checkpoints.forEach(checkpoint => {
        if (hitCheckpoints[checkpoint.label]) {
            hitCount++;
        }
    });
    
    // Calculate completion percentage
    const completionPercentage = hitCount / checkpoints.length;
    
    // Require both checkpoints to be hit (100% - ensures the letter shape is properly drawn)
    const requiredPercentage = 1.0;
    
    if (completionPercentage >= requiredPercentage) {
        // Start completion timer if not already started
        if (!letterCompletionTimers[letterIndex]) {
            letterCompletionTimers[letterIndex] = Date.now();
        }
        
        // Check if enough time has passed
        const timeElapsed = Date.now() - letterCompletionTimers[letterIndex];
        
        if (timeElapsed >= completionDelayMs) {
            // Mark letter as complete FIRST
            delete letterCompletionTimers[letterIndex];
            wordProgress[letterIndex] = true;
            
            // Clear checkpoints for this letter
            letterCheckpoints[letterIndex] = {};
            
            // Clear nose trails
            clearTrail();
            
            // Play letter completion sound immediately
            if (correctWordSound) {
                try {
                    correctWordSound.currentTime = 0;
                    correctWordSound.play().catch(() => playFallbackLetterSound());
                } catch (error) {
                    playFallbackLetterSound();
                }
            } else {
                playFallbackLetterSound();
            }
            
            // Wait 800ms before advancing to next letter (gives time to see completed letter)
            setTimeout(() => {
                // Advance to next letter after delay
                currentLetterIndex++;
                
                // Check if all letters are completed
                const lettersOnly = currentWord.split('').filter(char => char !== ' ');
                if (currentLetterIndex >= lettersOnly.length) {
                    // All letters done - show closing screen
                    setTimeout(() => {
                        showClosingScreen();
                    }, 100);
                }
            }, 1000); // 1000ms delay before switching to next letter
        }
    } else {
        // Not enough checkpoints hit - reset timer
        if (letterCompletionTimers[letterIndex]) {
            delete letterCompletionTimers[letterIndex];
        }
    }
}


function checkWordCompletion() {
    // Check if all letters are completed (spaces are automatically completed)
    let allCompleted = true;
    for (let i = 0; i < currentWord.length; i++) {
        // Spaces are automatically considered completed
        if (currentWord[i] === ' ') {
            wordProgress[i] = true;
        } else if (!wordProgress[i]) {
            allCompleted = false;
        }
    }
    
    if (allCompleted && !wordCompletedSoundPlayed) {
        // Mark that sound has been played for this word
        wordCompletedSoundPlayed = true;
        
        // Play the success sound
        if (correctWordSound) {
            correctWordSound.play();
        } else {
            playFallbackSuccessSound();
        }
        
        // Transition to closing screen after a short delay
        setTimeout(() => {
            showClosingScreen();
        }, 100); 
    }
}

function playFallbackSuccessSound() {
    // Create a simple success sound using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Create a pleasant success sound
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        // Could not play fallback sound
    }
}

function playFallbackLetterSound() {
    // Create a simple letter completion sound using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Create a pleasant letter completion sound (higher pitch than success)
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.1); // G5
        
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        // Could not play fallback letter sound
    }
}

function updateWordDisplay() {
    let displayHTML = '';
    let allFilled = true;

    for (let i = 0; i < currentWord.length; i++) {
        if (wordProgress[i]) {
            // Show fully filled letter with clean, bold styling
            displayHTML += `<span style="
                color: #ffffff; 
                text-shadow: 
                    0 0 8px rgba(0, 200, 255, 0.8),
                    0 0 16px rgba(0, 150, 255, 0.6),
                    2px 2px 4px rgba(0, 100, 255, 0.8);
                font-weight: 900;
                font-size: 1.1em;
                -webkit-text-stroke: 2px solid #0066ff;
                text-stroke: 2px solid #0066ff;
            ">${currentWord[i]}</span>`;
        } else {
            // Show unfilled letter in gray outline style (visible but not filled)
            displayHTML += `<span style="color: #666; -webkit-text-stroke: 2px #333; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${currentWord[i]}</span>`;
            allFilled = false;
        }
    }

    if (currentWordElement) {
        currentWordElement.innerHTML = displayHTML;
    }

    if (allFilled) {
        if (currentWordElement) currentWordElement.classList.add('filled');
    } else {
        if (currentWordElement) currentWordElement.classList.remove('filled');
    }
}

function randomizeWord() {
    const randomIndex = Math.floor(Math.random() * words.length);
    currentWord = words[randomIndex].trim(); // Keep spaces between letters
    currentBrand = wordToBrand[currentWord]; // Get the brand for this word
    wordProgress = {};
    letterCheckpoints = {}; // Reset checkpoints
    letterCompletionTimers = {}; // Reset completion timers
    currentLetterIndex = 0; // Start with first letter
    wordCompletedSoundPlayed = false; // Reset sound flag for new word
    
    // Simple fallback display
    if (currentWordElement) {
        currentWordElement.textContent = currentWord;
    }
    
    updateWordDisplay();
    
    // Force display the word
    setTimeout(() => {
        forceDisplayWord();
    }, 100);
}

// Add function to manually clear trail
function clearTrail() {
    noseTrail = [];
    // Trail cleared - total points removed
}

function drawBrandClosingScreen() {
    if (!currentBrand || !brandImages[currentBrand]) return;
    
    // Create canvas for closing screen if it doesn't exist
    let closingCanvas = document.getElementById('closingCanvas');
    if (!closingCanvas) {
        closingCanvas = document.createElement('canvas');
        closingCanvas.id = 'closingCanvas';
        closingCanvas.style.position = 'absolute';
        closingCanvas.style.top = '0';
        closingCanvas.style.left = '0';
        closingCanvas.style.width = '100%';
        closingCanvas.style.height = '100%';
        closingCanvas.style.objectFit = 'contain';
        closingCanvas.style.zIndex = '10000';
        closingScreenElement.appendChild(closingCanvas);
    }
    
    // Set canvas size with device pixel ratio for sharp rendering on mobile
    const dpr = window.devicePixelRatio || 1;
    closingCanvas.width = window.innerWidth * dpr;
    closingCanvas.height = window.innerHeight * dpr;
    const ctx = closingCanvas.getContext('2d');
    
    // Scale context for high DPI displays (retina/mobile)
    ctx.scale(dpr, dpr);
    
    // Use logical dimensions for drawing
    const logicalWidth = window.innerWidth;
    const logicalHeight = window.innerHeight;
    
    // Use the pre-loaded closing background image
    const closingBg = images['closingBg'];
    if (closingBg) {
        // Draw background (handle both p5.Image and HTML Image)
        const bgImg = closingBg.canvas || closingBg;
        ctx.drawImage(bgImg, 0, 0, logicalWidth, logicalHeight);
        
        // Select random product image for this brand
        const randomIndex = Math.floor(Math.random() * 3);
        const productImages = brandImages[currentBrand];
        const randomProduct = productImages[randomIndex];
        
        // Calculate positions (similar to the example image layout)
        const centerX = logicalWidth / 2;
        const centerY = logicalHeight / 2.7;
        
        // Draw product image centered based on actual image size
        if (randomProduct) {
            // Get actual image dimensions
            const imgWidth = randomProduct.width;
            const imgHeight = randomProduct.height;
            
            // Calculate max size while maintaining aspect ratio (responsive)
            const maxSize = Math.min(logicalWidth * 0.5, logicalHeight * 0.4);
            const aspectRatio = imgWidth / imgHeight;
            
            let displayWidth, displayHeight;
            if (aspectRatio > 1) {
                // Image is wider than tall
                displayWidth = Math.min(maxSize, maxSize * aspectRatio);
                displayHeight = displayWidth / aspectRatio;
            } else {
                // Image is taller than wide or square
                displayHeight = Math.min(maxSize, maxSize / aspectRatio);
                displayWidth = displayHeight * aspectRatio;
            }
            
            // Center the image based on its actual display size
            const productX = centerX - displayWidth / 2;
            const productY = centerY - displayHeight / 2;
            
            // Handle both p5.Image and HTML Image
            const prodImg = randomProduct.canvas || randomProduct;
            ctx.drawImage(prodImg, productX, productY, displayWidth, displayHeight);
        }
        
        // Draw brand name with responsive font size
        const textY = logicalHeight * 0.64;
        ctx.fillStyle = '#000000';
        
        // Responsive font size based on canvas width (mobile-friendly)
        const fontSize = Math.max(24, Math.min(56, logicalWidth * 0.052));
        ctx.font = `${fontSize}px "TikTok-Display-Bold", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(currentBrand, centerX, textY);

        // Select random product qrcode for this brand
        const productQrcodes = brandQcodes[currentBrand];
        const randomQrcode = productQrcodes[randomIndex];

        // Draw qrcode with responsive size
        // Responsive QR code size (mobile-friendly)
        const qrcodeSize = Math.max(100, Math.min(240, logicalWidth * 0.22));
        const qrcodeX = centerX - qrcodeSize / 2;
        const qrcodeY = logicalHeight * 0.704;
        
        // Handle both p5.Image and HTML Image
        const qrImg = randomQrcode.canvas || randomQrcode;
        ctx.drawImage(qrImg, qrcodeX, qrcodeY, qrcodeSize, qrcodeSize);
    }
}

// Force display word function
function forceDisplayWord() {
    if (currentWordElement && currentWord) {
        // Clear any existing content
        currentWordElement.innerHTML = '';
        
        // Get the current letter to display (excluding spaces)
        const lettersOnly = currentWord.split('').filter(char => char !== ' ');
        if (currentLetterIndex < lettersOnly.length) {
            const currentLetter = lettersOnly[currentLetterIndex];
            currentWordElement.textContent = currentLetter;
        } else {
            currentWordElement.textContent = '';
        }
        
        // Add clean styling for better visibility
        currentWordElement.style.color = '#ffffff';
        currentWordElement.style.fontSize = '72px';
        currentWordElement.style.fontWeight = '900';
        currentWordElement.style.textAlign = 'center';
        currentWordElement.style.textShadow = `
            0 0 10px rgba(0, 200, 255, 0.8),
            0 0 20px rgba(0, 150, 255, 0.6),
            2px 2px 4px rgba(0, 100, 255, 0.8)
        `;
        currentWordElement.style.webkitTextStroke = '2px solid #0066ff';
        currentWordElement.style.textStroke = '2px solid #0066ff';
        
    }
}

// Handle window resize with mobile detection
function windowResized() {
    detectMobile(); // Recalculate scaling on resize/orientation change
    
    // Calculate proper dimensions with 9:16 aspect ratio
    const dimensions = calculateCanvasDimensions();
    resizeCanvas(dimensions.width, dimensions.height);
    
    // Don't resize video - let it maintain natural aspect ratio
}

// Initialize front screen when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeFrontScreen();
});

// Clean up resources when page is unloaded
window.addEventListener('beforeunload', function() {
    cleanupGameResources();
});

// Clean up resources when page becomes hidden (mobile browsers)
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        cleanupGameResources();
    }
});