import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function initAuthFlow() {
    const registerForm = document.getElementById('register-form');
    
    if(registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Recoger datos del DOM
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value; // Asume que añadiste un campo password
            const fullName = document.getElementById('reg-name').value;
            const gender = document.getElementById('reg-gender').value;
            const age = document.getElementById('reg-age').value;
            const phone = document.getElementById('reg-phone').value;
            const telegram = document.getElementById('reg-telegram').value;
            
            const btn = registerForm.querySelector('button');
            btn.disabled = true;
            btn.textContent = 'Registrando...';

            try {
                // 1. Crear usuario en Firebase Auth
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Crear perfil en Firestore. Programación Defensiva: Forzar estado y rol
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    fullName: fullName,
                    email: email,
                    gender: gender,
                    age: Number(age),
                    phone: phone,
                    telegram: telegram || null,
                    // Variables críticas de sistema (protegidas por Reglas en el paso 3)
                    status: 'pending', // 'pending', 'approved', 'rejected'
                    role: null,        // 'app', 'cliente', 'atleta', 'admin'
                    createdAt: serverTimestamp()
                });

                alert('Registro completado. Tu cuenta está pendiente de aprobación por el Coach.');
                // Aquí podrías ocultar el formulario o redirigir a una pantalla de "En espera"
                
            } catch (error) {
                console.error("Error en registro:", error);
                alert('Error al registrar: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Registrarse';
            }
        });
    }

    // Monitor de estado global
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Usuario logueado. ¿Está aprobado?
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.status === 'approved') {
                    console.log(`Acceso concedido. Rol: ${userData.role}`);
                    // Ocultar Auth UI, Mostrar App UI
                    document.getElementById('auth-view').style.display = 'none';
                    document.getElementById('app-view').style.display = 'block';
                } else {
                    alert('Tu cuenta aún no ha sido aprobada por el administrador.');
                    // Mantener en la vista de Auth o vista de espera
                }
            }
        } else {
            // Usuario no logueado
            document.getElementById('auth-view').style.display = 'block';
            document.getElementById('app-view').style.display = 'none';
        }
    });
}