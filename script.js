// script.js - קוד סופי: זום מותנה (80% / 90%), יציבות מגע, מחזור אובייקטים, וחלודה מיידית

// הגדרות עיקריות
const MAX_ZOOM = 10;
const MIN_ZOOM_DEFAULT = 0.8; // 80% זום-אאוט ברירת מחדל (לאובייקטים 0, 1, 4)
const MIN_ZOOM_TIGHT = 0.9; // 90% זום-אאוט (פחות מרווח - לאובייקטים 2 ו-3)
const RUST_THRESHOLD = [1.05, 2, 3.5]; 
const RUST_HOLD_DELAY_MS = 2000; 
const GLITCH_DURATION_MS = 500; 
const MIN_PAN_ZOOM = 1.05; 
const NUM_OBJECTS = 5; // **עדכון: יש 5 אובייקטים (0 עד 4) - אנא ודא שזה המספר הנכון!**

// אלמנטים
const imageContainer = document.getElementById('image-container');
const glitchOverlay = document.getElementById('glitch-overlay');
const objectGroups = document.querySelectorAll('.object-group');

// מצב גלובלי
let currentZoom = MIN_ZOOM_DEFAULT; // אתחול עם ברירת המחדל, יתוקן מיד באתחול.
let currentObjectIndex = 0; 
let isGlitching = false;
let rustHoldTimeoutId = null;
let glitchTimeoutId = null;
let maxRustLevel = 0; 

// --- משתנים לגרירת עכבר וקיזוז מגע ---
let isDragging = false; 
let startX = 0; 
let startY = 0;
let currentTranslateX = 0; 
let currentTranslateY = 0; 
let previousTranslateX = 0; 
let previousTranslateY = 0;

// --- משתנים לזום דינמי (Pinch) ---
let initialDistance = 0;
let isPinching = false;
let initialFocusPointX = 0; 
let initialFocusPointY = 0; 


// ------------------------------------------
// פונקציות עזר (כולל הזום המותנה)
// ------------------------------------------

function getMinZoomForCurrentObject() {
    // אובייקטים 2 ו-3 הם אינדקס 2 ו-3 ב-JavaScript.
    if (currentObjectIndex === 2 || currentObjectIndex === 3) {
        return MIN_ZOOM_TIGHT; // 0.9 (פחות זום-אאוט)
    }
    return MIN_ZOOM_DEFAULT; // 0.8 (זום-אאוט ברירת מחדל)
}

function getCurrentObjectLayers() {
    const activeGroup = objectGroups[currentObjectIndex];
    const cleanLayer = activeGroup.querySelector('.clean');
    const rustLayers = [
        activeGroup.querySelector('.rust1'),
        activeGroup.querySelector('.rust2'),
        activeGroup.querySelector('.rust3')
    ];
    return { cleanLayer, rustLayers };
}

function cycleToNextObject() {
    // 1. כבה את הקבוצה הנוכחית
    objectGroups[currentObjectIndex].classList.remove('active');
    
    // 2. עדכן את האינדקס
    currentObjectIndex = (currentObjectIndex + 1) % NUM_OBJECTS;
    
    // 3. הפעל את הקבוצה הבאה
    objectGroups[currentObjectIndex].classList.add('active');
    
    // 🌟 איפוס הזום והמיקום לאובייקט החדש (משתמש בזום המותנה) 🌟
    currentZoom = getMinZoomForCurrentObject(); 
    currentTranslateX = 0;
    currentTranslateY = 0;
    previousTranslateX = 0;
    previousTranslateY = 0;
    updateImageTransform(); 
    
    maxRustLevel = 0; // איפוס חלודה
}


// ------------------------------------------
// פונקציות ליבה (עדכון כל הלוגיקה לזום המותנה)
// ------------------------------------------

function updateImageTransform() {
    imageContainer.style.transformOrigin = '50% 50%'; 
    imageContainer.style.transform = 
        `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${currentZoom})`;
}

