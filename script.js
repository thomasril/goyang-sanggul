// Nose Writing Game - Enhanced smoothing to eliminate shivering + Mobile Responsive
let poseNet;
let video;
let poses = [];
let noseX = 0;
let noseY = 0;
// Enhanced smoothing variables
let smoothedNoseX = 0;
let smoothedNoseY = 0;
let noseHistory = []; // Store recent nose positions for better smoothing
let maxHistoryLength = 10;
// Trail functionality restored
let noseTrail = [];
let maxTrailLength = 200; // Reduced from 500 to prevent memory issues
let isVideoReady = false;
let isModelReady = false;
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
    'Xi Yaopin': ['HERBAL', 'SEHAT']
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
let letterPaintedAreas = {};
let currentLetterIndex = 0; // Track which letter we're currently working on
let isRunning = false;
let faceDetected = false;
// Letter completion delay system
let letterCompletionTimers = {}; // Track completion timers for each letter
let completionDelayMs = 2000; // 1 second delay before marking letter as complete
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
let startGameBtn;
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
      console.log("Autoplay failed, waiting for user interaction...");
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
    startGameBtn = document.getElementById('startGameBtn');
    openingScreen = document.getElementById('openingScreen');
    closingScreen = document.getElementById('closingScreen');
    
    if (openingScreen) {
        openingScreen.addEventListener('click', startGame);
    }

    if (startGameBtn) {
        startGameBtn.addEventListener('click', startGame);
    }
    
    if (closingScreen) {
        closingScreen.addEventListener('click', function() {
            // Reload the page for a fresh start
            window.location.reload();
        });
    }
    
    // Front screen initialized
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
            video: true // Use simple video constraint like p5.js does
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
    
    // Clean up old painted areas (remove points older than 5 seconds)
    const now = Date.now();
    for (let letterIndex in letterPaintedAreas) {
        if (letterPaintedAreas[letterIndex]) {
            letterPaintedAreas[letterIndex] = letterPaintedAreas[letterIndex].filter(
                point => now - point.time < 5000
            );
        }
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
    console.log(`Word completed: ${wordIsCompleted}, Win sound available: ${!!winSound}`);
    if (wordIsCompleted && winSound) {
        console.log('Playing win sound!');
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
    
    // Clear pose detection and stop model
    if (poseNet) {
        try {
            poseNet.removeAllListeners();
        } catch (e) {
            // PoseNet cleanup completed
        }
        poseNet = null;
    }
    
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
    letterPaintedAreas = {};
    wordProgress = {};
    
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
    letterPaintedAreas = {};
    wordProgress = {};
    faceDetected = false;
    isRunning = false;
    wordCompletedSoundPlayed = false; // Reset sound flag
    
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
    
    console.log(`Canvas created: ${dimensions.width}x${dimensions.height} (9:16 ratio, target: 1080x1920)`);
    
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
    letterPaintedAreas = {};
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

function videoReady() {
    isVideoReady = true;
    
    // Hide loading screen when camera is ready
    if (loadingScreenElement) {
        loadingScreenElement.style.display = 'none';
    }
    
    // Use the correct PoseNet API for ml5.js v0.12.2x
    poseNet = ml5.poseNet(video, {
        architecture: 'MobileNetV1',
        imageScaleFactor: 0.3,
        outputStride: 16,
        flipHorizontal: false,
        minConfidence: 0.5,
        maxPoseDetections: 1,
        scoreThreshold: 0.5,
        nmsRadius: 20,
        detectionType: 'single',
        inputResolution: 513,
        multiplier: 0.75,
        quantBytes: 2
    }, modelReady);
    
    // Listen for pose detection results
    poseNet.on('pose', gotPoses);
}

function gotPoses(results) {
    poses = results;
}

function modelReady() {
    isModelReady = true;
    isRunning = true; // Start the game when model is ready
    // PoseNet model ready - Game started
}

// Global variables to store images
// (Images are now stored in the images object)
// Custom fonts
// (Fonts are now stored in the fonts object)
let timerFgColor = null; // Store the extracted color from Timer_FG

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
    console.log('Loading images from HTML (CSS approach - no CORS issues)');
    const loadPromises = [];
    
    imageNames.forEach(name => {
        const imgElement = document.getElementById('img_' + name);
        if (imgElement) {
            // Create a promise that resolves when the image is fully loaded
            const loadPromise = new Promise((resolve, reject) => {
                if (imgElement.complete && imgElement.naturalWidth > 0) {
                    // Image already loaded
                    images[name] = imgElement;
                    console.log(`Loaded ${name} from HTML (already loaded)`);
                    resolve();
                } else {
                    // Wait for image to load
                    imgElement.onload = () => {
                        images[name] = imgElement;
                        console.log(`Loaded ${name} from HTML`);
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
            console.log('Error loading Game2_CorrectWord.mp3:', e);
            correctWordSound = null;
        });
        
        // Add load event listener
        correctWordSound.addEventListener('canplaythrough', function() {
            console.log('Game2_CorrectWord.mp3 loaded successfully');
        });
        
        correctWordSound.load(); // Force load the audio
    } catch (error) {
        console.log('Error creating correctWordSound:', error);
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
    
    console.log('Fonts loaded via CSS @font-face');
}

// Setup function called after preload completes
function setup() {
    // Detect mobile and calculate dimensions first
    detectMobile();
    
    // Create an initial canvas with proper sizing (will be replaced by initializeGame)
    // We need this so drawingContext exists for HTML image drawing
    const initialDimensions = calculateCanvasDimensions();
    createCanvas(initialDimensions.width, initialDimensions.height);
    
    console.log(`Initial canvas: ${initialDimensions.width}x${initialDimensions.height}`);
    
    // Load images from HTML and wait for them to be ready
    loadImagesFromHTML().then(() => {
        console.log('All images loaded from HTML');
        
        // Setup brand images from HTML-loaded images
        setupBrandImages();
        
        // Wait for CSS fonts to load before marking as ready
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                assetsLoaded = true;
                console.log('Setup complete - all assets ready (images from HTML, fonts from CSS)');
            });
        } else {
            // Fallback if fonts API not available
            assetsLoaded = true;
            console.log('Setup complete - all assets ready');
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
    brandImages['Xi Yaopin'] = [
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
    brandQcodes['Xi Yaopin'] = [
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
        // Default color - a nice blue/cyan for the timer
        timerFgColor = { r: 0, g: 200, b: 255, a: 255 };
        console.log('Using default timer color (skipping pixel extraction to avoid CORS)');
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

        // Draw poses if detected
        if (poses.length > 0) {
            drawNose(poses[0]);
        }

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
    console.log(`Drawing letter ${currentLetter}, actualIndex: ${actualIndex}, completed: ${wordProgress[actualIndex]}`);
    
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
    
    pop();
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

function drawNose(pose) {
    // Check if pose has keypoints and nose exists
    if (pose.pose && pose.pose.keypoints) {
        let nosePoint = pose.pose.keypoints.find(kp => kp.part === 'nose');
        
        if (nosePoint && nosePoint.score > 0.2) {
            let videoX = nosePoint.position.x;
            let videoY = nosePoint.position.y;
            
            // Transform coordinates from video space to canvas space
            const transformed = transformNoseCoordinates(videoX, videoY);
            let targetX = transformed.x;
            let targetY = transformed.y;
            
            // Use enhanced smoothing function
            const smoothedPos = smoothNosePosition(targetX, targetY);
            noseX = smoothedPos.x;
            noseY = smoothedPos.y;
            
            // Add to trail BEFORE drawing the nose dot
            addToTrail(noseX, noseY);
            
            // Draw current nose position - responsive size
            push();
            
            // Use integer positions to prevent sub-pixel rendering issues
            const drawX = Math.round(noseX);
            const drawY = Math.round(noseY);
            
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
            
            faceDetected = true;
            updateNoseIndicator();
            
        } else {
            faceDetected = false;
        }
    } else {
        faceDetected = false;
    }
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
        
        // Prevent memory accumulation by limiting trail length
        if (noseTrail.length > maxTrailLength) {
            noseTrail.shift(); // Remove oldest point
        }
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
    
    // Canvas-based collision detection for current letter only
    const wordX = width / 2;
    const wordY = height * 0.6; // Match the new letter position
    const fontSize = Math.min(width * 0.15, height * 0.15); // Match the drawing font size
    
    // Convert nose position to screen coordinates (accounting for mirroring)
    const screenX = width - noseX; // Flip X coordinate
    const screenY = noseY;
    
    // Check if nose is over the current letter area (larger collision area for single letter)
    const letterSize = fontSize;
    const letterLeft = wordX - letterSize / 2;
    const letterRight = wordX + letterSize / 2;
    const letterTop = wordY - letterSize / 2;
    const letterBottom = wordY + letterSize / 2;
    
    if (screenX >= letterLeft - 50 && screenX <= letterRight + 50 &&
        screenY >= letterTop - 50 && screenY <= letterBottom + 50) {
        
        // Get the actual character index for the current letter
        const actualIndex = getActualLetterIndex(currentLetterIndex);
        
        if (actualIndex >= 0 && actualIndex < currentWord.length) {
            // Only add painted area if letter is not already completed
            if (!wordProgress[actualIndex]) {
                // Add painted area for this letter
                addPaintedArea(actualIndex, screenX, screenY, letterSize);
            }
        }
    }
}

function addPaintedArea(letterIndex, screenX, screenY, letterWidth) {
    // Initialize painted areas for this letter if not exists
    if (!letterPaintedAreas[letterIndex]) {
        letterPaintedAreas[letterIndex] = [];
    }
    
    // Calculate position within the letter
    const wordX = width / 2;
    const wordY = height * 0.6; // Match the new letter position
    const fontSize = Math.min(width * 0.12, height * 0.12);
    const startX = wordX - (currentWord.length * letterWidth) / 2;
    
    const letterStartX = startX + (letterIndex * letterWidth);
    const relativeLetterX = screenX - letterStartX;
    const relativeLetterY = screenY - wordY;
    
    // Add painted point with timestamp
    letterPaintedAreas[letterIndex].push({
        x: relativeLetterX,
        y: relativeLetterY,
        time: Date.now(),
        delayTime: Date.now() + 100 // Small delay for visual effect
    });
    
    // Check if letter is complete
    checkLetterCompletion(letterIndex, letterWidth);
}

function checkLetterCompletion(letterIndex, letterWidth) {
    const paintedPoints = letterPaintedAreas[letterIndex];
    
    // Check if letter is already completed to prevent multiple completions
    if (wordProgress[letterIndex]) return;
    
    // Check if letter meets completion criteria
    if (paintedPoints && paintedPoints.length >= 10) {
        // Start completion timer if not already started
        if (!letterCompletionTimers[letterIndex]) {
            letterCompletionTimers[letterIndex] = Date.now();
            console.log(`Letter ${letterIndex} completion timer started - need to maintain for ${completionDelayMs}ms`);
        }
        
        // Check if enough time has passed
        const timeElapsed = Date.now() - letterCompletionTimers[letterIndex];
        if (timeElapsed >= completionDelayMs) {
            // Mark letter as complete after delay
            delete letterCompletionTimers[letterIndex]; // Clean up timer
        wordProgress[letterIndex] = true;
        console.log(`Letter at index ${letterIndex} completed!`);
        
        // Play letter completion sound with fallback
        console.log(`CorrectWordSound available: ${!!correctWordSound}`);
        if (correctWordSound) {
            try {
                // Reset audio to beginning
                correctWordSound.currentTime = 0;
                
                // Try to play the sound
                const playPromise = correctWordSound.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        console.log('Playing Game2_CorrectWord sound');
                    }).catch((error) => {
                        console.log('Error playing correctWordSound:', error);
                        // Fallback: play a simple beep sound
                        playFallbackLetterSound();
                    });
                }
            } catch (error) {
                console.log('Error playing correctWordSound:', error);
                // Fallback: play a simple beep sound
                playFallbackLetterSound();
            }
        } else {
            console.log('correctWordSound is null or undefined');
            // Fallback: play a simple beep sound
            playFallbackLetterSound();
        }
        
        // Clear nose trails for clean visual reset
        clearTrail();
        console.log('Cleared nose trails after letter completion');
        
        // Add delay before advancing to next letter
        setTimeout(() => {
            // Advance to next letter
            currentLetterIndex++;
            
            // Check if all letters are completed
            const lettersOnly = currentWord.split('').filter(char => char !== ' ');
            if (currentLetterIndex >= lettersOnly.length) {
                // All letters completed, show closing screen
                setTimeout(() => {
                    showClosingScreen();
                }, 100);
            }
        }, 1000);
        }
    } else {
        // Letter no longer meets completion criteria - reset timer
        if (letterCompletionTimers[letterIndex]) {
            console.log(`Letter ${letterIndex} completion timer reset - criteria no longer met`);
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
            // Calculate partial progress for this letter
            const paintedPoints = letterPaintedAreas[i] || [];
            const progress = Math.min(paintedPoints.length / 15, 1); // Max at 15 points
            
            if (progress > 0) {
                // Show partially filled letter with gradient effect
                const opacity = 0.3 + (progress * 0.7); // 30% to 100% opacity
                const blueIntensity = Math.floor(progress * 255);
                displayHTML += `<span style="
                    color: rgba(0, 102, 255, ${opacity}); 
                    -webkit-text-stroke: ${3 - (progress * 2)}px #333; 
                    text-shadow: 2px 2px 4px rgba(0,102,255,${progress * 0.5});
                    transition: all 0.3s ease;
                ">${currentWord[i]}</span>`;
            } else {
                // Show unfilled letter in gray outline style (visible but not filled)
                displayHTML += `<span style="color: #666; -webkit-text-stroke: 2px #333; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${currentWord[i]}</span>`;
            }
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
    letterPaintedAreas = {}; // Clear painted areas
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
        const productImages = brandImages[currentBrand];
        const randomProduct = productImages[Math.floor(Math.random() * productImages.length)];
        
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
        const randomQrcode = productQrcodes[Math.floor(Math.random() * productQrcodes.length)];

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
    
    console.log(`Canvas resized to: ${dimensions.width}x${dimensions.height} (9:16 ratio)`);
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