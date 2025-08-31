import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ButtonBuilder,
  ButtonStyle,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ThumbnailBuilder,
  EmbedBuilder,
} from 'discord.js';

import DiscordBaseMessageUpdater from './discord-base-message-updater.js';
import { anyIDsToPlayers } from '../utils/any-id.js';

export default class DiscordAdvancedStatus extends DiscordBaseMessageUpdater {
  static get description() {
    return 'The <code>DiscordAdvancedStatus</code> plugin can be used to get the server status in Discord.';
  }

  static get defaultEnabled() {
    return true;
  }

  static get optionsSpecification() {
    return {
      ...DiscordBaseMessageUpdater.optionsSpecification,
      command: {
        required: false,
        description: 'Command name to get message.',
        default: '!status',
      },
      updateInterval: {
        required: false,
        description: 'How frequently to update the time in Discord.',
        default: 60 * 1000,
      },
      setBotStatus: {
        required: false,
        description: "Whether to update the bot's status with server information.",
        default: true,
      },
      apiKey: {
        required: true,
        description: 'Steam API key.',
        default: '',
      },
      icons: {
        required: false,
        description: 'Icons to display in the status container.',
        default: {},
      },
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);

    this.updateMessages = this.updateMessages.bind(this);
    this.updateStatus = this.updateStatus.bind(this);
    this.checkAdmins = this.checkAdmins.bind(this);

    this.onlineAdmins = [];
  }

