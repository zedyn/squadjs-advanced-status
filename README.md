
# SquadJS Server Status Plugin

Advanced Discord server status plugin for SquadJS.



## Commands

- `!status` - shows the current server status
- `!status subscribe` - subscribes to automatic server status updates
- `!status unsubscribe` - unsubscribes from automatic updates


  
## Note

**Update `discord.js` in SquadJS:**
```bash
npm install discord.js
```

**Add Emojis to Your Discord Server:**
- Download the icons from the **/icons** folder.
- Upload them to your Discord server via Server Settings > Emojis.

**Configure the Plugin:**
- Send any uploaded emoji to a channel, prefixing it with a backslash (\\) (e.g., **\\:my_emoji:**).
- Copy the output (e.g., **<:my_emoji:1234567890>**) and paste it into the relevant field in the configuration.

You need to obtain a Steam API key—the process is quite simple. With a quick search, you can get your Steam API key from the website below. Do not share your key with anyone.

https://steamcommunity.com/dev?l=english

  
## Example Configration

```json
{
    "plugin": "DiscordAdvancedStatus",
    "enabled": true,
    "discordClient": "discord",
    "messageStore": "sqlite",
    "command": "!status",
    "disableSubscriptions": false,
    "updateInterval": 10000,
    "setBotStatus": true,
    "apiKey": "your_steam_api_key",
    "icons": {
        "status": "emoji",
        "players": "emoji",
        "map": "emoji",
        "time": "emoji",
        "admins": "emoji"
    }
}
```

  
## Demo

![#1](https://resmim.net/cdn/2025/07/02/TPhqQk.png)

  
## Original Plugin Reference

Based on: [discord-server-status](https://github.com/Team-Silver-Sphere/SquadJS/blob/master/squad-server/plugins/discord-server-status.js)


  
## Support
For support, DM me on [Discord](https://discord.com/users/1096540990162088058) or create a ticket in [discord.gg/luppux](https://discord.gg/luppux)
