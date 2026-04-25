import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

export const fetchCurrency = createAsyncThunk('settings/fetchCurrency', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/settings');
    const curr = res.data.data?.find(s => s.key === 'currency');
    return curr?.value || 'INR';
  } catch {
    return rejectWithValue('INR');
  }
});

const settingsSlice = createSlice({
  name: 'settings',
  initialState: { currency: 'INR' },
  reducers: {
    setCurrency: (state, action) => { state.currency = action.payload; },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchCurrency.fulfilled, (state, action) => {
      state.currency = action.payload;
    });
  },
});

export const { setCurrency } = settingsSlice.actions;
export default settingsSlice.reducer;
