<template>
    <Teleport to="body">
        <div v-if="visible" ref="menu" class="item-context-menu" role="menu" aria-label="Item actions" tabindex="-1"
            :style="{ left: `${left}px`, top: `${top}px` }" @keydown="handleKey">
            <button v-for="action in actions" :key="action.id" type="button" role="menuitem" tabindex="-1"
                :disabled="action.disabled" :aria-disabled="action.disabled ? 'true' : undefined" @click="choose(action)">
                {{ action.label }}
            </button>
        </div>
    </Teleport>
</template>

<script>
export default {
    props: {
        actions: { type: Array, default: () => [] },
        position: { type: Object, default: () => ({ x: 0, y: 0 }) },
        visible: Boolean,
        opener: { type: Object, default: null }
    },
    emits: ['select', 'close'],
    data() { return { left: 0, top: 0 } },
    watch: {
        visible(value) { if (value) this.updateMenu(true) },
        position: { deep: true, handler() { if (this.visible) this.updateMenu(true) } },
        actions: { deep: true, handler() { if (this.visible) this.updateMenu() } }
    },
    methods: {
        async updateMenu(focusFirst = false) {
            await this.$nextTick()
            const menu = this.$refs.menu
            if (!this.visible || !menu) return
            const margin = 8
            const bounds = menu.getBoundingClientRect()
            const width = document.documentElement.clientWidth || window.innerWidth
            const height = window.innerHeight
            const x = Number.isFinite(this.position.x) ? this.position.x : 0
            const y = Number.isFinite(this.position.y) ? this.position.y : 0
            this.left = Math.max(margin, Math.min(x, width - bounds.width - margin))
            this.top = Math.max(margin, Math.min(y, height - bounds.height - margin))
            if (focusFirst || !menu.contains(document.activeElement) || document.activeElement.disabled) {
                this.focusItem(this.enabledItems()[0] || menu)
            }
        },
        enabledItems() { return [...(this.$refs.menu?.querySelectorAll('button:not(:disabled)') || [])] },
        focusItem(item) {
            item?.focus({ preventScroll: true })
            item?.scrollIntoView?.({ block: 'nearest' })
        },
        choose(action) {
            if (action.disabled) return
            this.$emit('select', action.id)
            this.close()
        },
        close(restoreFocus = false) { this.$emit('close', { restoreFocus }) },
        handleKey(event) {
            if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                this.close(true)
                return
            }
            if (event.key === 'Tab') {
                this.close(true)
                return
            }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            event.stopPropagation()
            const items = this.enabledItems()
            if (!items.length) return
            let index = items.indexOf(document.activeElement)
            if (event.key === 'Home') index = 0
            else if (event.key === 'End') index = items.length - 1
            else if (index < 0) index = event.key === 'ArrowUp' ? items.length - 1 : 0
            else index = (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
            this.focusItem(items[index])
        },
        pointerOutside(event) {
            if (this.visible && !this.$refs.menu?.contains(event.target) && !this.opener?.contains(event.target)) this.close()
        },
        viewportChanged() { if (this.visible) this.close() },
        documentScrolled(event) {
            if (this.visible && !this.$refs.menu?.contains(event.target)) this.close()
        }
    },
    mounted() {
        document.addEventListener('pointerdown', this.pointerOutside)
        document.addEventListener('scroll', this.documentScrolled, true)
        window.addEventListener('resize', this.viewportChanged)
        if (this.visible) this.updateMenu(true)
    },
    beforeUnmount() {
        document.removeEventListener('pointerdown', this.pointerOutside)
        document.removeEventListener('scroll', this.documentScrolled, true)
        window.removeEventListener('resize', this.viewportChanged)
    }
}
</script>

<style scoped>
.item-context-menu {
    position: fixed; z-index: 20; box-sizing: border-box;
    min-width: min(12rem, calc(100vw - 1rem)); max-width: calc(100vw - 1rem);
    max-height: calc(100dvh - 1rem); overflow: auto; overscroll-behavior: contain;
    padding: 0.25rem; border: 1px solid var(--default-border-color); border-radius: 4px;
    background: var(--background-color); color: var(--text-color); box-shadow: 0 4px 16px #0003;
    outline: 0;
}
button {
    display: block; width: 100%; min-height: 2.5rem; padding: 0.5rem 0.75rem;
    text-align: left; overflow-wrap: anywhere; border: 0; border-radius: 3px;
    background: transparent; color: inherit; font: inherit; cursor: pointer;
}
button:hover:not(:disabled) { background: #ffffff0c; }
button:focus-visible { outline: 0; background: #ffffff1f; }
button:disabled { opacity: 0.5; cursor: default; }
@media (forced-colors: active) {
    button:focus-visible { outline: 2px solid Highlight; outline-offset: -2px; }
}
</style>
