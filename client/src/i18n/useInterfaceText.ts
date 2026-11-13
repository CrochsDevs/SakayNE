import { useTranslation } from 'react-i18next';

// Natural-language keys keep shared interface copy readable at its call site.
export function useInterfaceText() {
  const { t } = useTranslation('ui');
  return (text: string, values?: Record<string, string | number>) => t(text, { ...values, keySeparator: false, nsSeparator: false });
}
