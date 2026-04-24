import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import store from './store';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#1B4332', color: '#fff', fontFamily: 'Inter, sans-serif' },
            success: { style: { background: '#15803d' } },
            error: { style: { background: '#dc2626' } },
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
