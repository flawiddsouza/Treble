import { createApp } from 'vue'
import App from './App.vue'
import './styles/normalize.css'
import './styles/main.css'
import { initializeTheme } from './themes'

initializeTheme()
createApp(App).mount('#app')
