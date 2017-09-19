# DiscordConnector 

#### Version 0.7.2

___

## Description:

**DiscordConnector** allows bots written using **[Microsoft's Bot Framework][botframework]** to be used in the popular VoIP client, **[Discord][discordapp]**. DiscordConnector uses the Bot Framework's **[Direct Line API][directline]** to connect a Bot Framework Bot to Discord. This connector implements **[Discord.js][discord.js]** to map Direct Line's Activity objects to Discord-consumable events.

The **ConnectorStorage** provides multiple conversation support. A succinct description is that the DiscordConnector uses an external storage to store Direct Line Conversationi ID and Discord Channel ID pairings; this allows your users to continue conversations with their bot.

The **DiscordHelperModule** focuses on providing Discord-specific functionalities and commands, e.g. having a bot join or leave a channel, getting a list of users from the Discord.js client, etc.  

___

## Setup:
```
npm install
```

### ffmpeg
- [Guide on installing ffmpeg][adaptlearning/ffmpeg]
- [WikiHow on installing ffmpeg][wikihow/ffmpeg]


# DiscordConnector



### Details:
- This version of the DiscordConnector was built with [Discord.js v11.1.0][Discordv11.1.0] (Discord.js [.zip][Discordv11.1.0Download] and [.tar.gz][Discordv11.1.0Download.tar.gz]) 
- Users should __only__ format their bot's messages in markdown as this is [Discord's supported markup language][discordmarkup].
- __NOTE:__ Discord does not support buttons or similiar forms of data input in their RichEmbeds. If a button type is one of those found here under [cardActionTypes][cardActionTypes], then the value of the message (if an URL) will be added to the card.
- Discord currently supports [one attachment per message][oneAttachmentLimit].

## Special Thanks:
- Thank you to [**hydrabolt**][hydrabolt] for the [Discord.js][discord.jsGitHub] library.

### Other Information:
- You can provide feedback to Discord via their [forums][discordfeedback]!
- File Bot Builder bugs and issues at their [repository][botframeworkissues].
- File Discord.js issues at _their_ [repository][discord.jsissues].



  [botframework]: https://github.com/Microsoft/BotBuilder  
  [botframeworkissues]: https://github.com/Microsoft/BotBuilder/issues
  [discordapp]: https://discordapp.com
  [directline]: https://docs.microsoft.com/en-us/bot-framework/rest-api/bot-framework-rest-direct-line-3-0-concepts
  [discord.js]: https://discord.js.org
  [hydrabolt]: https://github.com/hydrabolt
  [discord.jsGitHub]: https://github.com/hydrabolt/discord.js/
  [discord.jsissues]: https://github.com/hydrabolt/discord.js/issues
  [Discordv11.1.0]: https://github.com/hydrabolt/discord.js/releases/tag/11.1.0
  [Discordv11.1.0Download]: https://github.com/hydrabolt/discord.js/archive/11.1.0.zip
  [Discordv11.1.0Download.tar.gz]: https://github.com/hydrabolt/discord.js/archive/11.1.0.tar.gz
  [discordmarkup]: https://support.discordapp.com/hc/en-us/articles/210298617-Markdown-Text-101-Chat-Formatting-Bold-Italic-Underline-
  [discordfeedback]: https://feedback.discordapp.com/forums/326712-discord-dream-land
  [adaptlearning/ffmpeg]: https://github.com/adaptlearning/adapt_authoring/wiki/Installing-FFmpeg
  [wikihow/ffmpeg]: http://www.wikihow.com/Install-FFmpeg-on-Windows
  [cardActionTypes]: ./Consts.js
  [oneAttachmentLimit]: https://feedback.discordapp.com/forums/326712-discord-dream-land/suggestions/17614645-attach-multiple-photos-to-messages-and-choose-if-t