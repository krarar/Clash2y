// Clashy PWA - Main Application JavaScript
// Version 5.0.0 - PWA Edition

// إعدادات Supabase
const SUPABASE_URL = 'https://wgvkbrmcgejscgsyapcs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indndmticm1jZ2Vqc2Nnc3lhcGNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MzgwOTUsImV4cCI6MjA2NTExNDA5NX0.FfODkBYSgTBBkoNP40YixlQphKyrzYbuwqSip7-smuU';

// Global variables
let supabase;
let stores = {};
let isAdmin = localStorage.getItem('clashy_admin') === 'true';
let isConnected = false;
let deferredPrompt;
let serviceWorkerRegistration;

// PWA Installation
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('📱 PWA install prompt available');
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
});

// Initialize PWA
async function initializePWA() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        try {
            serviceWorkerRegistration = await navigator.serviceWorker.register('./service-worker.js');
            console.log('✅ Service Worker registered:', serviceWorkerRegistration);
            
            // Listen for service worker updates
            serviceWorkerRegistration.addEventListener('updatefound', () => {
                const newWorker = serviceWorkerRegistration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showNotification('🔄 تحديث جديد متاح - أعد تحميل الصفحة', 'warning');
                    }
                });
            });
            
            // Handle service worker messages
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'STORES_UPDATED') {
                    console.log('📦 Stores updated via service worker');
                    loadStoresFromData(event.data.data);
                }
            });
            
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
        }
    }
    
    // Setup background sync
    if ('sync' in window.ServiceWorkerRegistration.prototype) {
        console.log('🔄 Background sync supported');
    }
    
    // Setup push notifications
    if ('PushManager' in window) {
        console.log('🔔 Push notifications supported');
    }
    
    // Handle app shortcuts
    if ('getInstalledRelatedApps' in navigator) {
        try {
            const relatedApps = await navigator.getInstalledRelatedApps();
            console.log('📱 Related apps:', relatedApps);
        } catch (error) {
            console.log('📱 No related apps found');
        }
    }
}

// Show install banner
function showInstallBanner() {
    const banner = document.getElementById('installBanner');
    const installActionBtn = document.getElementById('installActionBtn');
    
    if (banner && deferredPrompt) {
        banner.classList.add('show');
        installActionBtn.classList.remove('hide');
        
        // Auto hide after 10 seconds
        setTimeout(() => {
            if (banner.classList.contains('show')) {
                banner.classList.remove('show');
            }
        }, 10000);
    }
}

// Install PWA
async function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('✅ PWA installation accepted');
            showNotification('📱 تم تثبيت التطبيق بنجاح!');
            hideInstallBanner();
        } else {
            console.log('❌ PWA installation declined');
            showNotification('📱 يمكنك تثبيت التطبيق لاحقاً', 'warning');
        }
        
        deferredPrompt = null;
    } else {
        // Manual installation instructions
        showInstallInstructions();
    }
}

// Hide install banner
function hideInstallBanner() {
    const banner = document.getElementById('installBanner');
    const installActionBtn = document.getElementById('installActionBtn');
    
    if (banner) {
        banner.classList.remove('show');
    }
    if (installActionBtn) {
        installActionBtn.classList.add('hide');
    }
}

// Show manual install instructions
function showInstallInstructions() {
    const userAgent = navigator.userAgent.toLowerCase();
    let instructions = '';
    
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
        instructions = 'في Chrome: اضغط على القائمة (⋮) ← تثبيت التطبيق';
    } else if (userAgent.includes('firefox')) {
        instructions = 'في Firefox: اضغط على أيقونة المنزل في شريط العناوين';
    } else if (userAgent.includes('safari')) {
        instructions = 'في Safari: اضغط على المشاركة ← إضافة إلى الشاشة الرئيسية';
    } else if (userAgent.includes('edge')) {
        instructions = 'في Edge: اضغط على القائمة (⋯) ← التطبيقات ← تثبيت هذا الموقع كتطبيق';
    } else {
        instructions = 'ابحث عن خيار "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية" في متصفحك';
    }
    
    showNotification(`📱 ${instructions}`, 'warning');
}

