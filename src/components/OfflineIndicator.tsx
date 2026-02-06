import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, RefreshCw } from 'lucide-react';
import { offlineService, type OfflineState } from '../services/offline';

export const OfflineIndicator: React.FC = () => {
  const [state, setState] = useState<OfflineState>(offlineService.getState());
  const [showDetails, setShowDetails] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ success: number; failed: number } | null>(null);

  useEffect(() => {
    const unsubscribe = offlineService.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  // Cleanup du timeout
  useEffect(() => {
    let timeoutId: number | null = null;
    
    if (lastSyncResult) {
      timeoutId = window.setTimeout(() => setLastSyncResult(null), 3000);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [lastSyncResult]);

  const handleForceSync = async () => {
    const result = await offlineService.forceSync();
    setLastSyncResult(result);
  };

  // Si tout va bien (online et rien en attente), on affiche juste une petite icône discrète
  if (state.isOnline && state.pendingCount === 0 && !state.isSyncing) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111827]/80 border border-white/10 rounded-full text-xs text-[#7cfc8a]">
          <Cloud size={14} />
          <span>Synchronisé</span>
        </div>
      </div>
    );
  }

  // Mode hors-ligne
  if (!state.isOnline) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <div 
          className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 border border-orange-500/50 rounded-lg text-sm text-orange-400 cursor-pointer"
          onClick={() => setShowDetails(!showDetails)}
        >
          <WifiOff size={16} />
          <span className="font-medium">Hors-ligne</span>
          {state.pendingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full">
              {state.pendingCount}
            </span>
          )}
        </div>
        
        {showDetails && (
          <div className="absolute bottom-full left-0 mb-2 w-64 p-4 bg-[#111827] border border-white/20 rounded-xl shadow-xl">
            <p className="text-sm text-white mb-2">
              <WifiOff size={14} className="inline mr-1" />
              Pas de connexion Internet
            </p>
            {state.pendingCount > 0 ? (
              <>
                <p className="text-sm text-[#94a3b8] mb-3">
                  {state.pendingCount} rapport{state.pendingCount > 1 ? 's' : ''} en attente de synchronisation
                </p>
                <p className="text-xs text-[#7cfc8a]">
                  ✅ Les rapports seront envoyés automatiquement quand le réseau reviendra
                </p>
              </>
            ) : (
              <p className="text-sm text-[#94a3b8]">
                Aucun rapport en attente
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // En ligne mais avec rapports en attente
  if (state.isOnline && state.pendingCount > 0) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <div 
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all ${
            state.isSyncing 
              ? 'bg-[#ffb703]/20 border border-[#ffb703]/50 text-[#ffb703]' 
              : 'bg-[#4dd0e1]/20 border border-[#4dd0e1]/50 text-[#4dd0e1]'
          }`}
          onClick={() => !state.isSyncing && handleForceSync()}
        >
          {state.isSyncing ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Wifi size={16} />
          )}
          <span className="font-medium">
            {state.isSyncing ? 'Synchronisation...' : `${state.pendingCount} en attente`}
          </span>
          {!state.isSyncing && <RefreshCw size={14} className="ml-1" />}
        </div>

        {lastSyncResult && (
          <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#111827] border border-[#7cfc8a]/30 rounded-lg text-xs">
            {lastSyncResult.success > 0 && (
              <span className="text-[#7cfc8a]">✓ {lastSyncResult.success} synchronisé</span>
            )}
            {lastSyncResult.failed > 0 && (
              <span className="text-[#ff6b6b] ml-2">✗ {lastSyncResult.failed} échec</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Synchronisation en cours (aucun en attente)
  if (state.isSyncing) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <div className="flex items-center gap-2 px-3 py-2 bg-[#ffb703]/20 border border-[#ffb703]/50 rounded-lg text-sm text-[#ffb703]">
          <RefreshCw size={16} className="animate-spin" />
          <span>Vérification...</span>
        </div>
      </div>
    );
  }

  return null;
};

// Composant plus discret pour le header
export const OfflineStatusDot: React.FC = () => {
  const [isOnline, setIsOnline] = useState(offlineService.isOnline());
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const unsubscribe = offlineService.subscribe((state) => {
      setIsOnline(state.isOnline);
      setPendingCount(state.pendingCount);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span 
        className={`w-2 h-2 rounded-full ${
          isOnline 
            ? pendingCount > 0 ? 'bg-[#ffb703] animate-pulse' : 'bg-[#7cfc8a]' 
            : 'bg-[#ff6b6b]'
        }`} 
        title={isOnline ? (pendingCount > 0 ? `${pendingCount} en attente` : 'En ligne') : 'Hors-ligne'}
      />
      {!isOnline && (
        <span className="text-xs text-[#ff6b6b]">Hors-ligne</span>
      )}
      {isOnline && pendingCount > 0 && (
        <span className="text-xs text-[#ffb703]">{pendingCount} en attente</span>
      )}
    </div>
  );
};
