export type ReportStorageState = 'saved_now' | 'saved_repeat' | 'local_now' | 'local_repeat';

export const getReportShareHelp = (savedServerReportId: string | null) => {
  if (savedServerReportId) {
    return {
      canShare: true,
      helperText: 'Le partage est disponible pour ce rapport.',
    };
  }

  return {
    canShare: false,
    helperText: "Le partage s'active apres un premier enregistrement en ligne.",
  };
};

export const getReportStorageMessage = (state: ReportStorageState) => {
  switch (state) {
    case 'saved_now':
      return 'Rapport enregistre. Vous pouvez maintenant le partager.';
    case 'saved_repeat':
      return 'Rapport deja enregistre. Le PDF a ete regenere.';
    case 'local_now':
      return 'Rapport garde en local. Il sera synchronise quand le reseau reviendra.';
    case 'local_repeat':
      return 'Rapport deja garde en local. Le PDF a ete regenere.';
    default:
      return 'Rapport prepare.';
  }
};
