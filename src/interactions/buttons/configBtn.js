const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getQuery } = require('../../db/database');

module.exports = {
    async execute(interaction, args) {
        
        const type = args[0];
        const panelId = args[1];

        const panel = await getQuery(`SELECT * FROM ticket_panels WHERE id = ?`, [panelId]);
        if (!panel) return interaction.reply({ content: 'Painel não encontrado.', ephemeral: true });

        const modal = new ModalBuilder()
            .setCustomId(`configModal_${type}_${panel.id}`);

        let input;

        if (type === 'nameFormat') {
            modal.setTitle('Editar Formato de Nome');
            input = new TextInputBuilder()
                .setCustomId('value')
                .setLabel('Formato (ex: {dd}-{username})')
                .setStyle(TextInputStyle.Short)
                .setValue(panel.channel_name_format || '{dd}-timecreated-{username}')
                .setRequired(true);
        } else if (type === 'initMsg') {
            modal.setTitle('Editar Mensagem Inicial');
            input = new TextInputBuilder()
                .setCustomId('value')
                .setLabel('Mensagem (Use {username} etc)')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(panel.initial_message || 'Olá {username}, informe seu problema!')
                .setRequired(false);
        } else if (type === 'cooldown') {
            modal.setTitle('Editar Cooldown');
            input = new TextInputBuilder()
                .setCustomId('value')
                .setLabel('Cooldown em Segundos (0 para nenhum)')
                .setStyle(TextInputStyle.Short)
                .setValue(panel.cooldown.toString())
                .setRequired(true);
        } else if (type === 'category') {
            modal.setTitle('Editar Categoria do Ticket');
            input = new TextInputBuilder()
                .setCustomId('value')
                .setLabel('ID da Categoria (opcional)')
                .setStyle(TextInputStyle.Short)
                .setValue(panel.category_id || '')
                .setRequired(false);
        } else if (type === 'roles') {
            modal.setTitle('Editar Cargos de Acesso');
            input = new TextInputBuilder()
                .setCustomId('value')
                .setLabel('IDs dos Cargos separados por vírgula')
                .setStyle(TextInputStyle.Short)
                .setValue(panel.permissions === '[]' ? '' : JSON.parse(panel.permissions).join(','))
                .setRequired(false);
        } else if (type === 'jsonUpload') {
            await interaction.reply({
                content: '📎 **Por favor, envie o arquivo `.json` neste chat agora.** Você tem 60 segundos, nya!.\n*(A mensagem original do arquivo será apagada após o sucesso)*',
                ephemeral: true
            });

            const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
            const collector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

            collector.on('collect', async m => {
                const attachment = m.attachments.first();
                if (!attachment.name.endsWith('.json')) {
                    interaction.followUp({ content: 'O arquivo enviado não é um `.json`. Você é burro, nya?.', ephemeral: true });
                    return;
                }

                try {
                    const response = await fetch(attachment.url);
                    const jsonRaw = await response.json();
                    const { cleanEmpty } = require('../../utils/json_cleaner');
                    const embedData = cleanEmpty(jsonRaw);
                    const tempJsonStr = JSON.stringify(embedData);

                    const { runQuery } = require('../../db/database');
                    await runQuery(`UPDATE ticket_panels SET initial_embed = ? WHERE id = ?`, [tempJsonStr, panel.id]);

                    await m.delete().catch(() => { });

                    await interaction.followUp({ content: '✅ Embed Inicial salvo com sucesso no painel!', ephemeral: true });

                    const editMenuHandler = require('../selectMenus/editPanel.js');

                } catch (e) {
                    await interaction.followUp({ content: 'Erro ao analisar o JSON Inicial. Arquivo malformado...', ephemeral: true });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.followUp({ content: 'Tempo esgotado, nya. Tente clicar no botão novamente.', ephemeral: true });
                }
            });

            return; 
        }

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        await interaction.showModal(modal);
    }
};
