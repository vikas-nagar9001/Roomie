import { create } from 'zustand';

interface LoaderStore {
  isLoading: boolean;
  timeoutId: NodeJS.Timeout | null;
  activeLoaders: number;
  show: () => void;
  hide: () => void;
  forceHide: () => void;
}

const useLoaderStore = create<LoaderStore>((set, get) => ({
  isLoading: false,
  timeoutId: null,
  activeLoaders: 0,
  show: () => {
    // Increment active loaders count
    set((state) => ({ 
      isLoading: true,
      activeLoaders: state.activeLoaders + 1 
    }));
    
    // Clear any existing timeout to prevent premature hiding
    if (get().timeoutId) {
      clearTimeout(get().timeoutId);
      set({ timeoutId: null });
    }
  },
  hide: () => {
    // Decrement active loaders count
    set((state) => ({
      activeLoaders: Math.max(0, state.activeLoaders - 1)
    }));
    
    // Only hide loader when all active loaders are done
    const currentState = get();
    
    if (currentState.activeLoaders <= 0) {
      // Ensure loader shows for at least 500ms
      const timeoutId = setTimeout(() => {
        set({ isLoading: false, timeoutId: null });
      }, 500);
      
      set({ timeoutId });
    }
  },  forceHide: () => {
    // Force hide loader regardless of active count
    // Clear any existing timeout
    const currentTimeoutId = get().timeoutId;
    if (currentTimeoutId) {
      clearTimeout(currentTimeoutId);
    }
    
    set({ 
      isLoading: false, 
      timeoutId: null,
      activeLoaders: 0
    });
    
    // Double-ensure the loader is hidden after a short delay
    // This helps with edge cases where something might be retriggering the loader
    setTimeout(() => {
      set({ isLoading: false, activeLoaders: 0, timeoutId: null });
    }, 600);
  }
}));

export const showLoader = () => useLoaderStore.getState().show();
export const hideLoader = () => useLoaderStore.getState().hide();
export const forceHideLoader = () => useLoaderStore.getState().forceHide();
export const useLoader = () => useLoaderStore((state) => state.isLoading);
