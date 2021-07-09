
    /** @inheritdoc */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "combat",
            template: "templates/sidebar/combat-tracker.html",
            title: "Cross Scene Combat Tracker",
            scrollY: [".directory-list"]
        });
    }




    get combats() {
        //if (!game.csctCombat) game.csctCombat = new Combat();
        return [this.viewed];
    }

    createPopout() {
        CombatTracker.prototype.createPopout.call(this);
    }

    initialize({ combat = this.viewed, render = true } = {}) {

        // Set flags
        this._highlighted = null;

        // Trigger data computation
        if (combat && !combat.turns) combat.turns = combat.setupTurns();

        // Also initialize the popout
        if (this._popout) this._popout.initialize({ combat, render: false });

        // Render the tracker
        if (render) this.render();
    }

    scrollToTurn() {
        CombatTracker.prototype.scrollToTurn.call(this);
    }

    async getData(options) {
        CombatTracker.prototype.getData.call(this, options);
    }

    activateListners(html) {
        CombatTracker.prototype.activateListeners.call(this, html);

    }

    /**
 * Handle new Combat creation request
 * @param {Event} event
 * @private
 */
    async _onCombatCreate(event) {
        CombatTracker.prototype._onCombatCreate.call(this, event);
    }

    /* -------------------------------------------- */

    /**
     * Handle a Combat deletion request
     * @param {Event} event
     * @private
     */
    async _onCombatDelete(event) {
        CombatTracker.prototype._onCombatDelete.call(this, event);
    }

    /* -------------------------------------------- */

    /**
     * Handle a Combat cycle request
     * @param {Event} event
     * @private
     */
    async _onCombatCycle(event) {
        CombatTracker.prototype._onCombatCycle.call(this, event);
    }

    /* -------------------------------------------- */

    /**
     * Handle click events on Combat control buttons
     * @private
     * @param {Event} event   The originating mousedown event
     */
    async _onCombatControl(event) {
        CombatTracker.prototype._onCombatControl.call(this, event);
    }

    /* -------------------------------------------- */

    /**
     * Handle a Combatant control toggle
     * @private
     * @param {Event} event   The originating mousedown event
     */
    async _onCombatantControl(event) {
        CombatTracker.prototype._onCombatantControl.call(this, event);
    }

    /* -------------------------------------------- */

    /**
     * Handle toggling the defeated status effect on a combatant Token
     * @param {Combatant} combatant     The combatant data being modified
     * @return {Promise}                A Promise that resolves after all operations are complete
     * @private
     */
    async _onToggleDefeatedStatus(combatant) {
        CombatTracker.prototype._onToggleDefeatedStatus.call(this, combatant);
    }

    /* -------------------------------------------- */

    /**
     * Handle mouse-down event on a combatant name in the tracker
     * @param {Event} event   The originating mousedown event
     * @return {Promise}      A Promise that resolves once the pan is complete
     * @private
     */
    async _onCombatantMouseDown(event) {
        CombatTracker.prototype._onCombatantMouseDown.call(this, event);
    }

    /* -------------------------------------------- */

    /**
     * Handle mouse-hover events on a combatant in the tracker
     * @private
     */
    _onCombatantHoverIn(event) {
        CombatTracker.prototype._onCombatantHoverIn.call(this, event);
    }

    /* -------------------------------------------- */

    /**
     * Handle mouse-unhover events for a combatant in the tracker
     * @private
     */
    _onCombatantHoverOut(event) {
        CombatTracker.prototype._onCombatantHoverOut.call(this, event);
    }

    /* -------------------------------------------- */

    /**
     * Attach context menu options to elements in the tracker
     * @param {jQuery} html     The HTML element to which context options are attached
     * @private
     */
    _contextMenu(html) {
        CombatTracker.prototype._contextMenu.call(this, html);
    }

    /* -------------------------------------------- */

    /**
     * Get the sidebar directory entry context options
     * @return {Object}   The sidebar entry context options
     * @private
     */
    _getEntryContextOptions() {
        CombatTracker.prototype._getEntryContextOptions.call(this);
    }

    /* -------------------------------------------- */

    /**
     * Display a dialog which prompts the user to enter a new initiative value for a Combatant
     * @param {jQuery} li
     * @private
     */
    _onConfigureCombatant(li) {
        CombatTracker.prototype._onConfigureCombatant.call(this, li);
    }
}
