// 通知ユーティリティ - お薬リマインダー用

import { useState, useEffect } from "react";

/**
 * 通知権限を要求する
 */
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log("このブラウザは通知をサポートしていません");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (error) {
      console.error("通知権限の取得に失敗:", error);
      return false;
    }
  }

  return false;
};

/**
 * 通知機能を管理するカスタムフック
 */
export const useNotifications = () => {
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initNotifications = async () => {
      try {
        const granted = await requestNotificationPermission();
        setIsNotificationEnabled(granted);

        if (granted) {
          console.log("通知権限が許可されました");

          // Service Worker の登録確認
          if ("serviceWorker" in navigator) {
            try {
              const registration = await navigator.serviceWorker.ready;
              console.log("Service Worker の準備完了:", registration);
            } catch (error) {
              console.error("Service Worker エラー:", error);
            }
          }
        }
      } catch (error) {
        console.error("通知初期化エラー:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    initNotifications();
  }, []);

  return { isNotificationEnabled, isInitializing };
};

/**
 * 即座に通知を表示する
 */
export const showInstantNotification = (title, body, options = {}) => {
  if (Notification.permission === "granted") {
    const notification = new Notification(title, {
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: "medication-alert",
      requireInteraction: false,
      silent: false,
      ...options,
    });

    // 通知クリック時の動作
    notification.onclick = () => {
      window.focus();
      notification.close();

      // カスタムコールバックがあれば実行
      if (options.onClick) {
        options.onClick();
      }
    };

    // 自動で閉じる（5秒後）
    setTimeout(() => {
      notification.close();
    }, 5000);

    return notification;
  } else {
    console.warn("通知権限がありません");
    return null;
  }
};

/**
 * 薬剤の服薬通知をスケジュールする
 */
export const scheduleMedicationNotifications = (medication) => {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service Worker がサポートされていません");
    return false;
  }

  if (Notification.permission !== "granted") {
    console.warn("通知権限がありません");
    return false;
  }

  navigator.serviceWorker.ready
    .then((registration) => {
      if (registration.active) {
        medication.times.forEach((time) => {
          console.log(`通知をスケジュール: ${medication.name} - ${time}`);

          registration.active.postMessage({
            type: "SCHEDULE_NOTIFICATION",
            medicationId: medication.id,
            medicationName: medication.name,
            dosage: medication.dosage,
            time: time,
          });
        });

        return true;
      } else {
        console.warn("Service Worker がアクティブではありません");
        return false;
      }
    })
    .catch((error) => {
      console.error("Service Worker エラー:", error);
      return false;
    });
};

/**
 * 薬剤の通知をキャンセルする
 */
export const cancelMedicationNotifications = (medicationId) => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.active) {
        registration.active.postMessage({
          type: "CANCEL_NOTIFICATION",
          medicationId: medicationId,
        });
      }
    });
  }
};

/**
 * 薬剤相互作用の警告通知を表示
 */
export const showInteractionWarning = (interactions) => {
  const interactionCount = interactions.length;

  return showInstantNotification(
    "⚠️ 薬剤相互作用の警告",
    `${interactionCount}件の相互作用が検出されました。安全性を確認してください。`,
    {
      tag: "drug-interaction",
      requireInteraction: true,
      icon: "/icons/icon-192x192.png",
      actions: [
        { action: "view", title: "詳細を確認", icon: "/icons/icon-96x96.png" },
        { action: "dismiss", title: "後で確認", icon: "/icons/icon-96x96.png" },
      ],
      data: { interactions },
    }
  );
};

/**
 * アプリバッジを更新（未服薬数を表示）
 */
export const updateAppBadge = (count) => {
  if ("setAppBadge" in navigator) {
    if (count > 0) {
      navigator.setAppBadge(count).catch((err) => {
        console.log("Badge API はサポートされていません:", err);
      });
    } else {
      navigator.clearAppBadge().catch((err) => {
        console.log("Badge API はサポートされていません:", err);
      });
    }
  }
};

/**
 * Service Worker メッセージリスナーを設定
 */
export const setupServiceWorkerMessageListener = (messageHandler) => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", messageHandler);

    // クリーンアップ関数を返す
    return () => {
      navigator.serviceWorker.removeEventListener("message", messageHandler);
    };
  }

  return () => {}; // 何もしないクリーンアップ関数
};

/**
 * テスト通知を送信（開発・デバッグ用）
 */
export const sendTestNotification = () => {
  return showInstantNotification(
    "🧪 テスト通知",
    "お薬リマインダーの通知機能が正常に動作しています。",
    {
      tag: "test-notification",
      onClick: () => {
        console.log("テスト通知がクリックされました");
      },
    }
  );
};

/**
 * 通知サポート状況を確認
 */
export const checkNotificationSupport = () => {
  const support = {
    notifications: "Notification" in window,
    serviceWorker: "serviceWorker" in navigator,
    pushManager: "PushManager" in window,
    badge: "setAppBadge" in navigator,
  };

  console.log("通知機能サポート状況:", support);
  return support;
};

/**
 * PWA インストールプロンプトを管理
 */
export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      console.log("PWA がインストールされました");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;

      if (result.outcome === "accepted") {
        console.log("ユーザーがPWAインストールを受け入れました");
      } else {
        console.log("ユーザーがPWAインストールを拒否しました");
      }

      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  return { isInstallable, installApp };
};

// 初期化時に通知サポート状況をチェック
checkNotificationSupport();
