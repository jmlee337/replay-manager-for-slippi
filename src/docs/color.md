# Character Color in start.gg

start.gg doesn't officially support character colors currently so if `Report character color` is enabled we encode the color in the 'stocks remaining' field as follows:

```
(<costume index> + 1) * 100 + <actual stocks remaining>
```

IE. `204`: 
```
costume index = floor(204 / 100) - 1 = 1  
actual stocks remaining = 204 % 100 = 4
```

[SmashWiki](https://www.ssbwiki.com/Alternate_costume_(SSBM)) has a listing of colors by character that appears to be in the right order and [this repository](https://github.com/jmlee337/replay-manager-for-slippi/tree/main/src/renderer/characters) contains stock icons sorted first by external character id, then costume index.

When reading this data programmatically please be aware the costume index can be out of bounds if a player used the [stock icon glitch](https://www.ssbwiki.com/Stock_glitch).
