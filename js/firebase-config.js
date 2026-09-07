// Pega aquí la configuración de tu proyecto Firebase.
// La encuentras en: Firebase Console > Configuración del proyecto > Tus apps > SDK setup.
// Ver README.md para el paso a paso completo.

const firebaseConfig = {
  apiKey: "AIzaSyDjkBtk8aaLhJjGV224JJDYK-_EdgX0lys",
  authDomain: "finanzas-12bdd.firebaseapp.com",
  projectId: "finanzas-12bdd",
  storageBucket: "finanzas-12bdd.firebasestorage.app",
  messagingSenderId: "143993790118",
  appId: "1:143993790118:web:e48430d87f01f0f7e71e67",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();