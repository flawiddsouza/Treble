<template>
    <main>
        <div class="search-bar">
            <input type="search" placeholder="Search...">
            <div class="settings">
                <i class="fas fa-sliders-h"></i>
            </div>
        </div>
        <div class="tabs">
            <div class="tab" :class="{ 'tab-active': tab === activeTab }" @click="activeTab = tab" v-for="tab in tabs">{{ tab }}</div>
        </div>
        <div class="list">
            <div v-for="i in 100" class="list-item">
                <i class="fas fa-folder"></i>
                <span style="margin-left: 0.5rem">Folder {{ i }}</span>
            </div>
        </div>
        <footer class="nav-bar">
            <div class="nav-bar-item">
                <i class="fas fa-music"></i>
                <span style="margin-left: 0.5rem">Your Library</span>
            </div>
            <div class="nav-bar-item">
                <i class="fas fa-search"></i>
                <span style="margin-left: 0.5rem">Browse</span>
            </div>
        </footer>
    </main>
</template>

<script>
export default {
    data() {
        return {
            tabs: [
                'Folders',
                'Albums',
                'Artists'
            ],
            activeTab: 'Folders'
        }
    }
}
</script>

<style scoped>
main {
    height: 100%;

    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
    grid-template-areas:
        'search-bar'
        'tabs'
        'list'
        'nav-bar'
    ;

    background: var(--background-color);
    color: var(--text-color);
}

main > .search-bar {
  grid-area: search-bar;
}

main > .tabs {
  grid-area: tabs;
}

main > .list {
  grid-area: list;
}

main > .nav-bar {
  grid-area: nav-bar;
}

.search-bar {
    display: flex;
    padding: 1rem;
}

.search-bar > input {
    outline: 0;
    border: 0;
    border-bottom: 1px solid var(--default-border-color);
    padding: 0.5rem;
    background-color: var(--search-background-color);
    color: var(--tab-active-text-color);
    font-weight: 500;
    width: 100%;
    border-radius: 3px;
}

.settings {
    font-size: 1.2rem;
    margin-left: 1rem;
    display: flex;
    align-items: center;
}

.tabs {
    display: flex;
    padding-top: 0.5rem;
    padding-left: 1rem;
    padding-bottom: 0.5rem;
    /* border-bottom: 1px solid var(--default-border-color); */
    justify-content: center;
}

.tab {
    border-top: 1px solid var(--default-border-color);
    border-bottom: 1px solid var(--default-border-color);
    border-right: 1px solid var(--default-border-color);
    padding: 0.5rem 1rem;
}

.tab:first-child {
    border-left: 1px solid var(--default-border-color);
    border-top-left-radius: 4px;
    border-bottom-left-radius: 4px;
}

.tab:last-child {
    border-top-right-radius: 4px;
    border-bottom-right-radius: 4px;
}

.tab-active {
    background-color: var(--tab-active-background-color);
    color: var(--tab-active-text-color);
    font-weight: 500;
    border: 1px solid transparent;
}

.list {
    overflow-y: auto;
    padding-top: 0.5rem;
    padding-bottom: 1rem;
}

.list-item {
    padding-left: 1rem;
    padding-right: 1rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
}

.nav-bar {
    display: flex;
    border-top: 1px solid var(--default-border-color);
}

.nav-bar-item {
    border-right: 1px solid var(--default-border-color);
    padding: 1rem;
    width: 100%;
    text-align: center;
}
</style>
