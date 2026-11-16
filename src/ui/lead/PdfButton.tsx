import { useState } from 'preact/hooks';
import { t } from '../../content';
import type { Answers } from '../../engine/conditions';

interface Props {
  answers: Answers;
  company?: string;
  hourlyRate: number | undefined;
  bookingUrl: string;
}

/** Bouton de téléchargement : le générateur PDF n'est chargé qu'au clic. */
export function PdfButton({ answers, company, hourlyRate, bookingUrl }: Props) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');
  const run = async () => {
    setState('working');
    try {
      const { downloadReport } = await import('../../pdf/download');
      await downloadReport(answers, {
        ...(company && { company }),
        ...(hourlyRate !== undefined && { hourlyRate }),
        bookingUrl,
      });
      setState('idle');
    } catch {
      setState('error');
    }
  };
  return (
    <div class="pdf-button">
      <button
        type="button"
        class="btn btn-secondary"
        onClick={run}
        disabled={state === 'working'}
        aria-busy={state === 'working'}
      >
        {state === 'working' ? t('pdf_working') : t('pdf_download')}
      </button>
      <span role="status" class="field-error">
        {state === 'error' ? t('pdf_error') : ''}
      </span>
    </div>
  );
}
