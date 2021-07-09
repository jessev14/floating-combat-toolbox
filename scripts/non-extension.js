/* 
Add module setting to prevent CSCT from closing on esc keypress; refer to Smalltime implementation
*/

Hooks.once("init", () => {
    console.log("cross-scene-combat-tracker | initializing");

    window.CrossSceneCombatTracker = CrossSceneCombatTracker;
});

Hooks.once("ready", () => {
    if (!game.csct) game.csct = new CrossSceneCombatTracker();
});


Hooks.on("updateScene", () => {
    game.csct?.initialize();
});

Hooks.on("updateCombat", () => {
    game.csct?.initialize();
});

Hooks.on("deleteCombat", () => {
    game.csct?.initialize();
})

/* 
Hooks.on("updateCombatant", () => {
    if (game.csct) game.csct.initialize();
});
*/

// Create fakeout combat tracker to hold csct
class CrossSceneCombatTracker extends Application {
    constructor(options) {
        super(options);

        this.initialize(false);
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "csct",
            classes: ["csct", "directory", "sidebar-popout"],
            template: "modules/cross-scene-combat-tracker/templates/cross-scene-combat-tracker.hbs",
            title: "Cross Scene Combat Tracker",
            height: 600,
            width: 300,
            resizable: false,
            scrollY: [".directory-list"]
        });
    }

    async getData(options) {

        for (const turn of this.turns) {
            
        }

        return {
            user: game.user,
            hasCombat: this.combats.length,
            turns: this.turns
        }
    }

    initialize(render = true) {
        this.turns = [];
        this.combats = game.combats.contents.filter(c => c.getFlag("cross-scene-combat-tracker", "tracked"));
        for (const combat of this.combats) this.turns = this.turns.concat(combat.turns);
        if (this.turns.length) {
            this.element.find("img").each(function () {
                $(this).prop("src", $(this).prop("dataset").src);
            });
        }
        console.log(this.turns)
        if (render) this.render();
    }

    activateListeners(html) {
        html.find(".combat-settings").click(ev => {
            ev.preventDefault();
            this.configCSCT();
        });
    }

    async configCSCT() {
        //const combats = game.combats.contents.filter(c => !c.started || c.data.flags["cross-scene-combat-tracker"]?.tracked);
        const combats = game.combats.contents;
        const content = await renderTemplate("modules/cross-scene-combat-tracker/templates/csct-config.hbs", { combats });
        new Dialog({
            title: "Track Combats", // LOCALIZE
            content,
            buttons: {
                confirm: {
                    label: "Confirm", // LOCALIZE
                    callback: (html) => {
                        const combats = [];
                        const combatIDS = html.find('input[name="checkboxes"]');
                        $(combatIDS).each(function () {
                            if (!$(this).prop("checked")) return;

                            combats.push(game.combats.get($(this).prop("id")));
                        });
                        this.updateCombats(combats)
                    }
                },
                cancel: {
                    label: "Cancel", // LOCALIZE
                    callback: () => { }
                }
            },
            default: "confirm"
        }, { id: "csct-config", width: 200 }).render(true);
    }

    async updateCombats(combats) {
        for (const combat of game.combats.contents) {
            await combat.unsetFlag("cross-scene-combat-tracker", "tracked");
        }
        for (const combat of combats) {
            await combat.setFlag("cross-scene-combat-tracker", "tracked", true);
            if (combat.round !== 0) {
                //await combat.resetAll();
                //await combat.previousRound();
            }
        }
        this.initialize();
    }
}