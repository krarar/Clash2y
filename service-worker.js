// كلاشي PWA Service Worker - التحديث الرابع مع Supabase
const CACHE_NAME = 'clashy-pwa-v4.1.0';
const DATA_CACHE_NAME = 'clashy-data-v4.1.0';

// الملفات المطلوب حفظها في الكاش
const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/alhajami.html',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@200;300;400;500;700;800;900&display=swap',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://wgvkbrmcgejscgsyapcs.supabase.co/storage/v1/object/public/images//Clashy.png'
];

// الـ URLs التي يجب تخزين بياناتها
const DATA_URLS = [
    'https://wgvkbrmcgejscgsyapcs.supabase.co'
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
    console.log('🔧 [Service Worker] تثبيت كلاشي PWA...');
    
    event.waitUntil(
        Promise.all([
            // كاش الملفات الأساسية
            caches.open(CACHE_NAME).then((cache) => {
                console.log('📦 [Service Worker] حفظ الملفات الأساسية...');
                return cache.addAll(FILES_TO_CACHE.map(url => {
                    return new Request(url, { cache: 'reload' });
                }));
            }),
            
            // كاش البيانات
            caches.open(DATA_CACHE_NAME).then((cache) => {
                console.log('🗄️ [Service Worker] إعداد كاش البيانات...');
                return Promise.resolve();
            })
        ]).then(() => {
            console.log('✅ [Service Worker] تم تثبيت كلاشي PWA بنجاح!');
            // فرض تفعيل Service Worker الجديد
            return self.skipWaiting();
        }).catch((error) => {
            console.error('❌ [Service Worker] خطأ في التثبيت:', error);
        })
    );
});

// تفعيل Service Worker
self.addEventListener('activate', (event) => {
    console.log('🚀 [Service Worker] تفعيل كلاشي PWA...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // حذف الكاش القديم
                    if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
                        console.log('🗑️ [Service Worker] حذف كاش قديم:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ [Service Worker] تم تفعيل كلاشي PWA بنجاح!');
            // التحكم في جميع العملاء النشطين
            return self.clients.claim();
        })
    );
});

// التعامل مع طلبات الشبكة
self.addEventListener('fetch', (event) => {
    const requestURL = new URL(event.request.url);
    
    // التعامل مع طلبات البيانات من Supabase
    if (requestURL.origin.includes('supabase.co')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return fetch(event.request)
                    .then((response) => {
                        // حفظ البيانات الجديدة في الكاش
                        if (response.status === 200) {
                            cache.put(event.request.url, response.clone());
                        }
                        return response;
                    })
                    .catch(() => {
                        // في حالة عدم توفر الإنترنت، استخدم البيانات المحفوظة
                        console.log('📡 [Service Worker] لا يوجد إنترنت، استخدام البيانات المحفوظة');
                        return cache.match(event.request);
                    });
            })
        );
        return;
    }

    // التعامل مع طلبات الملفات الأساسية
    if (event.request.mode === 'navigate') {
        // للصفحات
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        return cache.match('/index.html');
                    });
                })
        );
    } else {
        // للملفات الأخرى (CSS, JS, Images)
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((response) => {
                    if (response) {
                        // إرجاع الملف من الكاش
                        return response;
                    }

                    // تحميل الملف من الشبكة وحفظه في الكاش
                    return fetch(event.request).then((response) => {
                        // لا نريد حفظ الاستجابات السيئة
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // حفظ نسخة من الاستجابة في الكاش
                        const responseToCache = response.clone();
                        cache.put(event.request, responseToCache);

                        return response;
                    }).catch(() => {
                        // في حالة فشل التحميل من الشبكة
                        console.log('❌ [Service Worker] فشل في تحميل:', event.request.url);
                        
                        // إرجاع صفحة افتراضية للصور
                        if (event.request.destination === 'image') {
                            return new Response(
                                '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#8B5CF6"/><text x="100" y="100" text-anchor="middle" fill="white" font-family="Arial" font-size="16">كلاشي</text></svg>',
                                { headers: { 'Content-Type': 'image/svg+xml' } }
                            );
                        }
                        
                        return new Response('متاح قريباً في وضع عدم الاتصال', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
                });
            })
        );
    }
});

// التعامل مع رسائل من التطبيق الرئيسي
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('🔄 [Service Worker] تم طلب تحديث فوري');
        self.skipWaiting();
    }
});

// إعادة تشغيل دورية للتحقق من التحديثات
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('🔄 [Service Worker] مزامنة في الخلفية');
        event.waitUntil(doBackgroundSync());
    }
});

// وظيفة المزامنة في الخلفية
async function doBackgroundSync() {
    try {
        // محاولة مزامنة البيانات المعلقة
        console.log('📡 [Service Worker] محاولة مزامنة البيانات...');
        
        // يمكن إضافة منطق المزامنة هنا
        // مثل إرسال البيانات المحفوظة محلياً إلى Supabase
        
        return Promise.resolve();
    } catch (error) {
        console.error('❌ [Service Worker] خطأ في المزامنة:', error);
        return Promise.reject(error);
    }
}

// معالجة إشعارات Push
self.addEventListener('push', (event) => {
    console.log('🔔 [Service Worker] تم استقبال إشعار push');
    
    const options = {
        body: event.data ? event.data.text() : 'إشعار جديد من كلاشي',
        icon: 'https://wgvkbrmcgejscgsyapcs.supabase.co/storage/v1/object/public/images//Clashy.png',
        badge: 'https://wgvkbrmcgejscgsyapcs.supabase.co/storage/v1/object/public/images//Clashy.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'تصفح المتاجر',
                icon: 'https://wgvkbrmcgejscgsyapcs.supabase.co/storage/v1/object/public/images//Clashy.png'
            },
            {
                action: 'close',
                title: 'إغلاق',
                icon: 'https://wgvkbrmcgejscgsyapcs.supabase.co/storage/v1/object/public/images//Clashy.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('كلاشي - متاجر متعددة', options)
    );
});

// معالجة النقر على الإشعارات
self.addEventListener('notificationclick', (event) => {
    console.log('👆 [Service Worker] تم النقر على الإشعار');
    
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/#stores')
        );
    } else if (event.action === 'close') {
        // مجرد إغلاق الإشعار
        return;
    } else {
        // النقر على الإشعار نفسه
        event.waitUntil(
            clients.matchAll().then((clientList) => {
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    }
});

// معلومات إضافية للتطوير
console.log('🚀 كلاشي PWA Service Worker - التحديث الرابع');
console.log('📦 إصدار الكاش:', CACHE_NAME);
console.log('🗄️ إصدار كاش البيانات:', DATA_CACHE_NAME);
console.log('🔗 متصل مع Supabase لحفظ البيانات');
console.log('📱 يدعم التثبيت على الأجهزة المحمولة');
console.log('🔔 يدعم الإشعارات Push');
console.log('🔄 يدعم المزامنة في الخلفية');
console.log('📡 يعمل في وضع عدم الاتصال');
