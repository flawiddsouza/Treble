<template>
    <ul ref="list" :style="virtual ? { height: `${totalSize}px`, position: 'relative' } : undefined" @focusin="rememberFocus" @focusout="forgetFocus">
        <li v-for="row in rows" :key="row.key" ref="elements" :data-index="row.index"
            :aria-posinset="virtual ? row.index + 1 : undefined" :aria-setsize="virtual ? items.length : undefined"
            :style="virtual ? { position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${row.start - scrollMargin}px)` } : undefined">
            <slot :item="items[row.index]" :index="row.index" />
        </li>
    </ul>
</template>

<script setup>
import { computed, nextTick, onMounted, onUpdated, ref, shallowRef, watch } from 'vue'
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/vue-virtual'

const props = defineProps({
    items: { type: Array, required: true },
    virtual: Boolean,
    scrollElement: Object,
    itemKey: { type: Function, required: true }
})
const list = ref(null)
const elements = shallowRef([])
const scrollMargin = ref(0)
const anchorOffset = ref(0)
const anchorIndex = ref(-1)
const focusedKey = ref(null)
const focusedIndex = computed(() => focusedKey.value === null ? -1
    : props.items.findIndex((item, index) => props.itemKey(item, index) === focusedKey.value))
const virtualizer = useVirtualizer(computed(() => {
    const focused = focusedIndex.value
    const anchor = anchorIndex.value
    return {
        enabled: props.virtual,
        count: props.virtual ? props.items.length : 0,
        getScrollElement: () => props.scrollElement,
        getItemKey: index => props.itemKey(props.items[index], index),
        // Estimate the usual two-line search row, then measure wrapped text at its actual height.
        estimateSize: () => 48,
        initialRect: { width: 0, height: window.innerHeight },
        overscan: 4,
        scrollMargin: scrollMargin.value,
        // Keep the within-row position while TanStack settles dynamic row measurements.
        scrollPaddingStart: -anchorOffset.value,
        rangeExtractor: range => [...new Set([
            ...defaultRangeExtractor(range),
            // Measure the anchor and preceding overscan before aligning a restored position.
            ...Array.from({ length: range.overscan + 1 }, (_, offset) => anchor - offset).filter(index => anchor >= 0 && index >= 0 && index < range.count),
            // Keep focus and its neighbours mounted so native Tab can reach every result.
            ...[focused - 1, focused, focused + 1].filter(index => focused >= 0 && index >= 0 && index < range.count)
        ])].sort((left, right) => left - right)
    }
}))
const rows = computed(() => props.virtual ? virtualizer.value.getVirtualItems()
    : props.items.map((item, index) => ({ index, key: props.itemKey(item, index) })))
const totalSize = computed(() => virtualizer.value.getTotalSize())

function rememberFocus(event) {
    const row = event.target.closest('li[data-index]')
    if (row) {
        const index = Number(row.dataset.index)
        focusedKey.value = props.itemKey(props.items[index], index)
    }
}
function forgetFocus(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) focusedKey.value = null
}
function getScrollAnchor() {
    if (!props.virtual || !props.scrollElement) return null
    const offset = props.scrollElement.scrollTop
    const row = virtualizer.value.getVirtualItemForOffset(offset)
    return row ? { key: row.key, offset: offset - row.start } : null
}
async function restoreScrollAnchor(anchor) {
    if (!props.virtual || !anchor) return false
    const items = props.items
    const index = props.items.findIndex((item, index) => props.itemKey(item, index) === anchor.key)
    if (index < 0) return false
    anchorOffset.value = anchor.offset
    anchorIndex.value = index
    await nextTick()
    if (!props.virtual || props.items !== items) {
        anchorIndex.value = -1
        return false
    }
    measureRows()
    virtualizer.value.scrollToIndex(index, { align: 'start' })
    anchorIndex.value = -1
    return true
}
function measureRows() {
    if (!props.virtual) return
    scrollMargin.value = list.value.offsetTop
    virtualizer.value.measureElement(null)
    elements.value.forEach(element => virtualizer.value.measureElement(element))
}
watch(() => props.items, () => { if (focusedIndex.value < 0) focusedKey.value = null })
onMounted(measureRows)
onUpdated(measureRows)
defineExpose({ getScrollAnchor, restoreScrollAnchor })
</script>
