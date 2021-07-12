![All Downloads](https://img.shields.io/github/downloads/jessev14/floating-combat-toolbox/total?style=for-the-badge)

[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Ffloating-combat-toolbox&colorB=4aa94a)](https://forge-vtt.com/bazaar#package=floating-combat-toolbox)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/jessev14)


# Floating Combat Toolbox

Commissioned by SoundSherpa.

Floating Combat Toolbox gives users an accessible way to create and manage "floating" combats.

Floating combats can be viewed from any scene and can contain combatatants from different scenes. This makes large-scale, multi-scene encounters much more feasible.

<img src="/img/demo.gif" width=1000>

# Usage

Floating combats can be created using the new dialog window that appears when clicking the + icon on the combat tracker.

For GM users, the encounter header for floating combats will be displayed in yellow.

Combatants can be added to floating combats in the same way as normal combats.

Hovering over combatants in the combat tracker will display their scene. A module setting can also be enabled to display the scene next to the combatant's name.

Additional module settings can be enabled to:

### Switch Scene on Turn Change
This setting can be set to only change the scene for GM users or for all users.

### Switch Scene on Combatant Click
This feature only works for the GM user that clicks on the combatant.
However, GM users can use a new context menu option to pull **all** users to the selected combatant's scene.

### Make Combats Floating by Default
This will skip the new encounter dialog window, automatically making new combats floating. This also applies when creating a combat by toggling combat on a token.


# Incompatibilities
The following modules are currently not compatible with floating combats, though even with this module enabled, normal combats can be used and should function as expected.

* Multilevel Tokens
* Next Up (partial)
* Combat Ready


# Tehcnical Notes
Floating combats are a not a novel feature. They can be created without this module by creating a combat with `scene: null` or updating an existing combat's scene to be `null`.
This module implements a user-friendly interface for creating and managing floating combats. It also implements additional combat/combatant/token handling to offer a smoother combat flow while using a floating combat.


# Future Implementations
* Multilevel Tokens comaptibility - Top Priority
* Combat Ready compatibility.
* Option to create a floating combat from other, pre-existing combats.
