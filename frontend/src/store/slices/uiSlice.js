import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarOpen: true,
    sidebarCollapsed: false,
  },
  reducers: {
    toggleSidebar: (state) => { state.sidebarOpen = !state.sidebarOpen; },
    setSidebarOpen: (state, action) => { state.sidebarOpen = action.payload; },
    toggleSidebarCollapsed: (state) => { state.sidebarCollapsed = !state.sidebarCollapsed; },
  },
});

export const { toggleSidebar, setSidebarOpen, toggleSidebarCollapsed } = uiSlice.actions;
export default uiSlice.reducer;