// Initialize Supabase
function initSupabase() {
    try {
        if (typeof window.supabase === 'undefined') {
            console.error('❌ Supabase library not loaded');
            updateDBStatus('error', 'مكتبة Supabase غير محملة');
            return false;
        }

        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        testSupabaseConnection();
        
        console.log('✅ Supabase client initialized');
        updateDBStatus('connected', 'جاري اختبار الاتصال...');
        isConnected = true;
        return true;
    } catch (error) {
        console.error('❌ Supabase initialization error:', error);
        updateDBStatus('error', 'خطأ في إعداد الاتصال');
        isConnected = false;
        return false;
    }
}

// Test Supabase connection
async function testSupabaseConnection() {
    try {
        const { data, error } = await supabase
            .from('stores')
            .select('count', { count: 'exact', head: true });

        if (error) {
            console.warn('⚠️ Connection test failed:', error);
            updateDBStatus('error', 'فشل اختبار الاتصال');
            isConnected = false;
        } else {
            console.log('✅ Connection test successful');
            updateDBStatus('connected', 'متصل بنجاح');
            isConnected = true;
        }
    } catch (error) {
        console.error('❌ Connection test error:', error);
        updateDBStatus('error', 'خطأ في اختبار الاتصال');
        isConnected = false;
    }
}

// Update database status indicator
function updateDBStatus(status, message) {
    const dbStatus = document.getElementById('dbStatus');
    const dbStatusText = document.getElementById('dbStatusText');
    
    if (dbStatus && dbStatusText) {
        dbStatus.className = `db-status ${status}`;
        dbStatusText.textContent = message;
    }
}

// Load stores from Supabase
async function loadStoresFromDB() {
    if (!isConnected) {
        console.log('📡 لا يوجد اتصال بقاعدة البيانات، تحميل البيانات الافتراضية...');
        loadDefaultStores();
        return;
    }

    try {
        const { data, error } = await supabase
            .from('stores')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ خطأ في تحميل المتاجر:', error);
            loadDefaultStores();
            updateDBStatus('error', 'خطأ في تحميل البيانات');
            return;
        }

        console.log('📦 تم تحميل المتاجر من قاعدة البيانات:', data);
        loadStoresFromData(data);
        
        updateDBStatus('connected', `متصل - ${Object.keys(stores).length} متجر`);
    } catch (error) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', error);
        loadDefaultStores();
        updateDBStatus('error', 'خطأ في الاتصال');
    }
}

// Load stores from data array
function loadStoresFromData(data) {
    // Clear existing stores
    stores = {};
    const storesGrid = document.getElementById('storesGrid');
    const addBtn = document.getElementById('addStoreBtn');
    if (storesGrid) {
        storesGrid.innerHTML = '';
        if (addBtn) {
            storesGrid.appendChild(addBtn);
        }
    }

    // Add stores from database
    if (data && data.length > 0) {
        data.forEach(store => {
            stores[store.id] = {
                id: store.id,
                name: store.name,
                description: store.description,
                url: store.url,
                icon: store.icon,
                color: store.color,
                available: store.available || true,
                fromDB: true
            };
            addStoreToGrid(store.id, stores[store.id]);
        });
        updateStoreCount();
        showNotification(`📦 تم تحميل ${data.length} متجر من قاعدة البيانات`);
    } else {
        loadDefaultStores();
    }
}

// Load default stores (fallback)
function loadDefaultStores() {
    stores = {
        'alhajami': {
            id: 'alhajami',
            name: 'محلات الحجامي',
            description: 'أجود أنواع الشالات والطرحات والسجادات التركية الأصلية بأفضل الأسعار',
            url: './alhajami.html',
            icon: 'fas fa-user-tie',
            color: 'textiles',
            available: true,
            fromDB: false
        }
    };

    const storesGrid = document.getElementById('storesGrid');
    const addBtn = document.getElementById('addStoreBtn');
    if (storesGrid) {
        storesGrid.innerHTML = '';
        if (addBtn) {
            storesGrid.appendChild(addBtn);
        }
        
        Object.entries(stores).forEach(([storeId, store]) => {
            addStoreToGrid(storeId, store);
        });
    }
    
    updateStoreCount();
    showNotification('📦 تم تحميل البيانات الافتراضية', 'warning');
}

