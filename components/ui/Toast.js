import { createContext, useContext, useMemo, useState } from 'react';

const ToastContext = createContext({ toast: () => {} });

export default function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = (message, tone = 'neutral') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4000);
  };
  const value = useMemo(() => ({ toast }), []);
  return <ToastContext.Provider value={value}>{children}<div className="ui-toast-region" aria-live="polite">{items.map((item) => <div className={`ui-toast ui-toast-${item.tone}`} key={item.id}>{item.message}</div>)}</div></ToastContext.Provider>;
}

export function useToast() { return useContext(ToastContext); }
