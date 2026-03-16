const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getQuery, runQuery } = require('../../db/database');

module.exports = {
    async execute(interaction, args) {
        const panelId = interaction.values ? interaction.values[0] : args[0];

        const panel = await getQuery(`SELECT * FROM ticket_panels WHERE id = ?`, [panelId]);

        if (!panel) {
            return interaction.reply({ content: 'Este painel não foi encontrado. Talvez ele tenha sido apagado.', ephemeral: true });
        }

        const tempJson = interaction.client.tempJson.get(interaction.user.id);
        if (tempJson) {
            await runQuery(`UPDATE ticket_panels SET initial_embed = ? WHERE id = ?`, [tempJson, panel.id]);
            panel.initial_embed = tempJson;
            interaction.client.tempJson.delete(interaction.user.id);
        }

        const embed = new EmbedBuilder()
            .setTitle(`🔧 Configurações: ${panel.name}`)
            .setDescription(`**ID:** ${panel.id}\n**Canal Vinculado:** <#${panel.channel_id}>\n\n**O que você deseja editar?**`)
            .addFields(
                { name: 'Formato de Nome', value: `\`${panel.channel_name_format || '{dd}-timecreated-{username}'}\``, inline: true },
                { name: 'Cooldown', value: `${panel.cooldown} segundos`, inline: true },
                { name: 'Categoria Destino', value: panel.category_id ? `<#${panel.category_id}>` : '🔴 Nenhuma', inline: true },
                { name: 'Embed Inicial (.json)', value: panel.initial_embed ? '🟢 Sim' : '🔴 Padrão (Amarelo)', inline: true },
                { name: 'Ocultar Ticket', value: panel.hide_from_users ? '🟢 Sim' : '🔴 Não', inline: true },
                { name: 'Feedback (Sim/Não)', value: panel.feedback_enabled ? '🟢 Sim' : '🔴 Não', inline: true },
                { name: 'User Pode Fechar', value: panel.user_can_close ? '🟢 Sim' : '🔴 Somente Admin', inline: true },
                { name: 'Cargos (JSON)', value: panel.permissions === '[]' ? 'Nenhum' : `\`${panel.permissions}\``, inline: true }
            )
            .setColor(0xFFD700);

        const row1 = new ActionRowBuilder().addComponents(
             new ButtonBuilder().setCustomId(`configBtn_nameFormat_${panel.id}`).setLabel('Formato do Nome').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
             new ButtonBuilder().setCustomId(`configBtn_initMsg_${panel.id}`).setLabel('Mensagem (Txt)').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
             new ButtonBuilder().setCustomId(`configBtn_category_${panel.id}`).setLabel('ID Categoria').setStyle(ButtonStyle.Secondary).setEmoji('📁'),
             new ButtonBuilder().setCustomId(`configBtn_roles_${panel.id}`).setLabel('Cargos (IDs)').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
             new ButtonBuilder().setCustomId(`configBtn_cooldown_${panel.id}`).setLabel('Cooldown').setStyle(ButtonStyle.Secondary).setEmoji('⏱️')
        );

        const row2 = new ActionRowBuilder().addComponents(
             new ButtonBuilder().setCustomId(`configBtn_jsonUpload_${panel.id}`).setLabel('Embed Inicial (JSON)').setStyle(ButtonStyle.Primary).setEmoji('📎'),
             new ButtonBuilder().setCustomId(`configToggle_hide_${panel.id}`).setLabel('Alternar Ocultar').setStyle(panel.hide_from_users ? ButtonStyle.Success : ButtonStyle.Danger),
             new ButtonBuilder().setCustomId(`configToggle_feedback_${panel.id}`).setLabel('Alternar Feedback').setStyle(panel.feedback_enabled ? ButtonStyle.Success : ButtonStyle.Danger),
             new ButtonBuilder().setCustomId(`configToggle_userclose_${panel.id}`).setLabel('Alternar Fechamento').setStyle(panel.user_can_close ? ButtonStyle.Success : ButtonStyle.Danger),
             new ButtonBuilder().setCustomId(`configToggle_rmEmbed_${panel.id}`).setLabel('Remover Embed Json').setStyle(ButtonStyle.Danger)
        );

        if (interaction.isButton()) {
             await interaction.update({ embeds: [embed], components: [row1, row2] });
        } else {
             await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
        }
    }
};
