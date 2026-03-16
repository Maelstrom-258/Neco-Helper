const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getQuery, runQuery } = require('../../db/database');

module.exports = {
    async execute(interaction, args) {
        const ignoreUserCanClose = args[0] === 'true';
        const ticketId = args[1];

        if (ignoreUserCanClose && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Apenas administradores podem aprovar o fechamento deste ticket.', ephemeral: true });
        }

        const ticket = await getQuery(`SELECT * FROM tickets WHERE id = ?`, [ticketId]);

        if (!ticket) {
            return interaction.reply({ content: 'Este ticket não foi encontrado no nosso banco de dados, burunyuu.', ephemeral: true });
        }

        const panel = await getQuery(`SELECT * FROM ticket_panels WHERE id = ?`, [ticket.panel_id]);

        await interaction.update({ content: 'Fechamento aprovado.', embeds: [], components: [] });

        const closeEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket Fechando')
            .setDescription('Um administrador aprovou o fechamento. O canal será apagado em 1 minuto.\n\nVocê ainda pode pedir para transcrever as mensagens se desejar! (/ticket transcrever)\n\nObrigado pela cooperação, nya!')
            .setColor(0xFFD700);

        await interaction.followUp({ embeds: [closeEmbed] });

        if (panel && panel.feedback_enabled) {
            try {
                const userObj = await interaction.client.users.fetch(ticket.creator_id);
                const fbEmbed = new EmbedBuilder()
                    .setTitle('Opinião de Atendimento')
                    .setDescription(`O seu ticket **#${ticket.id}** foi fechado. Seu problema foi resolvido, nya?`)
                    .setColor(0xFFD700);

                const fRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`feedbackYes_${ticket.id}`).setLabel('Sim').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`feedbackNo_${ticket.id}`).setLabel('Não').setStyle(ButtonStyle.Danger)
                );
                await userObj.send({ embeds: [fbEmbed], components: [fRow] }).catch(() => { });
            } catch (e) { }
        } else {
            await runQuery(`UPDATE tickets SET status = 'closed_solved', closed_at = ? WHERE id = ?`, [Math.floor(Date.now() / 1000), ticket.id]);
        }

        setTimeout(async () => {
            
            try {
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                await runQuery(`UPDATE tickets SET messages_count = ? WHERE id = ?`, [messages.size, ticket.id]);
            } catch (e) { }

            try {
                const channel = interaction.guild.channels.cache.get(ticket.channel_id);
                if (channel) await channel.delete();
            } catch (error) {
                console.error('Falha ao apagar o ticket: ', error);
            }
        }, 60000);
    }
};
