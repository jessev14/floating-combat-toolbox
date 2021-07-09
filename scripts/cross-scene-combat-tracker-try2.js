CONFIG.debug.hooks = true;

Hooks.once("init", () => {
    console.log("cross-scene-combat-tracker | initializing");
});

Hooks.once("ready", () => {
});

Hooks.once("renderSidebar", (sidebar, html, options) => {
    sidebar.tabs.csct = new CrossSceneCombatTracker;
});

class CrossSceneCombatTracker extends SidebarTab {
    constructor(options) {
        super(options);

        console.log("custom sidebar tab consructor");
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
        id: "csct",
        template: "templates/sidebar/combat-tracker.html",
        title: "Cross Scene Combat Tracker",
        scrollY: [".directory-list"]
      });
    }
}