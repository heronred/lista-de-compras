import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { Bell, Flame, X, CheckCircle2, UserPlus, Info } from "lucide-react";
import { db, OperationType, handleFirestoreError } from "../firebase";
import { ActivityNotification } from "../types";

interface AlertNotificationCenterProps {
  familyId: string | null;
  currentUserId: string;
}

export default function AlertNotificationCenter({ familyId, currentUserId }: AlertNotificationCenterProps) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [activeAlerts, setActiveAlerts] = useState<ActivityNotification[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [allLogs, setAllLogs] = useState<ActivityNotification[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const resp = await Notification.requestPermission();
      setPermission(resp);
    }
  };

  // Real-time listen to activities inside this family group
  useEffect(() => {
    if (!familyId) return;

    const queryPath = "activities";
    const q = query(
      collection(db, queryPath),
      where("familyId", "==", familyId),
      orderBy("createdAt", "desc"),
      limit(25)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const changes = snapshot.docChanges();
        const logs: ActivityNotification[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          logs.push({
            activityId: doc.id,
            ...data,
          } as ActivityNotification);
        });

        setAllLogs(logs);

        // For dynamic on-screen "Push" notification triggers:
        // We only show toast alerts if the change was made by SOMEONE ELSE, and the document is newly added
        changes.forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            // Skip logs we created or that are too old (e.g. initial fetch)
            const isSelf = data.userId === currentUserId;
            const logTime = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : Date.now();
            const isFresh = Date.now() - logTime < 10000; // less than 10 seconds old

            if (!isSelf && isFresh) {
              const newAlert = {
                activityId: change.doc.id,
                ...data,
              } as ActivityNotification;

              // 1) Trigger custom floating inside-app toast alert push banner
              setActiveAlerts((prev) => [newAlert, ...prev].slice(0, 5));

              // 2) Trigger browser level native Push Notification if enabled
              if (Notification.permission === "granted") {
                const nativeAlert = new Notification("Lista de Compras Atualizada!", {
                  body: `${data.userName}: ${data.message}`,
                  icon: data.userPhoto || "/favicon.ico",
                  tag: "shopping-list-update",
                });
                setTimeout(() => nativeAlert.close(), 6000);
              }

              // Sound cue for push alerts
              try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                if (audioCtx) {
                  const osc = audioCtx.createOscillator();
                  const gain = audioCtx.createGain();
                  osc.connect(gain);
                  gain.connect(audioCtx.destination);
                  osc.type = "sine";
                  osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
                  osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
                  gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
                  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
                  osc.start();
                  osc.stop(audioCtx.currentTime + 0.5);
                }
              } catch (_) {}
            }
          }
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, queryPath);
      }
    );

    return () => unsubscribe();
  }, [familyId, currentUserId]);

  const removeAlert = (id: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.activityId !== id));
  };

  return (
    <>
      {/* Floating Push Toast Area */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {activeAlerts.map((alert) => (
          <div
            key={alert.activityId}
            className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 pb-3.5 rounded-xl border border-slate-700/50 shadow-xl flex gap-3 items-start animate-bounce-short"
            style={{ animation: "slideInRight 0.35s ease-out" }}
          >
            <img
              src={alert.userPhoto || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop"}
              alt=""
              className="w-10 h-10 rounded-full object-cover border border-slate-700 mt-0.5"
            />
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <p className="text-xs font-bold text-emerald-400">Notificação Push (FCM)</p>
                <button
                  onClick={() => removeAlert(alert.activityId)}
                  className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs font-semibold text-slate-200 mt-0.5">{alert.userName}</p>
              <p className="text-xs text-slate-300 mt-1 leading-normal">{alert.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Control Banner for Notifications permission */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mb-5">
        <div className="flex gap-2.5 items-start">
          <Bell className="w-4 h-4 text-slate-500 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-700">Notificações Push Co-laborativas</p>
            <p className="text-slate-500">
              Sempre que outro familiar adicionar ou riscar um item do carrinho, você receberá notificações em tempo real.
            </p>
          </div>
        </div>

        {permission !== "granted" ? (
          <button
            onClick={requestPermission}
            className="px-3 py-1.5 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 whitespace-nowrap transition-colors cursor-pointer"
          >
            Ativar Notificações do Navegador
          </button>
        ) : (
          <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-1 rounded border border-emerald-100">
            ✓ Notificações Ativadas
          </span>
        )}
      </div>

      {/* Collapsible Alerts Feed Tab */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-100 p-5 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4.5 h-4.5 text-orange-500" />
            <h4 className="text-sm font-semibold text-slate-800">Atividades Recentes da Família</h4>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-slate-500 hover:text-slate-900 font-medium underline"
          >
            {showHistory ? "Recolher Histórico" : "Exibir Todos os Logs"}
          </button>
        </div>

        {allLogs.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs flex flex-col items-center justify-center gap-1.5">
            <Info className="w-4 h-4 text-slate-300" />
            <p>Seus logs colaborativos aparecerão aqui.</p>
          </div>
        ) : (
          <div className={`space-y-2 ${showHistory ? "" : "max-h-24 overflow-hidden mask-fade-bottom"}`}>
            {allLogs.slice(0, showHistory ? 20 : 3).map((log) => (
              <div key={log.activityId} className="flex gap-3 items-start bg-slate-50/55 p-2.5 rounded-lg border border-slate-100">
                <img
                  src={log.userPhoto || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&fit=crop"}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <p className="text-xs font-bold text-slate-700 truncate">{log.userName}</p>
                    <p className="text-[9px] text-slate-400 font-sans font-medium">
                      {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Agora"}
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 leading-tight mt-0.5">{log.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