// Save store to Supabase
async function saveStoreToSupabase(storeData) {
    if (!isConnected) {
        showNotification('❌ لا يوجد اتصال بقاعدة البيانات', 'error');
        return null;
    }

    try {
        const { data, error } = await supabase
            .from('stores')
            .insert([{
                name: storeData.name,
                description: storeData.description,
                url: storeData.url,
                icon: storeData.icon,
                color: storeData.color,
                available: storeData.available || true
            }])
            .select()
            .single();

        if (error) {
            console.error('❌ خطأ في حفظ المتجر:', error);
            showNotification('❌ خطأ في حفظ المتجر', 'error');
            return null;
        }

        console.log('✅ تم حفظ المتجر في قاعدة البيانات:', data);
        return data;
    } catch (error) {
        console.error('❌ خطأ في الاتصال:', error);
        showNotification('❌ خطأ في الاتصال بقاعدة البيانات', 'error');
        return null;
    }
}

// Sync data manually
async function syncData() {
    const syncBtn = document.getElementById('syncBtn');
    const syncIcon = syncBtn?.querySelector('i');
    
    if (syncIcon) {
        syncIcon.classList.add('syncing');
    }
    showNotification('🔄 جاري مزامنة البيانات...');
    
    await loadStoresFromDB();
    
    setTimeout(() => {
        if (syncIcon) {
            syncIcon.classList.remove('syncing');
        }
        showNotification('✅ تم تحديث البيانات بنجاح');
    }, 1000);
}

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    showLoadingOverlay();
    
    // Initialize PWA features
    await initializePWA();
    
    // Wait for external scripts to load
    setTimeout(async () => {
        let supabaseReady = false;
        let attempts = 0;
        const maxAttempts = 3;

        while (!supabaseReady && attempts < maxAttempts) {
            attempts++;
            console.log(`🔄 محاولة تهيئة Supabase (${attempts}/${maxAttempts})...`);
            
            if (typeof window.supabase !== 'undefined') {
                supabaseReady = initSupabase();
                if (supabaseReady) break;
            } else {
                console.warn(`⚠️ Supabase library not found (attempt ${attempts})`);
                updateDBStatus('error', `محاولة ${attempts}: المكتبة غير محملة`);
            }
            
            if (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (!supabaseReady) {
            console.warn('⚠️ تم التحول إلى الوضع المحلي');
            updateDBStatus('error', 'وضع محلي - لا يوجد اتصال');
        }
        
        await loadStoresFromDB();
        initializeApp();
        
        if (isAdmin) {
            showAdminElements();
        }
        
        hideLoadingOverlay();
        
        setTimeout(() => {
            if (isConnected) {
                showNotification('🎉 PWA التحديث الخامس: متصل بقاعدة البيانات!');
            } else {
                showNotification('⚠️ وضع محلي - تحقق من الاتصال بالإنترنت', 'warning');
            }
        }, 500);
    }, 2000);
});

// Initialize app features
function initializeApp() {
    initScrollAnimations();
    initHeaderScrollEffect();
    setupKeyboardShortcuts();
    setupTouchGestures();
    setupRealtimeUpdates();
    
    // Check if app is installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('📱 App is running as PWA');
        hideInstallBanner();
    }
}

// Header scroll effect
function initHeaderScrollEffect() {
    let lastScroll = 0;
    const header = document.getElementById('header');
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (header) {
            if (currentScroll > 100) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }
        
        lastScroll = currentScroll;
    });
}

// Store operations
function openStore(storeId) {
    const store = stores[storeId];
    
    if (!store) {
        showNotification('المتجر غير موجود', 'error');
        return;
    }
    
    if (!store.available) {
        showNotification(`${store.name} قريباً... 🔜`, 'warning');
        const storeCard = document.querySelector(`.store-card[onclick*="${storeId}"]`);
        if (storeCard) {
            storeCard.classList.add('success-animation');
            setTimeout(() => {
                storeCard.classList.remove('success-animation');
            }, 600);
        }
        return;
    }
    
    const storeCard = document.querySelector(`.store-card[onclick*="${storeId}"]`);
    if (storeCard) {
        storeCard.style.transform = 'translateY(-10px) scale(0.95) rotateX(10deg)';
        storeCard.style.filter = 'brightness(1.2)';
        setTimeout(() => {
            storeCard.style.transform = '';
            storeCard.style.filter = '';
        }, 400);
    }
    
    showLoadingOverlay();
    document.querySelector('.loading-text').textContent = `جاري فتح ${store.name}...`;
    
    setTimeout(() => {
        hideLoadingOverlay();
        showNotification(`🛍️ مرحباً بك في ${store.name}!`);
        setTimeout(() => {
            window.location.href = store.url;
        }, 500);
    }, 1500);
}

