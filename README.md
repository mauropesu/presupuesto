# Presupuesto

App web de ingresos, gastos y metas de ahorro, en pesos y dólares, multiusuario
(cada persona inicia sesión con su cuenta de Google y ve solo sus propios datos).

Sin build tools: HTML + CSS + JavaScript plano, con Firebase (Auth + Firestore)
como backend. Funciona desde el navegador de celular o computador.

## 1. Crear el proyecto de Firebase

1. Ve a https://console.firebase.google.com/ y crea un proyecto nuevo.
2. En **Compilación > Authentication**, pestaña "Sign-in method", activa el
   proveedor **Google**.
3. En **Compilación > Firestore Database**, crea la base de datos (modo
   producción está bien, las reglas de este repo la protegen).
4. En **Configuración del proyecto > Tus apps**, agrega una app **web** (ícono
   `</>`). Te va a mostrar un bloque `firebaseConfig` con tus llaves.
5. Copia esos valores dentro de `js/firebase-config.js`, reemplazando los
   valores de ejemplo (`TU_API_KEY`, etc.).

## 2. Publicar las reglas de seguridad

Con la [CLI de Firebase](https://firebase.google.com/docs/cli):

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # elige el proyecto que ya creaste
firebase deploy --only firestore:rules
```

Esto sube el archivo `firestore.rules` de este repo, que es lo que garantiza
que cada usuario solo pueda leer/escribir sus propios datos.

## 3. Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "Presupuesto inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/presupuesto.git
git push -u origin main
```

## 4. Activar GitHub Pages

1. En el repo de GitHub: **Settings > Pages**.
2. En "Build and deployment", elige **Source: GitHub Actions**.
3. Cada `git push` a `main` lo publica solo (ver
   `.github/workflows/deploy.yml`).
4. Tu app queda en `https://TU_USUARIO.github.io/presupuesto/`.

## 5. Autorizar el dominio en Firebase

En **Authentication > Settings > Authorized domains**, agrega el dominio de
GitHub Pages (`TU_USUARIO.github.io`), o el inicio de sesión con Google lo
va a rechazar.

## Cómo usarla otra persona

Cualquiera con el link puede entrar con su propia cuenta de Google. Firebase
crea automáticamente su documento de ajustes (fuentes de ingreso,
categorías de gasto, TRM, saldo anterior) la primera vez que entra, separado
por completo del tuyo — las reglas de Firestore no dejan que un usuario lea
los datos de otro.

## Estructura de datos (Firestore)

```
users/{uid}                        → saldoAnterior, trmHoy, fuentes[], categorias[]
users/{uid}/incomes/{id}           → fecha, fuente, descripcion, moneda, montoOriginal, trmUsado, montoCOP
users/{uid}/expenses/{id}          → fecha, categoria, descripcion, moneda, montoOriginal, trmUsado, montoCOP
users/{uid}/goals/{id}             → nombre, montoObjetivo, montoActual, fechaLimite
```

## Ideas para más adelante

- Editar un registro existente (hoy solo se puede borrar y volver a crear).
- Exportar a Excel/CSV.
- Traer la TRM del día automáticamente desde una API pública en vez de
  escribirla a mano en Ajustes.
- Notificación cuando una meta de ahorro llega al 100%.