function updateRustLayers() {
    if (rustHoldTimeoutId || isGlitching) return;
    
    const { cleanLayer, rustLayers } = getCurrentObjectLayers();

    let currentRustVisible = false;
    let currentMaxRustIndex = -1;

    rustLayers.forEach((layer, index) => {
        if (currentZoom >= RUST_THRESHOLD[index]) {
            currentMaxRustIndex = index;
        }
    });

    maxRustLevel = Math.max(maxRustLevel, currentMaxRustIndex + 1);

    // חלודה מופיעה רק מעל 105% זום
    if (currentZoom < 1.05) { 
        rustLayers.forEach(layer => layer.style.opacity = 0);
        cleanLayer.style.opacity = 1;
    } else {
        for (let i = 0; i < rustLayers.length; i++) {
            if (i < maxRustLevel) {
                rustLayers[i].style.opacity = 1;
                currentRustVisible = true;
            } else {
                rustLayers[i].style.opacity = 0;
            }
        }
        cleanLayer.style.opacity = currentRustVisible ? 0 : 1;
    }
}

function activateGlitchAndReset() {
    if (isGlitching) return;
    isGlitching = true;
    glitchOverlay.classList.add('glitching'); 

    glitchTimeoutId = setTimeout(() => {
        glitchOverlay.classList.remove('glitching');
        isGlitching = false;
        glitchTimeoutId = null;

        currentTranslateX = 0;
        currentTranslateY = 0;
        previousTranslateX = 0;
        previousTranslateY = 0;
        
        // cycleToNextObject מטפלת באיפוס הזום לערך המינימלי הנכון
        cycleToNextObject(); 
        
        // איפוס חזותי של האובייקט החדש (למצב נקי)
        const { cleanLayer, rustLayers } = getCurrentObjectLayers();
        rustLayers.forEach(layer => layer.style.opacity = 0);
        cleanLayer.style.opacity = 1;
        
    }, GLITCH_DURATION_MS);
}

function performZoom(delta) {
    if (rustHoldTimeoutId) {
        clearTimeout(rustHoldTimeoutId);
        rustHoldTimeoutId = null;
    }
    
    // קטיעת גליץ'
    if (glitchTimeoutId) {
        clearTimeout(glitchTimeoutId);
        glitchTimeoutId = null;
        glitchOverlay.classList.remove('glitching');
        isGlitching = false;
        
        // איפוס מלא לאחר קטיעת גליץ'
        currentZoom = getMinZoomForCurrentObject(); 
        currentTranslateX = 0; currentTranslateY = 0;
        previousTranslateX = 0; previousTranslateY = 0;
        updateImageTransform();
        cycleToNextObject(); 
        maxRustLevel = 0; 
        const { cleanLayer, rustLayers } = getCurrentObjectLayers();
        rustLayers.forEach(layer => layer.style.opacity = 0);
        cleanLayer.style.opacity = 1;
        return;
    }
    if (isGlitching) return;

    const minZoom = getMinZoomForCurrentObject(); // קבלת ערך מותנה
    let newZoom = currentZoom + delta;
    newZoom = Math.max(minZoom, Math.min(MAX_ZOOM, newZoom)); // שימוש בערך המותנה
    
    // אם הזום חוזר למצב המינימלי, נאפס את מיקום התרגום
    if (newZoom === minZoom) { 
        currentTranslateX = 0;
        currentTranslateY = 0;
        previousTranslateX = 0;
        previousTranslateY = 0;
    }

    currentZoom = newZoom;
    updateImageTransform();
    updateRustLayers();

    // הפעל טיימר גליץ' רק אם אנחנו מגיעים למצב זום מינימלי
    if (currentZoom <= minZoom && delta < 0) { // שימוש בערך המותנה
        const { cleanLayer, rustLayers } = getCurrentObjectLayers();
        rustLayers.forEach(layer => layer.style.opacity = 0);
        if (rustLayers[2]) rustLayers[2].style.opacity = 1; 
        cleanLayer.style.opacity = 0;
        
        if (!rustHoldTimeoutId) {
             rustHoldTimeoutId = setTimeout(() => {
                 rustHoldTimeoutId = null;
                 activateGlitchAndReset();
             }, RUST_HOLD_DELAY_MS);
        }
    }
}

