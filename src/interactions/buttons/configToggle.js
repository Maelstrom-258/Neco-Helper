const { getQuery, runQuery } = require('../../db/database');

module.exports = {
    async execute(interaction, args) {
        
        const action = args[0];
        const panelId = args[1];

        const panel = await getQuery(`SELECT * FROM ticket_panels WHERE id = ?`, [panelId]);
        if (!panel) return interaction.reply({ content: 'Painel não encontrado.', ephemeral: true });

        try {
            if (action === 'hide') {
                const newValue = panel.hide_from_users ? 0 : 1;
                await runQuery(`UPDATE ticket_panels SET hide_from_users = ? WHERE id = ?`, [newValue, panel.id]);
            } else if (action === 'feedback') {
                const newValue = panel.feedback_enabled ? 0 : 1;
                await runQuery(`UPDATE ticket_panels SET feedback_enabled = ? WHERE id = ?`, [newValue, panel.id]);
            } else if (action === 'userclose') {
                const newValue = panel.user_can_close ? 0 : 1;
                await runQuery(`UPDATE ticket_panels SET user_can_close = ? WHERE id = ?`, [newValue, panel.id]);
            } else if (action === 'rmEmbed') {
                await runQuery(`UPDATE ticket_panels SET initial_embed = NULL WHERE id = ?`, [panel.id]);
            }

            const editMenuHandler = require('../selectMenus/editPanel.js');
            await editMenuHandler.execute(interaction, [panelId]);
        } catch (e) {
            console.error(e);
            await interaction.reply({ content: 'Erro ao atualizar configuração.', ephemeral: true });
        }
    }
};
