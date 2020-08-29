
// IIFE for namespace purposes
var shortcuts = (function() {

    // Valid keys for shortcuts
    // Note: check how/if media buttons actually work
    const functionKeys = new Set([
    	"F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12",
    ]);
    const validKeys = new Set([
    	"Home","End","PageUp","PageDown","Insert","Delete",
    	"0","1","2","3","4","5","6","7","8","9",
    	...Array.from(functionKeys),
    	"MediaNextTrack","MediaPlayPause","MediaPrevTrack","MediaStop",
    	"A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
    	"Up","Down","Left","Right","Comma","Period","Space",
    ]);

    // Processing a key event through to eg "Ctrl+Shift+Y", the saveable output
    // Note that this model assumes the key is the last one pressed

    var trimPrefix = (string) => { return string.replace(/^(?:Digit|Numpad|Arrow)/, ""); };

    const remapKeys = {
    	",": "Comma",
    	".": "Period",
    	" ": "Space",
    };
    var remapKey = (keyString) => {
    	return remapKeys.hasOwnProperty(keyString) ? remapKeys[keyString] : keyString;
    };

    const keyOptions = [
    	e => String.fromCharCode(e.which), // A letter?
    	e => e.code.toUpperCase(), // A letter.
    	e => trimPrefix(e.code), // Digit3, ArrowUp, Numpad9.
    	e => trimPrefix(e.key), // Digit3, ArrowUp, Numpad9.
    	e => remapKey(e.key), // Comma, Period, Space.
    ];
    function getStringForEvent(e) {
        if(e.type == "keyup") return ""; //hack so letters don't linger after press
    	for (let option of keyOptions) {
    		let value = option(e);
    		if(validKeys.has(value)) return value;
    	}
    	return "";
    };

    function getModifiersForEvent(e) {
    	let modifierMap;
    	let platform = "macosx";
    	// TODO: for an inexplicable reason, only the background script can request platform
    	if (platform == "macosx") {
    		modifierMap = { MacCtrl: e.ctrlKey, Alt: e.altKey, Command: e.metaKey, Shift: e.shiftKey };
    	} else {
    		modifierMap = { Ctrl: e.ctrlKey, Alt: e.altKey, Shift: e.shiftKey };
    	}

    	return Object.entries(modifierMap)
    		.filter(([key, isDown]) => isDown)
    		.map(([key]) => key)
    };

    function getShortcutForEvent(e) {
    	let modifiers = getModifiersForEvent(e);
    	let keyString = getStringForEvent(e);
    	if(keyString != "") modifiers = modifiers.concat(keyString);
    	return modifiers.join("+");
    };

    var topboxClearError = function() {
    	if( errorbox.classList.contains("shown")) errorbox.classList.remove("shown");
    };

    var topboxSetError = function(str) {
    	if( ! errorbox.classList.contains("shown")) {
    		errorbox.classList.add("shown");
    		updateErrorPos();
    	}
    	errorbox.innerText = str;
    };

    // Actually attaching the function to the
    var onShortcutChange = function(e) {
    	let boxx = e.target;

    	/* Check for combinations that should close the window */
    	if (e.key == "Escape") {
    		e.preventDefault();
    		boxx.blur();
    		return;
        }
        if (e.key == "Tab") return;

        if (!e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
    		if (e.key == "Delete" || e.key == "Backspace") {
    			// "Avoid triggering back-navigation."
    			e.preventDefault();
    			// TODO Add an 'enabled' flag to each command or way to delete them, etc
    			return;
    		}
        }
        e.preventDefault();
        e.stopPropagation();

    	/* Update pane */
        let shortcutString = getShortcutForEvent(e);

        boxx.value = shortcutString;
    	if (e.type == "keyup" || !shortcutString.length) return;

    	/* Check for validity and add errors */
    	// Check: 1) it's only valid keys; 2) it's of the proper format, aka a) has a modifier, b) has a key, c) only has up to two modifiers of the proper types

    	let modifiers = getModifiersForEvent(e)
        if(modifiers.length > 2) {
    		// on older/other browsers, check for less compatible combinations
    		topboxSetError("Invalid Combination");
    	} else if(getStringForEvent(e) == "") {
    		topboxSetError("Type a letter");
    	} else if(modifiers.length == 0 || (modifiers.length == 1 && modifiers.includes("Shift") ) ) {
    		topboxSetError("Include Ctrl, Alt or Command");	// TODO check platform
    	} else {
    		/* Save if complete valid expression */

    		former_value = shortcutString;
            boxx.saveShortcut(shortcutString);  // CUSTOM event that must be created on the object
    		boxx.blur();
    	}
    };

    //----------------------------------------------------------------------------------------------------------------------------

    var my_enableEvent = new Event("save");

    let errorbox = document.getElementById("key_popup");

    let former_value = "";

    var updateErrorPos;
    let _updateErrorPos = (input) => {
    	let inputBB = input.getBoundingClientRect();
    	errorbox.style.left = `${ inputBB.left + inputBB.width / 2 }px`;
    	errorbox.style.top = `${ inputBB.bottom }px` ;
    };

    var onShortcutFocus = (e) => {
        let boxx = e.target;
    	former_value = boxx.value;
    	boxx.value = "";
    	updateErrorPos = () => { _updateErrorPos(boxx); };
    };

    var onShortcutBlur = (e) => {
    	e.target.value = former_value;
    	topboxClearError();
    };


    // IIFE ending; the following are the globally-exported vars
    return {
        "onShortcutChange": onShortcutChange,
        "onShortcutFocus": onShortcutFocus,
        "onShortcutBlur": onShortcutBlur,
    };
})();
