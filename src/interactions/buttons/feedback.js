const { getQuery, runQuery } = require('../../db/database');

module.exports = {
    async execute(interaction, action) {
        const [, ticketIdStr] = interaction.customId.split('_');
        const ticketId = parseInt(ticketIdStr);

        const ticket = await getQuery(`SELECT * FROM tickets WHERE id = ?`, [ticketId]);

        if (!ticket) {
            return interaction.reply({ content: 'Ticket não encontrado no banco de dados.', ephemeral: true });
        }

        const isYes = action === 'feedbackYes';
        const newStatus = isYes ? 'closed_solved' : 'closed_unsolved';

        await runQuery(`UPDATE tickets SET status = ? WHERE id = ?`, [newStatus, ticketId]);

        await interaction.update({ 
            content: `Obrigado pelo seu feedback! Registramos que o problema foi **${isYes ? 'resolvido' : 'não resolvido'}**.`,
            embeds: [],
            components: []
        });
    }
};
