import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Cloud, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { offlineService, type OfflineState } from '../services/offline';

const formatRetryLabel = (nextRetryAt: string | null): string => {
  if (!nextRetryAt) return 'Aucune relance planifiée';
  const timestamp = Date.parse(nextRetryAt);
  if (!Number.isFinite(timestamp)) return 'Relance à venir';
  const diffMs = timestamp - Date.now();
  if (diffMs <= 0) return 'Relance imminente';
  const minutes = Math.ceil(diffMs / 60_000);
  if (minutes < 60) return `Relance dans ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  return `Relance dans ${hours} h`;
};

export const OfflineIndicator: React.FC = () => {
  const [state, setState] = useState<OfflineState>(offlineService.getState());
  const [showDetails, setShowDetails] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ success: number; failed: number } | null>(null);
  const floatingStyle = {
    left: 'calc(1rem + env(safe-area-inset-left, 0px))',
    bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
  };

  useEffect(() => {
    const unsubscribe = offlineService.subscribe((nextState) => {
      setState(nextState);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!lastSyncResult) return undefined;
    const timeoutId = window.setTimeout(() => setLastSyncResult(null), 3500);
    return () => clearTimeout(timeoutId);
  }, [lastSyncResult]);

  const nextRetryLabel = useMemo(() => formatRetryLabel(state.nextRetryAt), [state.nextRetryAt]);

  const handleForceSync = async () => {
    const result = await offlineService.forceSync();
    setLastSyncResult(result);
  };

  if (state.isOnline && state.pendingCount === 0 && !state.isSyncing) {
    return (
      <div className="fixed z-50" style={floatingStyle}>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111827]/80 border border-white/10 rounded-full text-xs text-[#7cfc8a]">
          <Cloud size={14} aria-hidden="true" />
          <span>Synchronisé</span>
        </div>
      </div>
    );
  }

  if (!state.isOnline) {
    return (
      <div className="fixed z-50" style={floatingStyle}>
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 border border-orange-500/50 rounded-lg text-sm text-orange-400 cursor-pointer pressable"
          onClick={() => setShowDetails((prev) => !prev)}
          aria-expanded={showDetails}
          aria-controls="offline-details"
        >
          <WifiOff size={16} aria-hidden="true" />
          <span className="font-medium">Hors-ligne</span>
          {state.pendingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full">
              {state.pendingCount}
            </span>
          )}
        </button>

        {showDetails && (
          <div
            id="offline-details"
            className="absolute bottom-full left-0 mb-2 w-72 p-4 bg-[#111827] border border-white/20 rounded-xl shadow-xl"
          >
            <p className="text-sm text-white mb-2">
              <WifiOff size={14} className="inline mr-1" />
              Pas de connexion Internet
            </p>
            {state.pendingCount > 0 ? (
              <>
                <p className="text-sm text-[#94a3b8] mb-2">
                  {state.pendingCount} rapport{state.pendingCount > 1 ? 's' : ''} en file d’attente
                </p>
                <p className="text-xs text-[#7cfc8a] mb-2">
                  Les envois reprendront automatiquement dès le retour du réseau.
                </p>
                <ul className="text-xs text-[#cbd5e1] space-y-1">
                  {state.queuePreview.map((item) => (
                    <li key={item.localId} className="truncate">
                      {item.localId.slice(0, 12)} • {item.syncStatus}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-[#94a3b8]">Aucun rapport en attente</p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (state.isOnline && state.pendingCount > 0) {
    return (
      <div className="fixed z-50" style={floatingStyle}>
        <button
          type="button"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all pressable ${
            state.isSyncing
              ? 'bg-[#ffb703]/20 border border-[#ffb703]/50 text-[#ffb703]'
              : 'bg-[#4dd0e1]/20 border border-[#4dd0e1]/50 text-[#4dd0e1]'
          }`}
          onClick={() => {
            if (!state.isSyncing) void handleForceSync();
          }}
          aria-live="polite"
        >
          {state.isSyncing ? (
            <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Wifi size={16} aria-hidden="true" />
          )}
          <span className="font-medium">
            {state.isSyncing ? 'Synchronisation...' : `${state.pendingCount} en attente`}
          </span>
          {!state.isSyncing && <RefreshCw size={14} className="ml-1" aria-hidden="true" />}
        </button>

        <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#111827] border border-white/20 rounded-lg text-xs min-w-[220px]">
          <p className="text-[#94a3b8] mb-1">{nextRetryLabel}</p>
          {state.failedCount > 0 && (
            <p className="text-[#ff6b6b] mb-1">
              <AlertTriangle size={12} className="inline mr-1" />
              {state.failedCount} échec(s) définitif(s)
            </p>
          )}
          {state.retryScheduledCount > 0 && (
            <p className="text-[#ffb703]">{state.retryScheduledCount} en relance différée</p>
          )}
          {lastSyncResult && (
            <p className="mt-1 text-[#7cfc8a]" aria-live="assertive">
              ✓ {lastSyncResult.success} ok • ✗ {lastSyncResult.failed} échec
            </p>
          )}
        </div>
      </div>
    );
  }

  if (state.isSyncing) {
    return (
      <div className="fixed z-50" style={floatingStyle}>
        <div className="flex items-center gap-2 px-3 py-2 bg-[#ffb703]/20 border border-[#ffb703]/50 rounded-lg text-sm text-[#ffb703]">
          <RefreshCw size={16} className="animate-spin" />
          <span>Vérification...</span>
        </div>
      </div>
    );
  }

  return null;
};

export const OfflineStatusDot: React.FC = () => {
  const [isOnline, setIsOnline] = useState(offlineService.isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    const unsubscribe = offlineService.subscribe((state) => {
      setIsOnline(state.isOnline);
      setPendingCount(state.pendingCount);
      setFailedCount(state.failedCount);
    });
    return unsubscribe;
  }, []);

  const statusLabel = !isOnline
    ? 'Hors-ligne'
    : failedCount > 0
      ? `${failedCount} échec(s) de synchro`
      : pendingCount > 0
        ? `${pendingCount} en attente de synchro`
        : 'Synchronisé';

  return (
    <div className="flex items-center gap-2" aria-label={statusLabel}>
      <span
        className={`w-2 h-2 rounded-full ${
          !isOnline
            ? 'bg-[#ff6b6b]'
            : failedCount > 0
              ? 'bg-[#ff6b6b] animate-pulse'
              : pendingCount > 0
                ? 'bg-[#ffb703] animate-pulse'
                : 'bg-[#7cfc8a]'
        }`}
        title={statusLabel}
      />
      {!isOnline && <span className="text-xs text-[#ff6b6b]">Hors-ligne</span>}
      {isOnline && failedCount > 0 && <span className="text-xs text-[#ff6b6b]">{failedCount} erreur(s)</span>}
      {isOnline && failedCount === 0 && pendingCount > 0 && (
        <span className="text-xs text-[#ffb703]">{pendingCount} en attente</span>
      )}
    </div>
  );
};
