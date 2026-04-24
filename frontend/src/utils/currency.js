import { useSelector } from 'react-redux';
import { formatCurrency } from './helpers';

export const useCurrency = () => {
  const currency = useSelector((s) => s.settings.currency);
  return (amount) => formatCurrency(amount, currency);
};
