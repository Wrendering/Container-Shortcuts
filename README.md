# Container Shortcuts

Container Shortcuts is a Firefox WebExtension designed to allow users flexible, useful choices about opening new tabs and homepages:
- Set or remove customizable keyboard shortcuts for opening tabs;
- Open tabs in a specified Firefox Container tab;
- Set an HTML document as the target page of a given shortcut

Optimize your workflow with new-tab commands that do exactly what you want.

## Limitations
Unfortunately, due to the nature of the Firefox API, there are some limitations:
- Firefox does not allow default commands to be overridden, and is inconsistent about the results when you do. Some commands aren't easily intercepted at all; others will silently fail; still others function, more or less. Notably, Ctrl-T (or Cmd-T on Mac) cannot be remapped.
- The addon does not currently warn about remapping or redefining either commands that are already defined or are system commands.
- HTML homepages need to be copy-pasted into the addon; upload buttons are broken within addon browser actions.

## Installation:
To come soon in the future. (The addon is still being developed, and has not yet been released onto the Addon store.) Check back soon!
