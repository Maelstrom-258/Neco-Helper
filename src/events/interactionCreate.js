module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Ocorreu um erro ao executar este comando!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'Ocorreu um erro ao executar este comando!', ephemeral: true });
                }
            }
        } else if (interaction.isButton()) {
            const [action, ...args] = interaction.customId.split('_');

            if (action === 'createTicket') {
                const handler = require('../interactions/buttons/createTicket.js');
                await handler.execute(interaction, args);
            } else if (action === 'closeTicket') {
                const handler = require('../interactions/buttons/closeTicket.js');
                await handler.execute(interaction, args);
            } else if (action === 'feedbackYes' || action === 'feedbackNo') {
                const handler = require('../interactions/buttons/feedback.js');
                await handler.execute(interaction, action);
            } else if (action === 'deletePanel') {
                const handler = require('../interactions/buttons/deletePanel.js');
                await handler.execute(interaction, args);
            } else if (action === 'forcePanel') {
                const handler = require('../interactions/buttons/forcePanel.js');
                await handler.execute(interaction, args);
            } else if (action === 'configToggle') {
                const handler = require('../interactions/buttons/configToggle.js');
                await handler.execute(interaction, args);
            } else if (action === 'configBtn') {
                const handler = require('../interactions/buttons/configBtn.js');
                await handler.execute(interaction, args);
            } else if (action === 'deleteWizardChat') {
                try {
                    await interaction.channel.delete();
                } catch (e) {
                    interaction.reply({ content: 'Erro ao deletar canal. Exclua-o manualmente.', ephemeral: true }).catch(()=>{});
                }
            }
        } else if (interaction.isStringSelectMenu()) {
             const [action, ...args] = interaction.customId.split('_');
             if (action === 'editPanelMenu') {
                  const handler = require('../interactions/selectMenus/editPanel.js');
                  await handler.execute(interaction, args);
             } else if (action === 'deletePanelMenu') {
                  const handler = require('../interactions/selectMenus/deletePanel.js');
                  await handler.execute(interaction, args);
             }
        } else if (interaction.isModalSubmit()) {
            const [action, ...args] = interaction.customId.split('_');
             if (action === 'editPanelModal') {
                 const handler = require('../interactions/modals/editPanel.js');
                 await handler.execute(interaction, args);
             } else if (action === 'createTicketModal') {
                 const handler = require('../interactions/modals/createTicket.js');
                 await handler.execute(interaction, args);
             } else if (action === 'configModal') {
                 const handler = require('../interactions/modals/configModal.js');
                 await handler.execute(interaction, args);
             }
        } else if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) return;

            try {
                if (command.autocomplete) {
                    await command.autocomplete(interaction);
                }
            } catch (error) {
                console.error(error);
            }
        }
    },
};
