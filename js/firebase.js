// js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, collection, addDoc, updateDoc, doc, getDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCOYWxr9kBdN3kQLG_34Z5Lr4z8RKvZjn0",
    authDomain: "fitdatalite.firebaseapp.com",
    projectId: "fitdatalite",
    storageBucket: "fitdatalite.firebasestorage.app",
    messagingSenderId: "1003644679120",
    appId: "1:1003644679120:web:b479fb9d9d7e165f523fd5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
    localCache: persistentLocalCache()
});

// -----------------------------------------
// DATABASE HELPERS
// -----------------------------------------

/**
 * Carga el perfil principal del usuario (pesos máximos, rutinas, notas)
 */
export async function loadUserData(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (error) {
        console.error("Error cargando perfil:", error);
    }
    return null;
}

/**
 * Guarda un entrenamiento finalizado en el historial
 */
export async function saveWorkout(uid, workoutData) {
    try {
        const historyRef = collection(db, "users", uid, "history");
        await addDoc(historyRef, {
            ...workoutData,
            timestamp: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error("Error guardando entreno:", error);
        return false;
    }
}

/**
 * Actualiza el perfil del usuario (RM, Notas de máquinas, etc)
 */
export async function updateProfile(uid, dataUpdates) {
    try {
        const docRef = doc(db, "users", uid);
        await updateDoc(docRef, dataUpdates);
        return true;
    } catch (error) {
        console.error("Error actualizando perfil:", error);
        return false;
    }
}

/**
 * Carga el historial de entrenamientos ordenado por fecha
 */
export async function loadHistory(uid, limitCount = 50) {
    try {
        const q = query(collection(db, "users", uid, "history"), orderBy("timestamp", "desc"), limit(limitCount));
        const querySnapshot = await getDocs(q);
        const history = [];
        querySnapshot.forEach((doc) => {
            history.push({ id: doc.id, ...doc.data() });
        });
        return history;
    } catch (error) {
        console.error("Error cargando historial:", error);
        return [];
    }
}

// Exportamos todo para uso global
export { auth, db };