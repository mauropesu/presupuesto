// Pega aquí la configuración de tu proyecto Firebase.
// La encuentras en: Firebase Console > Configuración del proyecto > Tus apps > SDK setup.
// Ver README.md para el paso a paso completo.

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
