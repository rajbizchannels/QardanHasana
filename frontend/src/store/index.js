import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: { ignoredActions: ['persist/PERSIST'] } }),
});

export default store;