  async mount() {
    await super.mount();

    this.updateInterval = setInterval(this.updateMessages, this.options.updateInterval);
    this.updateStatusInterval = setInterval(this.updateStatus, this.options.updateInterval);
    this.checkAdmins = setInterval(this.checkAdmins, this.options.updateInterval);

    this.options.discordClient.on('interactionCreate', async (interaction) => {
      if (interaction.customId.startsWith('view:')) {
        await interaction.deferReply({ flags: 'Ephemeral' });

        const type = interaction.customId.split(':')[1];

        if (type == 'admins') {
          const response = await fetch(
            `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${this.options.apiKey}&steamids=${this.onlineAdmins
              .map((admin) => admin.steamID)
              .join(',')}`
          );
          const json = await response.json();

          const admins = json.response.players;

          const embed = new EmbedBuilder()
            .setColor('Blurple')
            .setTitle(`Online Admins: ${this.onlineAdmins.length} (${Object.keys(this.server.adminsInAdminCam).length} in cam)`)
            .setDescription(
              this.onlineAdmins.length > 0 && admins?.length > 0
                ? admins
                    .map((admin) => {
                      const player = this.onlineAdmins.find((player) => player.steamID == admin.steamid);
                      const inCam = Object.keys(this.server.adminsInAdminCam).includes(admin.steamid);

                      return `[\` ${admin.personaname.replaceAll('`', '').trim()} \`](https://steamcommunity.com/profiles/${
                        admin.steamid
                      }) — in ${inCam ? 'cam' : `team **${player.teamID}**${player.squadID ? `, squad **${player.squadID}**` : ''}`}`;
                    })
                    .join('\n')
                : 'There are no active admins in the game.'
            );

          interaction.editReply({
            embeds: [embed],
          });
        } else {
          const data = JSON.parse(await this.server.rcon.execute(`ShowServerInfo`));

          const teamOne = data.TeamOne_s?.replace(new RegExp(data.MapName_s, 'i'), '') || '';
          const teamTwo = data.TeamTwo_s?.replace(new RegExp(data.MapName_s, 'i'), '') || '';

          const teams = {
            1: {
              country: teamOne.split('_')[0],
              mode: teamOne
                .split('_')[2]
                .replace(/([A-Z])/g, ' $1')
                .trim(),
            },
            2: {
              country: teamTwo.split('_')[0],
              mode: teamTwo
                .split('_')[2]
                .replace(/([A-Z])/g, ' $1')
                .trim(),
            },
          };

          const teamId = parseInt(type);

          const players = this.server.players.filter((player) => player.teamID === teamId);
          const squads = this.server.squads.filter((squad) => squad.teamID === teamId);
          const unSquaddedPlayers = players.filter((player) => !player.squadID);

          const embed = new EmbedBuilder()
            .setColor(type == 1 ? 'DarkGreen' : 'Red')
            .setTitle(`${teams[type].country} (${teams[type].mode})`)
            .setDescription(
              `-# ${players.length} players, ${squads.length} squads` +
                (unSquaddedPlayers.length > 0
                  ? '\n\n' +
                    unSquaddedPlayers
                      .map(
                        (player) =>
                          `[\` ${player.name.replace(/`/g, '').trim()} \`](https://steamcommunity.com/profiles/${player.steamID}) — ${
                            player.role
                          }`
                      )
                      .join('\n')
                  : '')
            );

          if (squads.length > 0) {
            let i = 0;

            for (const squad of squads) {
              embed.addFields({
                name: `${squad.squadID} - ${squad.squadName}`,
                value:
                  `-# Status: ${squad.size}/9 ${squad.locked == 'True' ? '🔒' : '🔓'}` +
                  '\n' +
                  `${players
                    .filter((player) => player.squadID == squad.squadID)
                    .map(
                      (player) =>
                        `[\` ${player.name.replace(/`/g, '').trim()} \`](https://steamcommunity.com/profiles/${player.steamID}) — ${
                          player.role
                        }`
                    )
                    .join('\n')}`,
                inline: true,
              });

              i++;

              if (i % 2 === 1) {
                embed.addFields({
                  name: '\u200b',
                  value: '\u200b',
                  inline: true,
                });
              }
            }
          }

          interaction.editReply({
            embeds: [embed],
          });
        }
      }
    });
  }

  async unmount() {
    await super.unmount();

    clearInterval(this.updateInterval);
    clearInterval(this.updateStatusInterval);
  }

  async generateMessage() {
    let players = '';

    players += `${this.server.a2sPlayerCount}`;
    if (this.server.publicQueue + this.server.reserveQueue > 0) players += ` (+${this.server.publicQueue + this.server.reserveQueue})`;

    players += ` / ${this.server.publicSlots}`;
    if (this.server.reserveSlots > 0) players += ` (+${this.server.reserveSlots})`;

    let queueText = ' 0';

    if (this.server.publicQueue + this.server.reserveQueue > 0) {
      queueText = '';

      if (this.server.publicQueue > 0) queueText += ` ${this.server.publicQueue} Public`;
      if (this.server.reserveQueue > 0) queueText += ` ${this.server.reserveQueue} Whitelist`;
    }

    const currentLayer = this.server.currentLayer;
    const nextLayer = await this.server.nextLayer;

    const matchStartTimestamp = Math.floor(new Date(this.server.matchStartTime).getTime() / 1000);

    const data = JSON.parse(await this.server.rcon.execute(`ShowServerInfo`));

    const teamOne = data.TeamOne_s?.replace(new RegExp(data.MapName_s, 'i'), '') || '';
    const teamTwo = data.TeamTwo_s?.replace(new RegExp(data.MapName_s, 'i'), '') || '';

    const teams = {
      a: {
        country: teamOne.split('_')[0],
        mode: teamOne
          .split('_')[2]
          .replace(/([A-Z])/g, ' $1')
          .trim(),
      },
      b: {
        country: teamTwo.split('_')[0],
        mode: teamTwo
          .split('_')[2]
          .replace(/([A-Z])/g, ' $1')
          .trim(),
      },
    };

    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder({ content: `## ${this.server.serverName} Status` }))
      .addSeparatorComponents(new SeparatorBuilder({ divider: true, spacing: SeparatorSpacingSize.Large }))
      .addSectionComponents(
        new SectionBuilder({
          components: [
            new TextDisplayBuilder({
              content:
                `**${this.options.icons?.status ?? ''} Status:** Online 🟢` +
                '\n\n' +
                `**${this.options.icons?.players ?? ''} Players:** ${players} — Queue:${queueText}`,
            }),
            new TextDisplayBuilder({
              content: [
                `**${this.options.icons?.map ?? ''} Map:** ${
                  currentLayer
                    ? `[${currentLayer.name}](https://squadmaps.com/map?name=${encodeURIComponent(
                        currentLayer.map.name
                      )}&layer=${encodeURIComponent(currentLayer.gamemode)}%20${encodeURIComponent(currentLayer.version)})`
                    : 'Unknown'
                }*`,
                nextLayer
                  ? `— **Next:** [${nextLayer.name}](https://squadmaps.com/map?name=${encodeURIComponent(
                      nextLayer.map.name
                    )}&layer=${encodeURIComponent(nextLayer.gamemode)}%20${encodeURIComponent(nextLayer.version)})`
                  : '',
              ].join(' '),
            }),
            new TextDisplayBuilder({
              content: `**${
                this.options.icons?.time ?? ''
              } Time:** Match start at <t:${matchStartTimestamp}:t> (<t:${matchStartTimestamp}:R>)`,
            }),
          ],
          accessory: new ThumbnailBuilder({
            media: {
              url: `https://raw.githubusercontent.com/Squad-Wiki/squad-wiki-pipeline-map-data/master/completed_output/_Current%20Version/images/${currentLayer.layerid}.jpg`,
            },
          }),
        })
      )
      .addSeparatorComponents(new SeparatorBuilder({ divider: true, spacing: SeparatorSpacingSize.Large }))
      .addSectionComponents(
        new SectionBuilder({
          components: [
            new TextDisplayBuilder({
              content: `**${this.options.icons?.admins ?? ''} Online Admins:** ${this.onlineAdmins.length} (${
                Object.keys(this.server.adminsInAdminCam).length
              } in cam)`,
            }),
          ],
          accessory: new ButtonBuilder().setCustomId('view:admins').setStyle(ButtonStyle.Primary).setLabel('Admins'),
        })
      )

      .addSeparatorComponents(new SeparatorBuilder({ divider: true, spacing: SeparatorSpacingSize.Large }))
      .addSectionComponents(
        new SectionBuilder({
          components: [
            new TextDisplayBuilder({
              content:
                `### ${teams.a.country} (${teams.a.mode})` +
                '\n' +
                `-# ${this.server.players.filter((player) => player.teamID == 1).length} players, ${
                  this.server.squads.filter((squad) => squad.teamID == 1).length
                } squads`,
            }),
          ],
          accessory: new ButtonBuilder().setCustomId('view:1').setStyle(ButtonStyle.Success).setLabel('Squads & Players'),
        })
      )
      .addSeparatorComponents(new SeparatorBuilder({ divider: false, spacing: SeparatorSpacingSize.Large }))
      .addSectionComponents(
        new SectionBuilder({
          components: [
            new TextDisplayBuilder({
              content:
                `### ${teams.b.country} (${teams.b.mode})` +
                '\n' +
                `-# ${this.server.players.filter((player) => player.teamID == 2).length} players, ${
                  this.server.squads.filter((squad) => squad.teamID == 2).length
                } squads`,
            }),
          ],
          accessory: new ButtonBuilder().setCustomId('view:2').setStyle(ButtonStyle.Danger).setLabel('Squads & Players'),
        })
      );

    return {
      flags: MessageFlags.IsComponentsV2,
      components: [container],
    };
  }

  async updateStatus() {
    if (!this.options.setBotStatus) return;

    await this.options.discordClient.user.setActivity(
      `(${this.server.a2sPlayerCount}/${this.server.publicSlots}) ${this.server.currentLayer?.name || 'Unknown'}`,
      { type: 4 }
    );
  }

  async checkAdmins() {
    const admins = this.getAdminsWithPermission();

    this.onlineAdmins = this.server.players.filter((player) => admins.some((adminId) => player.steamID == adminId));
  }

  getAdminsWithPermission() {
    const steamRgx = /^\d{17}$/;
    const ret = [];

    for (const [anyID, perms] of Object.entries(this.server.admins)) {
      if ('canseeadminchat' in perms) ret.push(anyID);
    }

    const matches = [];
    const fails = [];

    ret.forEach((ID) => (steamRgx.test(ID) ? matches : fails.push(ID)));

    if (fails.length) {
      const remappedIDs = anyIDsToPlayers(fails, this.server.players).map((player) => player.steamID);
      return [...new Set(matches.concat(remappedIDs))];
    }

    return matches;
  }
}
