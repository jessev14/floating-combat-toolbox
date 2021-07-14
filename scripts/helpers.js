export function getCombatfromCombatantID(combatantID) {
    const combat = game.combats.find(c => {
        for (const combatant of c.combatants.contents) {
            if (combatant.data._id === combatantID) return true; 
        }
    });

    return combat;
}

export function getTokenFromTokenID(tokenID, tokenActorID = null) {
    const token = game.scenes.find(s => {
        for (const tkn of s.tokens.contents) {
            if (tokenActorID) {  // optional comparison to avoid (reduce?) collision on the chance that two tokens have the same ID
                if (tokenActorID !== tkn.actor.data._id) continue;
            }

            if (tkn.data._id === tokenID) return true;
        }
    }).tokens.get(tokenID);

    return token;
}