// Admin functions
function toggleAdmin() {
    const password = prompt('🔐 أدخل كلمة مرور الإدارة:');
    if (password === 'admin123') {
        isAdmin = !isAdmin;
        localStorage.setItem('clashy_admin', isAdmin.toString());
        if (isAdmin) {
            showAdminElements();
            showNotification('🔓 تم تفعيل وضع الإدارة المتقدم');
            document.body.style.filter = 'hue-rotate(30deg)';
            setTimeout(() => {
                document.body.style.filter = '';
            }, 1000);
        } else {
            hideAdminElements();
            showNotification('🔒 تم إلغاء وضع الإدارة');
        }
    } else if (password !== null) {
        showNotification('❌ كلمة مرور خاطئة', 'error');
    }
}

function showAdminElements() {
    const addBtn = document.getElementById('addStoreBtn');
    if (addBtn) {
        addBtn.classList.remove('hide');
        setTimeout(() => {
            addBtn.style.animation = 'fadeInUp 0.5s ease-out';
        }, 100);
    }
}

function hideAdminElements() {
    const addBtn = document.getElementById('addStoreBtn');
    if (addBtn) {
        addBtn.classList.add('hide');
    }
}

function openAddStoreModal() {
    const modal = document.getElementById('addStoreModal');
    if (modal) {
        modal.classList.add('active');
    }
}

async function handleAddStore(event) {
    event.preventDefault();
    
    const name = document.getElementById('storeName')?.value.trim();
    const description = document.getElementById('storeDescription')?.value.trim();
    const url = document.getElementById('storeUrl')?.value.trim();
    const icon = document.getElementById('storeIcon')?.value;
    const color = document.getElementById('storeColor')?.value;
    
    if (!name || !description || !url || !icon || !color) {
        showNotification('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }
    
    showLoadingOverlay();
    document.querySelector('.loading-text').textContent = 'جاري إضافة المتجر إلى قاعدة البيانات...';
    
    const storeData = {
        name,
        description,
        url,
        icon,
        color,
        available: true
    };

    try {
        const savedStore = await saveStoreToSupabase(storeData);
        
        if (savedStore) {
            stores[savedStore.id] = {
                ...storeData,
                id: savedStore.id,
                fromDB: true
            };
            
            addStoreToGrid(savedStore.id, stores[savedStore.id]);
            updateStoreCount();
            updateDBStatus('connected', `متصل - ${Object.keys(stores).length} متجر`);
            
            showNotification('✅ تم حفظ المتجر في قاعدة البيانات بنجاح!');
        } else {
            const storeId = 'store_' + Date.now();
            stores[storeId] = {
                ...storeData,
                id: storeId,
                fromDB: false
            };
            
            addStoreToGrid(storeId, stores[storeId]);
            updateStoreCount();
            
            showNotification('⚠️ تم حفظ المتجر محلياً (لا يوجد اتصال)', 'warning');
        }
        
        closeModal('addStoreModal');
        const form = document.getElementById('addStoreForm');
        if (form) {
            form.reset();
        }
        
    } catch (error) {
        console.error('❌ خطأ في إضافة المتجر:', error);
        showNotification('❌ خطأ في إضافة المتجر', 'error');
    }
    
    hideLoadingOverlay();
}

function addStoreToGrid(storeId, store) {
    const grid = document.getElementById('storesGrid');
    const addBtn = document.getElementById('addStoreBtn');
    
    if (!grid) return;
    
    const storeCard = document.createElement('div');
    storeCard.className = `store-card ${store.color} fade-in-up`;
    storeCard.onclick = () => openStore(storeId);
    
    storeCard.innerHTML = `
        <div class="store-header">
            <i class="${store.icon} store-icon"></i>
        </div>
        <div class="store-content">
            <h3 class="store-name">${store.name}</h3>
            <p class="store-description">${store.description}</p>
            <div class="store-action">
                <button class="store-btn">
                    <i class="fas fa-shopping-bag"></i>
                    تسوق الآن
                </button>
            </div>
        </div>
        ${store.fromDB ? `<div class="coming-soon-badge" style="background: var(--success-solid);">🔗 DB</div>` : ''}
    `;
    
    if (addBtn) {
        grid.insertBefore(storeCard, addBtn);
    } else {
        grid.appendChild(storeCard);
    }
    
    setTimeout(() => {
        storeCard.style.animation = 'fadeInUp 0.8s ease-out';
    }, 100);
}

function updateStoreCount() {
    const storeCount = document.getElementById('storeCount');
    if (storeCount) {
        storeCount.textContent = Object.keys(stores).length;
    }
}

// Navigation functions
function scrollToStores() {
    const storesSection = document.getElementById('stores');
    if (storesSection) {
        storesSection.scrollIntoView({ behavior: 'smooth' });
    }
    updateActiveNavItem(1);
    showNotification('📍 تم الانتقال إلى قسم المتاجر');
}

function goToHome() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateActiveNavItem(0);
    showNotification('🏠 العودة إلى الصفحة الرئيسية');
}

function showContact() {
    const modal = document.getElementById('contactModal');
    if (modal) {
        modal.classList.add('active');
    }
    updateActiveNavItem(2);
}

function showAbout() {
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.classList.add('active');
    }
    updateActiveNavItem(3);
}

