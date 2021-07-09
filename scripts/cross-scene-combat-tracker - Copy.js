/* 
Add module setting to control preventing CSCT from closing on esc keypress; refer to Smalltime implementation
*/

Hooks.once("init", () => {
    console.log("cross-scene-combat-tracker | initializing");

    // Add CrossSceneCombatTracker class to global scope
    window.CrossSceneCombatTracker = CrossSceneCombatTracker;
});

Hooks.once("ready", () => {
    // If no CrossSceneCombatTracker instance exists in the game, create one
    // New instance will look for combats with CSCT flag on initialization
    if (!game.csct) game.csct = new CrossSceneCombatTracker();
});


// CSCT Initialization Hooks

Hooks.on("renderCombatTracker", () => {
    console.log("renderCombatTracker")
    game.csct?.initialize();
});
/*
Hooks.on("updateScene", () => {
    console.log("updateScene")
    game.csct?.initialize();
});
Hooks.on("updateCombat", () => {
    console.log("updateCombat")
    game.csct?.initialize();
});
Hooks.on("deleteCombat", () => {
    console.log("deleteCombat")
    game.csct?.initialize();
});
Hooks.on("updateCombatant", () => {
    console.log("updateCombatant")
   game.csct?.initialize();
});
*/

// Create fakeout combat tracker to hold csct
class CrossSceneCombatTracker extends Application {
    constructor(options) {
        super(options);

        this.viewed = {
            turns: [],
            data: {
                round: 0
            }
        };

        this.turnCount = 0;
        this.currentCombatant = null;


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
        const data = await CombatTracker.prototype.getData.call(this);

        for (const turn of data.turns) {
            const og_turn = this.viewed.turns.find(c => c.id === turn.id);
            turn.sceneName = og_turn._token.parent.name;
        }

        data.hasCombat = this.viewed.turns.length;

        return data;
    }

    initialize(render = true) {
        // Collect combats that are tracked (have CSCT flag), then sort by round
        this.combats = game.combats.contents.filter(c => c.getFlag("cross-scene-combat-tracker", "tracked"));
        const rounds = this.combats.map(c => c.round);
        if (rounds.length) {
            this.combats.sort((a, b) => {
                if (a.round > b.round) return -1;
                if (a.round < b.round) return 1;
            });
        }

        // Collect turn data of tracked combats, then sort by initiative
        this.viewed.turns = [];
        for (const combat of this.combats) {
            this.viewed.turns = this.viewed.turns.concat(combat.turns);
        }
        this.viewed.turns.sort((a, b) => {
            if (a.initiative > b.initiative) return -1;
            if (a.initiative < b.initiative) return 1;
        });

        // Set CSCT round to highest round of tracked combats
        if (rounds.length) {
            this.viewed.data.round = rounds.reduce((acc, cv) => {
                if (cv > acc) return cv;
                else return acc;
            });
        }

        //this.currentCombatant = this.viewed.turns[turnCount]

        if (render) this.render();
    }

    activateListeners(html) {
        html.find(".combat-settings").click(ev => {
            ev.preventDefault();
            this.configCSCT();
        });

        html.find("#startCombat").click(async (ev) => {
            const initialCombatant = this.viewed.turns[0];
            if (initialCombatant.initiative === null) ui.notifications.warn("Roll initiative for at least one combatant.") // LOCALIZE
            else {
                initialCombatant.parent.startCombat();
                this.currentCombatant = initialCombatant;
            }
        });

        html.find("#endCombat").click(async (ev) => {
            return Dialog.confirm({
                title: `CSCT: ${game.i18n.localize("COMBAT.EndTitle")}`,
                content: `<p>${game.i18n.localize("COMBAT.EndConfirmation")}</p>`,
                yes: () => {
                    for (const combat of this.combats) combat.delete();
                }
            });
        });

        html.find("#rollInitiative").click( ev => {
            const combatantId = ev.currentTarget.closest(".combatant").dataset.combatantId;
            this.viewed.turns.find(c => c.id === combatantId).parent.rollInitiative([combatantId]);
        })
    };

    async configCSCT() {
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
        }
        this.initialize();
    }
}