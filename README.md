# DiscordConnector 

#### Version 0.7.1

___

## Description:

**DiscordConnector** allows bots written using **[Microsoft's Bot Framework][botframework]** to be used in the popular VoIP client, **[Discord][discordapp]**. **DC** uses the Bot Framework's **[Direct Line API][directline]** to connect a Bot Framework Bot to Discord. This connector implements **[Discord.js][discord.js]** to map Direct Line's Activity objects to Discord-consumable events.



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
- __NOTE:__ Discord does not support buttons or similiar forms of data input in their RichEmbeds.


### Other Information:
- You can provide feedback to Discord via their [forums][discordfeedback]!
- File Bot Builder bugs and issues at their [repository][botframeworkissues].
- File Discord.js issues at _their_ [repository][discord.jsissues].



  [botframework]: https://github.com/Microsoft/BotBuilder  
  [botframeworkissues]: https://github.com/Microsoft/BotBuilder/issues
  [discordapp]: https://discordapp.com
  [directline]: https://docs.microsoft.com/en-us/bot-framework/rest-api/bot-framework-rest-direct-line-3-0-concepts
  [discord.js]: https://discord.js.org
  [discord.jsissues]: https://github.com/hydrabolt/discord.js/issues
  [Discordv11.1.0]: https://github.com/hydrabolt/discord.js/releases/tag/11.1.0
  [Discordv11.1.0Download]: https://github.com/hydrabolt/discord.js/archive/11.1.0.zip
  [Discordv11.1.0Download.tar.gz]: https://github.com/hydrabolt/discord.js/archive/11.1.0.tar.gz
  [discordmarkup]: https://support.discordapp.com/hc/en-us/articles/210298617-Markdown-Text-101-Chat-Formatting-Bold-Italic-Underline-
  [discordfeedback]: https://feedback.discordapp.com/forums/326712-discord-dream-land
  [adaptlearning/ffmpeg]: https://github.com/adaptlearning/adapt_authoring/wiki/Installing-FFmpeg
  [wikihow/ffmpeg]: http://www.wikihow.com/Install-FFmpeg-on-Windows