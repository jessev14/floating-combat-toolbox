import { libWrapper } from "../lib/shim.js";
import { getTokenFromTokenID } from "./helpers.js";


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
        default: true,
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
    libWrapper.register("floating-combat-toolbox", "CombatTracker.prototype._onCombatantMouseDown", new_onCombatantMouseDown, "OVERRIDE");

    // Patch CombatTracker#_onCombatCreate to query type of combat to create
    libWrapper.register("floating-combat-toolbox", "CombatTracker.prototype._onCombatCreate", new_onCombatCreate, "MIXED");

    // Patch Combatant#token#get to use sceneID flag data to get token
    libWrapper.register("floating-combat-toolbox", "Combatant.prototype.token", new_getToken, "MIXED");

    // Patch MultilevelTokens#_execute to avoid deleting combatants
    if (game.modules.get("multilevel-tokens")?.active) libWrapper.register("floating-combat-toolbox", "MultilevelTokens.prototype._execute", new_MLTexecute, "WRAPPER");

    // Stairways compatibility
    if (game.modules.get("stairways")?.active) stairwaysHook();
});


// Add combatant context menu option to allow GM users to pull all users to a combatant's scene
Hooks.on("getCombatTrackerEntryContext", (html, contextOptions) => {
    const pullToSceneOption = {
        name: "Pull All Users to Scene", // LOCALIZE
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
    const token = getTokenFromTokenID(data.tokenId, data.actorId);
    if (token.data.flags["multilevel-tokens"]) return false;

    if (combatant.parent.data.scene) return;
    const sceneID = token.parent.data._id;
    combatant.data.update({ "flags.floating-combat-toolbox.sceneID": sceneID });
});

// After a combatant is created, store combatant data in a flag on the combatant's token
Hooks.on("createCombatant", (combatant, data, options, userID) => {
    if (combatant.parent.data.scene) return;

    const tokenID = combatant.data.tokenId;
    const tokenActorID = combatant.data.actorId;
    const token = getTokenFromTokenID(tokenID, tokenActorID);
    if (token) token.setFlag("floating-combat-toolbox", "combatantData", combatant.data);
});

// When a combatant is updated, also update combatant data in token flags
Hooks.on("updateCombatant", (combatant, diff, options, userID) => {
    if (!combatant.data.flags["floating-combat-toolbox"]?.sceneID) return;

    const token = game.scenes.get(combatant.getFlag("floating-combat-toolbox", "sceneID")).tokens.get(combatant.data.tokenId);
    if (token) token.setFlag("floating-combat-toolbox", "combatantData", combatant.data);
});

// When a token is created, if it already has combatantData flag, then the token was most likely created as part of a MLT teleport
Hooks.on("createToken", async (tokenDoc, data, options, userID) => {
    if (!game.combat) return;

    let combatantData = tokenDoc.data.flags["floating-combat-toolbox"]?.combatantData;
    if (!combatantData) return;

    combatantData = mergeObject(combatantData, {
        tokenId: tokenDoc.data._id
    });

    // Update the token combatantData flag
    await tokenDoc.data.update({ "flags.floating-combat-toolbox.combatantData": combatantData });

    // Update combatant sceneID flag and tokenId data
    await game.combat.combatants.get(combatantData._id).update({
        "flags.floating-combat-toolbox.sceneID": tokenDoc.parent.data._id,
        tokenId: tokenDoc.data._id
    });
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
        const sceneName = game.scenes.get(combatantSceneID)?.name;
        if (sceneName) $(this).prop("title", sceneName);

        if (game.settings.get("floating-combat-toolbox", "displaySceneName")) {
            $(this).find("h4").contents().filter(function () { return this.nodeType === 3; })[0].nodeValue += ` | ${sceneName}`;
        }
    });

});

// For Stairways module, hook onto PreStairwayTeleport and and prevent combatant deletion
function stairwaysHook() {
    Hooks.on("PreStairwayTeleport", data => {
        const { selectedTokenIds, sourceSceneId } = data;
        for (const tokenID of selectedTokenIds) {
            const token = game.scenes.get(sourceSceneId).tokens.get(tokenID);
            if (!token.data.flags["floating-combat-toolbox"].combatantData) continue;

            const preDeleteHook = Hooks.on("preDeleteCombatant", (combatantDoc, options, userID) => {
                if (combatantDoc.data.tokenId !== tokenID) return;

                Hooks.off("preDeleteCombatant", preDeleteHook);
                return false;
            });
        }
    });
}
    

async function new_onCombatantMouseDown(...args) {
    args[0].preventDefault();
    const event = args[0];

    const li = event.currentTarget;
    const combatant = this.viewed.combatants.get(li.dataset.combatantId);
    const token = combatant.token;
    if ((token === null) || !combatant.actor?.testUserPermission(game.user, "OBSERVED")) return;
    const now = Date.now();

    // Handle double-left click to open sheet
    const dt = now - this._clickTime;
    this._clickTime = now;
    if (dt <= 250) return token?.actor?.sheet.render(true);

    // If the Token does not exist in this scene
    // TODO: This is a temporary workaround until we persist sceneId as part of the Combatant data model
    //if ( token === undefined ) {
    const scene = game.scenes.get(combatant.getFlag("floating-combat-toolbox", "sceneID"));
    if (scene?.id !== game.scenes.viewed.data._id) {
        if (scene && game.settings.get("floating-combat-toolbox", "clickCombatantSceneSwitch")) await scene.view();
    }

    // Control and pan to Token object
    const tkn = game.scenes.viewed.tokens.get(token.data._id);
    if (!tkn) return;
    if (tkn.object) {
        tkn.object.control({ releaseOthers: true });
        return canvas.animatePan({ x: tkn.data.x, y: tkn.data.y });
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
                        label: "Floating (multi-scene)", // LOCALIZE
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
    const token = wrapped(...args);

    const sceneID = this.data.flags["floating-combat-toolbox"]?.sceneID;
    if (!sceneID) return token;

    const scene = game.scenes.get(sceneID);
    this._token = scene.tokens.get(this.data.tokenId);
    return this._token;
}

function new_MLTexecute(wrapped, ...args) {
    const options = {isUndo: true};
    options[MLT.REPLICATED_UPDATE] = true;

    const requestBatch = args[0];
    for (const [sceneId, data] of Object.entries(requestBatch._scenes)) {
        const scene = game.scenes.get(sceneId);
        if (data.delete.length) {
            scene.deleteEmbeddedDocuments(Token.embeddedName, data.delete, options);
            data.delete = [];
        }
    }

    return wrapped(...args);
}
