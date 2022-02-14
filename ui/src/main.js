import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)

app.config.errorHandler = (err) => {
    console.log('vue error', err.stack)
}

app.mount('#app')
