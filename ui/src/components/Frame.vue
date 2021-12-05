<template>
    <main>
        <div class="search-bar">
            <input type="search" style="width: 100%" placeholder="Search...">
        </div>
        <div class="tabs">
            <div class="tab tab-active">Folders</div>
            <div class="tab">Albums</div>
            <div class="tab">Artists</div>
        </div>
        <div class="list">
            <div v-for="i in 100" class="list-item">
                <i class="far fa-folder"></i>
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

.search-bar > input {
    outline: 0;
    border: 0;
    border-bottom: 1px solid var(--default-border-color);
    padding: 0.5rem;
}

.tabs {
    display: flex;
    padding-top: 1rem;
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
    background-color: #3300ff36;
    color: #3300ffa6;
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
