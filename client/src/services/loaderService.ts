import { create } from 'zustand';

interface LoaderStore {
  isLoading: boolean;
  timeoutId: NodeJS.Timeout | null;
  show: () => void;
  hide: () => void;
}

const useLoaderStore = create<LoaderStore>((set) => ({
  isLoading: false,
  timeoutId: null,
  show: () => set({ isLoading: true }),
  hide: () => {
    // Ensure loader shows for at least 1 second
    setTimeout(() => {
      set({ isLoading: false });
    }, 500);
  },
}));

export const showLoader = () => useLoaderStore.getState().show();
export const hideLoader = () => useLoaderStore.getState().hide();
export const useLoader = () => useLoaderStore((state) => state.isLoading);
