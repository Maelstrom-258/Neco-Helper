const { getQuery, runQuery } = require('../../db/database');

module.exports = {
    async execute(interaction, args) {
        
        const type = args[0];
        const panelId = args[1];

        const panel = await getQuery(`SELECT * FROM ticket_panels WHERE id = ?`, [panelId]);
        if (!panel) return interaction.reply({ content: 'Painel não encontrado.', ephemeral: true });

        const value = interaction.fields.getTextInputValue('value');

        try {
            if (type === 'nameFormat') {
                await runQuery(`UPDATE ticket_panels SET channel_name_format = ? WHERE id = ?`, [value, panel.id]);
            } else if (type === 'initMsg') {
                await runQuery(`UPDATE ticket_panels SET initial_message = ? WHERE id = ?`, [value, panel.id]);
            } else if (type === 'cooldown') {
                let cooldown = parseInt(value);
                if (isNaN(cooldown)) cooldown = 60;
                await runQuery(`UPDATE ticket_panels SET cooldown = ? WHERE id = ?`, [cooldown, panel.id]);
            } else if (type === 'category') {
                const checkedValue = value.trim() === '' ? null : value.trim();
                await runQuery(`UPDATE ticket_panels SET category_id = ? WHERE id = ?`, [checkedValue, panel.id]);
            } else if (type === 'roles') {
                let rolesJson = '[]';
                if (value) {
                    const rs = value.split(',').map(r => r.trim()).filter(r => r.length > 5);
                    rolesJson = JSON.stringify(rs);
                }
                await runQuery(`UPDATE ticket_panels SET permissions = ? WHERE id = ?`, [rolesJson, panel.id]);
            }

            const editMenuHandler = require('../selectMenus/editPanel.js');
            await editMenuHandler.execute(interaction, [panelId]);
        } catch (e) {
            console.error(e);
            await interaction.reply({ content: 'Erro ao salvar configuração.', ephemeral: true });
        }
    }
};
