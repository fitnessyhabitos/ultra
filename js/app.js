import { initAuthFlow } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Registrar Service Worker para PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('SW registrado', reg.scope))
                .catch(err => console.error('SW Fallo registro', err));
        });
    }

    // 2. Iniciar Flujo de Autenticación
    initAuthFlow();

    // 3. (Futuro) Iniciar Router de Vistas (el código que hicimos antes para navegar por la app)
});