# Character Color in start.gg

start.gg doesn't officially support character colors currently so if `Report character color` is enabled we encode the color in the 'stocks remaining' field as follows:

```
(<costume index> + 1) * 100 + <actual stocks remaining>
```

IE. `204` -> `costume index`: 1, `actual stocks remaining`: 4