function updateActiveNavItem(index) {
    document.querySelectorAll('.nav-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function openWhatsApp() {
    const message = encodeURIComponent('السلام عليكم، أريد الاستفسار عن خدمات كلاشي - PWA التحديث الخامس 🚀📱');
    window.open(`https://wa.me/9647813798636?text=${message}`, '_blank');
    showNotification('📱 تم فتح واتساب...');
}

// Modal functions
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.animation = 'modalFadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.classList.remove('active');
            modal.style.animation = '';
        }, 300);
    }
}

// Event listeners
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        const modalId = e.target.id;
        closeModal(modalId);
    }
});

// Install banner event listeners
document.addEventListener('DOMContentLoaded', function() {
    const installBtn = document.getElementById('installBtn');
    const dismissBtn = document.getElementById('dismissBtn');
    
    if (installBtn) {
        installBtn.addEventListener('click', installPWA);
    }
    
    if (dismissBtn) {
        dismissBtn.addEventListener('click', hideInstallBanner);
    }
});

// Notification system
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    if (!notification || !notificationText) return;
    
    notificationText.textContent = message;
    notification.className = `notification ${type}`;
    
    const icon = notification.querySelector('i');
    if (icon) {
        if (type === 'error') {
            icon.className = 'fas fa-exclamation-circle';
        } else if (type === 'warning') {
            icon.className = 'fas fa-exclamation-triangle';
        } else {
            icon.className = 'fas fa-check-circle';
        }
    }
    
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            notification.classList.remove('show');
            notification.style.animation = '';
        }, 300);
    }, 4000);
}

// Loading overlay
function showLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('active');
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// Scroll animations
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                
                if (entry.target.classList.contains('store-card')) {
                    const delay = Array.from(entry.target.parentNode.children).indexOf(entry.target) * 100;
                    setTimeout(() => {
                        entry.target.style.animation = 'fadeInUp 0.8s ease-out forwards';
                    }, delay);
                }
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.fade-in-up').forEach(el => {
        observer.observe(el);
    });
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                closeModal(modal.id);
            });
        }
        
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'h':
                    e.preventDefault();
                    goToHome();
                    break;
                case 's':
                    e.preventDefault();
                    scrollToStores();
                    break;
                case 'c':
                    e.preventDefault();
                    showContact();
                    break;
                case 'r':
                    e.preventDefault();
                    syncData();
                    break;
                case 'i':
                    e.preventDefault();
                    installPWA();
                    break;
            }
        }
    });
}

// Touch gestures
function setupTouchGestures() {
    let touchStartY = 0;
    let touchStartX = 0;

    document.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
    });

    document.addEventListener('touchmove', function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    });

    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(e) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
        
        const touchEndY = e.changedTouches[0].clientY;
        const touchEndX = e.changedTouches[0].clientX;
        const deltaY = touchStartY - touchEndY;
        const deltaX = touchStartX - touchEndX;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            if (deltaX > 0) {
                scrollToStores();
            } else {
                goToHome();
            }
        }
    }, false);
}

