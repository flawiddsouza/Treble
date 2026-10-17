<template>
    <div class="settings" @keydown.esc.stop.prevent="dismiss" @focusout="focusLeft">
        <button ref="trigger" class="settings-trigger" type="button" aria-label="Settings" title="Settings"
            aria-haspopup="dialog" :aria-expanded="open" aria-controls="settings-panel" @click="toggle">
            <i class="fas fa-sliders-h" aria-hidden="true"></i>
        </button>
        <section v-if="open" id="settings-panel" class="settings-panel" role="dialog" aria-labelledby="settings-title">
            <div class="settings-heading">
                <button v-if="choosingTheme" class="settings-back" type="button" aria-label="Back to settings" @click="showSettings"><i class="fas fa-arrow-left" aria-hidden="true"></i></button>
                <h2 id="settings-title">{{ choosingTheme ? 'Theme' : 'Settings' }}</h2>
                <button v-if="!choosingTheme" class="settings-close" type="button" aria-label="Close settings" @click="close(true)">&times;</button>
            </div>
            <div v-if="choosingTheme" ref="themeChoices" class="theme-choices" role="radiogroup" aria-labelledby="settings-title">
                <button v-for="(option, index) in themes" :key="option.id" class="theme-choice" type="button" role="radio"
                    :aria-checked="theme === option.id" :tabindex="theme === option.id ? 0 : -1"
                    @click="changeTheme(option.id)" @keydown="handleThemeKey($event, index)">
                    <span class="theme-swatch" :data-theme="option.id" aria-hidden="true"></span>
                    <span class="theme-name">{{ option.label }}</span>
                    <svg class="theme-check" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg>
                </button>
            </div>
            <button v-else ref="theme" class="theme-summary" type="button" @click="showThemes">
                <span>Theme</span>
                <span class="theme-current"><span class="theme-swatch" :data-theme="theme" aria-hidden="true"></span><span class="theme-name" :title="selectedTheme.label">{{ selectedTheme.label }}</span></span>
                <i class="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
        </section>
    </div>
</template>

<script>
import { getTheme, setTheme, themes } from '@/themes'

export default {
    data() { return { open: false, choosingTheme: false, theme: getTheme(), themes } },
    computed: {
        selectedTheme() { return this.themes.find(option => option.id === this.theme) }
    },
    methods: {
        async toggle() {
            if (this.open) return this.close(true)
            this.theme = getTheme()
            this.choosingTheme = false
            this.open = true
            await this.$nextTick()
            this.$refs.theme?.focus()
        },
        close(restoreFocus = false) {
            this.open = false
            this.choosingTheme = false
            if (restoreFocus) this.$refs.trigger?.focus()
        },
        dismiss() {
            if (this.choosingTheme) this.showSettings()
            else this.close(true)
        },
        async showSettings() {
            this.choosingTheme = false
            await this.$nextTick()
            this.$refs.theme?.focus()
        },
        async showThemes() {
            this.choosingTheme = true
            await this.focusTheme()
        },
        async focusTheme() {
            await this.$nextTick()
            const choice = this.$refs.themeChoices?.querySelector('[aria-checked="true"]')
            choice?.focus()
            choice?.scrollIntoView?.({ block: 'nearest' })
        },
        changeTheme(theme) { this.theme = setTheme(theme) },
        async handleThemeKey(event, index) {
            if (['ArrowDown', 'ArrowRight'].includes(event.key)) index = (index + 1) % this.themes.length
            else if (['ArrowUp', 'ArrowLeft'].includes(event.key)) index = (index + this.themes.length - 1) % this.themes.length
            else if (event.key === 'Home') index = 0
            else if (event.key === 'End') index = this.themes.length - 1
            else return
            event.preventDefault()
            this.changeTheme(this.themes[index].id)
            await this.focusTheme()
        },
        pointerOutside(event) {
            if (this.open && !this.$el.contains(event.target)) this.close()
        },
        focusLeft(event) {
            if (this.open && event.relatedTarget && !this.$el.contains(event.relatedTarget)) this.close()
        }
    },
    mounted() { document.addEventListener('pointerdown', this.pointerOutside) },
    beforeUnmount() { document.removeEventListener('pointerdown', this.pointerOutside) }
}
</script>

<style scoped>
.settings { position: relative; margin-left: 1rem; display: flex; align-items: center; }
button { position: relative; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; border-radius: 3px; }
button:focus-visible { outline: 0; background: #ffffff1f; }
.settings-trigger { font-size: 1.2rem; width: 1.2rem; min-height: 2rem; padding: 0; }
.settings-trigger::before { content: ''; position: absolute; inset: -0.5rem; }
.settings-trigger:hover:not([aria-expanded="true"]), .settings-close:hover, .settings-back:hover,
.theme-summary:hover, .theme-choice:hover:not([aria-checked="true"]) { background: #ffffff0c; }
.settings-trigger[aria-expanded="true"] { background: #ffffff17; }
.settings-panel {
    position: absolute; right: 0; top: calc(100% + 0.75rem); z-index: 10;
    display: flex; flex-direction: column;
    width: 17rem; max-width: calc(100vw - 2rem); max-height: calc(100dvh - 5rem); overflow: hidden;
    padding: 1rem; border: 1px solid var(--default-border-color); border-radius: 4px;
    background: var(--background-color); color: var(--text-color); box-shadow: 0 4px 16px #0003;
}
.settings-heading { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; flex-shrink: 0; }
h2 { margin: 0; font-size: 1rem; font-weight: 600; }
.settings-close { font-size: 1.25rem; width: 2rem; height: 2rem; padding: 0; margin: -0.5rem -0.5rem -0.5rem auto; }
.settings-back { width: 2rem; height: 2rem; padding: 0; margin: -0.5rem 0 -0.5rem -0.5rem; }
.theme-summary, .theme-choice { display: flex; align-items: center; gap: 0.75rem; min-height: 2.75rem; padding: 0.5rem; text-align: left; }
.theme-summary { width: calc(100% + 1rem); margin: 0 -0.5rem; flex-shrink: 0; }
.theme-current { display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem; flex: 1; min-width: 0; }
.theme-summary .theme-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.theme-swatch {
    width: 1.75rem; height: 1.25rem; flex-shrink: 0; border-radius: 3px; box-shadow: inset 0 0 0 1px #ffffff20;
    background: linear-gradient(90deg, var(--background-color) 50%, var(--player-background-color) 50%);
}
.theme-summary .theme-swatch { width: 1.25rem; }
.theme-choices { display: grid; gap: 2px; max-height: 14rem; min-height: 0; overflow-y: auto; overscroll-behavior: contain; margin: 0 -0.5rem; }
.theme-choice { width: 100%; }
.theme-choice .theme-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.theme-check { width: 1rem; height: 1rem; flex-shrink: 0; visibility: hidden; }
.theme-choice[aria-checked="true"] .theme-check { visibility: visible; }
@media (forced-colors: active) {
    button:focus-visible { outline: 2px solid Highlight; outline-offset: -2px; }
}
</style>
