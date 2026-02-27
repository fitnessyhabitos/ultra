import { db, auth } from './firebase.js';
import {
    collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc,
    query, where, orderBy, limit, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * FitDataPro - Módulo de Administración (Coach Panel)
 * Filosofía: Zero-Defect. Consultas paginadas y transacciones atómicas para métricas.
 */
export const AdminController = {

    /**
     * Obtiene la lista de clientes aprobados o pendientes.
     * @param {string} status - 'approved' | 'pending'
     * @returns {Promise<Array>}
     */
    async getClients(status = 'approved') {
        try {
            const q = query(
                collection(db, "users"),
                where("status", "==", status),
                // Solo traemos los que tú gestionas (si hubiera varios coaches en el futuro)
                // where("coachId", "==", auth.currentUser.uid) 
            );

            const snapshot = await getDocs(q);
            const clients = [];
            snapshot.forEach(doc => clients.push({ id: doc.id, ...doc.data() }));
            return clients;
        } catch (error) {
            console.error("Admin: Error al obtener clientes.", error);
            alert("Fallo de red al cargar clientes.");
            return [];
        }
    },

    /**
     * Incrementa y obtiene el ID único del cliente de manera transaccional. (Fallback method para la UI si no lo maneja auth.js)
     */
    async getOptimizedIncrementCounter() {
        const counterRef = doc(db, "system", "counters");
        try {
            return await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let count = 1;
                if (counterDoc.exists()) {
                    count = (counterDoc.data().userCount || 0) + 1;
                    transaction.update(counterRef, { userCount: count });
                } else {
                    transaction.set(counterRef, { userCount: 1 });
                }
                return count;
            });
        } catch (e) {
            console.error("Fallo al incrementar ID.", e);
            return 999;
        }
    },

    /**
     * Aprueba a un usuario pendiente, dándole acceso a la app.
     */
    async approveUser(uid) {
        try {
            const userRef = doc(db, "users", uid);
            await updateDoc(userRef, {
                status: 'approved',
                role: 'user' // Por defecto se le asigna rol normal para que acceda al Plan
            });
            return true;
        } catch (error) {
            console.error("Admin: Error al aprobar usuario.", error);
            return false;
        }
    },

    /**
     * Rechaza a un usuario pendiente.
     */
    async rejectUser(uid) {
        try {
            const userRef = doc(db, "users", uid);
            await updateDoc(userRef, {
                status: 'rejected'
            });
            return true;
        } catch (error) {
            console.error("Admin: Error al rechazar usuario.", error);
            return false;
        }
    },

    /**
     * Enviar Nota de Pago a un cliente
     */
    async sendBillingNote(clientId, amount, concept) {
        if (!clientId || !amount || amount <= 0) {
            console.warn("Admin: Datos de facturación inválidos.");
            return false;
        }

        try {
            await addDoc(collection(db, "billing"), {
                clientId: clientId,
                coachId: auth.currentUser.uid,
                amount: Number(amount),
                concept: concept,
                status: 'pending',
                issuedAt: serverTimestamp()
            });
            // Opcional: Aquí dispararías una Cloud Function para enviar un email
            return true;
        } catch (error) {
            console.error("Admin: Error al crear nota de pago.", error);
            return false;
        }
    },

    /**
     * REGISTRO PROXY & ACTUALIZACIÓN DE 1RM (Transacción Atómica)
     * Guarda el entreno y evalúa instantáneamente si hay nuevos récords.
     * @param {string} clientId - ID del atleta
     * @param {Object} workoutData - Datos del entreno
     * @param {Array} exercises - [{ id: 'squat', name: 'Sentadilla', maxWeight: 120 }]
     */
    async logProxyWorkout(clientId, workoutData, exercises) {
        if (!auth.currentUser || !clientId || !exercises?.length) return false;

        const workoutRef = doc(collection(db, `users/${clientId}/workouts`));

        try {
            // Usamos runTransaction para asegurar que si falla la actualización del 1RM, 
            // no se guarde un entreno corrupto (ACID compliance).
            await runTransaction(db, async (transaction) => {

                // 1. Guardar el entreno general (Proxy Flag activado)
                transaction.set(workoutRef, {
                    ...workoutData,
                    loggedBy: auth.currentUser.uid, // Firma del Coach
                    timestamp: serverTimestamp(),
                    isProxy: true
                });

                // 2. Procesar cada ejercicio para actualizar el 1RM histórico
                for (const ex of exercises) {
                    const statsRef = doc(db, `users/${clientId}/exercise_stats/${ex.id}`);
                    const statsDoc = await transaction.get(statsRef);

                    const newWeight = Number(ex.maxWeight);

                    if (!statsDoc.exists()) {
                        // Primer registro de este ejercicio
                        transaction.set(statsRef, {
                            name: ex.name,
                            current1RM: newWeight,
                            history1RM: [{ date: new Date().toISOString(), weight: newWeight }],
                            lastWorkoutRef: workoutRef.id
                        });
                    } else {
                        // Ya existe, comprobamos si superó el 1RM
                        const currentData = statsDoc.data();

                        // Solo actualizamos el histórico de 1RM si levantó más peso
                        if (newWeight > currentData.current1RM) {
                            const updatedHistory = [...currentData.history1RM, { date: new Date().toISOString(), weight: newWeight }];

                            // Programación defensiva: Evitar arrays infinitos en Firebase (Max 50 hitos de RM)
                            if (updatedHistory.length > 50) updatedHistory.shift();

                            transaction.update(statsRef, {
                                current1RM: newWeight,
                                history1RM: updatedHistory,
                                lastWorkoutRef: workoutRef.id
                            });
                        } else {
                            // Si no es PR, solo actualizamos la referencia del último entreno
                            transaction.update(statsRef, {
                                lastWorkoutRef: workoutRef.id
                            });
                        }
                    }
                }
            });

            console.log("Admin: Entreno Proxy y Récords guardados exitosamente.");
            return true;

        } catch (error) {
            console.error("Admin: Fallo en la transacción de entreno Proxy.", error);
            alert("Error al guardar el entreno. Revisa tu conexión.");
            return false;
        }
    },

    /**
     * Obtener el historial optimizado para gráficas (Progreso)
     */
    async getExerciseProgression(clientId, exerciseId) {
        try {
            const statsRef = doc(db, `users/${clientId}/exercise_stats/${exerciseId}`);
            const docSnap = await getDoc(statsRef);

            if (docSnap.exists()) {
                // Retorna un array pequeño con las fechas y pesos, ideal para inyectar directo a Chart.js
                return docSnap.data().history1RM;
            }
            return [];
        } catch (error) {
            console.error("Admin: Error leyendo progresión.", error);
            return [];
        }
    },

    /**
     * Bandeja de entrada Global: Obtiene los últimos mensajes de todos los atletas
     */
    async getGlobalMessages() {
        try {
            // Requiere un Composite Index en Firestore: status == 'approved' && order by lastMessageAt
            const q = query(collection(db, "users"), where("status", "==", "approved"));
            const snapshot = await getDocs(q);
            let inbox = [];

            for (const docSnap of snapshot.docs) {
                const u = docSnap.data();
                if (u.messages && u.messages.length > 0) {
                    const lastMsg = u.messages[u.messages.length - 1];
                    inbox.push({
                        clientId: docSnap.id,
                        clientName: u.fullName || 'Atleta',
                        lastMessage: lastMsg.text,
                        time: lastMsg.time,
                        sender: lastMsg.sender,
                        unreadCount: u.messages.filter(m => m.sender === 'user' && !m.read).length
                    });
                }
            }
            // Sort by most recent conceptually (if we had real timestamps it would be better, but time string is HH:MM)
            return inbox.sort((a, b) => b.time.localeCompare(a.time));
        } catch (error) {
            console.error("Admin: Error cargando buzón global", error);
            return [];
        }
    },

    /**
     * Responde a un atleta específico (Coach -> Cliente)
     */
    async replyToMessage(clientId, text) {
        try {
            const userRef = doc(db, "users", clientId);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) return false;

            const userData = userSnap.data();
            const msgs = userData.messages || [];
            const d = new Date();
            msgs.push({
                sender: 'coach',
                text: text,
                time: `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`,
                read: false // pending for user to read
            });

            // Mark all previous user messages as read by coach
            msgs.forEach(m => { if (m.sender === 'user') m.read = true; });

            await updateDoc(userRef, { messages: msgs });
            return true;
        } catch (error) {
            console.error("Admin: Error al enviar mensaje", error);
            return false;
        }
    },

    /**
     * Cliente envía mensaje al Coach
     */
    async sendClientMessage(text) {
        try {
            if (!auth.currentUser) return false;
            const userRef = doc(db, "users", auth.currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) return false;

            const userData = userSnap.data();
            const msgs = userData.messages || [];
            const d = new Date();
            msgs.push({
                sender: 'user',
                text: text,
                time: `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`,
                read: false
            });
            await updateDoc(userRef, { messages: msgs });

            // update local State if available
            if (typeof window.State !== 'undefined') {
                window.State.messages = msgs;
            }
            return msgs;
        } catch (error) {
            console.error("Admin: Error sending client message", error);
            return false;
        }
    },

    /**
     * Guarda una rutina plantilla a nivel global para el coach
     */
    async saveGlobalRoutine(routineName, exercisesArray) {
        try {
            const routineRef = doc(db, "global_routines", routineName.toLowerCase().replace(/\s+/g, '_'));
            await setDoc(routineRef, {
                name: routineName,
                exercises: exercisesArray,
                coachId: auth.currentUser.uid,
                createdAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error("Admin: Error al guardar rutina global", error);
            return false;
        }
    },

    /**
     * Asigna una rutina directamente a un atleta
     */
    async assignRoutineToUser(clientId, routineName, exercisesArray) {
        try {
            const userRef = doc(db, "users", clientId);
            await updateDoc(userRef, {
                assignedRoutine: {
                    name: routineName,
                    exercises: exercisesArray,
                    assignedAt: new Date().toISOString()
                }
            });
            return true;
        } catch (error) {
            console.error("Admin: Error al asignar rutina al atleta", error);
            return false;
        }
    },

    /**
     * Obtiene todas las rutinas globales guardadas por el coach
     */
    async getGlobalRoutines() {
        try {
            if (!auth.currentUser) return [];
            const q = query(collection(db, "global_routines"), where("coachId", "==", auth.currentUser.uid));
            const snapshot = await getDocs(q);
            let routines = [];
            snapshot.forEach(docSnap => routines.push({ id: docSnap.id, ...docSnap.data() }));
            return routines;
        } catch (error) {
            console.error("Admin: Error cargando rutinas globales", error);
            return [];
        }
    },

    /**
     * Elimina una rutina global
     */
    async deleteGlobalRoutine(routineId) {
        try {
            const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            await deleteDoc(doc(db, "global_routines", routineId));
            return true;
        } catch (error) {
            console.error("Admin: Error eliminando rutina global", error);
            return false;
        }
    },

    /**
     * Elimina a un cliente de forma definitiva (Doble confirmación la hará la UI)
     */
    async deleteClientComplete(clientId) {
        try {
            const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            // Borramos documento principal (idealmente deberíamos borrar subcolecciones desde una Cloud Function)
            await deleteDoc(doc(db, "users", clientId));
            return true;
        } catch (error) {
            console.error("Admin: Error eliminando cliente permanente", error);
            return false;
        }
    },

    /**
     * Agenda / Citas
     */
    async getAgenda() {
        try {
            if (!auth.currentUser) return [];
            const q = query(collection(db, "appointments"), where("coachId", "==", auth.currentUser.uid));
            const snapshot = await getDocs(q);
            let appts = [];
            snapshot.forEach(docSnap => appts.push({ id: docSnap.id, ...docSnap.data() }));
            return appts.sort((a, b) => new Date(a.date) - new Date(b.date));
        } catch (e) {
            console.error("Admin: Error cargando agenda", e);
            return [];
        }
    },

    async createAppointment(clientId, clientName, dateStr, timeStr, type, notes) {
        try {
            if (!auth.currentUser) return false;

            // 1. Crear el docto en la colección global 'appointments'
            const docRef = doc(collection(db, "appointments"));
            await setDoc(docRef, {
                coachId: auth.currentUser.uid,
                clientId: clientId,
                clientName: clientName,
                date: dateStr, // YYYY-MM-DD
                time: timeStr, // HH:MM
                type: type, // Presencial / Online
                notes: notes || "",
                timestamp: Date.now()
            });

            // 2. Enviar una notificación al cliente a través del Chat In-Vivo
            const { getDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const userDocRef = doc(db, "users", clientId);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                const uData = userSnap.data();
                const msgs = uData.messages || [];
                const msgText = `📅 Nueva cita programada: ${dateStr} a las ${timeStr} (${type}). ${notes ? "Notas: " + notes : ""}`;

                msgs.push({
                    sender: 'coach',
                    text: msgText,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    timestamp: Date.now()
                });

                await updateDoc(userDocRef, { messages: msgs });
            }

            return true;
        } catch (e) {
            console.error("Admin: Error creando cita", e);
            return false;
        }
    },

    async deleteAppointment(id) {
        try {
            const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            await deleteDoc(doc(db, "appointments", id));
            return true;
        } catch (e) {
            console.error("Admin: Error borrando cita", e);
            return false;
        }
    }
};