// ------------------------------------------
// לוגיקת מגע ועכבר (שימוש בזום המותנה)
// ------------------------------------------

function handleWheel(event) {
    event.preventDefault();
    const delta = -event.deltaY * 0.005;
    currentTranslateX = previousTranslateX;
    currentTranslateY = previousTranslateY;
    performZoom(delta);
}

function handleMouseDown(event) {
    if (isGlitching || event.button !== 0 || isPinching) return; 
    
    // גרירה (Pan) מופעלת רק אם אנחנו מעל 100% זום
    if (currentZoom > 1) { 
        isDragging = true;
        startX = event.clientX;
        startY = event.clientY;
        previousTranslateX = currentTranslateX; 
        previousTranslateY = currentTranslateY;
        imageContainer.style.cursor = 'grabbing';
    }
}

function handleMouseMove(event) {
    if (!isDragging || isGlitching || isPinching) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    
    currentTranslateX = previousTranslateX + dx;
    currentTranslateY = previousTranslateY + dy;
    updateImageTransform();
}

function handleMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    previousTranslateX = currentTranslateX; 
    previousTranslateY = currentTranslateY;
    imageContainer.style.cursor = 'grab';
}

function getDistance(t1, t2) {
    return Math.sqrt(
        Math.pow(t2.clientX - t1.clientX, 2) +
        Math.pow(t2.clientY - t1.clientY, 2)
    );
}

function getCenter(t1, t2) {
    return {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
    };
}

function getRelativePosition(clientX, clientY) {
    const rect = imageContainer.getBoundingClientRect();
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}


function handleTouchStart(event) {
    if (rustHoldTimeoutId || isGlitching) {
        if (rustHoldTimeoutId) clearTimeout(rustHoldTimeoutId);
        if (glitchTimeoutId) clearTimeout(glitchTimeoutId);
        rustHoldTimeoutId = null;
        glitchTimeoutId = null;
        glitchOverlay.classList.remove('glitching');
        isGlitching = false;
        
        // איפוס מלא לאחר קטיעת גליץ'
        currentZoom = getMinZoomForCurrentObject(); 
        currentTranslateX = 0; currentTranslateY = 0;
        previousTranslateX = 0; previousTranslateY = 0;
        updateImageTransform();
        cycleToNextObject(); 
        maxRustLevel = 0; 
        const { cleanLayer, rustLayers } = getCurrentObjectLayers();
        rustLayers.forEach(layer => layer.style.opacity = 0);
        cleanLayer.style.opacity = 1;
        return;
    }
    
    isDragging = false;
    isPinching = false;
    
    if (event.touches.length === 2) {
        isPinching = true;
        
        initialDistance = getDistance(event.touches[0], event.touches[1]);
        const center = getCenter(event.touches[0], event.touches[1]);
        const relativeCenter = getRelativePosition(center.x, center.y);

        initialFocusPointX = relativeCenter.x;
        initialFocusPointY = relativeCenter.y;

        previousTranslateX = currentTranslateX;
        previousTranslateY = currentTranslateY;
        
    } else if (event.touches.length === 1 && currentZoom >= MIN_PAN_ZOOM) {
        // גרירת Pan רק מעל 100% זום
        isDragging = true;
        
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        
        previousTranslateX = currentTranslateX;
        previousTranslateY = currentTranslateY;
    }
}

