// お薬リマインダー Service Worker

const CACHE_NAME = "medication-reminder-v1";
const urlsToCache = [
  "/",
  "/static/js/bundle.js",
  "/static/css/main.css",
  "/manifest.json",
  "/icons/icon-192x192.png",
];

// インストール時
self.addEventListener("install", function (event) {
  console.log("Service Worker: インストール中...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        console.log("Service Worker: キャッシュを開きました");
        return cache.addAll(urlsToCache);
      })
      .catch(function (error) {
        console.log("Service Worker: キャッシュエラー", error);
      })
  );
});

// フェッチ時（ネットワークリクエスト）
self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request).then(function (response) {
      // キャッシュにあれば返す
      if (response) {
        return response;
      }
      // なければネットワークから取得
      return fetch(event.request);
    })
  );
});

// アクティベート時
self.addEventListener("activate", function (event) {
  console.log("Service Worker: アクティベート中...");
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log("Service Worker: 古いキャッシュを削除", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 通知スケジューリング
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SCHEDULE_NOTIFICATION") {
    const { medicationId, medicationName, dosage, time } = event.data;

    console.log("Service Worker: 通知をスケジュール", { medicationName, time });

    const now = new Date();
    const [hours, minutes] = time.split(":");
    const scheduledTime = new Date();
    scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // 今日の時刻が過ぎていたら明日に設定
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const delay = scheduledTime.getTime() - now.getTime();

    // 通知をスケジュール
    setTimeout(() => {
      self.registration.showNotification("💊 服薬時間です", {
        body: `${medicationName} ${dosage} を服用してください`,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-72x72.png",
        tag: `medication-${medicationId}`,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        actions: [
          {
            action: "taken",
            title: "✅ 服薬完了",
            icon: "/icons/icon-96x96.png",
          },
          {
            action: "snooze",
            title: "⏰ 10分後",
            icon: "/icons/icon-96x96.png",
          },
          {
            action: "skip",
            title: "❌ スキップ",
            icon: "/icons/icon-96x96.png",
          },
        ],
        data: {
          medicationId,
          medicationName,
          dosage,
          action: "medication-reminder",
          time: time,
        },
      });
    }, delay);
  }
});

// 通知クリック処理
self.addEventListener("notificationclick", (event) => {
  const { action, data } = event.notification;

  console.log("Service Worker: 通知がクリックされました", { action, data });

  event.notification.close();

  if (data && data.action === "medication-reminder") {
    switch (action) {
      case "taken":
        // 服薬完了をメインアプリに通知
        event.waitUntil(
          clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: "MEDICATION_TAKEN",
                medicationId: data.medicationId,
                time: data.time,
                timestamp: new Date(),
              });
            });
          })
        );
        break;

      case "snooze":
        // 10分後に再通知
        setTimeout(() => {
          self.registration.showNotification("💊 服薬時間です（再通知）", {
            body: `${data.medicationName} ${data.dosage} を服用してください`,
            icon: "/icons/icon-192x192.png",
            tag: `medication-snooze-${data.medicationId}`,
            requireInteraction: true,
            vibrate: [200, 100, 200],
            data: { ...data, action: "medication-reminder-snooze" },
          });
        }, 10 * 60 * 1000); // 10分後
        break;

      case "skip":
        // スキップをメインアプリに通知
        event.waitUntil(
          clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: "MEDICATION_SKIPPED",
                medicationId: data.medicationId,
                time: data.time,
                timestamp: new Date(),
              });
            });
          })
        );
        break;

      default:
        // デフォルトではアプリを開く
        event.waitUntil(clients.openWindow("/"));
        break;
    }
  } else {
    // その他の通知の場合はアプリを開く
    event.waitUntil(clients.openWindow("/"));
  }
});

// プッシュ通知受信（将来の拡張用）
self.addEventListener("push", function (event) {
  console.log("Service Worker: プッシュ通知を受信", event);

  if (event.data) {
    const data = event.data.json();

    const options = {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      vibrate: [200, 100, 200],
      data: data,
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

// バックグラウンド同期（将来の拡張用）
self.addEventListener("sync", function (event) {
  if (event.tag === "background-sync") {
    console.log("Service Worker: バックグラウンド同期を実行");
    event.waitUntil(
      // バックグラウンドでのデータ同期処理
      Promise.resolve()
    );
  }
});

console.log("Service Worker: 登録完了");
