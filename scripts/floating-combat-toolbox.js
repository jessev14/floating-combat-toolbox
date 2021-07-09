import { libWrapper } from "../lib/shim.js";


Hooks.once("init", () => {
    console.log("floating-combat-toolbox | initializing");

    // Register module settings
    game.settings.register("floating-combat-toolbox", "turnChangeSceneSwitch", {
        name: "Turn Change: Switch Scene to Current Combatant", // LOCALIZE
        hint: "Switches scene when turn changes. Does not activate scene.", // LOCALIZE
        type: String,
        choices: {
            disabled: "Disabled", // LOCALIZE
            gm: "GMs Only", // LOCALIZE
            players: "GMs and Players" // LOCALIZE
        },
        default: "disabled",
        scope: "world",
        config: true
    });

    game.settings.register("floating-combat-toolbox", "clickCombatantSceneSwitch", {
        name: "Combatant Click: Switch Scene to Clicked Combatant", // LOCALIZE
        hint: "Only switches scene for GMs. Does not activate scene.", // LOCALIZE
        type: Boolean,
        default: false,
        scope: "world",
        config: true
    });

    game.settings.register("floating-combat-toolbox", "displaySceneName", {
        name: "Display Combatant Scene Name", // LOCALIZE
        hint: "",
        type: Boolean,
        default: false,
        scope: "world",
        config: true,
        onChange: () => ui.combat.render()
    });

    game.settings.register("floating-combat-toolbox", "floatingDefault", {
        name: "Floating Combats by Default", // LOCALIZE
        hint: "Combats created by toggling combat on tokens will also be floating.", // LOCALIZE
        type: Boolean,
        default: false,
        scope: "world",
        config: true
    });
});

Hooks.once("setup", () => {
    // Patch CombatTracker#_onCombatantMouseDown to switch scene to clicked combatant
    libWrapper.register("floating-combat-toolbox", "CombatTracker.prototype._onCombatantMouseDown", new_onCombatantMouseDown, "MIXED");

    // Patch CombatTracker#_onCombatCreate to query type of combat to create
    libWrapper.register("floating-combat-toolbox", "CombatTracker.prototype._onCombatCreate", new_onCombatCreate, "MIXED");
});


// Add combatant context menu option to allow GM users to pull all users to a combatant's scene
Hooks.on("getCombatTrackerEntryContext", (html, contextOptions) => {
    const pullToSceneOption = {
        name: "Pull All Users to Scene",
        icon: `<i class="fas fa-directions"></i>`,
        condition: game.user.isGM,
        callback: li => {
            const combatant = game.combat.combatants.get(li.data("combatant-id"));
            if (combatant) {
                for (const user of game.users.contents) {
                    game.socket.emit("pullToScene", combatant.getFlag("floating-combat-toolbox", "sceneID"), user.id);
                } 
            }
        }
    };
    contextOptions.splice(4, 0, pullToSceneOption);
});

// Switch scene to combatant on turn change (if module setting enabled)
Hooks.on("updateCombat", (combat, diff, options, userID) => {
    if (combat.data.scene) return;
    if (game.settings.get("floating-combat-toolbox", "turnChangeSceneSwitch") === "disabled") return;
    if (!game.user.isGM && game.settings.get("floating-combat-toolbox", "turnChangeSceneSwitch") === "gm") return;

    const combatant = combat.combatants.get(combat.current.combatantId);
    const combatantSceneID = combatant?.getFlag("floating-combat-toolbox", "sceneID");
    if (combatantSceneID !== game.scenes.viewed.id) game.scenes.get(combatantSceneID)?.view();
});

// When a combatant is created, store original scene ID in a flag
Hooks.on("preCreateCombatant", (combatant, data, options, userID) => {
    combatant.data.update({ "flags.floating-combat-toolbox.sceneID": game.scenes.viewed.id });
});

Hooks.on("renderCombatTracker", (combatTracker, html, data) => {
    if (combatTracker.viewed?.data.scene) return;

    // Highlight floating combats with yellow text
    const encounterHeader = html.find("h4.encounter");
    encounterHeader.css("color", "yellow"); // consider also changing text itself to differentiate floating combats
    encounterHeader.prop("title", "Floating Combat") // LOCALIZE


    // Add title and extra label to combatants to indicate scene
    html.find("li.combatant").each(function () {
        const combatantID = this.dataset.combatantId;
        const combatant = game.combat.combatants.get(combatantID);
        const combatantSceneID = combatant.getFlag("floating-combat-toolbox", "sceneID");
        const sceneName = game.scenes.get(combatantSceneID).name;
        $(this).prop("title", sceneName);

        if (game.settings.get("floating-combat-toolbox", "displaySceneName")) {
            $(this).find("h4").contents().filter(function () { return this.nodeType === 3; })[0].nodeValue += ` | ${sceneName}`;
        }
    });

});

Hooks.on("preCreateCombat", (combat, data, options, userID) => {
    if (game.settings.get("floating-combat-toolbox", "floatingDefault")) combat.data.update({ scene: null });
});


async function new_onCombatantMouseDown(wrapped, ...args) {
    if (!game.settings.get("floating-combat-toolbox", "clickCombatantSceneSwitch")) return wrapped(...args);

    const event = args[0];
    const li = event.currentTarget;
    const combatant = this.viewed.combatants.get(li.dataset.combatantId);
    const combatantSceneID = combatant.getFlag("floating-combat-toolbox", "sceneID");

    if (combatantSceneID === game.scenes.viewed.id) return wrapped(...args);
    if (!combatant.actor?.testUserPermission(game.user, "OBSERVED")) return wrapped(...args);

    await game.scenes.get(combatantSceneID).view();
    const token = combatant.token;
    if (token.object) {
        token.object?.control({ releaseOthers: true });
        return canvas.animatePan({ x: token.data.x, y: token.data.y });
    }
}

async function new_onCombatCreate(wrapped, ...args) {
    const event = args[0];
    const dialogOptions = {
        id: "create-combat-dialog",
        width: 200,
        left: window.innerWidth - 510,
        top: event.currentTarget.offsetTop
    };

    if (!game.settings.get("floating-combat-toolbox", "floatingDefault")) {
        const res = await new Promise(resolve => {
            new Dialog({
                title: "Create Encounter", // LOCALIZE
                content: `
                    <style>
                        #create-combat-dialog .dialog-buttons {
                            flex-direction: column;
                        }
                    </style>`,
                buttons: {
                    standard: {
                        label: "Normal (single-scene)", // LOCALIZE
                        callback: () => resolve(true)
                    },
                    floating: {
                        label: "Floating (multi-scene)",
                        callback: () => resolve(false)
                    }
                }
            }, dialogOptions).render(true);
        });

        if (res) return wrapped(...args);
    }

    const combat = await getDocumentClass("Combat").create({ scene: null });
    await combat.activate();
    this.initialize({ combat });
}
