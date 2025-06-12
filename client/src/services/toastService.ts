import toast from 'react-hot-toast';

export const showSuccess = (message: string) => {
  toast.success(message, {
    style: {
      background: 'rgba(26, 26, 46, 0.85)',
      backdropFilter: 'blur(12px)',
      color: '#fff',
      border: '1px solid rgba(88, 44, 132, 0.3)',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(88, 44, 132, 0.15)',
      padding: '12px 16px',
      fontWeight: '500',
    },
    iconTheme: {
      primary: '#ab6cff',
      secondary: '#fff',
    },
    duration: 3000,
  });
};

export const showError = (message: string) => {
  toast.error(message, {
    style: {
      background: 'rgba(26, 26, 46, 0.85)',
      backdropFilter: 'blur(12px)',
      color: '#fff',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
      padding: '12px 16px',
      fontWeight: '500',
    },
    iconTheme: {
      primary: '#f87171',
      secondary: '#fff',
    },
    duration: 4000,
  });
};

export const showInfo = (message: string) => {
  toast(message, {
    style: {
      background: 'rgba(26, 26, 46, 0.85)',
      backdropFilter: 'blur(12px)',
      color: '#fff',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
      padding: '12px 16px',
      fontWeight: '500',
    },
    icon: 'ℹ️',
    duration: 3000,
  });
};

export const showWarning = (message: string) => {
  toast(message, {
    icon: '⚠️',
    style: {
      background: 'rgba(26, 26, 46, 0.85)',
      backdropFilter: 'blur(12px)',
      color: '#fff',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
      padding: '12px 16px',
      fontWeight: '500',
    },
    duration: 4000,
  });
};
