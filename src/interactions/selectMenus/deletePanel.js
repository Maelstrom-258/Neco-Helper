const { getQuery, runQuery } = require('../../db/database');

module.exports = {
    async execute(interaction, args) {
        const panelId = interaction.values[0];

        const panel = await getQuery(`SELECT * FROM ticket_panels WHERE id = ?`, [panelId]);

        if (!panel) {
            return interaction.reply({ content: 'Este painel já foi apagado ou não existe mais.', ephemeral: true });
        }

        try {
            
            try {
                const channel = interaction.guild.channels.cache.get(panel.channel_id);
                if (channel) {
                    const msg = await channel.messages.fetch(panel.message_id);
                    if (msg) await msg.delete();
                }
            } catch(e) {
                console.log('Mensagem do painel não encontrada para apagar, ignorando...');
            }

            await runQuery(`DELETE FROM ticket_panels WHERE id = ?`, [panel.id]);
            await runQuery(`DELETE FROM tickets WHERE panel_id = ?`, [panel.id]); 

            await interaction.update({ content: `O painel **${panel.name}** foi apagado com sucesso!`, embeds: [], components: [] });
        } catch(error) {
            console.error(error);
            await interaction.reply({ content: 'Ocorreu um erro ao tentar apagar o painel.', ephemeral: true });
        }
    }
};
