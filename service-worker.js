// كلاشي PWA Service Worker المحدث
// الإصدار 2.1.1 - إصلاح مشاكل التثبيت

const CACHE_NAME = 'clashy-v2-1-1';
const OFFLINE_URL = '/offline.html';

// الملفات الأساسية للتخزين المؤقت
const CORE_CACHE_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@200;300;400;500;700;800;900&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// استراتيجية التخزين المؤقت للصور
const IMAGE_CACHE_NAME = 'clashy-images-v1';
const API_CACHE_NAME = 'clashy-api-v1';

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: تثبيت الإصدار الجديد...');
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('📦 Service Worker: تخزين الملفات الأساسية...');
        
        // تخزين الملفات بشكل فردي مع معالجة الأخطاء
        for (const url of CORE_CACHE_FILES) {
          try {
            await cache.add(url);
            console.log(`✅ تم تخزين: ${url}`);
          } catch (error) {
            console.warn(`⚠️ فشل تخزين: ${url}`, error);
          }
        }
        
        console.log('✅ Service Worker: تم تخزين الملفات الأساسية');
      } catch (error) {
        console.error('❌ Service Worker: خطأ في التثبيت:', error);
      }
    })()
  );
  
  // فرض التفعيل الفوري للإصدار الجديد
  self.skipWaiting();
});

// تفعيل Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: تفعيل الإصدار الجديد...');
  
  event.waitUntil(
    (async () => {
      try {
        // حذف الكاش القديم
        const cacheNames = await caches.keys();
        const deletionPromises = cacheNames
          .filter(cacheName => 
            cacheName !== CACHE_NAME && 
            cacheName !== IMAGE_CACHE_NAME && 
            cacheName !== API_CACHE_NAME
          )
          .map(cacheName => {
            console.log('🗑️ Service Worker: حذف كاش قديم:', cacheName);
            return caches.delete(cacheName);
          });
        
        await Promise.all(deletionPromises);
        console.log('✅ Service Worker: تم تنظيف الكاش القديم');
        
        // السيطرة على جميع العملاء
        await self.clients.claim();
        console.log('✅ Service Worker: تم السيطرة على جميع العملاء');
        
        // إرسال إشعار للعملاء بأن التحديث مكتمل
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            message: 'تم تحديث التطبيق بنجاح - إصدار 2.1.1'
          });
        });
        
      } catch (error) {
        console.error('❌ Service Worker: خطأ في التفعيل:', error);
      }
    })()
  );
});

// اعتراض الطلبات
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // تجاهل الطلبات غير HTTP/HTTPS
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // تجاهل طلبات Chrome Extension
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // استراتيجية مختلفة لكل نوع من الطلبات
  if (request.destination === 'image') {
    event.respondWith(handleImageRequest(request));
  } else if (url.origin === 'https://wgvkbrmcgejscgsyapcs.supabase.co') {
    event.respondWith(handleAPIRequest(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
  } else {
    event.respondWith(handleResourceRequest(request));
  }
});