function handleTouchMove(event) {
    if (isGlitching) return;
    event.preventDefault(); 
    
    if (isPinching && event.touches.length === 2) {
        // --- Pinch Zoom ---
        
        const minZoom = getMinZoomForCurrentObject(); // קבלת ערך מותנה
        const newDistance = getDistance(event.touches[0], event.touches[1]);
        const scaleFactor = newDistance / initialDistance;

        const oldZoom = currentZoom;
        const newZoom = Math.max(minZoom, Math.min(MAX_ZOOM, oldZoom * scaleFactor)); // שימוש בערך המותנה
        
        if (newZoom === oldZoom) return;

        // חישוב קיזוז
        const containerRect = imageContainer.getBoundingClientRect();
        const halfWidth = containerRect.width / 2;
        const halfHeight = containerRect.height / 2;
        
        const focusOffsetX = initialFocusPointX - halfWidth;
        const focusOffsetY = initialFocusPointY - halfHeight;

        const compensateX = focusOffsetX * (newZoom - oldZoom);
        const compensateY = focusOffsetY * (newZoom - oldZoom);

        currentTranslateX = previousTranslateX - compensateX;
        currentTranslateY = previousTranslateY - compensateY;
        
        currentZoom = newZoom;
        updateImageTransform();
        updateRustLayers(); 

        // לוגיקת גליץ' / חלודה (שימוש בערך המותנה)
        if (currentZoom <= minZoom) { 
            const { cleanLayer, rustLayers } = getCurrentObjectLayers();
            rustLayers.forEach(layer => layer.style.opacity = 0);
            if (rustLayers[2]) rustLayers[2].style.opacity = 1; 
            cleanLayer.style.opacity = 0;

            if (!rustHoldTimeoutId) {
                 rustHoldTimeoutId = setTimeout(() => {
                     rustHoldTimeoutId = null;
                     activateGlitchAndReset();
                 }, RUST_HOLD_DELAY_MS);
            }
        } else {
            if (rustHoldTimeoutId) {
                clearTimeout(rustHoldTimeoutId);
                rustHoldTimeoutId = null;
            }
        }
        
        previousTranslateX = currentTranslateX;
        previousTranslateY = currentTranslateY;
        initialDistance = newDistance;

    } else if (isDragging && event.touches.length === 1) {
        // --- Drag Pan ---
        
        const dx = event.touches[0].clientX - startX;
        const dy = event.touches[0].clientY - startY;

        currentTranslateX = previousTranslateX + dx;
        currentTranslateY = previousTranslateY + dy;
        updateImageTransform();
    }
}

function handleTouchEnd() {
    if (isPinching || isDragging) {
        previousTranslateX = currentTranslateX; 
        previousTranslateY = currentTranslateY;
    }
    
    isPinching = false;
    isDragging = false; 

    initialFocusPointX = 0; 
    initialFocusPointY = 0;
    
    // מטפל בהמתנת הגליץ' לאחר סיום מגע (שימוש בערך המותנה)
    if (currentZoom <= getMinZoomForCurrentObject() && !rustHoldTimeoutId && !isGlitching) {
         const { cleanLayer, rustLayers } = getCurrentObjectLayers();
         rustLayers.forEach(layer => layer.style.opacity = 0);
         if (rustLayers[2]) rustLayers[2].style.opacity = 1; 
         cleanLayer.style.opacity = 0;
         
         rustHoldTimeoutId = setTimeout(() => {
             rustHoldTimeoutId = null;
             activateGlitchAndReset();
         }, RUST_HOLD_DELAY_MS);
    }
}

// ------------------------------------------
// חיבור מאזיני אירועים ואתחול
// ------------------------------------------

window.addEventListener('wheel', handleWheel, { passive: false });
imageContainer.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseup', handleMouseUp); 
window.addEventListener('touchstart', handleTouchStart, { passive: false });
window.addEventListener('touchmove', handleTouchMove, { passive: false });
window.addEventListener('touchend', handleTouchEnd);


// אתחול: התחלה עם הזום המינימלי הנכון לאובייקט הראשון
currentZoom = getMinZoomForCurrentObject();
updateImageTransform();
objectGroups[currentObjectIndex].classList.add('active'); 
const { cleanLayer, rustLayers } = getCurrentObjectLayers();
cleanLayer.style.opacity = 1;
rustLayers.forEach(layer => layer.style.opacity = 0);