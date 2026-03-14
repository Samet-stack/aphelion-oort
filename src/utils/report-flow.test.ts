import { describe, expect, it } from 'vitest';
import { getReportShareHelp, getReportStorageMessage } from './report-flow';

describe('report-flow helpers', () => {
  it('disables share before a report is saved online', () => {
    expect(getReportShareHelp(null)).toEqual({
      canShare: false,
      helperText: "Le partage s'active apres un premier enregistrement en ligne.",
    });
  });

  it('enables share when a server report id exists', () => {
    expect(getReportShareHelp('report-123')).toEqual({
      canShare: true,
      helperText: 'Le partage est disponible pour ce rapport.',
    });
  });

  it('returns clear storage feedback messages', () => {
    expect(getReportStorageMessage('saved_now')).toBe('Rapport enregistre. Vous pouvez maintenant le partager.');
    expect(getReportStorageMessage('saved_repeat')).toBe('Rapport deja enregistre. Le PDF a ete regenere.');
    expect(getReportStorageMessage('local_now')).toBe('Rapport garde en local. Il sera synchronise quand le reseau reviendra.');
    expect(getReportStorageMessage('local_repeat')).toBe('Rapport deja garde en local. Le PDF a ete regenere.');
  });
});