// التعامل مع طلبات الصور
async function handleImageRequest(request) {
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('📷 Service Worker: استخدام صورة افتراضية');
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><defs><linearGradient id="grad"><stop offset="0%" style="stop-color:#8B5CF6"/><stop offset="100%" style="stop-color:#A855F7"/></linearGradient></defs><rect width="200" height="150" fill="url(#grad)"/><text x="100" y="80" text-anchor="middle" fill="white" font-family="Arial" font-size="16">كلاشي</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

// التعامل مع طلبات API
async function handleAPIRequest(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    if (request.method === 'GET') {
      const cache = await caches.open(API_CACHE_NAME);
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    return new Response('{"error": "Network unavailable"}', {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// التعامل مع طلبات التنقل
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match('/index.html') || await cache.match('/');
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // صفحة offline محسنة
    return new Response(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>كلاشي - غير متصل</title>
        <style>
          body {
            font-family: 'Tajawal', sans-serif;
            background: linear-gradient(135deg, #8B5CF6, #06B6D4);
            color: white;
            text-align: center;
            padding: 50px 20px;
            margin: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          .offline-container {
            max-width: 400px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 40px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
          }
          .logo {
            font-size: 48px;
            font-weight: 800;
            margin-bottom: 20px;
          }
          h1 {
            margin-bottom: 20px;
            font-size: 24px;
          }
          p {
            margin-bottom: 30px;
            opacity: 0.9;
            line-height: 1.6;
          }
          .retry-btn {
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid white;
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .retry-btn:hover {
            background: white;
            color: #8B5CF6;
          }
          .pwa-info {
            margin-top: 20px;
            font-size: 14px;
            opacity: 0.8;
          }
        </style>
      </head>
      <body>
        <div class="offline-container">
          <div class="logo">كلاشي</div>
          <h1>🌐 غير متصل بالإنترنت</h1>
          <p>يبدو أنك غير متصل بالإنترنت. لا تقلق، يمكنك استكمال التصفح عند عودة الاتصال.</p>
          <button class="retry-btn" onclick="window.location.reload()">
            🔄 إعادة المحاولة
          </button>
          <div class="pwa-info">
            📱 تطبيق PWA - يعمل بدون إنترنت<br>
            الإصدار 2.1.1
          </div>
        </div>
        <script>
          // إعادة المحاولة التلقائية عند عودة الاتصال
          window.addEventListener('online', () => {
            window.location.reload();
          });
        </script>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// التعامل مع طلبات الموارد الأخرى
async function handleResourceRequest(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // إرجاع النسخة المخزنة مؤقتاً أولاً
      fetch(request).then(response => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
      }).catch(() => {
        // تجاهل الأخطاء في التحديث في الخلفية
      });
      
      return cachedResponse;
    }
    
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Resource not available offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// التعامل مع رسائل العميل
self.addEventListener('message', (event) => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        console.log('📱 تفعيل التحديث فوراً...');
        self.skipWaiting();
        break;
        
      case 'CLEAR_CACHE':
        clearAllCaches().then(() => {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true });
          }
        });
        break;
        
      case 'UPDATE_CACHE':
        updateCache().then(() => {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true });
          }
        });
        break;
        
      case 'GET_VERSION':
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ 
            version: '2.1.1',
            cacheName: CACHE_NAME
          });
        }
        break;
    }
  }
});

// مسح جميع الكاش
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    console.log('🗑️ Service Worker: تم مسح جميع الكاش');
  } catch (error) {
    console.error('❌ خطأ في مسح الكاش:', error);
  }
}

// تحديث الكاش
async function updateCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // تحديث الملفات الأساسية
    for (const url of CORE_CACHE_FILES) {
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (response.ok) {
          await cache.put(url, response);
          console.log(`🔄 تم تحديث: ${url}`);
        }
      } catch (error) {
        console.warn(`⚠️ فشل تحديث: ${url}`, error);
      }
    }
    
    console.log('🔄 Service Worker: تم تحديث الكاش');
  } catch (error) {
    console.error('❌ Service Worker: خطأ في تحديث الكاش:', error);
  }
}

// إرسال إشعار عند توفر تحديث
self.addEventListener('updatefound', () => {
  console.log('🆕 Service Worker: تحديث متاح');
  
  // إرسال رسالة للعميل
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'UPDATE_AVAILABLE',
        message: 'تحديث جديد متاح لكلاشي - الإصدار 2.1.1'
      });
    });
  });
});

// التعامل مع أخطاء عدم اللحاق
self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker: خطأ غير معالج:', event.reason);
  event.preventDefault();
});

// تتبع إحصائيات الكاش (اختياري)
self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET') {
    // إحصائيات بسيطة
    console.log(`📊 طلب: ${event.request.url}`);
  }
});

console.log('🎉 Service Worker لكلاشي v2.1.1 جاهز ومحدث!');
