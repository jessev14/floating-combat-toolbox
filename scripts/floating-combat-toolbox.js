/**
 * IMP2 FORK:
 * prevent combatant deletion via any method other than combat deletion, combatant context menu, or token deletion
 * when a token is created, check for combatantData flag (only present if token was created via MLT teleport)
 * if flag present, update releveant combatant and combatantData flag on token
 * 
 * pros: 
 *  maintains combat turn
 *  maintains duration for time/duration based modules
 * 
 * cons:
 *  cannot delete combatant with HUD toggle (maybe)
 * 
 * 
 * 
 * when current combatant changes scenes, need to rewind back to their turn
 *      this implementation (instead of preventing combatant deletion) may be wholly incompatible with duration/time-based modules
 */

import { libWrapper } from "../lib/shim.js";
import { getCombatfromCombatantID, getTokenFromTokenID } from "./helpers.js"

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

    // Patch Combatant#token#get to use sceneID flag data to get token
    libWrapper.register("floating-combat-toolbox", "Combatant.prototype.token", new_getToken, "WRAPPER");
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

// As a combatant is created, store original scene ID in a flag
Hooks.on("preCreateCombatant", (combatant, data, options, userID) => {
    // If combatant's token has MLT flags, it's most likely a clone so do not create a combatant
    const token = getTokenFromTokenID(data.tokenId);
    if (token.data.flags["multilevel-tokens"]) return false;

    if (combatant.data.scene) return;
    const sceneID = token.parent.data._id;
    combatant.data.update({ "flags.floating-combat-toolbox.sceneID": sceneID });
});

// After a combatant is created, store combatant data in a flag on the combatant's token
Hooks.on('createCombatant', (combatant, data, options, userID) => {
    if (combatant.data.scene) return;

    const tokenID = combatant.data.tokenId;
    const token = getTokenFromTokenID(tokenID);
    if (token) token.setFlag("floating-combat-toolbox", "combatantData", combatant.data);
});

// When a combatant is updated, also update combatant data in token flags
Hooks.on("updateCombatant", (combatant, diff, options, userID) => {
    if (!combatant.data.flags["floating-combat-toolbox"].sceneID) return;

    const token = game.scenes.get(combatant.getFlag("floating-combat-toolbox", "sceneID")).tokens.get(combatant.data.tokenId);
    if (token) token.setFlag("floating-combat-toolbox", "combatantData", combatant.data);
});

// When a token is created, if it already has combatantData flag, then the token was most likely created as part of a MLT teleport
// Recreate the combatant with updated tokenId
Hooks.on("createToken", (tokenDoc, data, options, userID) => {
    if (!game.combat) return;

    let combatantData = tokenDoc.data.flags["floating-combat-toolbox"]?.combatantData;
    if (!combatantData) return;

    combatantData = mergeObject(combatantData, {
        tokenId: tokenDoc.data._id
    });
    Combatant.create(combatantData, { parent: game.combat });
});

// Have to manually delete combatant when token is deleted because CombatEncounters#_onDeleteToken looks at combat scene (null for floating combats)
Hooks.on("preDeleteToken", (tokenDoc, options, userID) => {
    if (!tokenDoc.combatant) return;

    if (tokenDoc.combatant.parent.data.scene === null && !options.mlt_bypass) tokenDoc.combatant.delete();
});

// Make combats floating by default (if enabled in module settings)
Hooks.on("preCreateCombat", (combat, data, options, userID) => {
    if (game.settings.get("floating-combat-toolbox", "floatingDefault")) combat.data.update({ scene: null });
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


async function new_onCombatantMouseDown(wrapped, ...args) {
    if (!game.settings.get("floating-combat-toolbox", "clickCombatantSceneSwitch")) return wrapped(...args);

    const event = args[0];
    const li = event.currentTarget;
    const combatant = this.viewed.combatants.get(li.dataset.combatantId);
    const combatantSceneID = combatant.getFlag("floating-combat-toolbox", "sceneID");

    if (combatantSceneID === game.scenes.viewed.id && combatant.token) return wrapped(...args);
    if (!combatant.actor?.testUserPermission(game.user, "OBSERVED")) return wrapped(...args);

    await game.scenes.get(combatantSceneID).view();
    const token = game.scenes.get(combatantSceneID).tokens.get(combatant.data.tokenId);

    if (token.object) {
        token.object.control({ releaseOthers: true });
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

function new_getToken(wrapped, ...args) {
    let token = wrapped(...args);
    if (token) return token;
    
    const sceneID = this.data.flags["floating-combat-toolbox"]?.sceneID;
    if (!sceneID) return token;

    const scene = game.scenes.get(sceneID);
    this._token = scene.tokens.get(this.data.tokenId);
    return this._token;
}