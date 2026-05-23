import { createApp } from 'vue';
import App from './App.vue';
import { createPinia } from 'pinia';
import router from './router';
import './styles/main.css';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';
// Initialize app with Pinia and Router
const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
