# Mi Presupuesto

Aplicación web simple para llevar el control de tu presupuesto personal: ingresos, gastos, límites por categoría y gráficos. Todo se guarda localmente en el navegador (localStorage) — no requiere backend ni base de datos.

## Funcionalidades

- Registro de ingresos y gastos con fecha, categoría y descripción.
- Presupuesto mensual por categoría con barra de progreso (verde / amarillo / rojo).
- Gráficos: gastos por categoría (dona) e ingresos vs gastos de los últimos 6 meses (barras).
- Filtro por mes.
- Exportar datos a JSON o CSV, e importar un respaldo JSON.
- Categorías personalizables.

## Uso

Solo abre `index.html` en tu navegador. No requiere instalación ni servidor.

También puedes publicarlo gratis con **GitHub Pages**:

1. Ve a *Settings → Pages* en el repositorio.
2. En *Source*, selecciona la rama `main` y la carpeta `/ (root)`.
3. Guarda y espera unos minutos — GitHub te dará una URL pública.

## Estructura

```
presupuesto/
├── index.html      # estructura de la app
├── css/style.css   # estilos
├── js/app.js       # lógica (localStorage, render, gráficos)
└── README.md
```

## Notas

- Los datos viven en el `localStorage` del navegador donde abras la app — si cambias de navegador o dispositivo, usa **Exportar JSON / Importar JSON** para migrar tus datos.
- Los gráficos usan [Chart.js](https://www.chartjs.org/) vía CDN.