// Real-time updates
function setupRealtimeUpdates() {
    if (!isConnected || !supabase) {
        console.log('📡 التحديثات الفورية غير متاحة - لا يوجد اتصال');
        return;
    }

    try {
        const subscription = supabase
            .channel('stores-changes')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'stores' 
                }, 
                (payload) => {
                    console.log('🔄 تحديث في قاعدة البيانات:', payload);
                    
                    switch (payload.eventType) {
                        case 'INSERT':
                            handleNewStore(payload.new);
                            break;
                        case 'UPDATE':
                            handleUpdateStore(payload.new);
                            break;
                        case 'DELETE':
                            handleDeleteStore(payload.old);
                            break;
                    }
                }
            )
            .subscribe();

        console.log('🔔 تم تفعيل التحديثات الفورية');
        showNotification('🔔 التحديثات الفورية مفعلة');
    } catch (error) {
        console.error('❌ خطأ في تفعيل التحديثات الفورية:', error);
    }
}

function handleNewStore(newStore) {
    if (!stores[newStore.id]) {
        stores[newStore.id] = {
            id: newStore.id,
            name: newStore.name,
            description: newStore.description,
            url: newStore.url,
            icon: newStore.icon,
            color: newStore.color,
            available: newStore.available,
            fromDB: true
        };
        
        addStoreToGrid(newStore.id, stores[newStore.id]);
        updateStoreCount();
        showNotification(`🆕 تم إضافة متجر جديد: ${newStore.name}`);
    }
}

function handleUpdateStore(updatedStore) {
    if (stores[updatedStore.id]) {
        stores[updatedStore.id] = {
            ...stores[updatedStore.id],
            ...updatedStore,
            fromDB: true
        };
        
        const existingCard = document.querySelector(`[onclick*="${updatedStore.id}"]`);
        if (existingCard) {
            existingCard.remove();
        }
        addStoreToGrid(updatedStore.id, stores[updatedStore.id]);
        showNotification(`🔄 تم تحديث متجر: ${updatedStore.name}`);
    }
}

function handleDeleteStore(deletedStore) {
    if (stores[deletedStore.id]) {
        delete stores[deletedStore.id];
        
        const existingCard = document.querySelector(`[onclick*="${deletedStore.id}"]`);
        if (existingCard) {
            existingCard.remove();
        }
        
        updateStoreCount();
        showNotification(`🗑️ تم حذف متجر: ${deletedStore.name}`, 'warning');
    }
}

// عند الحاجة لمسارات صور ثابتة في التطبيق (مثلاً عند إنشاء عناصر أو تمرير src لأي صورة)، استخدم الرابط التالي فقط:
const CLASHY_IMAGE_URL = 'https://wgvkbrmcgejscgsyapcs.supabase.co/storage/v1/object/public/images//Clashy.png';

// مثال: إذا أضفت صور ديناميكية أو ثابتة في أي مكان في الكود، استخدم CLASHY_IMAGE_URL
// مثال توضيحي (أضف هذا في أي مكان تحتاج فيه صورة):
// <img src="${CLASHY_IMAGE_URL}" alt="Clashy Logo" />

// Performance optimization
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// App state management
function saveAppState() {
    const state = {
        stores: stores,
        isAdmin: isAdmin,
        lastUpdate: Date.now()
    };
    localStorage.setItem('clashy_state', JSON.stringify(state));
}

function loadAppState() {
    try {
        const state = JSON.parse(localStorage.getItem('clashy_state') || '{}');
        if (state.stores && Date.now() - state.lastUpdate < 24 * 60 * 60 * 1000) {
            stores = state.stores;
            isAdmin = state.isAdmin || false;
            return true;
        }
    } catch (error) {
        console.error('❌ خطأ في تحميل حالة التطبيق:', error);
    }
    return false;
}

// Enhanced console logs
console.log('🚀 كلاشي PWA - التحديث الخامس جاهز!');
console.log('📱 PWA: قابل للتثبيت مع Service Worker');
console.log('🔗 قاعدة البيانات: Supabase (سيتم اختبار الاتصال...)');
console.log('📱 متجرين في صف على جميع الأجهزة');
console.log('✨ تفاعلات ثلاثية الأبعاد محسنة');
console.log('🎨 50+ أيقونة و 16 لون للمتاجر');
console.log('☁️ حفظ سحابي مع تحديثات فورية');
console.log('⚡ أداء محسن مع Service Worker');
console.log('🔧 نظام إدارة متطور');
console.log('⌨️ اختصارات: Ctrl+I (تثبيت), Ctrl+R (مزامنة)');
console.log('🔔 التحديثات الفورية والعمل بدون نت');
console.log('📳 دعم الإشعارات والمزامنة في الخلفية');
console.log('🎯 خلفية مخصصة مع شعار كلاشي');
