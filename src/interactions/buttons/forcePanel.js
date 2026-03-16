const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { runQuery } = require('../../db/database');

module.exports = {
    async execute(interaction, args) {
        
        const name = args.slice(0, -1).join('_');
        const channelId = args[args.length - 1];

        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) return interaction.reply({ content: 'O canal original onde o painel seria criado não existe mais.', ephemeral: true });

        const embedData = { 
            title: `Ticket: ${name}`, 
            description: 'Clique no botão abaixo para abrir um ticket!', 
            color: 0xFFD700 
        };

        const embed = new EmbedBuilder(embedData);

        try {
            const res = await runQuery(`INSERT INTO ticket_panels (guild_id, channel_id, name) VALUES (?, ?, ?)`, [interaction.guild.id, channel.id, name]);
            const panelId = res.lastID;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`createTicket_${panelId}`).setLabel('Criar Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫')
            );

            const msg = await channel.send({ embeds: [embed], components: [row] });
            await runQuery(`UPDATE ticket_panels SET message_id = ? WHERE id = ?`, [msg.id, panelId]);

            await interaction.update({ content: `✅ Painel criado com sucesso usando o visual padrão em <#${channel.id}>!`, embeds: [], components: [] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Ocorreu mais um erro ao tentar enviar ou gravar no banco de dados.', ephemeral: true });
        }
    }
};
