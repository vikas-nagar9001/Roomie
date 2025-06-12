import toast from 'react-hot-toast';

export const showSuccess = (message: string) => {
  toast.success(message, {
    style: {
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      color: '#fff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    iconTheme: {
      primary: '#10b981',
      secondary: '#fff',
    },
  });
};

export const showError = (message: string) => {
  toast.error(message, {
    style: {
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      color: '#fff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    iconTheme: {
      primary: '#ef4444',
      secondary: '#fff',
    },
  });
};

export const showInfo = (message: string) => {
  toast(message, {
    style: {
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      color: '#fff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
  });
};

export const showWarning = (message: string) => {
  toast(message, {
    icon: '⚠️',
    style: {
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      color: '#fff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
  });
};
